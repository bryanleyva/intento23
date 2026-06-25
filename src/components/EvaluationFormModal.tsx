'use client';

import { useEffect, useMemo, useState } from 'react';
import { hasSubmittedEvaluation, submitEvaluationForm } from '@/app/actions/evaluation-form';
import { SECTIONS, type SurveyBlock } from '@/lib/survey-config';

interface EvaluationFormModalProps {
    dni: string;
    usuario: string;
    nombre: string;
}

export default function EvaluationFormModal({ dni, usuario, nombre }: EvaluationFormModalProps) {
    const storageKey = `rayders_encuesta_done_${dni || usuario || 'anon'}`;
    const total = SECTIONS.length;

    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(0); // 0 = portada, 1..total = secciones, total+1 = cierre
    const [answers, setAnswers] = useState<Record<string, string>>({ nombre: nombre || '' });

    // Mostrar el formulario una sola vez por persona, hasta que lo envíe.
    useEffect(() => {
        let cancelled = false;
        try {
            if (localStorage.getItem(storageKey) === '1') return;
        } catch { /* ignore */ }

        (async () => {
            try {
                const done = await hasSubmittedEvaluation(dni);
                if (cancelled) return;
                if (done) {
                    try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
                    return;
                }
                setVisible(true);
            } catch {
                if (!cancelled) setVisible(true);
            }
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setAns = (key: string, val: string) =>
        setAnswers(prev => ({ ...prev, [key]: val }));

    const goTo = (s: number) => {
        setStep(s);
        try {
            const el = document.getElementById('encuesta-scroll');
            if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
        } catch { /* ignore */ }
    };

    const handleClose = () => {
        if (sending) return;
        setClosing(true);
        setTimeout(() => { setVisible(false); setClosing(false); }, 350);
    };

    const handleSubmit = async () => {
        const hasAnything = Object.values(answers).some(v => (v ?? '').toString().trim() !== '');
        if (!hasAnything) {
            setError('Responde al menos una pregunta antes de enviar.');
            return;
        }
        setSending(true);
        setError('');
        const res = await submitEvaluationForm({ dni, usuario, answers });
        setSending(false);
        if (res.success) {
            setSent(true);
            try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
            goTo(total + 1);
        } else {
            setError(res.error || 'No se pudo enviar. Inténtalo de nuevo.');
        }
    };

    if (!visible) return null;

    const isCover = step === 0;
    const isClosing = step === total + 1;
    const isSection = !isCover && !isClosing;
    const isLastSection = step === total;
    const section = isSection ? SECTIONS[step - 1] : null;

    const progressPct = isCover ? 4 : isClosing ? 100 : Math.round((step / (total + 1)) * 100);
    const stepLabel = isCover ? 'Bienvenida' : isClosing ? 'Completado' : `Sección ${step} de ${total}`;

    let statusColor = '#9AA7B8', statusHalo = 'rgba(154,167,184,0.18)', statusLabel = 'Borrador en curso';
    if (sent) { statusColor = '#1E8A5B'; statusHalo = 'rgba(30,138,91,0.18)'; statusLabel = '✓ Enviado a Google Sheets'; }
    else if (error) { statusColor = '#E0382B'; statusHalo = 'rgba(224,56,43,0.18)'; statusLabel = error; }

    return (
        <>
            <style>{`
                @keyframes encBackdropIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes encBackdropOut { from { opacity: 1; } to { opacity: 0; } }
                @keyframes encModalIn { from { opacity: 0; transform: translateY(24px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes encModalOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(24px) scale(0.98); } }
                .enc-backdrop { animation: encBackdropIn 0.3s ease forwards; }
                .enc-backdrop.closing { animation: encBackdropOut 0.35s ease forwards; }
                .enc-card { animation: encModalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .enc-card.closing { animation: encModalOut 0.35s ease forwards; }
                .enc-field { width:100%; border:1px solid #CBD4E0; border-radius:9px; background:#FBFCFE; padding:11px 13px; font-family:'Public Sans',sans-serif; font-size:14px; color:#1E2733; outline:none; transition:border-color .15s, box-shadow .15s; }
                .enc-field:focus { border-color:#16294A; box-shadow:0 0 0 3px rgba(22,41,74,0.12); background:#fff; }
                textarea.enc-field { resize:vertical; min-height:80px; line-height:1.45; }
                .enc-circle { font-family:'Archivo',sans-serif; font-weight:700; cursor:pointer; transition:transform .08s, filter .12s; }
                .enc-circle:hover { transform:translateY(-1px); filter:brightness(1.04); }
                .enc-opt { cursor:pointer; transition:border-color .15s, background .15s; font-family:'Public Sans',sans-serif; }
                .enc-btn { font-family:'Archivo',sans-serif; font-weight:700; font-size:13px; letter-spacing:0.4px; border:none; border-radius:9px; padding:13px 26px; cursor:pointer; transition:filter .15s, transform .05s; }
                .enc-btn:active { transform:translateY(1px); }
                .enc-btn:hover { filter:brightness(1.07); }
                .enc-btn:disabled { opacity:0.5; cursor:default; }
            `}</style>

            <div
                className={`enc-backdrop${closing ? ' closing' : ''}`}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
                    backdropFilter: 'blur(6px)', zIndex: 100000, display: 'flex',
                    alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px',
                    overflowY: 'auto',
                }}
            >
                <div className={`enc-card${closing ? ' closing' : ''}`} style={{ width: '100%', maxWidth: '760px', margin: 'auto' }}>
                    {/* STATUS BAR */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 0 4px ${statusHalo}` }} />
                            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#E7EAF0' }}>{statusLabel}</span>
                        </div>
                        <button className="enc-btn" style={{ background: '#EEF1F6', color: '#16294A', padding: '9px 18px' }} disabled={sending} onClick={handleClose}>
                            Cerrar
                        </button>
                    </div>

                    {/* CARD */}
                    <div style={{ width: '100%', background: '#FFFFFF', borderRadius: '16px', boxShadow: '0 22px 60px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "'Public Sans', sans-serif" }}>
                        {/* HEADER */}
                        <header style={{ position: 'relative', background: '#16294A', padding: '22px 30px', overflow: 'hidden' }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <span style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#E0382B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '16px', color: '#fff' }}>R</span>
                                    <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '18px', letterSpacing: '3px', color: '#fff' }}>RAYDERS</span>
                                    <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)' }} />
                                    <span style={{ fontSize: '10.5px', letterSpacing: '1.4px', textTransform: 'uppercase', color: '#AEBBD0', fontWeight: 600 }}>Gerencia Comercial</span>
                                </div>
                                <h1 style={{ margin: '13px 0 0', fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '23px', lineHeight: 1.08, color: '#fff', maxWidth: '440px' }}>Encuesta Mensual de Percepción</h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '6px' }}>
                                    <span style={{ width: '22px', height: '3px', background: '#E0382B', borderRadius: '2px' }} />
                                    <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 600, fontSize: '12px', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#E0382B' }}>Equipo Comercial</span>
                                </div>
                            </div>
                        </header>

                        {/* PROGRESS */}
                        <div style={{ padding: '13px 30px', borderBottom: '1px solid #EDF1F6', background: '#FBFCFE' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#16294A' }}>{stepLabel}</span>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#8A95A6' }}>{progressPct}%</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '6px', background: '#E4E9F0', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#16294A,#E0382B)', borderRadius: '6px', transition: 'width .35s ease' }} />
                            </div>
                        </div>

                        {/* BODY */}
                        <div id="encuesta-scroll" style={{ padding: '28px 30px 8px', minHeight: '360px', maxHeight: '60vh', overflowY: 'auto' }}>
                            {isCover && <Cover />}
                            {isSection && section && (
                                <SectionView section={section} num={step} answers={answers} setAns={setAns} />
                            )}
                            {isClosing && <Closing />}
                        </div>

                        {/* NAV FOOTER */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 30px 20px' }}>
                            {isSection
                                ? <button className="enc-btn" style={{ background: '#EEF1F6', color: '#16294A' }} onClick={() => goTo(Math.max(0, step - 1))}>← Atrás</button>
                                : <span />}

                            <span style={{ fontSize: '11.5px', color: '#A6B0BE', fontWeight: 500 }}>
                                {isSection ? 'Tus respuestas se envían al finalizar' : ''}
                            </span>

                            {isCover && <button className="enc-btn" style={{ background: '#E0382B', color: '#fff' }} onClick={() => goTo(1)}>Comenzar →</button>}
                            {isSection && (
                                <button className="enc-btn" style={{ background: '#E0382B', color: '#fff' }} disabled={sending} onClick={() => (isLastSection ? handleSubmit() : goTo(step + 1))}>
                                    {sending ? 'Enviando…' : isLastSection ? 'Enviar respuestas' : 'Siguiente →'}
                                </button>
                            )}
                            {isClosing && <span />}
                        </div>
                    </div>

                    <div style={{ height: '24px' }} />
                </div>
            </div>
        </>
    );
}

/* ---------- Sub-vistas ---------- */

function Cover() {
    const cards: [string, string, string][] = [
        ['🎯', 'No evaluamos personas', 'Buscamos comprender experiencias.'],
        ['🔒', 'Honestidad ante todo', 'No hay respuestas correctas o incorrectas.'],
        ['👁️', 'Revisión directa', 'La Gerencia Comercial lee cada respuesta.'],
        ['⏱️', '5 a 8 minutos', 'Puedes guardar y continuar después.'],
    ];
    return (
        <div>
            <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#E0382B', background: '#FCEBE9', padding: '5px 11px', borderRadius: '20px' }}>La voz del colaborador</span>
            <h2 style={{ margin: '16px 0 0', fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '26px', lineHeight: 1.18, color: '#16294A' }}>Tu voz también construye esta empresa.</h2>
            <p style={{ margin: '16px 0 0', fontSize: '14.5px', lineHeight: 1.6, color: '#42505F' }}>Queremos conocer cómo viviste el mes, qué funcionó bien, qué podemos mejorar y qué acciones deberíamos tomar para seguir construyendo un mejor lugar para trabajar.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '22px' }}>
                {cards.map(([icon, title, sub]) => (
                    <div key={title} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start', padding: '14px', border: '1px solid #E4E9F0', borderRadius: '11px', background: '#FBFCFE' }}>
                        <span style={{ width: '30px', height: '30px', flexShrink: 0, borderRadius: '8px', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}>{icon}</span>
                        <div><div style={{ fontWeight: 700, fontSize: '13.5px', color: '#16294A' }}>{title}</div><div style={{ fontSize: '12.5px', color: '#6A7689', lineHeight: 1.4 }}>{sub}</div></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Closing() {
    return (
        <div style={{ textAlign: 'center', padding: '24px 10px 18px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#E8F6EE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '34px' }}>✓</div>
            <h2 style={{ margin: '22px 0 0', fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '24px', color: '#16294A' }}>Gracias por compartir tu opinión</h2>
            <p style={{ margin: '14px auto 0', maxWidth: '480px', fontSize: '14.5px', lineHeight: 1.6, color: '#42505F' }}>Cada respuesta representa una oportunidad para seguir creciendo como equipo. La Gerencia Comercial revisará cuidadosamente toda la información.</p>
            <p style={{ margin: '18px auto 0', maxWidth: '420px', fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: '15px', color: '#E0382B', lineHeight: 1.4 }}>Creemos que escuchar también es una forma de liderar.</p>
        </div>
    );
}

function SectionView({ section, num, answers, setAns }: {
    section: typeof SECTIONS[number];
    num: number;
    answers: Record<string, string>;
    setAns: (key: string, val: string) => void;
}) {
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#16294A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '16px' }}>{num}</span>
                <h2 style={{ margin: 0, fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '21px', color: '#16294A', lineHeight: 1.1 }}>{section.title}</h2>
            </div>
            <p style={{ margin: '0 0 4px 46px', fontSize: '13px', color: '#7A8699', lineHeight: 1.4 }}>{section.subtitle}</p>

            {section.note && (
                <div style={{ marginTop: '14px', border: '1px solid #DBE2EC', borderLeft: '4px solid #E0382B', borderRadius: '10px', background: '#F6F8FB', padding: '14px 16px', fontSize: '13.5px', lineHeight: 1.55, color: '#3A4654' }}>{section.note}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '20px' }}>
                {section.blocks.map((b, i) => (
                    <div key={i} style={{ border: '1px solid #E7EBF1', borderRadius: '13px', padding: '17px 18px', background: '#FFFFFF' }}>
                        <BlockView block={b} answers={answers} setAns={setAns} />
                    </div>
                ))}
            </div>
        </div>
    );
}

function BlockView({ block, answers, setAns }: {
    block: SurveyBlock;
    answers: Record<string, string>;
    setAns: (key: string, val: string) => void;
}) {
    if (block.type === 'likert') {
        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '13px' }}>
                    <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#16294A' }}>Califica del 1 al 5</span>
                    <span style={{ fontSize: '11px', color: '#9AA5B4' }}>{block.legend}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {block.items.map(it => (
                        <div key={it.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '6px 0', borderBottom: '1px solid #F1F4F8' }}>
                            <span style={{ fontSize: '13.5px', color: '#2A3340', fontWeight: 500 }}>{it.label}</span>
                            <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
                                {[1, 2, 3, 4, 5].map(n => <Circle key={n} n={n} active={answers[it.key] === String(n)} onClick={() => setAns(it.key, String(n))} size={34} />)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (block.type === 'scale') {
        const nums: number[] = [];
        for (let n = block.min; n <= block.max; n++) nums.push(n);
        return (
            <div>
                <span style={{ fontSize: '14px', color: '#1E2733', fontWeight: 600, display: 'block', lineHeight: 1.4 }}>{block.label}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                    {nums.map(n => <Circle key={n} n={n} active={answers[block.key] === String(n)} onClick={() => setAns(block.key, String(n))} size={42} radius={11} />)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '9px' }}>
                    <span style={{ fontSize: '11px', color: '#9AA5B4' }}>{block.low}</span>
                    <span style={{ fontSize: '11px', color: '#9AA5B4' }}>{block.high}</span>
                </div>
            </div>
        );
    }

    if (block.type === 'choice') {
        const showOther = block.other && answers[block.key] === 'Otra';
        return (
            <div>
                <span style={{ fontSize: '14px', color: '#1E2733', fontWeight: 600, display: 'block', marginBottom: '12px' }}>{block.label}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '9px' }}>
                    {block.options.map(opt => {
                        const on = answers[block.key] === opt;
                        return (
                            <button key={opt} type="button" className="enc-opt" onClick={() => setAns(block.key, on ? '' : opt)} style={{ border: `1.5px solid ${on ? '#16294A' : '#CBD4E0'}`, background: on ? '#16294A' : '#FBFCFE', color: on ? '#fff' : '#2A3340', borderRadius: '9px', padding: '9px 16px', fontSize: '13px', fontWeight: 600 }}>{opt}</button>
                        );
                    })}
                </div>
                {showOther && block.otherKey && (
                    <input className="enc-field" style={{ marginTop: '11px' }} type="text" value={answers[block.otherKey] || ''} onChange={e => setAns(block.otherKey!, e.target.value)} placeholder="Escribe cuánto tiempo…" />
                )}
            </div>
        );
    }

    if (block.type === 'text') {
        return (
            <label style={{ display: 'block' }}>
                <span style={{ fontSize: '14px', color: '#1E2733', fontWeight: 600, display: 'block', marginBottom: '10px' }}>{block.label}</span>
                <input className="enc-field" type="text" value={answers[block.key] || ''} onChange={e => setAns(block.key, e.target.value)} placeholder={block.placeholder} />
            </label>
        );
    }

    // para
    return (
        <label style={{ display: 'block' }}>
            <span style={{ fontSize: '14px', color: '#1E2733', fontWeight: 600, display: 'block', marginBottom: '10px' }}>{block.label}</span>
            <textarea className="enc-field" value={answers[block.key] || ''} onChange={e => setAns(block.key, e.target.value)} placeholder={block.placeholder} />
        </label>
    );
}

function Circle({ n, active, onClick, size, radius }: { n: number; active: boolean; onClick: () => void; size: number; radius?: number }) {
    return (
        <button
            type="button"
            className="enc-circle"
            onClick={onClick}
            style={{
                width: `${size}px`, height: `${size}px`, borderRadius: radius ? `${radius}px` : '50%',
                fontSize: size >= 42 ? '15px' : '13px',
                background: active ? '#16294A' : '#fff', color: active ? '#fff' : '#16294A',
                border: `1.5px solid ${active ? '#16294A' : '#CBD4E0'}`,
            }}
        >{n}</button>
    );
}
