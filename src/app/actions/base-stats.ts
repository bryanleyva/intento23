'use server';

import { LeadCache } from '@/lib/lead-cache';
import { LeadCacheSpecial } from '@/lib/lead-cache-special';
import { LeadCacheLinda } from '@/lib/lead-cache-linda';

const INTERESADO_STATES = ['INTERESADO', 'ENVIADO A PROSPECTOS'];
const NO_INTERESADO_STATES = ['TELEFONO EQUIVOCADO', 'NO CONTESTA', 'RUC DADO DE BAJA', 'NO CALIFICA', 'POSIBLE FRAUDE'];

function computeStats(rows: any[]) {
    let interesados = 0;
    let lineas = 0;
    let noInteresados = 0;
    let pendientes = 0;

    rows.forEach(row => {
        const estado = (row.get('ESTADO') || '').trim().toUpperCase();
        const lineasCount = parseInt(row.get('CANTIDAD LINEAS') || '0') || 0;
        const ejecutivo = (row.get('EJECUTIVO') || '').trim();

        if (INTERESADO_STATES.includes(estado)) {
            interesados++;
            lineas += lineasCount;
        } else if (estado.startsWith('NO INTERESADO') || NO_INTERESADO_STATES.includes(estado)) {
            noInteresados++;
        } else if (ejecutivo !== '' && (!estado || estado === 'PENDIENTE' || estado === 'VOLVER A LLAMAR')) {
            pendientes++;
        }
    });

    return { interesados, lineas, noInteresados, pendientes };
}

export async function getBaseLeadsStats() {
    try {
        const rydersCache = LeadCache.getInstance();
        const specialCache = LeadCacheSpecial.getInstance();
        const lindaCache = LeadCacheLinda.getInstance();

        await Promise.all([
            rydersCache.ensureInitialized(),
            specialCache.ensureInitialized(),
            lindaCache.ensureInitialized(),
        ]);

        return {
            success: true,
            bases: [
                {
                    name: 'Base Ryders',
                    color: '#10b981',
                    emoji: '🚀',
                    ...computeStats(rydersCache.getAll()),
                },
                {
                    name: 'Base Especial',
                    color: '#8b5cf6',
                    emoji: '⭐',
                    ...computeStats(specialCache.getAll()),
                },
                {
                    name: 'Base Linda',
                    color: '#f97316',
                    emoji: '🌸',
                    ...computeStats(lindaCache.getAll()),
                },
            ],
        };
    } catch (error) {
        console.error('Error en getBaseLeadsStats:', error);
        return { success: false, bases: [] };
    }
}
