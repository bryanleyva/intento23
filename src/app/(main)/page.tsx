'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import UserFotocheck from '@/components/UserFotocheck';
import { getPostVentaReporteData } from '@/app/actions/postventa-reporte';
import { exportVentasActivasPorSupervisor } from '@/lib/excel-utils';
import { AppSwal } from '@/lib/sweetalert';

export default function InicioPage() {
    const { data: session, status } = useSession();
    const [downloading, setDownloading] = useState(false);

    const handleDescargarVentasActivas = async () => {
        if (downloading) return;
        setDownloading(true);
        try {
            const res = await getPostVentaReporteData();
            if (!res.success || !res.data) {
                AppSwal.fire({ icon: 'error', title: 'Error', text: res.error || 'No se pudieron obtener las ventas.' });
                return;
            }
            await exportVentasActivasPorSupervisor(res.data);
        } catch (e) {
            console.error('Error al descargar ventas activas:', e);
            AppSwal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un problema al generar el reporte.' });
        } finally {
            setDownloading(false);
        }
    };

    if (status === 'loading') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const userData = session?.user ? {
        name: session.user.name || 'Usuario',
        role: (session.user as any).role || 'Personal',
        cargo: (session.user as any).cargo || '',
        dni: (session.user as any).dni || (session.user as any).id || '',
        supervisor: (session.user as any).supervisor || 'N/A',
        phone: (session.user as any).phone || '',
        photo: session.user.image || undefined
    } : null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '1rem 1rem 4rem',
            position: 'relative',
            minHeight: '85vh',
            animation: 'fadeIn 0.5s ease-out forwards'
        }}>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .layout-wrapper-inicio {
                    display: flex;
                    flex-direction: row;
                    gap: 3.5rem;
                    align-items: flex-start;
                    justify-content: center;
                    width: 100%;
                    max-width: 1400px;
                    z-index: 10;
                    margin-top: 2rem;
                }
                .side-column {
                    flex-shrink: 0;
                }
                .main-column {
                    flex: 1;
                    display: flex;
                    flexDirection: column;
                    gap: 3rem;
                    max-width: 850px;
                }
                @media (max-width: 1100px) {
                    .layout-wrapper-inicio {
                        flex-direction: column;
                        align-items: center;
                        gap: 3rem;
                    }
                    .main-column {
                        max-width: 100%;
                    }
                }
            `}</style>

            {/* Ambient Background Glow */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '1200px',
                height: '800px',
                background: 'radial-gradient(circle, rgba(79, 70, 229, 0.05) 0%, transparent 70%)',
                zIndex: -1,
                pointerEvents: 'none'
            }}></div>

            <div className="layout-wrapper-inicio">
                {/* Side: Fotocheck */}
                {userData && (
                    <div className="side-column">
                        <UserFotocheck user={userData} />
                    </div>
                )}

                {/* Side: Welcome & Cards */}
                <div className="main-column" style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                    <div className="glass-panel" style={{
                        padding: '3.5rem',
                        textAlign: 'left',
                        width: '100%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1.5rem', color: 'white', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            ¡Hola, {(userData?.name.split(' ')[0] || 'Bienvenido')}!
                        </h2>
                        <p style={{ color: '#9ca3af', fontSize: '1.25rem', lineHeight: 1.7, fontWeight: 300 }}>
                            Bienvenido a tu panel de control MK. Aquí puedes gestionar tus ventas,
                            revisar leads y monitorear tu desempeño en tiempo real. Selecciona una opción del menú para continuar.
                        </p>

                        {userData?.role === 'ADMIN' && (
                            <div style={{
                                marginTop: '2rem',
                                paddingTop: '2rem',
                                borderTop: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                            }}>
                                <span style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    Solo administradores
                                </span>
                                <button
                                    onClick={handleDescargarVentasActivas}
                                    disabled={downloading}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.7rem',
                                        alignSelf: 'flex-start',
                                        padding: '0.85rem 1.5rem',
                                        background: downloading ? 'rgba(16,185,129,0.25)' : '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.7rem',
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        cursor: downloading ? 'default' : 'pointer',
                                        transition: 'background 0.2s, transform 0.1s',
                                        boxShadow: '0 8px 20px -8px rgba(16,185,129,0.6)',
                                    }}
                                    onMouseEnter={e => { if (!downloading) (e.currentTarget as HTMLElement).style.background = '#0ea271'; }}
                                    onMouseLeave={e => { if (!downloading) (e.currentTarget as HTMLElement).style.background = '#10b981'; }}
                                >
                                    {downloading ? (
                                        <>
                                            <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                                            Generando…
                                        </>
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="7 10 12 15 17 10" />
                                                <line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                            Descargar ventas activas (XLSX)
                                        </>
                                    )}
                                </button>
                                <span style={{ color: '#6b7280', fontSize: '0.8rem', lineHeight: 1.5 }}>
                                    Todas las ventas en estado <strong style={{ color: '#9ca3af' }}>ACTIVADO</strong> del año en curso (enero → hoy),
                                    una hoja por supervisor y ordenadas por ejecutivo.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* PDF Resource Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', width: '100%' }}>
                        {[
                            {
                                title: 'Presentación de Incentivos 2026',
                                summary: 'Conoce todos los bonos, premios y esquemas de incentivos vigentes para este año.',
                                file: '/PRESENTACION DE INCENTIVOS - 2026.pdf',
                                color: '#10b981',
                            },
                            {
                                title: 'Camino Corporativo Rayders 2026',
                                summary: 'Hoja de ruta y objetivos estratégicos de Rayders para el presente año.',
                                file: '/Rayders - Camino corp 2026.pdf',
                                color: '#6366f1',
                            },
                            {
                                title: 'Tu Desarrollo en Rayders 2026',
                                summary: 'Plan de crecimiento profesional, línea de carrera y oportunidades de desarrollo.',
                                file: '/TU DESARROLLO EN RAYDERS - 2026.pdf',
                                color: '#f59e0b',
                            },
                        ].map((doc) => (
                            <a
                                key={doc.file}
                                href={doc.file}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem',
                                    padding: '1.5rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${doc.color}33`,
                                    borderRadius: '1rem',
                                    textDecoration: 'none',
                                    transition: 'background 0.2s, border-color 0.2s, transform 0.2s',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.background = `${doc.color}11`;
                                    (e.currentTarget as HTMLElement).style.borderColor = `${doc.color}66`;
                                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                                    (e.currentTarget as HTMLElement).style.borderColor = `${doc.color}33`;
                                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                                }}
                            >
                                {/* Icon */}
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '0.6rem',
                                    background: `${doc.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={doc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                </div>
                                {/* Title */}
                                <p style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', margin: 0, lineHeight: 1.3 }}>
                                    {doc.title}
                                </p>
                                {/* Summary */}
                                <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0, lineHeight: 1.5, flexGrow: 1 }}>
                                    {doc.summary}
                                </p>
                                {/* CTA */}
                                <span style={{ color: doc.color, fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    Ver documento
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={doc.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
                                    </svg>
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
