'use server';

import { doc, loadDoc } from '@/lib/google-sheets';

export interface PostVentaRuc10Record {
    agente: string;
    ruc: string;
    idSolicitud: string;
    numOrden: string;
    nombres: string;
    tipoVenta: string;
    numPortar: string;
    modalidad: string;
    tipoEntrega: string;
    qLineas: string;
    cfCompleto: string;
    promocionOfrecida: string;
    cfFinalSinIgv: string;
    periodo: string;
}

export async function getPostVentaRuc10Data(): Promise<{ success: boolean; data?: PostVentaRuc10Record[]; error?: string }> {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle['POSTVENTA RUC 10'];
        if (!sheet) return { success: false, error: 'Hoja "POSTVENTA RUC 10" no encontrada en el Google Sheets' };

        const rows = await sheet.getRows();
        const data: PostVentaRuc10Record[] = rows
            .filter(row => (row.get('RUC') || '').trim() !== '')
            .map(row => ({
                agente: row.get('AGENTE') || '',
                ruc: (row.get('RUC') || '').trim(),
                idSolicitud: row.get('ID-SOLICITUD') || '',
                numOrden: row.get('N° ORDEN') || '',
                nombres: row.get('NOMBRES') || '',
                tipoVenta: row.get('TIPO VENTA') || '',
                numPortar: row.get('N° A PORTAR') || '',
                modalidad: row.get('MODALIDAD') || '',
                tipoEntrega: row.get('TIPO DE ENTREGA') || '',
                qLineas: row.get('Q LINEAS') || '',
                cfCompleto: row.get('CF COMPLETO') || '',
                promocionOfrecida: row.get('PROMOCION OFRCIDA') || '',
                cfFinalSinIgv: row.get('CF FINAL SIN IGV') || '',
                periodo: row.get('PERIODO') || '',
            }));

        return { success: true, data };
    } catch (error) {
        console.error('Error in getPostVentaRuc10Data:', error);
        return { success: false, error: 'Error al cargar datos de post venta RUC 10' };
    }
}
