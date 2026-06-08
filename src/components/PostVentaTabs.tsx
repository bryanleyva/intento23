'use client';

import { useState } from 'react';
import PostVentaGestion from './PostVentaGestion';
import PostVentaGestionRuc10 from './PostVentaGestionRuc10';
import { PostVentaRecord } from '@/app/actions/postventa';
import { PostVentaRuc10Record } from '@/app/actions/postventa-ruc10';
import { PostVentaObservacion } from '@/app/actions/postventa-actions';

interface Props {
    cuentasRuc20: PostVentaRecord[];
    cuentasRuc10: PostVentaRuc10Record[];
    usuario: string;
    rangeLabel: string;
    userRole?: string;
    initialGuardadasRuc20?: string[];
    initialGuardadasRuc10?: string[];
    allHistorial?: PostVentaObservacion[];
    // Whether the current user can see the RUC10 tab
    showRuc10Tab: boolean;
}

type Tab = 'ruc20' | 'ruc10';

export default function PostVentaTabs({
    cuentasRuc20, cuentasRuc10, usuario, rangeLabel, userRole,
    initialGuardadasRuc20, initialGuardadasRuc10, allHistorial, showRuc10Tab,
}: Props) {
    const [tab, setTab] = useState<Tab>('ruc20');
    const isJefeBO = userRole === 'JEFE_BO';

    // Split allHistorial by RUC type for each sub-component
    const historialRuc20 = allHistorial?.filter(h => !h.ruc.startsWith('10'));
    const historialRuc10 = allHistorial?.filter(h => h.ruc.startsWith('10'));

    return (
        <div>
            {/* Selector de tipo: RUC 20 / RUC 10 */}
            {showRuc10Tab && (
                <div style={{
                    display: 'flex', gap: '0.5rem', marginBottom: '2rem',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '1rem', padding: '4px', width: 'fit-content',
                }}>
                    <button
                        onClick={() => setTab('ruc20')}
                        style={{
                            padding: '8px 22px', borderRadius: '0.75rem', cursor: 'pointer',
                            border: tab === 'ruc20' ? '1px solid rgba(251,191,36,0.35)' : '1px solid transparent',
                            background: tab === 'ruc20' ? 'rgba(251,191,36,0.1)' : 'transparent',
                            color: tab === 'ruc20' ? '#fbbf24' : '#64748b',
                            fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.05em',
                            textTransform: 'uppercase' as const, transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                        }}
                    >
                        🏢 RUC 20
                        {!isJefeBO && (
                            <span style={{
                                fontSize: '0.65rem', fontWeight: 900, minWidth: 20, textAlign: 'center',
                                background: tab === 'ruc20' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.07)',
                                borderRadius: '999px', padding: '1px 7px',
                            }}>
                                {cuentasRuc20.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setTab('ruc10')}
                        style={{
                            padding: '8px 22px', borderRadius: '0.75rem', cursor: 'pointer',
                            border: tab === 'ruc10' ? '1px solid rgba(129,140,248,0.35)' : '1px solid transparent',
                            background: tab === 'ruc10' ? 'rgba(129,140,248,0.1)' : 'transparent',
                            color: tab === 'ruc10' ? '#818cf8' : '#64748b',
                            fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.05em',
                            textTransform: 'uppercase' as const, transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                        }}
                    >
                        👤 RUC 10
                        {!isJefeBO && (
                            <span style={{
                                fontSize: '0.65rem', fontWeight: 900, minWidth: 20, textAlign: 'center',
                                background: tab === 'ruc10' ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.07)',
                                borderRadius: '999px', padding: '1px 7px',
                            }}>
                                {cuentasRuc10.length}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* Contenido según tab activo */}
            {tab === 'ruc20' || !showRuc10Tab ? (
                <PostVentaGestion
                    cuentas={cuentasRuc20}
                    usuario={usuario}
                    rangeLabel={rangeLabel}
                    userRole={userRole}
                    initialGuardadas={initialGuardadasRuc20}
                    allHistorial={historialRuc20}
                />
            ) : (
                <PostVentaGestionRuc10
                    cuentas={cuentasRuc10}
                    usuario={usuario}
                    rangeLabel={rangeLabel}
                    userRole={userRole}
                    initialGuardadas={initialGuardadasRuc10}
                    allHistorial={historialRuc10}
                />
            )}
        </div>
    );
}
