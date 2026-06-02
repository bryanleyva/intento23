'use server';

import { doc, loadDoc } from '@/lib/google-sheets';

export interface ReporteRow {
    id: string;
    ruc: string;
    razonSocial: string;
    ejecutivo: string;
    supervisor: string;
    segmento: string;
    lineas: string;
    cargoFijo: string;
    descuento: string;
    contacto: string;
    telefono: string;
    correo: string;
    departamento: string;
    provincia: string;
    distrito: string;
    direccion: string;
    dni: string;
    proceso: string;
    detalle: string;
    fechaActivacion: string;
    fechaPeriodo: string;
    fechaInicio: string;
    fechaFin: string;
    srIngreso: string;
    numOrden: string;
    operador: string;
    estado: string;
}

function parseDate(raw: string): Date | null {
    if (!raw) return null;
    const datePart = raw.split(',')[0].trim();
    const parts = datePart.split('/');
    if (parts.length < 3) return null;
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month - 1, day);
}

/**
 * Returns all ACTIVADO rows from VENTAS.
 * - If month and year are provided, filters by that month (using FECHA ACTIVACION, fallback FECHA FIN).
 * - If neither is provided, returns all ACTIVADO rows (general report).
 * - No deduplication — every activation row is included.
 */
export async function getPostVentaReporteData(
    month?: number,
    year?: number
): Promise<{ success: boolean; data?: ReporteRow[]; error?: string }> {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle['VENTAS'];
        if (!sheet) return { success: false, error: 'Hoja VENTAS no encontrada' };

        const rows = await sheet.getRows();

        const filtered = rows.filter(row => {
            const estado = (row.get('ESTADO') || '').trim().toUpperCase();
            if (estado !== 'ACTIVADO') return false;

            if (month !== undefined && year !== undefined) {
                const rawFecha = row.get('FECHA ACTIVACION') || row.get('FECHA FIN') || row.get('FECHA INICIO') || '';
                const date = parseDate(rawFecha);
                if (!date) return false;
                return date.getMonth() + 1 === month && date.getFullYear() === year;
            }

            return true;
        });

        const data: ReporteRow[] = filtered.map(row => ({
            id: row.get('ID') || '',
            ruc: String(row.get('RUC') || '').trim(),
            razonSocial: row.get('RAZON SOCIAL') || '',
            ejecutivo: row.get('EJECUTIVO') || '',
            supervisor: row.get('SUPERVISOR') || '',
            segmento: row.get('SEGMENTO') || '',
            lineas: row.get('CANTIDAD LINEAS') || '',
            cargoFijo: row.get('CF TOTAL') || '',
            descuento: row.get('DESCUENTO') || '',
            contacto: row.get('REPRESENTANTE LEGAL') || '',
            telefono: row.get('TELEFONO') || '',
            correo: row.get('CORREO') || '',
            departamento: row.get('DEPARTAMENTO') || '',
            provincia: row.get('PROVINCIA') || '',
            distrito: row.get('DISTRITO') || '',
            direccion: row.get('DIRECCION') || '',
            dni: row.get('DOCUMENTO IDENTIDAD') || '',
            proceso: row.get('PROCESO') || '',
            detalle: row.get('DETALLE') || '',
            fechaActivacion: row.get('FECHA ACTIVACION') || '',
            fechaPeriodo: row.get('FECHA PERIODO') || '',
            fechaInicio: row.get('FECHA INICIO') || '',
            fechaFin: row.get('FECHA FIN') || '',
            srIngreso: row.get('SR DE INGRESO') || '',
            numOrden: row.get('NUMERO DE ORDEN') || '',
            operador: row.get('OPERADOR') || '',
            estado: row.get('ESTADO') || '',
        }));

        // Sort by ID ascending (oldest first)
        data.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

        return { success: true, data };
    } catch (error) {
        console.error('Error in getPostVentaReporteData:', error);
        return { success: false, error: 'Error al generar el reporte' };
    }
}
