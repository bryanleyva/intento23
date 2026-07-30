'use server';

import { doc, loadDoc } from '@/lib/google-sheets';
import { UserCache } from '@/lib/user-cache';
import type { PlantillaRow } from '@/lib/plantilla-ventas';

function norm(s: any): string {
    return String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function parseFechaParts(raw: string): { d: number; m: number; y: number } | null {
    if (!raw) return null;
    const datePart = String(raw).split(',')[0].trim();
    const parts = datePart.split('/');
    if (parts.length < 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    return { d, m, y };
}

// FECHA de la plantilla en formato ISO (YYYY-MM-DD).
function toISO(raw: string): string {
    const p = parseFechaParts(raw);
    if (!p) return '';
    return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

// Mes/año en que cuenta la venta: prioriza FECHA PERIODO (MM/YYYY), como el linker.
function resolvePeriodo(row: any): { year: number; month: number } | null {
    const fp = String(row.get('FECHA PERIODO') || '').trim();
    if (fp) {
        const parts = fp.split('/').map((x: string) => x.trim());
        if (parts.length === 2) {
            const m = parseInt(parts[0], 10);
            const y = parseInt(parts[1], 10);
            if (!isNaN(m) && !isNaN(y) && m >= 1 && m <= 12) return { year: y, month: m };
        }
        if (parts.length === 3) {
            const m = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            if (!isNaN(m) && !isNaN(y) && m >= 1 && m <= 12) return { year: y, month: m };
        }
    }
    const p = parseFechaParts(row.get('FECHA ACTIVACION') || row.get('FECHA FIN') || row.get('FECHA INICIO') || '');
    if (p) return { year: p.y, month: p.m };
    return null;
}

/**
 * Devuelve todas las ventas en estado ACTIVADO (hoja VENTAS, columna ESTADO)
 * del mes/año elegido, mapeadas al formato de la plantilla erpviernes.
 * Lo que no exista queda en blanco.
 */
export async function getVentasActivadasPlantilla(
    month: number,
    year: number
): Promise<{ success: boolean; data?: PlantillaRow[]; error?: string }> {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle['VENTAS'];
        if (!sheet) return { success: false, error: 'Hoja VENTAS no encontrada' };

        // USUARIOS: nombre/usuario -> { dni, campaña } para llenar DNI y equipo.
        const userCache = UserCache.getInstance();
        await userCache.ensureInitialized();
        const infoByName = new Map<string, { dni: string; campana: string }>();
        for (const u of userCache.getAll()) {
            const info = {
                dni: String(u.get('DNI') || '').trim(),
                campana: String(u.get('CAMPAÑA') || u.get('CAMPANA') || '').trim(),
            };
            const nombres = norm(u.get('NOMBRES COMPLETOS'));
            const user = norm(u.get('USER'));
            if (nombres) infoByName.set(nombres, info);
            if (user) infoByName.set(user, info);
        }

        const rows = await sheet.getRows();
        const data: PlantillaRow[] = [];

        for (const row of rows) {
            if (norm(row.get('ESTADO')) !== 'ACTIVADO') continue;

            const per = resolvePeriodo(row);
            if (!per || per.year !== year || per.month !== month) continue;

            const ejecutivo = String(row.get('EJECUTIVO') || '').trim();
            const supervisor = String(row.get('SUPERVISOR') || '').trim();
            const infoEje = infoByName.get(norm(ejecutivo));
            const infoSup = infoByName.get(norm(supervisor));

            const ruc = String(row.get('RUC') || '').trim();
            const docId = ruc || String(row.get('DOCUMENTO IDENTIDAD') || '').trim();

            data.push({
                fecha: toISO(row.get('FECHA ACTIVACION') || row.get('FECHA FIN') || row.get('FECHA INICIO') || ''),
                cliente: String(row.get('RAZON SOCIAL') || '').trim(),
                doc: docId,
                canal: String(row.get('SEGMENTO') || '').trim(),
                plan: String(row.get('DETALLE') || row.get('PRODUCTO') || '').trim(),
                tipo: String(row.get('TIPO DE VENTA') || '').trim(),
                lineas: String(row.get('CANTIDAD LINEAS') || '').trim(),
                cargo: String(row.get('CF TOTAL') || '').trim(),
                direccion: String(row.get('DIRECCION') || '').trim(),
                sr: String(row.get('SR DE INGRESO') || '').trim(),
                nro_orden: String(row.get('NUMERO DE ORDEN') || '').trim(),
                oit: '',
                vendedor_dni: infoEje?.dni || '',
                vendedor: ejecutivo,
                supervisor_dni: infoSup?.dni || '',
                supervisor,
                equipo: infoEje?.campana || '',
                estado: 'activado',
            });
        }

        data.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

        return { success: true, data };
    } catch (error) {
        console.error('Error in getVentasActivadasPlantilla:', error);
        return { success: false, error: 'Error al generar la data de la plantilla' };
    }
}
