import { upload } from '@vercel/blob/client';
import { uploadFromBlobUrl } from '@/app/actions/drive';

/**
 * Sube un archivo a Google Drive en dos pasos:
 *  1. El navegador sube el archivo a Vercel Blob (sin límite de 4.5 MB ni CORS).
 *  2. El servidor mueve el archivo de Blob a Google Drive y borra el blob.
 *
 * Devuelve el ID del archivo en Google Drive.
 */
export async function uploadFileToDrive(file: File): Promise<string> {
    const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob-upload',
    });

    const res = await uploadFromBlobUrl(blob.url, file.name, file.type);
    if (!res.success || !res.fileId) {
        throw new Error(res.error || `Error al subir el archivo: ${file.name}`);
    }
    return res.fileId;
}
