'use server';

import { doc, loadDoc } from '@/lib/google-sheets';
import { UserCache } from '@/lib/user-cache';

export interface MesColumna {
    label: string; // p.ej. "ENERO 2026"
    year: number;
    month: number; // 1-12
}

export interface EjecutivoMensual {
    ejecutivo: string;
    /** Total de LÍNEAS por mes, alineado al orden de `columnas`. */
    valores: number[];
    total: number;
}

const MESES = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

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
 * Comparativa de LÍNEAS vendidas (estado ACTIVADO) por ejecutivo de ROL STANDAR,
 * en una ventana de meses que TERMINA en (endMonth/endYear) e incluye `months`
 * meses hacia atrás (por defecto 7: el mes elegido + los 6 anteriores).
 * La ventana cruza el cambio de año sin problema.
 */
export async function getVentasStandardMensual(
    opts?: { endYear?: number; endMonth?: number; months?: number }
): Promise<{
    success: boolean;
    data?: EjecutivoMensual[];
    columnas?: MesColumna[];
    diag?: { activado: number; standar: number; enVentana: number };
    error?: string;
}> {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle['VENTAS'];
        if (!sheet) return { success: false, error: 'Hoja VENTAS no encontrada' };

        const now = new Date();
        const endYear = opts?.endYear ?? now.getFullYear();
        const endMonth = opts?.endMonth ?? (now.getMonth() + 1);
        const months = Math.max(1, Math.min(24, opts?.months ?? 7));

        // Ventana de meses (de más antiguo a más reciente).
        const columnas: MesColumna[] = [];
        {
            let y = endYear;
            let m = endMonth;
            for (let i = 0; i < months; i++) {
                columnas.unshift({ label: `${MESES[m - 1]} ${y}`, year: y, month: m });
                m--;
                if (m < 1) { m = 12; y--; }
            }
        }
        const indexByKey = new Map<string, number>();
        columnas.forEach((c, i) => indexByKey.set(`${c.year}-${c.month}`, i));

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
        const acc = new Map<string, { display: string; valores: number[] }>();
        const diag = { activado: 0, standar: 0, enVentana: 0 };

        for (const row of rows) {
            if (norm(row.get('ESTADO')) !== 'ACTIVADO') continue;
            diag.activado++;

            const ejecutivoRaw = row.get('EJECUTIVO') || '';
            const key = norm(ejecutivoRaw);
            if (!key) continue;

            // Solo ROL STANDAR (acepta también "STANDARD").
            const rol = rolByName.get(key) || '';
            if (!rol.startsWith('STANDAR')) continue;
            diag.standar++;

            const fecha = parseFecha(row.get('FECHA ACTIVACION') || row.get('FECHA FIN') || row.get('FECHA INICIO') || '');
            if (!fecha) continue;

            const idx = indexByKey.get(`${fecha.getFullYear()}-${fecha.getMonth() + 1}`);
            if (idx === undefined) continue; // fuera de la ventana
            diag.enVentana++;

            let entry = acc.get(key);
            if (!entry) {
                entry = { display: String(ejecutivoRaw).trim(), valores: new Array(months).fill(0) };
                acc.set(key, entry);
            }
            entry.valores[idx] += toLineas(row.get('CANTIDAD LINEAS'));
        }

        const data: EjecutivoMensual[] = Array.from(acc.values())
            .map(e => ({ ejecutivo: e.display, valores: e.valores, total: e.valores.reduce((a, b) => a + b, 0) }))
            .sort((a, b) => a.ejecutivo.localeCompare(b.ejecutivo, 'es'));

        return { success: true, data, columnas, diag };
    } catch (error) {
        console.error('Error in getVentasStandardMensual:', error);
        return { success: false, error: 'Error al generar el reporte' };
    }
}
