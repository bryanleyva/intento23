'use client';

import { useEffect, useState } from 'react';
const STORAGE_KEY = 'announcement_el_sobre_v1';

export default function AnnouncementModal() {
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        const seen = sessionStorage.getItem(STORAGE_KEY);
        if (!seen) {
            setVisible(true);
        }
    }, []);

    const handleClose = () => {
        setClosing(true);
        sessionStorage.setItem(STORAGE_KEY, '1');
        setTimeout(() => {
            setVisible(false);
            setClosing(false);
        }, 400);
    };

    if (!visible) return null;

    return (
        <>
            <style>{`
                @keyframes backdropIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes backdropOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.85) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes modalOut {
                    from { opacity: 1; transform: scale(1) translateY(0); }
                    to { opacity: 0; transform: scale(0.85) translateY(20px); }
                }
                .ann-backdrop {
                    animation: backdropIn 0.3s ease forwards;
                }
                .ann-backdrop.closing {
                    animation: backdropOut 0.4s ease forwards;
                }
                .ann-modal {
                    animation: modalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                .ann-modal.closing {
                    animation: modalOut 0.4s ease forwards;
                }
                .ann-close-btn {
                    transition: background 0.2s, transform 0.2s;
                }
                .ann-close-btn:hover {
                    background: rgba(255,255,255,0.15) !important;
                    transform: scale(1.1);
                }
            `}</style>

            <div
                className={`ann-backdrop${closing ? ' closing' : ''}`}
                onClick={handleClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem',
                }}
            >
                <div
                    className={`ann-modal${closing ? ' closing' : ''}`}
                    onClick={e => e.stopPropagation()}
                    style={{
                        position: 'relative',
                        maxWidth: '860px',
                        width: '100%',
                        borderRadius: '1rem',
                        overflow: 'hidden',
                        boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',
                    }}
                >
                    {/* Close button */}
                    <button
                        onClick={handleClose}
                        className="ann-close-btn"
                        style={{
                            position: 'absolute',
                            top: '0.75rem',
                            right: '0.75rem',
                            zIndex: 10,
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            border: 'none',
                            background: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1,
                        }}
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>

                    {/* Image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/el sobre.jpeg"
                        alt="El Sobre - Campaña"
                        style={{ display: 'block', width: '100%', height: 'auto' }}
                    />
                </div>
            </div>
        </>
    );
}
