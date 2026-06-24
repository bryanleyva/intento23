// Token de lectura/escritura de Vercel Blob.
// El SDK busca por defecto BLOB_READ_WRITE_TOKEN, pero si el Blob Store se
// conectó con un prefijo (ej. "rayders_b"), el token se llama distinto.
// Aquí aceptamos cualquiera de los nombres posibles.
export const BLOB_TOKEN =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.rayders_b_READ_WRITE_TOKEN ||
    undefined;
