'use server';

import { LeadCache } from '@/lib/lead-cache';
import { LeadCacheSpecial } from '@/lib/lead-cache-special';
import { LeadCacheLinda } from '@/lib/lead-cache-linda';
import { UserCache } from '@/lib/user-cache';

// NOTE: a 'use server' module may only export async functions, so this type stays
// local. The client component declares its own matching union.
type DistributionBase = 'RYDERS' | 'ESPECIAL' | 'LINDA';

interface DistCache {
    ensureInitialized: () => Promise<void>;
    getAll: () => any[];
    batchAssignSupervisorByCriteria: (
        supervisorName: string,
        quantity: number,
        criteria: (row: any) => boolean
    ) => Promise<{ success: boolean; count: number; error?: string }>;
}

function getCache(base: DistributionBase): DistCache {
    if (base === 'ESPECIAL') return LeadCacheSpecial.getInstance() as unknown as DistCache;
    if (base === 'LINDA') return LeadCacheLinda.getInstance() as unknown as DistCache;
    return LeadCache.getInstance() as unknown as DistCache;
}

const EMPTY_BUCKETS = (): Record<string, number> => ({
    '1-4': 0, '5-10': 0, '11-15': 0, '16-21': 0, '22-30': 0, '30+': 0,
});

function bucketOf(lineas: number): string | null {
    if (lineas >= 1 && lineas <= 4) return '1-4';
    if (lineas >= 5 && lineas <= 10) return '5-10';
    if (lineas >= 11 && lineas <= 15) return '11-15';
    if (lineas >= 16 && lineas <= 21) return '16-21';
    if (lineas >= 22 && lineas <= 30) return '22-30';
    if (lineas > 30) return '30+';
    return null;
}

function bucketCount(rows: any[]): Record<string, number> {
    const buckets = EMPTY_BUCKETS();
    rows.forEach(row => {
        const lineas = parseInt(row.get('CANTIDAD LINEAS') || '0');
        const key = bucketOf(lineas);
        if (key) buckets[key]++;
    });
    return buckets;
}

function rangeCriteria(rangeId: string): (row: any) => boolean {
    return (row: any) => {
        const lineas = parseInt(row.get('CANTIDAD LINEAS') || '0');
        switch (rangeId) {
            case '1-4': return lineas >= 1 && lineas <= 4;
            case '5-10': return lineas >= 5 && lineas <= 10;
            case '11-15': return lineas >= 11 && lineas <= 15;
            case '16-21': return lineas >= 16 && lineas <= 21;
            case '22-30': return lineas >= 22 && lineas <= 30;
            case '30+': return lineas > 30;
            default: return false;
        }
    };
}

/**
 * ADMIN VIEW — Distribution stats per supervisor for a given base.
 * - Supervisors are users with ROL === 'SPECIAL'.
 * - pool   = leads tagged with that supervisor (SUPERVISOR === name).
 * - disponible = pool leads still without an executive (EJECUTIVO empty).
 * - buckets = pool breakdown by line range.
 * - globalStock = leads with neither supervisor nor executive (free stock).
 */
export async function getSupervisorDistributionStats(base: DistributionBase) {
    try {
        const cache = getCache(base);
        await cache.ensureInitialized();
        const userCache = UserCache.getInstance();
        await userCache.ensureInitialized();

        const allLeads = cache.getAll();

        const supervisors = userCache.getAll().filter((u: any) =>
            (u.get('ROL') || '').trim().toUpperCase() === 'SPECIAL'
        );

        const stats = supervisors.map((u: any) => {
            const name = u.get('NOMBRES COMPLETOS') || '';
            const norm = name.trim().toLowerCase();
            const pool = allLeads.filter(r => (r.get('SUPERVISOR') || '').trim().toLowerCase() === norm);
            const disponible = pool.filter(r => (r.get('EJECUTIVO') || '').trim() === '');
            return {
                name,
                user: u.get('USER'),
                poolTotal: pool.length,
                disponible: disponible.length,
                buckets: bucketCount(pool),
            };
        });

        const globalRows = allLeads.filter(r =>
            (r.get('SUPERVISOR') || '').trim() === '' && (r.get('EJECUTIVO') || '').trim() === ''
        );

        return {
            success: true,
            stats,
            globalStock: bucketCount(globalRows),
            globalTotal: globalRows.length,
        };
    } catch (error) {
        console.error('Error in getSupervisorDistributionStats:', error);
        return { success: false, error: 'Error al cargar la distribución de base' };
    }
}

/**
 * ADMIN ACTION — Hand a chunk of the global stock to a supervisor's pool.
 */
export async function assignBaseToSupervisor(
    supervisorName: string,
    quantity: number,
    rangeId: string,
    base: DistributionBase
) {
    try {
        if (!supervisorName) return { success: false, count: 0, error: 'Supervisor no especificado.' };
        if (!quantity || quantity <= 0) return { success: false, count: 0, error: 'La cantidad debe ser mayor a 0.' };

        const cache = getCache(base);
        await cache.ensureInitialized();

        return await cache.batchAssignSupervisorByCriteria(supervisorName, quantity, rangeCriteria(rangeId));
    } catch (error: any) {
        console.error('Error in assignBaseToSupervisor:', error);
        return { success: false, count: 0, error: error.message || 'Error al distribuir base' };
    }
}
