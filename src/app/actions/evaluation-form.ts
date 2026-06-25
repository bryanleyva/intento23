'use server';

import { doc, loadDoc } from '@/lib/google-sheets';
import { getSheetHeaders, getSurveyFields, METADATA_HEADERS } from '@/lib/survey-config';

const SHEET_NAME = 'RESPUESTAS_FORMULARIO2';

const SHEET_HEADERS = getSheetHeaders();

export interface EvaluationFormData {
    dni: string;
    usuario: string;
    /** Respuestas de la encuesta, indexadas por la `key` de cada pregunta. */
    answers: Record<string, string>;
}

async function getOrCreateSheet() {
    await loadDoc();
    let sheet = doc.sheetsByTitle[SHEET_NAME];
    if (!sheet) {
        sheet = await doc.addSheet({ title: SHEET_NAME, headerValues: SHEET_HEADERS });
        return sheet;
    }

    const rows = await sheet.getRows(); // carga headerValues
    const existing = sheet.headerValues || [];

    // Si la hoja todavía no tiene respuestas, fijamos los encabezados canónicos.
    // Esto corrige cualquier encabezado mal escrito o desordenado ANTES de que
    // haya datos, garantizando que cada respuesta caiga en su columna correcta.
    if (rows.length === 0) {
        const sameHeaders =
            existing.length === SHEET_HEADERS.length &&
            existing.every((h, i) => h === SHEET_HEADERS[i]);
        if (!sameHeaders) {
            await sheet.setHeaderRow(SHEET_HEADERS);
        }
        return sheet;
    }

    // Con datos existentes, solo agregamos columnas faltantes (sin reordenar,
    // para no desalinear las filas ya guardadas).
    const missing = SHEET_HEADERS.filter(h => !existing.includes(h));
    if (missing.length > 0) {
        await sheet.setHeaderRow([...existing, ...missing]);
    }
    return sheet;
}

/**
 * Devuelve true si el DNI dado ya envió la encuesta.
 * Se usa para mostrar el formulario una sola vez por persona.
 */
export async function hasSubmittedEvaluation(dni: string): Promise<boolean> {
    if (!dni) return false;
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle[SHEET_NAME];
        if (!sheet) return false; // hoja aún no creada → nadie ha enviado
        const rows = await sheet.getRows();
        const target = dni.trim();
        return rows.some(r => (r.get('DNI') || '').trim() === target);
    } catch (e) {
        console.error('hasSubmittedEvaluation error:', e);
        // Fail-open ante errores de lectura para no bloquear el formulario.
        return false;
    }
}

/** Convierte las respuestas crudas en un objeto fila listo para la hoja. */
function buildRow(data: EvaluationFormData): Record<string, string> {
    const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    const a = data.answers || {};

    const row: Record<string, string> = {
        [METADATA_HEADERS[0]]: now,            // FECHA_ENVIO
        [METADATA_HEADERS[1]]: data.dni || '', // DNI
        [METADATA_HEADERS[2]]: data.usuario || '', // USUARIO
    };

    for (const field of getSurveyFields()) {
        let value = a[field.key] ?? '';
        // Preguntas de opción con "Otra": guarda el texto libre cuando aplica.
        if (field.otherKey && value === 'Otra') {
            value = a[field.otherKey] || 'Otra';
        }
        row[field.header] = value != null ? String(value) : '';
    }

    return row;
}

/**
 * Agrega una respuesta de la encuesta a RESPUESTAS_FORMULARIO2.
 * Idempotente por persona: si el DNI ya tiene fila, no se duplica.
 */
export async function submitEvaluationForm(
    data: EvaluationFormData
): Promise<{ success: boolean; error?: string }> {
    try {
        const answers = data.answers || {};
        const hasAnything = Object.values(answers).some(v => (v ?? '').toString().trim() !== '');
        if (!hasAnything) {
            return { success: false, error: 'Responde al menos una pregunta antes de enviar.' };
        }

        const sheet = await getOrCreateSheet();
        const rows = await sheet.getRows();

        // Evita doble envío para la misma persona.
        if (data.dni) {
            const already = rows.some(r => (r.get('DNI') || '').trim() === data.dni.trim());
            if (already) {
                return { success: true };
            }
        }

        await sheet.addRow(buildRow(data));

        return { success: true };
    } catch (e: any) {
        console.error('submitEvaluationForm error:', e);
        const detail = e?.message || String(e);
        return { success: false, error: `Error al guardar: ${detail}` };
    }
}
