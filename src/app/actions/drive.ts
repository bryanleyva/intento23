'use server';

import { google } from 'googleapis';
import { auth } from '@/lib/google-sheets';
import { Readable } from 'stream';

export async function uploadFileToDrive(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) {
            return { success: false, error: 'No se ha seleccionado ningún archivo.' };
        }

        // Initialize Drive API
        const drive = google.drive({ version: 'v3', auth });

        // Create a readable stream from the file buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        // Check folder access first
        const folderId = '13UpUfdlB6jr2vECjNuBP89N8IUvauDWN';
        try {
            const folder = await drive.files.get({
                fileId: folderId,
                fields: 'id, name, capabilities',
                supportsAllDrives: true
            });

            if (!folder.data.capabilities?.canAddChildren) {
                return { success: false, error: 'El robot tiene acceso de LECTURA pero no puede ESCRIBIR. Por favor cambie el permiso a "Editor" en Google Drive.' };
            }

        } catch (error: any) {
            console.error('Error accessing folder:', error);
            if (error.code === 404) {
                const robotEmail = (auth as any).email || 'el robot';
                return { success: false, error: `El robot (${robotEmail}) no tiene acceso a la carpeta (404). Verifique que haya compartido con este correo.` };
            }
            throw error;
        }

        const response = await drive.files.create({
            requestBody: {
                name: file.name,
                parents: [folderId],
            },
            media: {
                mimeType: file.type,
                body: stream,
            },
            fields: 'id, webViewLink',
            supportsAllDrives: true,
        });

        if (response.data.id) {
            return {
                success: true,
                fileId: response.data.id,
                viewLink: response.data.webViewLink
            };
        } else {
            return { success: false, error: 'No se pudo obtener el ID del archivo.' };
        }

    } catch (error: any) {
        console.error('Error uploading to Drive:', error);

        // Handle "No storage quota" error specifically
        if (error.message && error.message.includes('storage quota')) {
            return {
                success: false,
                error: 'Error de Cuota: Las cuentas de servicio no tienen espacio propio. SOLUCIÓN: La carpeta de destino debe estar dentro de una "UNIDAD COMPARTIDA" (Shared Drive) de Google Workspace, no en "Mi Unidad" personal.'
            };
        }

        return { success: false, error: error.message || 'Error al subir archivo a Drive.' };
    }
}

const DRIVE_FOLDER_ID = '13UpUfdlB6jr2vECjNuBP89N8IUvauDWN';

/**
 * Inicia una sesión de subida "resumable" en Google Drive y devuelve la URL
 * a la que el navegador subirá los bytes directamente. Así el archivo NO pasa
 * por la Server Action, evitando el límite de 4.5 MB de Vercel.
 */
export async function createDriveUploadSession(fileName: string, mimeType: string) {
    try {
        const tokenResponse = await (auth as any).getAccessToken();
        const accessToken = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
        if (!accessToken) {
            return { success: false, error: 'No se pudo autenticar con Google.' };
        }

        const res = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,webViewLink',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                    'X-Upload-Content-Type': mimeType || 'application/octet-stream',
                },
                body: JSON.stringify({ name: fileName, parents: [DRIVE_FOLDER_ID] }),
            }
        );

        if (!res.ok) {
            const text = await res.text();
            console.error('Error iniciando sesión de subida:', res.status, text);
            if (text.includes('storage quota')) {
                return {
                    success: false,
                    error: 'Error de Cuota: Las cuentas de servicio no tienen espacio propio. SOLUCIÓN: La carpeta de destino debe estar dentro de una "UNIDAD COMPARTIDA" (Shared Drive) de Google Workspace, no en "Mi Unidad" personal.',
                };
            }
            return { success: false, error: `No se pudo iniciar la subida (${res.status}).` };
        }

        const uploadUrl = res.headers.get('location');
        if (!uploadUrl) {
            return { success: false, error: 'Google no devolvió la URL de subida.' };
        }

        return { success: true, uploadUrl };
    } catch (error: any) {
        console.error('Error en createDriveUploadSession:', error);
        return { success: false, error: error.message || 'Error al iniciar la subida.' };
    }
}
