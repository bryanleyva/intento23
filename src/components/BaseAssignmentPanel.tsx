'use client';

import { useEffect, useState, useTransition } from 'react';
import { getUserBaseAssignments, updateUserBaseAssignment, type BaseType, type ExecutiveBaseAssignment } from '@/app/actions/user-base-assignment';

const BASE_CONFIG: Record<BaseType, { label: string; color: string; bg: string; glow: string }> = {
    RYDERS:  { label: 'RYDERS',  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  glow: 'rgba(16,185,129,0.35)'  },
    ESPECIAL:{ label: 'ESPECIAL',color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', glow: 'rgba(139,92,246,0.35)' },
    LINDA:   { label: 'LINDA',   color: '#f97316', bg: 'rgba(249,115,22,0.12)', glow: 'rgba(249,115,22,0.35)' },
};

const ALL_BASES: BaseType[] = ['RYDERS', 'ESPECIAL', 'LINDA'];

interface RowState {
    bases: BaseType[];
    dirty: boolean;
    saving: boolean;
    saved: boolean;
}

export default function BaseAssignmentPanel() {
    const [executives, setExecutives] = useState<ExecutiveBaseAssignment[]>([]);
    const [rows, setRows] = useState<Record<string, RowState>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const result = await getUserBaseAssignments();
        if (result.success && result.data) {
            setExecutives(result.data);
            const initial: Record<string, RowState> = {};
            result.data.forEach(e => {
                initial[e.userName] = { bases: e.bases, dirty: false, saving: false, saved: false };
            });
            setRows(initial);
        } else {
            setError(result.error || 'Error desconocido');
        }
        setLoading(false);
    }

    function toggleBase(userName: string, base: BaseType) {
        setRows(prev => {
            const current = prev[userName];
            if (!current) return prev;
            const has = current.bases.includes(base);
            const newBases = has
                ? current.bases.filter(b => b !== base)
                : [...current.bases, base];
            return { ...prev, [userName]: { ...current, bases: newBases, dirty: true, saved: false } };
        });
    }

    function selectAll(userName: string) {
        setRows(prev => {
            const current = prev[userName];
            if (!current) return prev;
            return { ...prev, [userName]: { ...current, bases: ALL_BASES, dirty: true, saved: false } };
        });
    }

    async function save(userName: string) {
        const row = rows[userName];
        if (!row) return;
        setRows(prev => ({ ...prev, [userName]: { ...prev[userName], saving: true } }));
        startTransition(async () => {
            const result = await updateUserBaseAssignment(userName, row.bases);
            setRows(prev => ({
                ...prev,
                [userName]: {
                    ...prev[userName],
                    saving: false,
                    dirty: !result.success,
                    saved: result.success,
                },
            }));
        });
    }

    const filtered = executives.filter(e =>
        !search ||
        e.fullName.toLowerCase().includes(search.toLowerCase()) ||
        e.userName.toLowerCase().includes(search.toLowerCase()) ||
        e.cargo.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#71717a', fontSize: '1rem', fontWeight: 600, letterSpacing: '0.1em' }}>
            CARGANDO EJECUTIVOS...
        </div>
    );

    if (error) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#ef4444', fontSize: '1rem', fontWeight: 600 }}>
            {error}
        </div>
    );

    return (
        <div style={{ fontFamily: "'Outfit', sans-serif" }}>
            {/* Sub-header */}
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                    <p style={{ color: '#a1a1aa', fontSize: '0.95rem', fontWeight: 500, margin: 0 }}>
                        Activa o desactiva el acceso a cada base por ejecutivo. Los cambios aplican inmediatamente.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Buscar ejecutivo..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            background: 'rgba(39,39,42,0.7)',
                            border: '1px solid #3f3f46',
                            borderRadius: '10px',
                            color: '#fff',
                            padding: '0.6rem 1rem',
                            fontSize: '0.85rem',
                            outline: 'none',
                            width: '220px',
                        }}
                    />
                    <button
                        onClick={loadData}
                        style={{
                            background: 'rgba(39,39,42,0.7)',
                            border: '1px solid #3f3f46',
                            borderRadius: '10px',
                            color: '#a1a1aa',
                            padding: '0.6rem 1rem',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            letterSpacing: '0.08em',
                        }}
                    >
                        ACTUALIZAR
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {ALL_BASES.map(b => {
                    const cfg = BASE_CONFIG[b];
                    return (
                        <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color }} />
                            <span style={{ color: '#a1a1aa', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em' }}>{cfg.label}</span>
                        </div>
                    );
                })}
                <span style={{ color: '#52525b', fontSize: '0.75rem', fontWeight: 600, marginLeft: 'auto' }}>
                    {filtered.length} ejecutivo{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Table */}
            <div style={{
                background: '#09090b',
                border: '1px solid #27272a',
                borderRadius: '20px',
                overflow: 'hidden',
            }}>
                {/* Table header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 130px 160px 160px 160px 140px',
                    padding: '0.9rem 1.5rem',
                    background: 'rgba(39,39,42,0.5)',
                    borderBottom: '1px solid #27272a',
                }}>
                    {['EJECUTIVO', 'CARGO', 'RYDERS', 'ESPECIAL', 'LINDA', 'ACCIÓN'].map(h => (
                        <span key={h} style={{ color: '#52525b', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.15em' }}>{h}</span>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#3f3f46', fontSize: '0.9rem', fontWeight: 600 }}>
                        No se encontraron ejecutivos
                    </div>
                )}

                {filtered.map((exec, idx) => {
                    const rowState = rows[exec.userName];
                    if (!rowState) return null;

                    return (
                        <div
                            key={exec.userName}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 130px 160px 160px 160px 140px',
                                padding: '1rem 1.5rem',
                                borderBottom: idx < filtered.length - 1 ? '1px solid rgba(39,39,42,0.8)' : 'none',
                                alignItems: 'center',
                                background: rowState.dirty ? 'rgba(234,179,8,0.03)' : 'transparent',
                                transition: 'background 0.2s',
                            }}
                        >
                            {/* Name */}
                            <div>
                                <div style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '0.9rem' }}>{exec.fullName || exec.userName}</div>
                                <div style={{ color: '#52525b', fontSize: '0.72rem', fontWeight: 600, marginTop: '2px', letterSpacing: '0.05em' }}>
                                    @{exec.userName} · <span style={{ color: '#71717a' }}>{exec.rol}</span>
                                </div>
                            </div>

                            {/* Cargo */}
                            <span style={{ color: '#71717a', fontSize: '0.78rem', fontWeight: 600 }}>{exec.cargo || '—'}</span>

                            {/* Base toggles */}
                            {ALL_BASES.map(base => {
                                const cfg = BASE_CONFIG[base];
                                const active = rowState.bases.includes(base);
                                return (
                                    <div key={base}>
                                        <button
                                            onClick={() => toggleBase(exec.userName, base)}
                                            style={{
                                                background: active ? cfg.bg : 'rgba(39,39,42,0.4)',
                                                border: `1px solid ${active ? cfg.color : '#3f3f46'}`,
                                                borderRadius: '8px',
                                                color: active ? cfg.color : '#52525b',
                                                padding: '0.4rem 1rem',
                                                fontSize: '0.7rem',
                                                fontWeight: 900,
                                                cursor: 'pointer',
                                                letterSpacing: '0.1em',
                                                transition: 'all 0.2s',
                                                boxShadow: active ? `0 0 10px ${cfg.glow}` : 'none',
                                                minWidth: '90px',
                                            }}
                                        >
                                            {active ? '✓ ACTIVO' : '✗ INACTIVO'}
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Save button */}
                            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                                {rowState.saved ? (
                                    <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em' }}>✓ GUARDADO</span>
                                ) : rowState.saving ? (
                                    <span style={{ color: '#71717a', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em' }}>GUARDANDO...</span>
                                ) : (
                                    <button
                                        onClick={() => save(exec.userName)}
                                        disabled={!rowState.dirty}
                                        style={{
                                            background: rowState.dirty ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(39,39,42,0.4)',
                                            border: '1px solid ' + (rowState.dirty ? '#10b981' : '#27272a'),
                                            borderRadius: '8px',
                                            color: rowState.dirty ? '#fff' : '#3f3f46',
                                            padding: '0.4rem 0.8rem',
                                            fontSize: '0.7rem',
                                            fontWeight: 900,
                                            cursor: rowState.dirty ? 'pointer' : 'not-allowed',
                                            letterSpacing: '0.1em',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        GUARDAR
                                    </button>
                                )}
                                {rowState.dirty && !rowState.saving && (
                                    <button
                                        onClick={() => selectAll(exec.userName)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#52525b',
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            letterSpacing: '0.06em',
                                            padding: '0 0.2rem',
                                            textAlign: 'left',
                                        }}
                                    >
                                        + todas
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
