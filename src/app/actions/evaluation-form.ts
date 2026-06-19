'use server';

import { doc, loadDoc } from '@/lib/google-sheets';

const SHEET_NAME = 'RESPUESTAS_FORMULARI';

const SHEET_HEADERS = [
    'FECHA_ENVIO',
    'DNI',
    'USUARIO',
    'NOMBRE',
    'FECHA',
    'HORA_LLENADO',
    'SEGMENTO',
    'PRIMERA_GESTION',
    'LLAMADAS',
    'CONTACTOS',
    'PROSPECTOS',
    'COTIZACIONES',
    'VENTAS',
    'INCIDENCIAS',
    'TIEMPO_SIN_TRABAJAR',
    'AUTOEVALUACION',
    'COMENTARIO',
];

export interface EvaluationFormData {
    dni: string;
    usuario: string;
    nombre: string;
    fecha: string;
    hora: string;
    segmento: string;
    primeraGestion: string;
    llamadas: string;
    contactos: string;
    prospectos: string;
    cotizaciones: string;
    ventas: string;
    incidenciasTexto: string;
    tiempoSin: string;
    rating: number;
    comentario: string;
}

async function getOrCreateSheet() {
    await loadDoc();
    let sheet = doc.sheetsByTitle[SHEET_NAME];
    if (!sheet) {
        sheet = await doc.addSheet({ title: SHEET_NAME, headerValues: SHEET_HEADERS });
        return sheet;
    }
    // Ensure expected columns exist on pre-existing sheets
    await sheet.getRows(); // loads headerValues
    const existing = sheet.headerValues || [];
    const missing = SHEET_HEADERS.filter(h => !existing.includes(h));
    if (missing.length > 0) {
        await sheet.setHeaderRow([...existing, ...missing]);
    }
    return sheet;
}

/**
 * Returns true if the given DNI already submitted the evaluation form.
 * Used to ensure the form is shown only once per person.
 */
export async function hasSubmittedEvaluation(dni: string): Promise<boolean> {
    if (!dni) return false;
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle[SHEET_NAME];
        if (!sheet) return false; // sheet not created yet → nobody has submitted
        const rows = await sheet.getRows();
        const target = dni.trim();
        return rows.some(r => (r.get('DNI') || '').trim() === target);
    } catch (e) {
        console.error('hasSubmittedEvaluation error:', e);
        // Fail-open on read errors so we don't block the form on a transient API issue.
        return false;
    }
}

/**
 * Appends one evaluation-form response to RESPUESTAS_FORMULARIO.
 * Idempotent per person: if the DNI already has a row, it is not duplicated.
 */
export async function submitEvaluationForm(
    data: EvaluationFormData
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!data.nombre?.trim() || !data.fecha?.trim()) {
            return { success: false, error: 'Completa al menos Nombre y Fecha.' };
        }

        const sheet = await getOrCreateSheet();
        const rows = await sheet.getRows();

        // Guard against double submission for the same person.
        if (data.dni) {
            const already = rows.some(r => (r.get('DNI') || '').trim() === data.dni.trim());
            if (already) {
                return { success: true };
            }
        }

        const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

        await sheet.addRow({
            'FECHA_ENVIO': now,
            'DNI': data.dni || '',
            'USUARIO': data.usuario || '',
            'NOMBRE': data.nombre || '',
            'FECHA': data.fecha || '',
            'HORA_LLENADO': data.hora || '',
            'SEGMENTO': data.segmento || '',
            'PRIMERA_GESTION': data.primeraGestion || '',
            'LLAMADAS': data.llamadas || '',
            'CONTACTOS': data.contactos || '',
            'PROSPECTOS': data.prospectos || '',
            'COTIZACIONES': data.cotizaciones || '',
            'VENTAS': data.ventas || '',
            'INCIDENCIAS': data.incidenciasTexto || '',
            'TIEMPO_SIN_TRABAJAR': data.tiempoSin || '',
            'AUTOEVALUACION': data.rating ? String(data.rating) : '',
            'COMENTARIO': data.comentario || '',
        });

        return { success: true };
    } catch (e: any) {
        console.error('submitEvaluationForm error:', e);
        const detail = e?.message || String(e);
        return { success: false, error: `Error al guardar: ${detail}` };
    }
}
