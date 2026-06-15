import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export interface UserRow {
    DNI: string;
    'NOMBRES COMPLETOS': string;
    USER: string;
    CLAVE: string;
    ROL: 'ADMIN' | 'SPECIAL' | 'STANDAR' | 'BACKOFFICE' | 'ANDREA';
    CARGO?: string;
    SUPERVISOR?: string;
    TELEFONO: string;
    SESSION_TOKEN?: string;
    FOTO?: string;
    'CAMPAÑA'?: string;   // ← columna real del Sheets
}

export interface BaseRow {
    [key: string]: any;
}

const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '')
    : undefined;

const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
    ],
});

export const auth = serviceAccountAuth;
export const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID || '', serviceAccountAuth);

let lastDocLoad = 0;
const DOC_CACHE_TTL = 10000;

export async function loadDoc() {
    const now = Date.now();
    if (now - lastDocLoad < DOC_CACHE_TTL) return;

    let retries = 3;
    while (retries > 0) {
        try {
            await doc.loadInfo();
            lastDocLoad = Date.now();
            return;
        } catch (e) {
            retries--;
            console.warn(`loadDoc failed, retries left: ${retries}`, e);
            if (retries === 0) throw e;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

import { UserCache } from './user-cache';

export async function getUserByCredentials(username: string, password: string): Promise<UserRow | null> {
    const cache = UserCache.getInstance();
    await cache.ensureInitialized();

    await loadDoc();
    const sheet = doc.sheetsByTitle['USUARIOS'];
    if (!sheet) throw new Error('Hoja USUARIOS no encontrada');
    const rows = await sheet.getRows();

    const userRow = rows.find(row => row.get('USER') === username && row.get('CLAVE') === password);
    if (!userRow) return null;

    const newToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    userRow.set('SESSION_TOKEN', newToken);
    await userRow.save();

    await cache.refresh();

    return {
        DNI: userRow.get('DNI'),
        'NOMBRES COMPLETOS': userRow.get('NOMBRES COMPLETOS'),
        USER: userRow.get('USER'),
        CLAVE: userRow.get('CLAVE'),
        ROL: userRow.get('ROL') as any,
        CARGO: userRow.get('CARGO'),
        SUPERVISOR: userRow.get('SUPERVISOR'),
        TELEFONO: userRow.get('TELEFONO'),
        SESSION_TOKEN: newToken,
        FOTO: userRow.get('FOTO'),
        'CAMPAÑA': userRow.get('CAMPAÑA') || '',  // ← nombre exacto de la columna
    };
}

export async function checkSessionToken(username: string, token: string): Promise<boolean> {
    const cache = UserCache.getInstance();
    await cache.ensureInitialized();

    const userRow = cache.findUser(username);
    // Fail-open: if user not found it's likely a transient API/cache issue, not a revocation.
    // Only close the session when the token is explicitly empty (account disabled/kicked).
    if (!userRow) return true;

    const currentToken = userRow.get('SESSION_TOKEN');
    // Empty token = account explicitly disabled or kicked out
    if (!currentToken) return false;
    return currentToken === token;
}