'use server';

import { doc, loadDoc } from '@/lib/google-sheets';

const SHEET_NAME = 'POSTVENTA_SEGUIMIENTO';

const SHEET_HEADERS = [
    'ID', 'RUC', 'RAZON SOCIAL', 'TELEFONO', 'EJECUTIVO ORIGINAL',
    'LINEAS', 'CARGO FIJO', 'SEGMENTO', 'SR_INGRESO', 'NUM_ORDEN', 'OBSERVACION',
    'ESTADO', 'MOTIVO', 'SUBMOTIVO', 'EVIDENCIA_IDS', 'USUARIO', 'FECHA',
];

export interface PostVentaObservacion {
    id: string;
    ruc: string;
    razonSocial: string;
    telefono: string;
    ejecutivoOriginal: string;
    lineas: string;
    cargoFijo: string;
    segmento: string;
    srIngreso: string;
    numOrden: string;
    observacion: string;
    estado: string;
    motivo: string;
    submotivo: string;
    evidenciaIds: string; // comma-separated Drive file IDs
    usuario: string;
    fecha: string;
}

function mapRow(r: any): PostVentaObservacion {
    return {
        id: r.get('ID') || '',
        ruc: r.get('RUC') || '',
        razonSocial: r.get('RAZON SOCIAL') || '',
        telefono: r.get('TELEFONO') || '',
        ejecutivoOriginal: r.get('EJECUTIVO ORIGINAL') || '',
        lineas: r.get('LINEAS') || '',
        cargoFijo: r.get('CARGO FIJO') || '',
        segmento: r.get('SEGMENTO') || '',
        srIngreso: r.get('SR_INGRESO') || '',
        numOrden: r.get('NUM_ORDEN') || '',
        observacion: r.get('OBSERVACION') || '',
        estado: r.get('ESTADO') || '',
        motivo: r.get('MOTIVO') || '',
        submotivo: r.get('SUBMOTIVO') || '',
        evidenciaIds: r.get('EVIDENCIA_IDS') || '',
        usuario: r.get('USUARIO') || '',
        fecha: r.get('FECHA') || '',
    };
}

async function getOrCreateSheet() {
    await loadDoc();
    let sheet = doc.sheetsByTitle[SHEET_NAME];
    if (!sheet) {
        sheet = await doc.addSheet({ title: SHEET_NAME, headerValues: SHEET_HEADERS });
        return sheet;
    }
    // Ensure new columns exist on existing sheets
    await sheet.getRows(); // loads headerValues
    const existing = sheet.headerValues || [];
    const missing = SHEET_HEADERS.filter(h => !existing.includes(h));
    if (missing.length > 0) {
        await sheet.setHeaderRow([...existing, ...missing]);
    }
    return sheet;
}

// ─── GUARDAR OBSERVACIÓN ──────────────────────────────────────────────────────
export async function savePostVentaObservacion(data: {
    ruc: string;
    razonSocial: string;
    telefono: string;
    ejecutivoOriginal: string;
    lineas: string;
    cargoFijo: string;
    segmento: string;
    srIngreso?: string;
    numOrden?: string;
    observacion: string;
    estado: string;
    motivo?: string;
    submotivo?: string;
    evidenciaIds?: string;
    usuario: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const sheet = await getOrCreateSheet();
        const rows = await sheet.getRows();
        const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

        // Upsert: update existing row for this RUC+usuario, otherwise create new
        const existing = rows.find(r =>
            (r.get('RUC') || '').trim() === data.ruc.trim() &&
            (r.get('USUARIO') || '').trim().toLowerCase() === data.usuario.trim().toLowerCase()
        );

        if (existing) {
            existing.set('TELEFONO', data.telefono);
            existing.set('EJECUTIVO ORIGINAL', data.ejecutivoOriginal);
            existing.set('LINEAS', data.lineas);
            existing.set('CARGO FIJO', data.cargoFijo);
            existing.set('SEGMENTO', data.segmento);
            existing.set('SR_INGRESO', data.srIngreso || '');
            existing.set('NUM_ORDEN', data.numOrden || '');
            existing.set('OBSERVACION', data.observacion);
            existing.set('ESTADO', data.estado);
            existing.set('MOTIVO', data.motivo || '');
            existing.set('SUBMOTIVO', data.submotivo || '');
            existing.set('EVIDENCIA_IDS', data.evidenciaIds || '');
            existing.set('FECHA', now);
            await existing.save();
        } else {
            const ids = rows.map(r => parseInt(r.get('ID'))).filter(n => !isNaN(n));
            const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
            await sheet.addRow({
                'ID': nextId.toString(),
                'RUC': data.ruc,
                'RAZON SOCIAL': data.razonSocial,
                'TELEFONO': data.telefono,
                'EJECUTIVO ORIGINAL': data.ejecutivoOriginal,
                'LINEAS': data.lineas,
                'CARGO FIJO': data.cargoFijo,
                'SEGMENTO': data.segmento,
                'SR_INGRESO': data.srIngreso || '',
                'NUM_ORDEN': data.numOrden || '',
                'OBSERVACION': data.observacion,
                'ESTADO': data.estado,
                'MOTIVO': data.motivo || '',
                'SUBMOTIVO': data.submotivo || '',
                'EVIDENCIA_IDS': data.evidenciaIds || '',
                'USUARIO': data.usuario,
                'FECHA': now,
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Error en savePostVentaObservacion:', error);
        return { success: false, error: 'Error al guardar la observación' };
    }
}

// ─── ACTUALIZAR ESTADO DE UNA OBSERVACIÓN ────────────────────────────────────
export async function updatePostVentaObservacion(
    id: string,
    data: { estado?: string; motivo?: string; submotivo?: string; observacion?: string; evidenciaIds?: string }
): Promise<{ success: boolean; error?: string }> {
    try {
        const sheet = await getOrCreateSheet();
        const rows = await sheet.getRows();
        const row = rows.find(r => r.get('ID') === id);
        if (!row) return { success: false, error: 'Registro no encontrado' };
        if (data.estado !== undefined) row.set('ESTADO', data.estado);
        if (data.motivo !== undefined) row.set('MOTIVO', data.motivo);
        if (data.submotivo !== undefined) row.set('SUBMOTIVO', data.submotivo);
        if (data.observacion !== undefined) row.set('OBSERVACION', data.observacion);
        if (data.evidenciaIds !== undefined) row.set('EVIDENCIA_IDS', data.evidenciaIds);
        await row.save();
        return { success: true };
    } catch (error) {
        console.error('Error en updatePostVentaObservacion:', error);
        return { success: false, error: 'Error al actualizar' };
    }
}

// ─── OBTENER HISTORIAL DEL USUARIO ───────────────────────────────────────────
export async function getPostVentaHistorial(
    usuario: string
): Promise<{ success: boolean; data?: PostVentaObservacion[]; error?: string }> {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle[SHEET_NAME];
        if (!sheet) return { success: true, data: [] };

        const rows = await sheet.getRows();
        const data: PostVentaObservacion[] = rows
            .filter(r => (r.get('USUARIO') || '').trim().toLowerCase() === usuario.trim().toLowerCase())
            .map(mapRow)
            .reverse();

        return { success: true, data };
    } catch (error) {
        console.error('Error en getPostVentaHistorial:', error);
        return { success: false, error: 'Error al obtener el historial' };
    }
}

// ─── OBTENER HISTORIAL DE TODOS (para JEFE_BO) ───────────────────────────────
export async function getAllPostVentaHistorial(): Promise<{ success: boolean; data?: PostVentaObservacion[]; error?: string }> {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle[SHEET_NAME];
        if (!sheet) return { success: true, data: [] };

        const rows = await sheet.getRows();
        const data: PostVentaObservacion[] = rows.map(mapRow).reverse();
        return { success: true, data };
    } catch (error) {
        console.error('Error en getAllPostVentaHistorial:', error);
        return { success: false, error: 'Error al obtener el historial' };
    }
}
