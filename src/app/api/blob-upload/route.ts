import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Genera un token de subida a Vercel Blob para el navegador.
// El archivo sube directo del navegador a Blob (sin pasar por la Server
// Action), evitando el límite de 4.5 MB de Vercel. Luego una Server Action
// mueve el archivo de Blob a Google Drive (server-to-server).
export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => {
                // Solo usuarios autenticados pueden subir.
                const session = await getServerSession(authOptions);
                if (!session) {
                    throw new Error('No autorizado.');
                }
                return {
                    allowedContentTypes: [
                        'application/pdf',
                        'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.ms-excel',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/octet-stream',
                    ],
                    maximumSizeInBytes: 50 * 1024 * 1024, // 50 MB
                };
            },
            onUploadCompleted: async () => {
                // No-op: el archivo se mueve a Drive desde la Server Action.
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 400 }
        );
    }
}
