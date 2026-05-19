'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import * as XLSX from 'xlsx';
import { PostVentaRecord } from '@/app/actions/postventa';
import { PostVentaObservacion, savePostVentaObservacion, getPostVentaHistorial } from '@/app/actions/postventa-actions';
import { uploadFileToDrive } from '@/app/actions/drive';
import { AppSwal } from '@/lib/sweetalert';

interface Props {
    cuentas: PostVentaRecord[];
    usuario: string;
    rangeLabel: string;
    userRole?: string;
    initialGuardadas?: string[];
    allHistorial?: PostVentaObservacion[];
}

type Vista = 'gestion' | 'historial';
type Estado = 'SATISFECHO' | 'INSATISFECHO' | 'ESCALADO';

const ESTADO_CFG: Record<Estado, { bg: string; border: string; color: string; label: string; emoji: string }> = {
    'SATISFECHO':   { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.45)',  color: '#34d399', label: 'Satisfecho',   emoji: '✅' },
    'INSATISFECHO': { bg: 'rgba(245,158,11,0.15)',   border: 'rgba(245,158,11,0.45)',  color: '#fbbf24', label: 'Insatisfecho', emoji: '⚠️' },
    'ESCALADO':     { bg: 'rgba(239,68,68,0.15)',    border: 'rgba(239,68,68,0.45)',   color: '#f87171', label: 'Escalado',     emoji: '🔴' },
};

const getEstadoCfg = (e: string) => ESTADO_CFG[e as Estado] ?? { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', color: '#64748b', label: e || 'Sin estado', emoji: '—' };

const SEG_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
    'SOHO':      { bg: '#6366f115', text: '#818cf8', glow: '#6366f140' },
    'LOW PYME':  { bg: '#0ea5e915', text: '#38bdf8', glow: '#0ea5e940' },
    'HIGH PYME': { bg: '#8b5cf615', text: '#a78bfa', glow: '#8b5cf640' },
    'GRANDES':   { bg: '#f59e0b15', text: '#fbbf24', glow: '#f59e0b40' },
    'CORPOS':    { bg: '#10b98115', text: '#34d399', glow: '#10b98140' },
};
const getSeg = (s: string) => SEG_COLORS[s?.toUpperCase()] ?? { bg: '#ffffff08', text: '#94a3b8', glow: '#ffffff20' };

export default function PostVentaGestion({ cuentas, usuario, rangeLabel, userRole, initialGuardadas, allHistorial }: Props) {
    const isJefeBO = userRole === 'JEFE_BO';

    const [vista, setVista] = useState<Vista>(isJefeBO ? 'historial' : 'gestion');
    const [guardadas, setGuardadas] = useState<Set<string>>(() => new Set(initialGuardadas ?? []));
    const [filterEjecutivo, setFilterEjecutivo] = useState('');

    const filteredCuentas = filterEjecutivo
        ? cuentas.filter(c => c.ejecutivo === filterEjecutivo)
        : cuentas;

    const [idx, setIdx] = useState<number>(() => {
        const saved = new Set(initialGuardadas ?? []);
        const firstUnsaved = cuentas.findIndex(c => !saved.has(c.ruc));
        return firstUnsaved >= 0 ? firstUnsaved : 0;
    });

    const [obs, setObs] = useState('');
    const [selectedEstado, setSelectedEstado] = useState<Estado | ''>('');
    const [reGestionando, setReGestionando] = useState<Set<string>>(new Set());
    const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [historial, setHistorial] = useState<PostVentaObservacion[]>(isJefeBO ? (allHistorial ?? []) : []);
    const [loadingHist, setLoadingHist] = useState(false);
    const [filterHistUsuario, setFilterHistUsuario] = useState('');
    const [filterHistEjecutivo, setFilterHistEjecutivo] = useState('');
    const [isPending, startTransition] = useTransition();

    const cuenta = filteredCuentas[idx] ?? null;
    const total = filteredCuentas.length;
    const guardadasEnFiltro = filteredCuentas.filter(c => guardadas.has(c.ruc)).length;
    const progreso = total > 0 ? Math.round((guardadasEnFiltro / total) * 100) : 0;
    const segColor = cuenta ? getSeg(cuenta.segmento) : getSeg('');
    const yaGuardada = cuenta ? guardadas.has(cuenta.ruc) : false;
    const enReGestion = cuenta ? reGestionando.has(cuenta.ruc) : false;
    const mostrarForm = !yaGuardada || enReGestion;
    const terminado = guardadasEnFiltro === total && total > 0;

    const ejecutivosUnicos = [...new Set(cuentas.map(c => c.ejecutivo).filter(Boolean))].sort();

    // Reset idx when filter changes
    useEffect(() => {
        const firstUnsaved = filteredCuentas.findIndex(c => !guardadas.has(c.ruc));
        setIdx(firstUnsaved >= 0 ? firstUnsaved : 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterEjecutivo]);

    // Load own historial when switching to historial tab
    useEffect(() => {
        if (isJefeBO) return;
        if (vista === 'historial') {
            setLoadingHist(true);
            getPostVentaHistorial(usuario).then(r => {
                if (r.success) setHistorial(r.data ?? []);
                setLoadingHist(false);
            });
        }
    }, [vista, usuario, isJefeBO]);

    // Clear form when account changes
    useEffect(() => {
        setObs('');
        setSelectedEstado('');
        setUploadedFiles([]);
    }, [idx]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        for (const file of Array.from(files)) {
            const fd = new FormData();
            fd.append('file', file);
            const res = await uploadFileToDrive(fd);
            if (res.success && res.fileId) {
                setUploadedFiles(prev => [...prev, { id: res.fileId!, name: file.name }]);
            } else {
                AppSwal.fire({ icon: 'error', title: 'Error al subir', text: res.error ?? 'Error desconocido', confirmButtonColor: '#ef4444' });
            }
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleGuardar = () => {
        if (!obs.trim()) {
            AppSwal.fire({ icon: 'warning', title: 'Escribe una observación', confirmButtonColor: '#10b981' });
            return;
        }
        if (!selectedEstado) {
            AppSwal.fire({ icon: 'warning', title: 'Selecciona un estado', text: 'Debes seleccionar SATISFECHO, INSATISFECHO o ESCALADO.', confirmButtonColor: '#10b981' });
            return;
        }
        if (!cuenta) return;

        startTransition(async () => {
            const res = await savePostVentaObservacion({
                ruc: cuenta.ruc,
                razonSocial: cuenta.razonSocial,
                telefono: cuenta.telefono,
                ejecutivoOriginal: cuenta.ejecutivo,
                lineas: cuenta.lineas,
                cargoFijo: cuenta.cargoFijo,
                segmento: cuenta.segmento,
                observacion: obs.trim(),
                estado: selectedEstado,
                evidenciaIds: uploadedFiles.map(f => f.id).join(','),
                usuario,
            });

            if (res.success) {
                setReGestionando(prev => { const n = new Set(prev); n.delete(cuenta.ruc); return n; });
                if (selectedEstado === 'SATISFECHO' || selectedEstado === 'ESCALADO') {
                    setGuardadas(prev => new Set([...prev, cuenta.ruc]));
                    if (idx < total - 1) {
                        setTimeout(() => setIdx(i => i + 1), 600);
                    }
                } else {
                    // INSATISFECHO: stays in queue
                    setGuardadas(prev => { const n = new Set(prev); n.delete(cuenta.ruc); return n; });
                    AppSwal.fire({ icon: 'info', title: 'Registrado como Insatisfecho', text: 'La cuenta permanece en cola para seguimiento.', confirmButtonColor: '#f59e0b' });
                }
            } else {
                AppSwal.fire({ icon: 'error', title: 'Error', text: res.error ?? 'No se pudo guardar', confirmButtonColor: '#ef4444' });
            }
        });
    };

    const handleExportExcel = () => {
        const rows = filteredHist.map(h => ({
            'ID':           h.id ?? '',
            'RUC':          h.ruc ?? '',
            'Razón Social': h.razonSocial ?? '',
            'Teléfono':     h.telefono ?? '',
            'Ejecutivo':    h.ejecutivoOriginal ?? '',
            'Líneas':       h.lineas ?? '',
            'Cargo Fijo':   h.cargoFijo ?? '',
            'Segmento':     h.segmento ?? '',
            'Observación':  h.observacion ?? '',
            'Estado':       h.estado ?? '',
            'Usuario':      h.usuario ?? '',
            'Fecha':        h.fecha ?? '',
        }));

        const ws = XLSX.utils.json_to_sheet(rows);

        // Ancho de columnas
        ws['!cols'] = [
            { wch: 8 },   // ID
            { wch: 14 },  // RUC
            { wch: 40 },  // Razón Social
            { wch: 16 },  // Teléfono
            { wch: 30 },  // Ejecutivo
            { wch: 8 },   // Líneas
            { wch: 12 },  // Cargo Fijo
            { wch: 14 },  // Segmento
            { wch: 60 },  // Observación
            { wch: 14 },  // Estado
            { wch: 22 },  // Usuario
            { wch: 20 },  // Fecha
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Post Venta');

        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `postventa-${fecha}.xlsx`);
    };

    const filteredHist = historial
        .filter(h => !filterHistUsuario || h.usuario === filterHistUsuario)
        .filter(h => !filterHistEjecutivo || h.ejecutivoOriginal === filterHistEjecutivo);

    const histUsuariosUnicos = [...new Set(historial.map(h => h.usuario).filter(Boolean))].sort();
    const histEjecutivosUnicos = [...new Set(historial.map(h => h.ejecutivoOriginal).filter(Boolean))].sort();

    return (
        <div style={{ color: 'white', maxWidth: '860px', margin: '0 auto' }}>
            <style>{`
                .pv-tabs { display:flex; gap:0.5rem; margin-bottom:2rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:1rem; padding:4px; width:fit-content; }
                .pv-tab { padding:8px 20px; border-radius:0.75rem; font-size:0.8rem; font-weight:800; letter-spacing:0.05em; cursor:pointer; border:none; background:transparent; color:#64748b; transition:all 0.2s; text-transform:uppercase; }
                .pv-tab.active { background:rgba(16,185,129,0.15); color:#34d399; box-shadow:inset 0 0 0 1px rgba(16,185,129,0.3); }

                .pv-progress-wrap { margin-bottom:1.75rem; }
                .pv-progress-labels { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; }
                .pv-progress-text { font-size:0.72rem; font-weight:800; color:#64748b; letter-spacing:0.06em; text-transform:uppercase; }
                .pv-progress-count { font-size:0.8rem; font-weight:900; color:#34d399; }
                .pv-bar-bg { height:6px; background:rgba(255,255,255,0.06); border-radius:999px; overflow:hidden; }
                .pv-bar-fill { height:100%; background:linear-gradient(90deg,#10b981,#34d399); border-radius:999px; transition:width 0.6s cubic-bezier(0.4,0,0.2,1); }

                .pv-filter-bar { display:flex; align-items:center; gap:0.75rem; margin-bottom:1.5rem; flex-wrap:wrap; }
                .pv-filter-label { font-size:0.68rem; font-weight:900; color:#475569; text-transform:uppercase; letter-spacing:0.08em; white-space:nowrap; }
                .pv-select { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:0.75rem; color:white; font-size:0.82rem; padding:8px 14px; outline:none; cursor:pointer; transition:border-color 0.2s; }
                .pv-select:focus { border-color:rgba(16,185,129,0.4); }
                .pv-select option { background:#0f172a; color:white; }

                .pv-cuenta-card { border-radius:1.5rem; overflow:hidden; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); margin-bottom:1.25rem; transition:border-color 0.3s; }
                .pv-cuenta-card.guardada { border-color:rgba(16,185,129,0.35); background:rgba(16,185,129,0.03); }
                .pv-cuenta-card.insatisfecho { border-color:rgba(245,158,11,0.35); background:rgba(245,158,11,0.02); }
                .pv-cuenta-top { padding:1.75rem 2rem 1.25rem; display:flex; align-items:flex-start; gap:1.25rem; }
                .pv-cuenta-avatar { width:52px; height:52px; border-radius:1rem; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0; }
                .pv-cuenta-info { flex:1; min-width:0; }
                .pv-cuenta-ruc { font-size:0.68rem; font-weight:900; color:#475569; letter-spacing:0.12em; margin-bottom:3px; display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; }
                .pv-ruc-tag { font-size:0.58rem; padding:2px 8px; border-radius:999px; font-weight:900; }
                .pv-ruc10 { background:rgba(99,102,241,0.2); color:#818cf8; border:1px solid rgba(99,102,241,0.3); }
                .pv-ruc20 { background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.25); }
                .pv-cuenta-nombre { font-size:1.3rem; font-weight:950; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:-0.01em; }
                .pv-cuenta-seg { display:inline-block; font-size:0.62rem; font-weight:900; padding:3px 10px; border-radius:999px; margin-top:6px; letter-spacing:0.05em; }
                .pv-cuenta-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; border-top:1px solid rgba(255,255,255,0.05); }
                .pv-data-cell { padding:1rem 2rem; border-right:1px solid rgba(255,255,255,0.04); }
                .pv-data-cell:last-child { border-right:none; }
                .pv-data-label { font-size:0.6rem; font-weight:900; color:#475569; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:3px; }
                .pv-data-value { font-size:0.95rem; font-weight:700; color:#e2e8f0; }
                .pv-data-value.tel { color:#38bdf8; font-size:1.05rem; }
                .pv-cuenta-ejec { font-size:0.72rem; color:#64748b; margin-top:4px; }

                .pv-estado-section { margin-bottom:1rem; }
                .pv-estado-label { font-size:0.7rem; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem; }
                .pv-estado-required { color:#f43f5e; font-size:0.9rem; }
                .pv-estado-btns { display:flex; gap:0.6rem; flex-wrap:wrap; }
                .pv-estado-btn { padding:9px 18px; border-radius:0.875rem; font-size:0.78rem; font-weight:800; cursor:pointer; border:1px solid transparent; letter-spacing:0.04em; text-transform:uppercase; transition:all 0.2s; display:flex; align-items:center; gap:0.4rem; background:rgba(255,255,255,0.04); color:#64748b; border-color:rgba(255,255,255,0.08); }
                .pv-estado-btn:hover { opacity:0.85; }
                .pv-estado-btn.selected { transform:scale(1.03); box-shadow:0 4px 15px rgba(0,0,0,0.2); }

                .pv-obs-wrap { margin-bottom:1rem; }
                .pv-obs-label { font-size:0.7rem; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem; }
                .pv-obs-required { color:#f43f5e; font-size:0.9rem; }
                .pv-obs-textarea { width:100%; min-height:100px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:1rem; padding:1rem 1.25rem; color:white; font-size:0.9rem; resize:vertical; outline:none; transition:border-color 0.2s, box-shadow 0.2s; font-family:inherit; box-sizing:border-box; }
                .pv-obs-textarea:focus { border-color:rgba(16,185,129,0.5); box-shadow:0 0 0 3px rgba(16,185,129,0.08); }
                .pv-obs-textarea::placeholder { color:#334155; }
                .pv-obs-textarea:disabled { opacity:0.5; cursor:not-allowed; }

                .pv-upload-section { margin-bottom:1.25rem; }
                .pv-upload-btn { display:inline-flex; align-items:center; gap:0.5rem; padding:8px 16px; border-radius:0.75rem; font-size:0.78rem; font-weight:800; cursor:pointer; border:1px dashed rgba(255,255,255,0.15); background:rgba(255,255,255,0.03); color:#94a3b8; transition:all 0.2s; }
                .pv-upload-btn:hover { border-color:rgba(99,102,241,0.4); color:#a78bfa; background:rgba(99,102,241,0.06); }
                .pv-upload-files { display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.6rem; }
                .pv-file-chip { display:inline-flex; align-items:center; gap:0.3rem; font-size:0.68rem; font-weight:700; color:#818cf8; background:rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.25); border-radius:999px; padding:3px 10px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

                .pv-actions { display:flex; gap:0.75rem; align-items:center; }
                .pv-btn { padding:12px 24px; border-radius:0.875rem; font-size:0.82rem; font-weight:800; cursor:pointer; border:none; letter-spacing:0.04em; text-transform:uppercase; transition:all 0.2s; display:flex; align-items:center; gap:0.5rem; }
                .pv-btn:disabled { opacity:0.35; cursor:not-allowed; transform:none !important; }
                .pv-btn-guardar { background:linear-gradient(135deg,#10b981,#059669); color:white; flex:1; justify-content:center; box-shadow:0 4px 15px rgba(16,185,129,0.25); }
                .pv-btn-guardar:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(16,185,129,0.35); }
                .pv-btn-nav { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); color:#94a3b8; padding:12px 16px; }
                .pv-btn-nav:not(:disabled):hover { background:rgba(255,255,255,0.09); color:white; }
                .pv-btn-siguiente { background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); color:#818cf8; }
                .pv-btn-siguiente:not(:disabled):hover { background:rgba(99,102,241,0.25); }
                .pv-btn-regest { background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); color:#fbbf24; }
                .pv-btn-regest:not(:disabled):hover { background:rgba(245,158,11,0.2); }
                .pv-btn-export { background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); color:#34d399; padding:9px 18px; font-size:0.75rem; border-radius:0.75rem; cursor:pointer; font-weight:800; letter-spacing:0.04em; text-transform:uppercase; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.4rem; }
                .pv-btn-export:hover { background:rgba(16,185,129,0.2); }

                .pv-saved-badge { display:flex; align-items:center; gap:0.75rem; border-radius:0.875rem; padding:12px 18px; margin-bottom:1rem; font-size:0.82rem; font-weight:800; flex-wrap:wrap; }

                .pv-done { text-align:center; padding:4rem 2rem; }
                .pv-done-icon { font-size:4rem; margin-bottom:1rem; }
                .pv-done-title { font-size:2rem; font-weight:950; color:white; margin:0 0 0.5rem; }
                .pv-done-sub { color:#64748b; font-size:0.95rem; }

                .pv-hist-filters { display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:1.25rem; align-items:center; }
                .pv-hist-grid { display:flex; flex-direction:column; gap:0.75rem; }
                .pv-hist-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:1.25rem; padding:1.25rem 1.5rem; }
                .pv-hist-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; gap:1rem; }
                .pv-hist-nombre { font-size:0.95rem; font-weight:800; color:white; }
                .pv-hist-ruc { font-size:0.68rem; font-weight:700; color:#475569; }
                .pv-hist-fecha { font-size:0.68rem; color:#475569; white-space:nowrap; }
                .pv-hist-obs { font-size:0.85rem; color:#94a3b8; line-height:1.5; background:rgba(255,255,255,0.03); border-radius:0.75rem; padding:0.75rem 1rem; border-left:3px solid rgba(16,185,129,0.4); }
                .pv-hist-meta { display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.6rem; align-items:center; }
                .pv-hist-chip { font-size:0.65rem; font-weight:700; color:#64748b; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); border-radius:999px; padding:3px 10px; }
                .pv-hist-estado-chip { font-size:0.65rem; font-weight:900; border-radius:999px; padding:3px 10px; letter-spacing:0.05em; text-transform:uppercase; }
                .pv-hist-file-link { font-size:0.65rem; font-weight:700; color:#818cf8; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:999px; padding:3px 10px; text-decoration:none; display:inline-flex; align-items:center; gap:0.3rem; }
                .pv-hist-file-link:hover { background:rgba(99,102,241,0.2); }
                .pv-empty-hist { text-align:center; padding:3rem; color:#475569; }

                @keyframes spin { to { transform:rotate(360deg); } }
                .pv-spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,0.2); border-top-color:white; border-radius:50%; animation:spin 0.7s linear infinite; flex-shrink:0; }
            `}</style>

            {/* TABS */}
            <div className="pv-tabs">
                {!isJefeBO && (
                    <button className={`pv-tab ${vista === 'gestion' ? 'active' : ''}`} onClick={() => setVista('gestion')}>
                        📞 Gestión
                    </button>
                )}
                <button className={`pv-tab ${vista === 'historial' ? 'active' : ''}`} onClick={() => setVista('historial')}>
                    {isJefeBO ? '📋 Todos los registros' : '📋 Mis registros'}
                </button>
            </div>

            {/* ══════════ GESTIÓN ══════════ */}
            {vista === 'gestion' && (
                <>
                    {/* Filtro por ejecutivo */}
                    {ejecutivosUnicos.length > 0 && (
                        <div className="pv-filter-bar">
                            <span className="pv-filter-label">Filtrar por ejecutivo:</span>
                            <select
                                className="pv-select"
                                value={filterEjecutivo}
                                onChange={e => setFilterEjecutivo(e.target.value)}
                            >
                                <option value="">Todos ({cuentas.length})</option>
                                {ejecutivosUnicos.map(ej => (
                                    <option key={ej} value={ej}>{ej}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {total === 0 ? (
                        <div className="pv-done">
                            <div className="pv-done-icon">📭</div>
                            <div className="pv-done-title">Sin cuentas</div>
                            <div className="pv-done-sub">
                                {filterEjecutivo ? `No hay cuentas para ${filterEjecutivo}` : `No hay ventas ACTIVADAS en ${rangeLabel}`}
                            </div>
                        </div>
                    ) : terminado ? (
                        <div className="pv-done">
                            <div className="pv-done-icon">🎉</div>
                            <div className="pv-done-title">¡Gestión completada!</div>
                            <div className="pv-done-sub">Gestionaste las {total} cuentas · {rangeLabel}</div>
                            <button className="pv-btn pv-btn-siguiente" style={{ margin: '1.5rem auto 0', display: 'flex' }} onClick={() => setVista('historial')}>
                                Ver mis registros →
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* PROGRESS */}
                            <div className="pv-progress-wrap">
                                <div className="pv-progress-labels">
                                    <span className="pv-progress-text">Progreso · {rangeLabel}</span>
                                    <span className="pv-progress-count">{guardadasEnFiltro} / {total}</span>
                                </div>
                                <div className="pv-bar-bg">
                                    <div className="pv-bar-fill" style={{ width: `${progreso}%` }} />
                                </div>
                            </div>

                            {/* CUENTA CARD */}
                            {cuenta && (
                                <div className={`pv-cuenta-card ${yaGuardada && !enReGestion ? 'guardada' : ''}`}
                                     style={{ boxShadow: yaGuardada && !enReGestion ? `0 0 30px ${segColor.glow}` : 'none' }}>
                                    <div className="pv-cuenta-top">
                                        <div className="pv-cuenta-avatar"
                                             style={{ background: segColor.bg, border: `1px solid ${segColor.glow}` }}>
                                            {cuenta.isRuc10 ? '👤' : '🏢'}
                                        </div>
                                        <div className="pv-cuenta-info">
                                            <div className="pv-cuenta-ruc">
                                                {cuenta.ruc}
                                                <span className={`pv-ruc-tag ${cuenta.isRuc10 ? 'pv-ruc10' : 'pv-ruc20'}`}>
                                                    {cuenta.isRuc10 ? 'RUC 10' : 'RUC 20'}
                                                </span>
                                            </div>
                                            <div className="pv-cuenta-nombre" title={cuenta.razonSocial}>
                                                {cuenta.razonSocial}
                                            </div>
                                            {cuenta.segmento && (
                                                <span className="pv-cuenta-seg"
                                                      style={{ background: segColor.bg, color: segColor.text, border: `1px solid ${segColor.glow}` }}>
                                                    {cuenta.segmento}
                                                </span>
                                            )}
                                            {cuenta.ejecutivo && (
                                                <div className="pv-cuenta-ejec">👤 {cuenta.ejecutivo}</div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cuenta</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 950, lineHeight: 1 }}>
                                                <span style={{ color: 'white' }}>{idx + 1}</span>
                                                <span style={{ fontSize: '1rem', color: '#334155' }}>/{total}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pv-cuenta-grid">
                                        <div className="pv-data-cell">
                                            <div className="pv-data-label">📞 Teléfono</div>
                                            <div className="pv-data-value tel">{cuenta.telefono || '—'}</div>
                                        </div>
                                        <div className="pv-data-cell">
                                            <div className="pv-data-label">📶 Líneas</div>
                                            <div className="pv-data-value">{cuenta.lineas || '—'}</div>
                                        </div>
                                        <div className="pv-data-cell">
                                            <div className="pv-data-label">💰 Cargo Fijo</div>
                                            <div className="pv-data-value">S/ {cuenta.cargoFijo || '—'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* FORM or SAVED BADGE */}
                            {yaGuardada && !enReGestion ? (
                                <div className="pv-saved-badge"
                                     style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
                                    <span>✅ Cuenta gestionada</span>
                                    <button className="pv-btn pv-btn-regest" style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: '0.72rem' }}
                                            onClick={() => { setReGestionando(prev => new Set([...prev, cuenta!.ruc])); }}>
                                        Re-gestionar
                                    </button>
                                </div>
                            ) : mostrarForm && (
                                <>
                                    {/* ESTADO */}
                                    <div className="pv-estado-section">
                                        <div className="pv-estado-label">
                                            Estado de la gestión <span className="pv-estado-required">*</span>
                                        </div>
                                        <div className="pv-estado-btns">
                                            {(Object.entries(ESTADO_CFG) as [Estado, typeof ESTADO_CFG[Estado]][]).map(([key, cfg]) => (
                                                <button
                                                    key={key}
                                                    className={`pv-estado-btn ${selectedEstado === key ? 'selected' : ''}`}
                                                    style={selectedEstado === key ? { background: cfg.bg, borderColor: cfg.border, color: cfg.color } : {}}
                                                    onClick={() => setSelectedEstado(key)}
                                                    disabled={isPending}
                                                >
                                                    {cfg.emoji} {cfg.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* OBSERVACIÓN */}
                                    <div className="pv-obs-wrap">
                                        <div className="pv-obs-label">
                                            Observación de la llamada <span className="pv-obs-required">*</span>
                                        </div>
                                        <textarea
                                            className="pv-obs-textarea"
                                            placeholder="Ej: Cliente atendió, confirma que está activado. Conforme con el servicio..."
                                            value={obs}
                                            onChange={e => setObs(e.target.value)}
                                            disabled={isPending}
                                        />
                                    </div>

                                    {/* EVIDENCIA */}
                                    <div className="pv-upload-section">
                                        <div className="pv-obs-label">Evidencia (capturas, audios, docs)</div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={handleFileUpload}
                                        />
                                        <button className="pv-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading || isPending}>
                                            {uploading ? <><div className="pv-spinner" style={{ borderTopColor: '#a78bfa' }} /> Subiendo...</> : <>📎 Adjuntar archivos</>}
                                        </button>
                                        {uploadedFiles.length > 0 && (
                                            <div className="pv-upload-files">
                                                {uploadedFiles.map((f, i) => (
                                                    <span key={i} className="pv-file-chip" title={f.name}>📄 {f.name}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* BOTONES */}
                            <div className="pv-actions">
                                <button className="pv-btn pv-btn-nav" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} title="Anterior">←</button>

                                {yaGuardada && !enReGestion ? (
                                    <button className="pv-btn pv-btn-siguiente" onClick={() => setIdx(i => Math.min(total - 1, i + 1))} disabled={idx === total - 1} style={{ flex: 1, justifyContent: 'center' }}>
                                        Siguiente cuenta →
                                    </button>
                                ) : (
                                    <button className="pv-btn pv-btn-guardar" onClick={handleGuardar} disabled={isPending || !obs.trim() || !selectedEstado}>
                                        {isPending ? <><div className="pv-spinner" /> Guardando...</> : <>✓ Guardar gestión</>}
                                    </button>
                                )}

                                <button className="pv-btn pv-btn-nav" onClick={() => setIdx(i => Math.min(total - 1, i + 1))} disabled={idx === total - 1} title="Siguiente sin guardar">→</button>
                            </div>

                            <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.65rem', color: '#1e293b', fontWeight: 700 }}>
                                La flecha → salta sin guardar · Estado requerido para registrar
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ══════════ HISTORIAL ══════════ */}
            {vista === 'historial' && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>
                            {isJefeBO ? 'Todas las gestiones registradas' : 'Mis gestiones registradas'}
                        </h2>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700 }}>{filteredHist.length} registros</span>
                            {isJefeBO && (
                                <button className="pv-btn-export" onClick={handleExportExcel}>
                                    ⬇ Exportar Excel
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filtros historial (JEFE_BO) */}
                    {isJefeBO && (
                        <div className="pv-hist-filters">
                            <span className="pv-filter-label">Filtrar:</span>
                            {histUsuariosUnicos.length > 0 && (
                                <select className="pv-select" value={filterHistUsuario} onChange={e => setFilterHistUsuario(e.target.value)}>
                                    <option value="">Todos los usuarios</option>
                                    {histUsuariosUnicos.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            )}
                            {histEjecutivosUnicos.length > 0 && (
                                <select className="pv-select" value={filterHistEjecutivo} onChange={e => setFilterHistEjecutivo(e.target.value)}>
                                    <option value="">Todos los ejecutivos</option>
                                    {histEjecutivosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            )}
                        </div>
                    )}

                    {loadingHist ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
                            <div className="pv-spinner" style={{ margin: '0 auto 1rem', width: 30, height: 30, borderWidth: 3 }} />
                            Cargando historial...
                        </div>
                    ) : filteredHist.length === 0 ? (
                        <div className="pv-empty-hist">
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                            <div style={{ fontWeight: 700, color: '#64748b' }}>Sin registros</div>
                            <div style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>
                                {historial.length > 0 ? 'Ningún registro coincide con los filtros' : 'Empieza a gestionar cuentas en la pestaña Gestión'}
                            </div>
                        </div>
                    ) : (
                        <div className="pv-hist-grid">
                            {filteredHist.map((h, i) => {
                                const sc = getSeg(h.segmento);
                                const ec = getEstadoCfg(h.estado);
                                const fileIds = h.evidenciaIds ? h.evidenciaIds.split(',').filter(Boolean) : [];
                                return (
                                    <div className="pv-hist-card" key={i}>
                                        <div className="pv-hist-header">
                                            <div>
                                                <div className="pv-hist-nombre">{h.razonSocial}</div>
                                                <div className="pv-hist-ruc">{h.ruc}</div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                                                {h.estado && (
                                                    <span className="pv-hist-estado-chip"
                                                          style={{ background: ec.bg, border: `1px solid ${ec.border}`, color: ec.color }}>
                                                        {ec.emoji} {ec.label}
                                                    </span>
                                                )}
                                                <span className="pv-hist-fecha">{h.fecha}</span>
                                            </div>
                                        </div>
                                        <div className="pv-hist-obs">{h.observacion}</div>
                                        <div className="pv-hist-meta">
                                            {isJefeBO && h.usuario && (
                                                <span className="pv-hist-chip" style={{ color: '#a78bfa', borderColor: '#8b5cf640', background: 'rgba(139,92,246,0.08)' }}>
                                                    🎧 {h.usuario}
                                                </span>
                                            )}
                                            {h.segmento && (
                                                <span className="pv-hist-chip" style={{ color: sc.text, borderColor: sc.glow }}>
                                                    {h.segmento}
                                                </span>
                                            )}
                                            {h.telefono && <span className="pv-hist-chip">📞 {h.telefono}</span>}
                                            {h.lineas && <span className="pv-hist-chip">📶 {h.lineas} líneas</span>}
                                            {h.ejecutivoOriginal && <span className="pv-hist-chip">👤 {h.ejecutivoOriginal}</span>}
                                            {fileIds.map((fid, fi) => (
                                                <a key={fi} className="pv-hist-file-link"
                                                   href={`https://drive.google.com/file/d/${fid}/view`}
                                                   target="_blank" rel="noopener noreferrer">
                                                    📎 Archivo {fi + 1}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
