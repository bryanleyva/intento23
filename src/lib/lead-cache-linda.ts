import { doc, loadDoc } from '@/lib/google-sheets';

export class LeadCacheLinda {
    private static instance: LeadCacheLinda;
    private rows: any[] = [];
    private lastFetch: number = 0;
    private CACHE_TTL = 30 * 1000;
    private mutex: Promise<void> = Promise.resolve();

    private constructor() { }

    public static getInstance(): LeadCacheLinda {
        if (!LeadCacheLinda.instance) {
            LeadCacheLinda.instance = new LeadCacheLinda();
        }
        return LeadCacheLinda.instance;
    }

    public async ensureInitialized() {
        const now = Date.now();
        if (this.rows.length === 0 || (now - this.lastFetch > this.CACHE_TTL)) {
            await this.refresh();
        }
    }

    private async runLocked<T>(task: () => Promise<T>): Promise<T> {
        const previous = this.mutex;
        let resolveTask: (value: void | PromiseLike<void>) => void;
        this.mutex = new Promise(resolve => { resolveTask = resolve; });
        await previous;
        try {
            return await task();
        } finally {
            resolveTask!();
        }
    }

    private async _refresh() {
        try {
            await loadDoc();
            const sheet = doc.sheetsByTitle['BASE LINDA'];
            if (!sheet) {
                console.error('LeadCacheLinda: Sheet BASE LINDA not found');
                return;
            }
            await sheet.loadHeaderRow();
            const rows = await sheet.getRows();
            this.rows = rows;
            this.lastFetch = Date.now();
        } catch (error) {
            console.error('LeadCacheLinda: Error refreshing data', error);
        }
    }

    public async refresh() {
        return this.runLocked(async () => {
            await this._refresh();
        });
    }

    public async allocateNextLead(userName: string, allowNewAllocation: boolean = true): Promise<{ type: 'resume' | 'allocate' | 'none', row?: any }> {
        return this.runLocked(async () => {
            const normUser = userName.trim().toLowerCase();
            const pendingRow = this.rows.find(row => {
                const ejecutivo = (row.get('EJECUTIVO') || '').trim().toLowerCase();
                const estado = (row.get('ESTADO') || '').trim().toUpperCase();
                return ejecutivo === normUser && (!estado || estado === '' || estado === 'PENDIENTE');
            });

            if (pendingRow) return { type: 'resume', row: pendingRow };
            if (!allowNewAllocation) return { type: 'none' };

            const availableRow = this.rows.find(row => {
                const ejecutivo = (row.get('EJECUTIVO') || '').trim();
                const ruc = row.get('RUC');
                return ruc && ejecutivo === '';
            });

            if (availableRow) {
                availableRow.set('EJECUTIVO', userName);
                const now = new Date();
                const peruTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
                const d = String(peruTime.getDate()).padStart(2, '0');
                const m = String(peruTime.getMonth() + 1).padStart(2, '0');
                const y = peruTime.getFullYear();
                const h = String(peruTime.getHours()).padStart(2, '0');
                const min = String(peruTime.getMinutes()).padStart(2, '0');
                const s = String(peruTime.getSeconds()).padStart(2, '0');
                availableRow.set('FECHA INICIO', `${d}/${m}/${y}, ${h}:${min}:${s}`);
                try { await availableRow.save(); } catch (e) { console.error(e); }
                return { type: 'allocate', row: availableRow };
            }

            return { type: 'none' };
        });
    }

    public async batchAssignByCriteria(
        executiveName: string,
        quantity: number,
        criteria: (row: any) => boolean,
        fechaInicio: string,
        poolSupervisor?: string
    ): Promise<{ success: boolean; count: number; error?: string }> {
        return this.runLocked(async () => {
            try {
                await this._refresh();
                const normPool = poolSupervisor ? poolSupervisor.trim().toLowerCase() : null;
                const candidates = this.rows.filter(row => {
                    const exec = (row.get('EJECUTIVO') || '').trim();
                    const ruc = row.get('RUC');
                    if (!ruc || exec !== '' || !criteria(row)) return false;
                    if (normPool) {
                        const sup = (row.get('SUPERVISOR') || '').trim().toLowerCase();
                        if (sup !== normPool) return false;
                    }
                    return true;
                }).slice(0, quantity);

                if (candidates.length === 0) {
                    return { success: false, count: 0, error: 'No hay cuentas disponibles para este criterio.' };
                }

                let count = 0;
                for (const row of candidates) {
                    row.set('EJECUTIVO', executiveName);
                    row.set('ESTADO', '');
                    row.set('FECHA INICIO', fechaInicio);
                    try { await row.save(); count++; } catch (e) { console.error(e); }
                }
                return { success: true, count };
            } catch (error: any) {
                return { success: false, count: 0, error: error.message || 'Error en asignación' };
            }
        });
    }

    private async ensureSupervisorColumnInternal() {
        await loadDoc();
        const sheet = doc.sheetsByTitle['BASE LINDA'];
        if (!sheet) return;
        await sheet.loadHeaderRow();
        if (!sheet.headerValues.includes('SUPERVISOR')) {
            await sheet.setHeaderRow([...sheet.headerValues, 'SUPERVISOR']);
        }
    }

    public async batchAssignSupervisorByCriteria(
        supervisorName: string,
        quantity: number,
        criteria: (row: any) => boolean
    ): Promise<{ success: boolean; count: number; error?: string }> {
        return this.runLocked(async () => {
            try {
                await this.ensureSupervisorColumnInternal();
                await this._refresh();

                const candidates = this.rows.filter(row => {
                    const exec = (row.get('EJECUTIVO') || '').trim();
                    const sup = (row.get('SUPERVISOR') || '').trim();
                    const ruc = row.get('RUC');
                    return ruc && exec === '' && sup === '' && criteria(row);
                }).slice(0, quantity);

                if (candidates.length === 0) {
                    return { success: false, count: 0, error: 'No hay leads disponibles en el stock global para este criterio.' };
                }

                let count = 0;
                for (const row of candidates) {
                    row.set('SUPERVISOR', supervisorName);
                    try { await row.save(); count++; } catch (e) { console.error(e); }
                }
                return { success: true, count };
            } catch (error: any) {
                return { success: false, count: 0, error: error.message || 'Error en distribución de base' };
            }
        });
    }

    public getByRuc(ruc: string) {
        return this.rows.find(r => r.get('RUC') === ruc);
    }

    public getAll() {
        return this.rows;
    }

    public async updateRow(ruc: string, updates: Record<string, any>, options?: { onlyIfUnassigned?: boolean }) {
        return this.runLocked(async () => {
            const row = this.getByRuc(ruc);
            if (!row) return false;

            if (options?.onlyIfUnassigned) {
                const currentExec = (row.get('EJECUTIVO') || '').trim();
                if (currentExec !== '') return false;
            }

            Object.keys(updates).forEach(key => row.set(key, updates[key]));
            try {
                await row.save();
                return true;
            } catch (e) {
                console.error('LeadCacheLinda: Error saving row', e);
                return false;
            }
        });
    }
}
