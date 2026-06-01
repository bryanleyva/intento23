'use server';

import { doc, loadDoc } from '@/lib/google-sheets';
import { UserCache } from '@/lib/user-cache';

export type BaseType = 'RYDERS' | 'ESPECIAL' | 'LINDA';

export interface ExecutiveBaseAssignment {
    userName: string;
    fullName: string;
    cargo: string;
    rol: string;
    bases: BaseType[];
}

const ALL_BASES: BaseType[] = ['RYDERS', 'ESPECIAL', 'LINDA'];

function parseBases(str: string): BaseType[] {
    if (!str || !str.trim()) return ALL_BASES;
    const parsed = str.split(',').map(b => b.trim().toUpperCase()).filter(b => ALL_BASES.includes(b as BaseType)) as BaseType[];
    return parsed.length > 0 ? parsed : ALL_BASES;
}

export async function getUserBaseAssignments(): Promise<{ success: boolean; data?: ExecutiveBaseAssignment[]; error?: string }> {
    try {
        const userCache = UserCache.getInstance();
        await userCache.ensureInitialized();

        const data = userCache.getAll()
            .filter(u => (u.get('ROL') || '').trim().toUpperCase() !== 'ADMIN')
            .map(u => ({
                userName: u.get('USER') || '',
                fullName: u.get('NOMBRES COMPLETOS') || '',
                cargo: u.get('CARGO') || '',
                rol: u.get('ROL') || '',
                bases: parseBases(u.get('BASES') || ''),
            }));

        return { success: true, data };
    } catch (error) {
        console.error('Error in getUserBaseAssignments:', error);
        return { success: false, error: 'Error al cargar asignaciones de base' };
    }
}

export async function updateUserBaseAssignment(userName: string, bases: BaseType[]): Promise<{ success: boolean; error?: string }> {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle['USUARIOS'];
        if (!sheet) throw new Error('USUARIOS sheet not found');

        const rows = await sheet.getRows();
        const row = rows.find(r => (r.get('USER') || '').trim().toUpperCase() === userName.trim().toUpperCase());
        if (!row) return { success: false, error: 'Usuario no encontrado' };

        row.set('BASES', bases.join(','));
        await row.save();

        await UserCache.getInstance().refresh();
        return { success: true };
    } catch (error: any) {
        console.error('Error in updateUserBaseAssignment:', error);
        return { success: false, error: error.message || 'Error al actualizar bases' };
    }
}

export async function getUserBases(userName: string): Promise<BaseType[]> {
    try {
        const userCache = UserCache.getInstance();
        await userCache.ensureInitialized();
        const user = userCache.findUser(userName);
        if (!user) return ALL_BASES;
        return parseBases(user.get('BASES') || '');
    } catch {
        return ALL_BASES;
    }
}
