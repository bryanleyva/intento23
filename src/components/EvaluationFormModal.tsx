'use client';

import { useEffect, useState } from 'react';
import { hasSubmittedEvaluation, submitEvaluationForm } from '@/app/actions/evaluation-form';

interface EvaluationFormModalProps {
    dni: string;
    usuario: string;
    nombre: string;
}

const INC_LABELS = [
    'Caídas de señal / internet',
    'Corte de luz',
    'Problema con el equipo / PC',
    'Acceso al CRM (Viernes)',
    'Sin incidencias',
];

interface FormState {
    nombre: string;
    fecha: string;
    hora: string;
    segmento: string;
    primeraGestion: string;
    llamadas: string;
    contactos: string;
    prospectos: string;
    cotizaciones: string;
    ventas: string;
    incidencias: boolean[];
    tiempoSin: string;
    rating: number;
    comentario: string;
}

function nowParts() {
    // Use Lima time for sensible defaults
    const fmt = (opts: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', ...opts });
    const fecha = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const hora = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date());
    return { fecha, hora };
}

export default function EvaluationFormModal({ dni, usuario, nombre }: EvaluationFormModalProps) {
    const storageKey = `rayders_eval_done_${dni || usuario || 'anon'}`;

    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const { fecha, hora } = nowParts();
    const [f, setF] = useState<FormState>({
        nombre: nombre || '',
        fecha,
        hora,
        segmento: '',
        primeraGestion: '',
        llamadas: '',
        contactos: '',
        prospectos: '',
        cotizaciones: '',
        ventas: '',
        incidencias: [false, false, false, false, false],
        tiempoSin: '',
        rating: 0,
        comentario: '',
    });

    // Decide whether to show the form: once per person, until submitted.
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
                // On error, still show so the person can submit.
                if (!cancelled) setVisible(true);
            }
        })();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const upd = <K extends keyof FormState>(key: K, val: FormState[K]) =>
        setF(prev => ({ ...prev, [key]: val }));

    const toggleInc = (i: number) => {
        setF(prev => {
            const arr = prev.incidencias.slice();
            arr[i] = !arr[i];
            // "Sin incidencias" (index 4) is exclusive
            if (i === 4 && arr[4]) { arr[0] = arr[1] = arr[2] = arr[3] = false; }
            else if (i < 4 && arr[i]) { arr[4] = false; }
            return { ...prev, incidencias: arr };
        });
    };

    const handleClose = () => {
        if (sending) return;
        setClosing(true);
        setTimeout(() => { setVisible(false); setClosing(false); }, 350);
    };

    const handleSubmit = async () => {
        if (!f.nombre.trim() || !f.fecha.trim()) {
            setError('Completa al menos Nombre y Fecha.');
            return;
        }
        setSending(true);
        setError('');
        const incidenciasTexto = INC_LABELS.filter((_, i) => f.incidencias[i]).join(' | ');
        const res = await submitEvaluationForm({
            dni,
            usuario,
            nombre: f.nombre,
            fecha: f.fecha,
            hora: f.hora,
            segmento: f.segmento,
            primeraGestion: f.primeraGestion,
            llamadas: f.llamadas,
            contactos: f.contactos,
            prospectos: f.prospectos,
            cotizaciones: f.cotizaciones,
            ventas: f.ventas,
            incidenciasTexto,
            tiempoSin: f.tiempoSin,
            rating: f.rating,
            comentario: f.comentario,
        });
        setSending(false);
        if (res.success) {
            setSent(true);
            try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
            setTimeout(handleClose, 1400);
        } else {
            setError(res.error || 'No se pudo enviar. Inténtalo de nuevo.');
        }
    };

    if (!visible) return null;

    const seg = (val: string) => f.segmento === val;
    const segStyle = (on: boolean) => ({
        border: on ? '#16294A' : '#CBD4E0',
        bg: on ? '#EEF2F8' : '#FBFCFE',
        fill: on ? '#16294A' : 'transparent',
        mark: on ? '✓' : '',
    });
    const s10 = segStyle(seg('RUC 10'));
    const s20 = segStyle(seg('RUC 20'));

    const labelCap: React.CSSProperties = {
        fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px',
        textTransform: 'uppercase', color: '#6A7689',
    };
    const fieldStyle: React.CSSProperties = {
        width: '100%', height: '36px', border: '1px solid #CBD4E0', borderRadius: '7px',
        background: '#FBFCFE', padding: '0 12px', fontFamily: "'Public Sans', sans-serif",
        fontSize: '13.5px', color: '#1E2733', outline: 'none',
    };
    const numStyle: React.CSSProperties = {
        ...fieldStyle, width: '108px', height: '32px', textAlign: 'right',
        paddingRight: '12px', fontWeight: 600,
    };
    const sectionNum: React.CSSProperties = {
        width: '24px', height: '24px', borderRadius: '6px', background: '#16294A', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: '13px',
    };
    const sectionTitle: React.CSSProperties = {
        fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: '14.5px',
        letterSpacing: '1.5px', textTransform: 'uppercase', color: '#16294A',
    };

    let statusColor = '#9AA7B8', statusHalo = 'rgba(154,167,184,0.18)', statusLabel = 'Listo para enviar';
    if (sent) { statusColor = '#1E8A5B'; statusHalo = 'rgba(30,138,91,0.18)'; statusLabel = '✓ Enviado a Google Sheets'; }
    else if (error) { statusColor = '#E0382B'; statusHalo = 'rgba(224,56,43,0.18)'; statusLabel = error; }

    return (
        <>
            <style>{`
                @keyframes evalBackdropIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes evalBackdropOut { from { opacity: 1; } to { opacity: 0; } }
                @keyframes evalModalIn { from { opacity: 0; transform: translateY(24px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes evalModalOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(24px) scale(0.98); } }
                .eval-backdrop { animation: evalBackdropIn 0.3s ease forwards; }
                .eval-backdrop.closing { animation: evalBackdropOut 0.35s ease forwards; }
                .eval-sheet-wrap { animation: evalModalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .eval-sheet-wrap.closing { animation: evalModalOut 0.35s ease forwards; }
                .eval-field:focus { border-color:#16294A !important; box-shadow:0 0 0 3px rgba(22,41,74,0.12); background:#fff !important; }
                .eval-btn { font-family:'Archivo',sans-serif; font-weight:700; font-size:12.5px; letter-spacing:0.5px; border:none; border-radius:8px; padding:11px 20px; cursor:pointer; transition:filter .15s, transform .05s; }
                .eval-btn:active { transform:translateY(1px); }
                .eval-btn:hover { filter:brightness(1.08); }
                .eval-btn:disabled { opacity:0.5; cursor:default; }
            `}</style>

            <div
                className={`eval-backdrop${closing ? ' closing' : ''}`}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
                    backdropFilter: 'blur(6px)', zIndex: 100000, display: 'flex',
                    alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px',
                    overflowY: 'auto',
                }}
            >
                <div
                    className={`eval-sheet-wrap${closing ? ' closing' : ''}`}
                    style={{ width: '100%', maxWidth: '794px', margin: 'auto' }}
                >
                    {/* TOOLBAR */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: '14px', marginBottom: '14px', flexWrap: 'wrap',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                                width: '9px', height: '9px', borderRadius: '50%',
                                background: statusColor, boxShadow: `0 0 0 4px ${statusHalo}`,
                            }} />
                            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#E7EAF0' }}>{statusLabel}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className="eval-btn"
                                style={{ background: '#EEF1F6', color: '#16294A' }}
                                disabled={sending}
                                onClick={handleClose}
                            >
                                Cerrar
                            </button>
                            <button
                                className="eval-btn"
                                style={{ background: '#E0382B', color: '#fff' }}
                                disabled={sending || sent}
                                onClick={handleSubmit}
                            >
                                {sending ? 'Enviando…' : sent ? '✓ Enviado' : 'Enviar a Sheets'}
                            </button>
                        </div>
                    </div>

                    {/* SHEET */}
                    <div style={{
                        width: '100%', background: '#FFFFFF', borderRadius: '12px',
                        boxShadow: '0 18px 50px rgba(0,0,0,0.5)', display: 'flex',
                        flexDirection: 'column', overflow: 'hidden', fontFamily: "'Public Sans', sans-serif",
                    }}>
                        {/* HEADER */}
                        <header style={{ display: 'flex', minHeight: '158px', background: '#16294A' }}>
                            <div style={{
                                flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column',
                                justifyContent: 'center', color: '#FFFFFF',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    <span style={{
                                        width: '30px', height: '30px', borderRadius: '8px', background: '#E0382B',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '18px', color: '#fff',
                                    }}>R</span>
                                    <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '20px', letterSpacing: '3px' }}>RAYDERS</span>
                                    <span style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.32)' }} />
                                    <span style={{ fontSize: '11.5px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#AEBBD0', fontWeight: 600 }}>People &amp; Partners · BIC</span>
                                </div>
                                <h1 style={{ margin: 0, fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '27px', lineHeight: 1.04 }}>Formulario de Evaluación</h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '7px' }}>
                                    <span style={{ width: '26px', height: '3px', background: '#E0382B', borderRadius: '2px' }} />
                                    <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 600, fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', color: '#E0382B' }}>Jornada Remota</span>
                                </div>
                                <p style={{ margin: '11px 0 0', fontSize: '12px', color: '#C3CDDD' }}>Equipo Comercial · Registro de cierre del día · Piloto de Trabajo Remoto</p>
                            </div>
                            <div style={{ width: '210px', position: 'relative', flexShrink: 0 }} className="eval-header-img">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/formulario-rayders-header.jpg"
                                    alt="Ejecutivo en jornada remota"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '60% 22%', filter: 'grayscale(0.25) contrast(1.02)' }}
                                />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #16294A 0%, rgba(22,41,74,0.55) 22%, rgba(22,41,74,0.08) 55%, rgba(22,41,74,0) 100%)' }} />
                            </div>
                        </header>

                        {/* BODY */}
                        <div style={{ padding: '20px 28px 14px' }}>
                            {/* IDENTITY */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: '12px' }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <span style={labelCap}>Nombre del ejecutivo</span>
                                    <input className="eval-field" style={fieldStyle} type="text" value={f.nombre} onChange={e => upd('nombre', e.target.value)} placeholder="Nombre y apellido" />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <span style={labelCap}>Fecha</span>
                                    <input className="eval-field" style={fieldStyle} type="date" value={f.fecha} onChange={e => upd('fecha', e.target.value)} />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <span style={labelCap}>Hora de llenado</span>
                                    <input className="eval-field" style={fieldStyle} type="time" value={f.hora} onChange={e => upd('hora', e.target.value)} />
                                </label>
                            </div>

                            {/* SEGMENT + FIRST CONTACT */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px', marginTop: '14px', alignItems: 'end' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <span style={labelCap}>Segmento</span>
                                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                        {([['RUC 10', s10], ['RUC 20', s20]] as const).map(([val, st]) => (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => upd('segmento', seg(val) ? '' : val)}
                                                style={{
                                                    flex: 1, display: 'flex', alignItems: 'center', gap: '9px', height: '36px',
                                                    padding: '0 14px', border: `1.5px solid ${st.border}`, borderRadius: '7px',
                                                    background: st.bg, cursor: 'pointer', fontFamily: "'Public Sans', sans-serif",
                                                }}
                                            >
                                                <span style={{
                                                    width: '16px', height: '16px', border: `1.5px solid ${st.border}`,
                                                    borderRadius: '4px', background: st.fill, display: 'flex',
                                                    alignItems: 'center', justifyContent: 'center', color: '#fff',
                                                    fontSize: '11px', fontWeight: 700,
                                                }}>{st.mark}</span>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2A3340' }}>{val}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <span style={labelCap}>Hora de primera gestión</span>
                                    <input className="eval-field" style={fieldStyle} type="time" value={f.primeraGestion} onChange={e => upd('primeraGestion', e.target.value)} />
                                </label>
                            </div>

                            {/* GOALS BANNER */}
                            <div style={{
                                marginTop: '16px', border: '1px solid #DBE2EC', borderLeft: '4px solid #E0382B',
                                borderRadius: '8px', background: '#F6F8FB', padding: '11px 16px', display: 'flex',
                                gap: '24px', alignItems: 'center', flexWrap: 'wrap',
                            }}>
                                <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: '#16294A' }}>Metas del día</span>
                                <div style={{ display: 'flex', gap: '28px', flex: 1, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#E0382B' }}>RUC 10</span>
                                        <span style={{ fontSize: '12.5px', color: '#3A4654', lineHeight: 1.35 }}>Mínimo <strong>300 llamadas</strong> <em style={{ color: '#6A7689' }}>o</em> <strong>2 ventas</strong></span>
                                    </div>
                                    <div style={{ width: '1px', background: '#DBE2EC' }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#E0382B' }}>RUC 20</span>
                                        <span style={{ fontSize: '12.5px', color: '#3A4654', lineHeight: 1.35 }}>Mínimo <strong>30 contactaciones</strong> <em style={{ color: '#6A7689' }}>y</em> <strong>3 prospectos</strong></span>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 1 — PRODUCCIÓN */}
                            <div style={{ marginTop: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '11px' }}>
                                    <span style={sectionNum}>1</span>
                                    <span style={sectionTitle}>Producción del día</span>
                                    <span style={{ flex: 1, height: '1px', background: '#E3E8EF' }} />
                                </div>
                                <div style={{ border: '1px solid #DBE2EC', borderRadius: '9px', overflow: 'hidden' }}>
                                    {([
                                        ['Llamadas realizadas (total)', 'llamadas', '#FFFFFF'],
                                        ['Contactos efectivos (con quien decide)', 'contactos', '#F7F9FC'],
                                        ['Prospectos con interés', 'prospectos', '#FFFFFF'],
                                        ['Cotizaciones / propuestas enviadas', 'cotizaciones', '#F7F9FC'],
                                    ] as const).map(([label, key, bg]) => (
                                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: bg, borderBottom: '1px solid #EDF1F6' }}>
                                            <span style={{ fontSize: '13px', color: '#2A3340' }}>{label}</span>
                                            <input className="eval-field" style={numStyle} type="number" min={0} value={f[key]} onChange={e => upd(key, e.target.value)} />
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', background: '#16294A' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>Ventas cerradas</span>
                                        <input
                                            className="eval-field"
                                            style={{ ...numStyle, borderColor: '#3A4E70', background: '#1E3357', color: '#fff' }}
                                            type="number" min={0} value={f.ventas} onChange={e => upd('ventas', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2 — INCIDENCIAS */}
                            <div style={{ marginTop: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '11px' }}>
                                    <span style={sectionNum}>2</span>
                                    <span style={sectionTitle}>Incidencias técnicas</span>
                                    <span style={{ flex: 1, height: '1px', background: '#E3E8EF' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '9px' }}>
                                    {INC_LABELS.map((label, i) => {
                                        const on = f.incidencias[i];
                                        const sin = i === 4;
                                        const border = on ? (sin ? '#1E8A5B' : '#16294A') : '#CBD4E0';
                                        const bg = on ? (sin ? '#E8F6EE' : '#EEF2F8') : '#FBFCFE';
                                        const fill = on ? (sin ? '#1E8A5B' : '#16294A') : 'transparent';
                                        return (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={() => toggleInc(i)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '9px', minHeight: '36px',
                                                    padding: '0 13px', border: `1.5px solid ${border}`, borderRadius: '7px',
                                                    background: bg, cursor: 'pointer', fontFamily: "'Public Sans', sans-serif", textAlign: 'left',
                                                }}
                                            >
                                                <span style={{
                                                    width: '15px', height: '15px', border: `1.5px solid ${border}`, borderRadius: '4px',
                                                    background: fill, flexShrink: 0, display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700,
                                                }}>{on ? '✓' : ''}</span>
                                                <span style={{ fontSize: '12px', color: '#2A3340', lineHeight: 1.1 }}>{label}</span>
                                            </button>
                                        );
                                    })}
                                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#6A7689' }}>Tiempo sin trabajar</span>
                                        <input className="eval-field" style={{ ...fieldStyle, height: '34px' }} type="text" value={f.tiempoSin} onChange={e => upd('tiempoSin', e.target.value)} placeholder="ej. 30 min" />
                                    </label>
                                </div>
                            </div>

                            {/* SECTION 3 — AUTOEVALUACIÓN */}
                            <div style={{ marginTop: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '11px' }}>
                                    <span style={sectionNum}>3</span>
                                    <span style={sectionTitle}>Autoevaluación</span>
                                    <span style={{ flex: 1, height: '1px', background: '#E3E8EF' }} />
                                </div>
                                <div style={{ border: '1px solid #DBE2EC', borderRadius: '9px', padding: '13px 16px', background: '#F7F9FC' }}>
                                    <span style={{ fontSize: '12.5px', color: '#2A3340', lineHeight: 1.35, display: 'block' }}>¿Qué tan productivo te sentiste hoy en remoto vs. en oficina?</span>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '8px' }}>
                                        <span style={{ fontSize: '10.5px', color: '#8A95A6', width: '64px' }}>1 = mucho menos</span>
                                        <div style={{ display: 'flex', gap: '11px' }}>
                                            {[1, 2, 3, 4, 5].map(n => {
                                                const on = f.rating === n;
                                                return (
                                                    <button
                                                        key={n}
                                                        type="button"
                                                        onClick={() => upd('rating', n)}
                                                        style={{
                                                            width: '34px', height: '34px', border: '1.5px solid #16294A',
                                                            borderRadius: '50%', background: on ? '#16294A' : '#fff', cursor: 'pointer',
                                                            fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: '14px',
                                                            color: on ? '#fff' : '#16294A',
                                                        }}
                                                    >{n}</button>
                                                );
                                            })}
                                        </div>
                                        <span style={{ fontSize: '10.5px', color: '#8A95A6', width: '64px', textAlign: 'right' }}>5 = mucho más</span>
                                    </div>
                                </div>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                                    <span style={labelCap}>Comentario / qué te ayudaría a rendir mejor en remoto</span>
                                    <textarea
                                        className="eval-field"
                                        style={{ ...fieldStyle, height: '58px', padding: '9px 12px', resize: 'none', lineHeight: 1.4 }}
                                        value={f.comentario}
                                        onChange={e => upd('comentario', e.target.value)}
                                        placeholder="Escribe aquí…"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 28px', background: '#F4F6F9', borderTop: '1px solid #E3E8EF', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#16294A' }}>RAYDERS S.A.C.</span>
                            <span style={{ fontSize: '10.5px', color: '#8A95A6', letterSpacing: '0.4px' }}>BIC · People &amp; Partners · Documento interno de evaluación</span>
                        </footer>
                    </div>

                    <div style={{ height: '24px' }} />
                </div>
            </div>
        </>
    );
}
