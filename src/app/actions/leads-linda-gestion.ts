'use server';

import { doc, loadDoc } from '@/lib/google-sheets';
import { LeadCacheLinda } from '@/lib/lead-cache-linda';
import { UserCache } from '@/lib/user-cache';

function mapRow(row: any) {
    return {
        id: (row as any).rowIndex,
        ruc: row.get('RUC'),
        razonSocial: row.get('Razón Social'),
        contacto: row.get('Representante Legal'),
        telefono: row.get('Teléfonos'),
        dni: row.get('Documento Identidad'),
        segmento: row.get('SEGMENTO'),
        consultor: row.get('CONSULTOR PRINCIPAL'),
        departamento: row.get('DEPARTAMENTO'),
        provincia: row.get('PROVINCIA'),
        distrito: row.get('DISTRITO'),
        direccion: row.get('DIRECCION'),
        correo: row.get('CORREO'),
        lineas: row.get('CANTIDAD LINEAS'),
        cargoFijo: row.get('CARGO FIJO'),
        observacion: row.get('OBSERVACIONES'),
        estado: row.get('ESTADO'),
        deseaInfo: row.get('DESEA INFORMACION'),
        otrosContactos: row.get('OTROS REPRESENTANTES LEGALES'),
        agendamiento: row.get('FECHA AGENDAMIENTO'),
        fechaInicio: row.get('FECHA INICIO'),
        operadorActual: row.get('OPERADOR'),
    };
}

export async function getNextLindaLead(userEmail: string, userName: string) {
    try {
        const cache = LeadCacheLinda.getInstance();
        await cache.ensureInitialized();

        let result = await cache.allocateNextLead(userName, false);
        if (result.type === 'none') {
            await cache.refresh();
            result = await cache.allocateNextLead(userName, false);
        }

        if (!result.row) {
            return { message: 'No hay registros de Base Linda asignados.' };
        }

        return { success: true, data: mapRow(result.row) };
    } catch (error) {
        console.error('Error en getNextLindaLead:', error);
        return { error: 'Error interno al procesar Base Linda.' };
    }
}

export async function saveLindaLead(rowIndex: number, data: any) {
    try {
        const cache = LeadCacheLinda.getInstance();
        await cache.ensureInitialized();

        const row = cache.getByRuc(data.ruc);
        if (!row) return { success: false, error: 'Registro no encontrado (RUC mismatch).' };

        const currentExec = row.get('EJECUTIVO');
        const normCurrent = currentExec ? currentExec.trim().toLowerCase() : '';
        const normAssigned = data.assignedUser ? data.assignedUser.trim().toLowerCase() : '';

        if (normCurrent && normCurrent !== normAssigned && data.userRole !== 'ADMIN') {
            return { success: false, error: `Este registro pertenece a ${currentExec}.` };
        }

        const now = new Date();
        const peruTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
        const d = String(peruTime.getDate()).padStart(2, '0');
        const m = String(peruTime.getMonth() + 1).padStart(2, '0');
        const y = peruTime.getFullYear();
        const h = String(peruTime.getHours()).padStart(2, '0');
        const min = String(peruTime.getMinutes()).padStart(2, '0');
        const s = String(peruTime.getSeconds()).padStart(2, '0');
        const fechaFin = `${d}/${m}/${y}, ${h}:${min}:${s}`;

        const updates: any = {
            'ESTADO': data.estado,
            'DESEA INFORMACION': data.deseaInfo,
            'OBSERVACIONES': data.observacion,
            'FECHA FIN': fechaFin,
        };

        if (data.correo) updates['CORREO'] = data.correo;
        if (data.lineas) updates['CANTIDAD LINEAS'] = data.lineas;
        if (data.cargoFijo) updates['CARGO FIJO'] = data.cargoFijo;
        if (data.segmento) updates['SEGMENTO'] = data.segmento;
        if (data.consultor) updates['CONSULTOR PRINCIPAL'] = data.consultor;
        if (data.contacto) updates['Representante Legal'] = data.contacto;
        if (data.dni) updates['Documento Identidad'] = data.dni;
        if (data.telefono) updates['Teléfonos'] = data.telefono;
        if (data.departamento) updates['DEPARTAMENTO'] = data.departamento;
        if (data.provincia) updates['PROVINCIA'] = data.provincia;
        if (data.distrito) updates['DISTRITO'] = data.distrito;
        if (data.direccion) updates['DIRECCION'] = data.direccion;
        if (data.razonSocial) updates['Razón Social'] = data.razonSocial;
        if (data.hasOwnProperty('agendamiento')) updates['FECHA AGENDAMIENTO'] = data.agendamiento || '';

        const TERMINAL_STATES = ['NO INTERESADO', 'TELEFONO EQUIVOCADO', 'NO CONTESTA', 'RUC DADO DE BAJA', 'NO CALIFICA', 'POSIBLE FRAUDE'];
        if (TERMINAL_STATES.includes(data.estado)) updates['FECHA AGENDAMIENTO'] = '';

        const success = await cache.updateRow(data.ruc, updates);
        return success ? { success: true } : { success: false, error: 'Error interno al escribir en Google Sheets.' };
    } catch (error) {
        console.error('Error en saveLindaLead:', error);
        return { success: false, error: 'Error al guardar.' };
    }
}

export async function getLindaAgendamientos(userName: string, userRole: string) {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle['BASE LINDA'];
        if (!sheet) return { error: 'Hoja BASE LINDA no encontrada' };

        const rows = await sheet.getRows();
        const scheduledRows = rows.filter(row => {
            const hasAgendamiento = row.get('FECHA AGENDAMIENTO') && row.get('FECHA AGENDAMIENTO').trim() !== '';
            if (!hasAgendamiento) return false;
            if (userRole === 'ADMIN') return true;
            return row.get('EJECUTIVO') === userName;
        });

        const agendamientos = scheduledRows.map(row => ({
            razonSocial: row.get('Razón Social'),
            ruc: row.get('RUC'),
            fecha: row.get('FECHA AGENDAMIENTO'),
            ejecutivo: row.get('EJECUTIVO'),
            telefono: row.get('Teléfonos'),
        })).sort((a, b) => {
            if (!a.fecha) return 1;
            if (!b.fecha) return -1;
            return b.fecha.localeCompare(a.fecha);
        });

        return { success: true, data: agendamientos };
    } catch (error) {
        console.error('Error en getLindaAgendamientos:', error);
        return { error: 'Error al obtener agendamientos' };
    }
}

export async function getLindaLeadByRuc(ruc: string) {
    try {
        const cache = LeadCacheLinda.getInstance();
        await cache.ensureInitialized();

        const row = cache.getByRuc(ruc);
        if (!row) return { success: false, error: 'Lead no encontrado' };

        return { success: true, data: mapRow(row) };
    } catch (error) {
        console.error('Error en getLindaLeadByRuc:', error);
        return { success: false, error: 'Error al cargar lead' };
    }
}

export async function createManualLindaLead(data: any, user: string) {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle['BASE LINDA'];
        if (!sheet) return { success: false, error: 'Hoja BASE LINDA no encontrada.' };

        const rows = await sheet.getRows();
        const normalizedRuc = String(data.ruc).trim();
        const existing = rows.find(r => String(r.get('RUC') || '').trim() === normalizedRuc);

        const now = new Date();
        const peruTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
        const d = String(peruTime.getDate()).padStart(2, '0');
        const m = String(peruTime.getMonth() + 1).padStart(2, '0');
        const y = peruTime.getFullYear();
        const h = String(peruTime.getHours()).padStart(2, '0');
        const min = String(peruTime.getMinutes()).padStart(2, '0');
        const s = String(peruTime.getSeconds()).padStart(2, '0');
        const fechaInicio = `${d}/${m}/${y}, ${h}:${min}:${s}`;

        if (existing) {
            const currentExec = (existing.get('EJECUTIVO') || '').trim().toUpperCase();
            const normalizedUser = user.trim().toUpperCase();
            if (currentExec !== '' && currentExec !== normalizedUser) {
                return { success: false, error: `Este registro ya pertenece a ${existing.get('EJECUTIVO')}` };
            }
            existing.set('Razón Social', data.razonSocial);
            existing.set('Representante Legal', data.contacto);
            existing.set('Teléfonos', data.telefono);
            existing.set('Documento Identidad', data.dni);
            existing.set('SEGMENTO', data.segmento);
            existing.set('EJECUTIVO', user);
            existing.set('FECHA INICIO', fechaInicio);
            existing.set('ESTADO', '');
            await existing.save();
        } else {
            await sheet.addRow({
                'RUC': data.ruc,
                'Razón Social': data.razonSocial,
                'Representante Legal': data.contacto,
                'Teléfonos': data.telefono,
                'Documento Identidad': data.dni,
                'SEGMENTO': data.segmento,
                'CONSULTOR PRINCIPAL': data.consultor || '',
                'DEPARTAMENTO': data.departamento || '',
                'PROVINCIA': data.provincia || '',
                'DISTRITO': data.distrito || '',
                'DIRECCION': data.direccion || '',
                'CORREO': data.correo || '',
                'CANTIDAD LINEAS': data.lineas || '',
                'CARGO FIJO': data.cargoFijo || '',
                'EJECUTIVO': user,
                'FECHA INICIO': fechaInicio,
                'ESTADO': '',
            });
        }

        const cache = LeadCacheLinda.getInstance();
        await cache.refresh();
        return { success: true };
    } catch (error: any) {
        console.error('Error en createManualLindaLead:', error);
        return { success: false, error: error.message || 'Error al crear registro.' };
    }
}

export async function getLindaAssignmentStats(userRole?: string, userName?: string) {
    try {
        const cache = LeadCacheLinda.getInstance();
        await cache.ensureInitialized();
        const userCache = UserCache.getInstance();
        await userCache.ensureInitialized();

        const allRows = cache.getAll();
        const allUsers = userCache.getAll();

        // If user cache returned nothing, it's almost certainly an API/quota error
        if (allUsers.length === 0) {
            return { success: false, error: 'No se pudo cargar la lista de ejecutivos. El servicio puede estar ocupado, intenta en unos segundos.' };
        }

        let execs;
        if (userRole === 'SPECIAL' && userName) {
            execs = userCache.getTeamForSupervisor(userName).filter((u: any) => {
                const role = (u.get('ROL') || '').trim().toUpperCase();
                return role === 'STANDAR' || role === 'SPECIAL';
            });
        } else {
            execs = allUsers.filter((u: any) => {
                const role = (u.get('ROL') || '').trim().toUpperCase();
                return role === 'STANDAR' || role === 'SPECIAL';
            });
        }

        const counts: Record<string, number> = {};
        allRows.forEach(row => {
            const exec = (row.get('EJECUTIVO') || '').trim();
            const estado = (row.get('ESTADO') || '').trim().toUpperCase();
            if (exec && (!estado || estado === '' || estado === 'PENDIENTE')) {
                counts[exec] = (counts[exec] || 0) + 1;
            }
        });

        const stats = execs.map((u: any) => ({
            name: u.get('NOMBRES COMPLETOS'),
            user: u.get('USER'),
            role: u.get('ROL'),
            assignedCount: counts[u.get('NOMBRES COMPLETOS')] || 0,
        }));

        const stock: Record<string, number> = { '1-4': 0, '5-10': 0, '11-15': 0, '16-21': 0, '22-30': 0, '30+': 0 };
        const normPool = (userRole === 'SPECIAL' && userName) ? userName.trim().toLowerCase() : null;
        allRows.forEach(row => {
            const exec = (row.get('EJECUTIVO') || '').trim();
            if (exec !== '') return;
            if (normPool) {
                const sup = (row.get('SUPERVISOR') || '').trim().toLowerCase();
                if (sup !== normPool) return;
            }
            const lineas = parseInt(row.get('CANTIDAD LINEAS') || '0');
            if (lineas >= 1 && lineas <= 4) stock['1-4']++;
            else if (lineas >= 5 && lineas <= 10) stock['5-10']++;
            else if (lineas >= 11 && lineas <= 15) stock['11-15']++;
            else if (lineas >= 16 && lineas <= 21) stock['16-21']++;
            else if (lineas >= 22 && lineas <= 30) stock['22-30']++;
            else if (lineas > 30) stock['30+']++;
        });

        return { success: true, stats, stock };
    } catch (error) {
        console.error('Error en getLindaAssignmentStats:', error);
        return { success: false, error: 'Error al cargar estadísticas de Base Linda' };
    }
}

export async function assignLindaLeadsByCriteria(
    executiveName: string,
    quantity: number,
    rangeId: string,
    userRole?: string,
    userName?: string
) {
    try {
        const userCache = UserCache.getInstance();
        await userCache.ensureInitialized();

        if (userRole === 'SPECIAL' && userName) {
            const supervisorOfTarget = userCache.getSupervisorForUser(executiveName);
            if (supervisorOfTarget.trim().toUpperCase() !== userName.trim().toUpperCase()) {
                return { success: false, error: 'No tienes permisos para asignar a un ejecutivo de otro equipo.' };
            }
        }

        if (userRole === 'SPECIAL' && quantity > 20) {
            return { success: false, error: 'Los supervisores no pueden asignar más de 20 registros' };
        }

        const cache = LeadCacheLinda.getInstance();
        await cache.ensureInitialized();

        const now = new Date();
        const peruTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
        const d = String(peruTime.getDate()).padStart(2, '0');
        const m = String(peruTime.getMonth() + 1).padStart(2, '0');
        const y = peruTime.getFullYear();
        const h = String(peruTime.getHours()).padStart(2, '0');
        const min = String(peruTime.getMinutes()).padStart(2, '0');
        const s = String(peruTime.getSeconds()).padStart(2, '0');
        const fechaInicio = `${d}/${m}/${y}, ${h}:${min}:${s}`;

        const criteria = (row: any) => {
            const lineas = parseInt(row.get('CANTIDAD LINEAS') || '0');
            switch (rangeId) {
                case '1-4': return lineas >= 1 && lineas <= 4;
                case '5-10': return lineas >= 5 && lineas <= 10;
                case '11-15': return lineas >= 11 && lineas <= 15;
                case '16-21': return lineas >= 16 && lineas <= 21;
                case '22-30': return lineas >= 22 && lineas <= 30;
                case '30+': return lineas > 30;
                default: return true;
            }
        };

        const poolSupervisor = (userRole === 'SPECIAL' && userName) ? userName : undefined;
        return await cache.batchAssignByCriteria(executiveName, quantity, criteria, fechaInicio, poolSupervisor);
    } catch (error: any) {
        console.error('Error en assignLindaLeadsByCriteria:', error);
        return { success: false, count: 0, error: error.message || 'Error al asignar' };
    }
}

export async function promoteToPipelineFromLinda(lead: any, user: string) {
    try {
        await loadDoc();
        const sheet = doc.sheetsByTitle['PROSPECCION'];
        if (!sheet) return { success: false, error: 'Hoja PROSPECCION no encontrada' };

        const rows = await sheet.getRows();
        let nextId = 1;
        const ids = rows.map(r => parseInt(r.get('ID'))).filter(n => !isNaN(n));
        if (ids.length > 0) nextId = Math.max(...ids) + 1;

        const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });

        await sheet.addRow({
            'ID': nextId.toString(),
            'RUC': String(lead.ruc),
            'RAZON SOCIAL': lead.razonSocial || '',
            'CONTACTO': lead.contacto || '',
            'TELEFONO': lead.telefono || '',
            'CANTIDAD LINEAS': lead.lineas || '',
            'CARGO FIJO': lead.cargoFijo || '',
            'EJECUTIVO': user,
            'ESTADO': 'INTERESADO',
            'FECHA INGRESO': now,
            'FECHA INTERESADO': now,
            'OBSERVACIONES': lead.observacion || '',
            'SEGMENTO': lead.segmento || '',
        });

        const cache = LeadCacheLinda.getInstance();
        await cache.ensureInitialized();
        await cache.updateRow(lead.ruc, { 'ESTADO': 'ENVIADO A PROSPECTOS', 'FECHA AGENDAMIENTO': '' });

        return { success: true };
    } catch (error) {
        console.error('Error en promoteToPipelineFromLinda:', error);
        return { success: false, error: 'Error al subir deal' };
    }
}
