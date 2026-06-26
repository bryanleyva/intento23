'use server';

import { doc, loadDoc } from '@/lib/google-sheets';
import { UserCache } from '@/lib/user-cache';

export interface EjecutivoMensual {
    ejecutivo: string;
    /** 12 posiciones (ene..dic) con el total de LÍNEAS de ventas ACTIVADO. */
    meses: number[];
    total: number;
}

function parseFecha(raw: string): Date | null {
    if (!raw) return null;
    const datePart = String(raw).split(',')[0].trim();
    const parts = datePart.split('/');
    if (parts.length < 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month - 1, day);
}

function toLineas(raw: any): number {
    if (raw == null) return 0;
    const n = parseInt(String(raw).replace(/[^\d-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
}

function norm(s: any): string {
    return String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Comparativa mensual de LÍNEAS vendidas (estado ACTIVADO) por ejecutivo,
 * SOLO para ejecutivos con ROL = STANDAR (cruzando VENTAS con USUARIOS).
 * Por defecto toma el año en curso.
 */
export async function getVentasStandardMensual(
    year?: number
): Promise<{ success: boolean; data?: EjecutivoMensual[]; year?: number; error?: string }> {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle['VENTAS'];
        if (!sheet) return { success: false, error: 'Hoja VENTAS no encontrada' };

        const targetYear = year ?? new Date().getFullYear();

        // Mapa nombre/usuario -> ROL desde USUARIOS (clave normalizada).
        const userCache = UserCache.getInstance();
        await userCache.ensureInitialized();
        const rolByName = new Map<string, string>();
        for (const u of userCache.getAll()) {
            const rol = norm(u.get('ROL'));
            const nombres = norm(u.get('NOMBRES COMPLETOS'));
            const user = norm(u.get('USER'));
            if (nombres) rolByName.set(nombres, rol);
            if (user) rolByName.set(user, rol);
        }

        const rows = await sheet.getRows();

        // Acumula líneas por ejecutivo (clave normalizada) y mes.
        const acc = new Map<string, { display: string; meses: number[] }>();

        for (const row of rows) {
            if (norm(row.get('ESTADO')) !== 'ACTIVADO') continue;

            const ejecutivoRaw = row.get('EJECUTIVO') || '';
            const key = norm(ejecutivoRaw);
            if (!key) continue;

            // Solo ejecutivos con ROL STANDAR.
            if (rolByName.get(key) !== 'STANDAR') continue;

            const fecha = parseFecha(row.get('FECHA ACTIVACION') || row.get('FECHA FIN') || row.get('FECHA INICIO') || '');
            if (!fecha || fecha.getFullYear() !== targetYear) continue;

            let entry = acc.get(key);
            if (!entry) {
                entry = { display: String(ejecutivoRaw).trim(), meses: new Array(12).fill(0) };
                acc.set(key, entry);
            }
            entry.meses[fecha.getMonth()] += toLineas(row.get('CANTIDAD LINEAS'));
        }

        const data: EjecutivoMensual[] = Array.from(acc.values())
            .map(e => ({ ejecutivo: e.display, meses: e.meses, total: e.meses.reduce((a, b) => a + b, 0) }))
            .sort((a, b) => a.ejecutivo.localeCompare(b.ejecutivo, 'es'));

        return { success: true, data, year: targetYear };
    } catch (error) {
        console.error('Error in getVentasStandardMensual:', error);
        return { success: false, error: 'Error al generar el reporte' };
    }
}
