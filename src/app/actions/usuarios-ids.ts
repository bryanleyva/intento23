'use server';

import { doc, loadDoc } from '@/lib/google-sheets';
import { UserCache } from '@/lib/user-cache';

export interface UsuarioIdRow {
    id: string;
    nombre: string;
    tipo: string;   // VENDEDOR | SUPERVISOR | AMBOS
    dni: string;
    campana: string;
}

const MASTER_SHEET = 'MAESTRO_USUARIOS';
const MASTER_HEADERS = ['ID', 'NOMBRE', 'TIPO', 'DNI', 'CAMPAÑA'];

function norm(s: any): string {
    return String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Construye/actualiza el padrón de usuarios (vendedores + supervisores) sacado
 * de TODAS las ventas. Cada persona recibe un ID único y estable:
 *   - Si ya está en la hoja MAESTRO_USUARIOS, conserva su ID.
 *   - Si es nuevo, se le asigna el siguiente ID correlativo y se agrega.
 * No se repiten: la clave es el nombre normalizado.
 */
export async function generarTablaUsuariosIds(): Promise<{ success: boolean; data?: UsuarioIdRow[]; nuevos?: number; error?: string }> {
    try {
        await loadDoc();

        const ventas = doc.sheetsByTitle['VENTAS'];
        if (!ventas) return { success: false, error: 'Hoja VENTAS no encontrada' };

        // 1) Recolectar nombres distintos de EJECUTIVO y SUPERVISOR.
        const encontrados = new Map<string, { nombre: string; roles: Set<string> }>();
        const registrar = (raw: any, rol: string) => {
            const nombre = String(raw || '').trim();
            if (!nombre) return;
            const key = norm(nombre);
            if (!encontrados.has(key)) encontrados.set(key, { nombre, roles: new Set() });
            encontrados.get(key)!.roles.add(rol);
        };

        const vrows = await ventas.getRows();
        for (const row of vrows) {
            registrar(row.get('EJECUTIVO'), 'VENDEDOR');
            registrar(row.get('SUPERVISOR'), 'SUPERVISOR');
        }

        // 2) DNI / campaña desde USUARIOS (por nombre o user).
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

        // 3) Hoja maestra: crear si no existe.
        let master = doc.sheetsByTitle[MASTER_SHEET];
        if (!master) {
            master = await doc.addSheet({ title: MASTER_SHEET, headerValues: MASTER_HEADERS });
        } else {
            // Asegurar encabezados.
            try {
                await master.loadHeaderRow();
                if (!master.headerValues || master.headerValues.length === 0) {
                    await master.setHeaderRow(MASTER_HEADERS);
                }
            } catch {
                await master.setHeaderRow(MASTER_HEADERS);
            }
        }

        const masterRows = await master.getRows();
        const existentes = new Map<string, any>();
        let maxId = 0;
        for (const r of masterRows) {
            const key = norm(r.get('NOMBRE'));
            if (key) existentes.set(key, r);
            const idNum = parseInt(String(r.get('ID') || '').replace(/[^\d]/g, ''), 10);
            if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
        }

        // 4) Determinar tipo (VENDEDOR / SUPERVISOR / AMBOS).
        const tipoDe = (roles: Set<string>): string => {
            const v = roles.has('VENDEDOR');
            const s = roles.has('SUPERVISOR');
            if (v && s) return 'AMBOS';
            if (s) return 'SUPERVISOR';
            return 'VENDEDOR';
        };

        // 5) Nuevos: los que no están en la maestra. Orden alfabético estable.
        const nuevosKeys = [...encontrados.keys()]
            .filter(k => !existentes.has(k))
            .sort((a, b) => a.localeCompare(b));

        const toAppend: Record<string, string>[] = [];
        for (const key of nuevosKeys) {
            const item = encontrados.get(key)!;
            maxId++;
            const id = String(maxId).padStart(4, '0');
            const info = infoByName.get(key);
            toAppend.push({
                ID: id,
                NOMBRE: item.nombre,
                TIPO: tipoDe(item.roles),
                DNI: info?.dni || '',
                'CAMPAÑA': info?.campana || '',
            });
        }
        if (toAppend.length > 0) {
            await master.addRows(toAppend);
        }

        // 6) Actualizar TIPO/DNI/CAMPAÑA de existentes si cambió (sin tocar el ID).
        for (const r of masterRows) {
            const key = norm(r.get('NOMBRE'));
            const item = encontrados.get(key);
            if (!item) continue;
            const nuevoTipo = tipoDe(item.roles);
            const info = infoByName.get(key);
            let changed = false;
            if (norm(r.get('TIPO')) !== norm(nuevoTipo)) { r.set('TIPO', nuevoTipo); changed = true; }
            if (info?.dni && String(r.get('DNI') || '').trim() !== info.dni) { r.set('DNI', info.dni); changed = true; }
            if (info?.campana && String(r.get('CAMPAÑA') || '').trim() !== info.campana) { r.set('CAMPAÑA', info.campana); changed = true; }
            if (changed) { try { await r.save(); } catch { /* no bloquear por un error de fila */ } }
        }

        // 7) Salida: TODO el padrón (existentes + nuevos), ordenado por ID.
        const data: UsuarioIdRow[] = [];
        // Existentes (con posibles cambios aplicados en memoria).
        for (const r of masterRows) {
            const nombre = String(r.get('NOMBRE') || '').trim();
            if (!nombre) continue;
            data.push({
                id: String(r.get('ID') || '').trim(),
                nombre,
                tipo: String(r.get('TIPO') || '').trim(),
                dni: String(r.get('DNI') || '').trim(),
                campana: String(r.get('CAMPAÑA') || '').trim(),
            });
        }
        // Nuevos.
        for (const a of toAppend) {
            data.push({
                id: a.ID,
                nombre: a.NOMBRE,
                tipo: a.TIPO,
                dni: a.DNI,
                campana: a['CAMPAÑA'],
            });
        }

        data.sort((x, y) => (parseInt(x.id, 10) || 0) - (parseInt(y.id, 10) || 0));

        return { success: true, data, nuevos: toAppend.length };
    } catch (error) {
        console.error('Error in generarTablaUsuariosIds:', error);
        return { success: false, error: 'Error al generar el padrón de usuarios' };
    }
}
