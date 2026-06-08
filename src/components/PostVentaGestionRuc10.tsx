'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import * as XLSX from 'xlsx';
import { PostVentaRuc10Record, getPostVentaRuc10Data } from '@/app/actions/postventa-ruc10';
import { PostVentaObservacion, savePostVentaObservacion, getPostVentaHistorial, updatePostVentaObservacion } from '@/app/actions/postventa-actions';
import { uploadFileToDrive } from '@/app/actions/drive';
import { AppSwal } from '@/lib/sweetalert';

interface Props {
    cuentas: PostVentaRuc10Record[];
    usuario: string;
    rangeLabel: string;
    userRole?: string;
    initialGuardadas?: string[];
    allHistorial?: PostVentaObservacion[];
}

type Vista = 'gestion' | 'historial';

type MotivoConfig = { key: string; label: string; submotivos: string[] };
type EstadoConfig = { label: string; emoji: string; color: string; bg: string; border: string; motivos: MotivoConfig[] };
type EstadoKey = 'SATISFECHO' | 'INSATISFECHO' | 'NO CONTESTA' | 'SIN LLEGADA AL ENCARGADO' | 'PROBLEMAS DE FACTURACION';

const ESTADOS: Record<EstadoKey, EstadoConfig> = {
    'SATISFECHO': {
        label: 'Satisfecho', emoji: '✅',
        color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.45)',
        motivos: [],
    },
    'INSATISFECHO': {
        label: 'Insatisfecho', emoji: '⚠️',
        color: '#fbbf24', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.45)',
        motivos: [
            { key: 'PROBLEMAS TECNICOS', label: 'Problemas técnicos', submotivos: ['PROBLEMAS DE SEÑAL', 'INTERNET LENTO', 'SIN SERVICIO', 'PROBLEMAS DE CONFIGURACION'] },
            { key: 'DESCUENTOS NO PACTADOS', label: 'Descuentos no pactados', submotivos: [] },
            { key: 'BENEFICIO NO BRINDADO', label: 'Beneficio no brindado', submotivos: [] },
            { key: 'CLIENTE MOLESTO', label: 'Cliente molesto', submotivos: [] },
            { key: 'SOLICITA BAJA O PORTABILIDAD', label: 'Solicita baja o portabilidad', submotivos: [] },
            { key: 'VENTA OBSERVADA POR CALIDAD', label: 'Venta observada por calidad', submotivos: [] },
            { key: 'POSIBLE REVERSION', label: 'Posible reversión', submotivos: [] },
        ],
    },
    'NO CONTESTA': {
        label: 'No contesta', emoji: '📵',
        color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.4)',
        motivos: [],
    },
    'SIN LLEGADA AL ENCARGADO': {
        label: 'Sin llegada al encargado', emoji: '🚫',
        color: '#64748b', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)',
        motivos: [],
    },
    'PROBLEMAS DE FACTURACION': {
        label: 'Problemas de facturación', emoji: '🧾',
        color: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.45)',
        motivos: [
            { key: 'PLAN INCORRECTO', label: 'Plan incorrecto', submotivos: ['FACTURACION INCORRECTA', 'COBRO ADICIONAL', 'ERROR EN LA PROMOCION'] },
        ],
    },
};

const ESTADO_KEYS = Object.keys(ESTADOS) as EstadoKey[];

const getEstadoCfg = (e: string): EstadoConfig & { emoji: string } =>
    ESTADOS[e as EstadoKey] ?? { label: e || 'Sin estado', emoji: '—', color: '#64748b', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', motivos: [] };

const TIPO_VENTA_STYLE: Record<string, { color: string; bg: string; border: string }> = {
    'ALTA':         { color: '#34d399', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.35)' },
    'PORTABILIDAD': { color: '#818cf8', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.35)' },
};
const getTipoVentaStyle = (t: string) =>
    TIPO_VENTA_STYLE[t?.toUpperCase()] ?? { color: '#94a3b8', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)' };

export default function PostVentaGestionRuc10({ cuentas, usuario, rangeLabel, userRole, initialGuardadas, allHistorial }: Props) {
    const isJefeBO = userRole === 'JEFE_BO';

    const [vista, setVista] = useState<Vista>(isJefeBO ? 'historial' : 'gestion');
    const [guardadas, setGuardadas] = useState<Set<string>>(() => new Set(initialGuardadas ?? []));

    const [idx, setIdx] = useState<number>(() => {
        const saved = new Set(initialGuardadas ?? []);
        const first = cuentas.findIndex(c => !saved.has(c.ruc));
        return first >= 0 ? first : 0;
    });

    const [obs, setObs] = useState('');
    const [selectedEstado, setSelectedEstado] = useState<EstadoKey | ''>('');
    const [selectedMotivo, setSelectedMotivo] = useState('');
    const [selectedSubmotivo, setSelectedSubmotivo] = useState('');
    const [reGestionando, setReGestionando] = useState<Set<string>>(new Set());
    const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Historial
    const [historial, setHistorial] = useState<PostVentaObservacion[]>(() =>
        (isJefeBO ? (allHistorial ?? []) : []).filter(h => h.ruc.startsWith('10'))
    );
    const [loadingHist, setLoadingHist] = useState(false);
    const [filterHistAgente, setFilterHistAgente] = useState('');
    const [searchHistRuc, setSearchHistRuc] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editEstado, setEditEstado] = useState<EstadoKey | ''>('');
    const [editMotivo, setEditMotivo] = useState('');
    const [editSubmotivo, setEditSubmotivo] = useState('');
    const [editObs, setEditObs] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Reporte
    const [reporteLoading, setReporteLoading] = useState(false);

    const cuenta = cuentas[idx] ?? null;
    const total = cuentas.length;
    const guardadasCount = cuentas.filter(c => guardadas.has(c.ruc)).length;
    const progreso = total > 0 ? Math.round((guardadasCount / total) * 100) : 0;
    const yaGuardada = cuenta ? guardadas.has(cuenta.ruc) : false;
    const enReGestion = cuenta ? reGestionando.has(cuenta.ruc) : false;
    const mostrarForm = !yaGuardada || enReGestion;
    const terminado = guardadasCount === total && total > 0;

    const estadoConfig = selectedEstado ? ESTADOS[selectedEstado] : null;
    const motivosParaEstado = estadoConfig?.motivos ?? [];
    const requiereMotivo = motivosParaEstado.length > 0;
    const selectedMotivoConfig = motivosParaEstado.find(m => m.key === selectedMotivo);
    const submotivosParaMotivo = selectedMotivoConfig?.submotivos ?? [];
    const requiereSubmotivo = submotivosParaMotivo.length > 0;

    const canSave = !!(obs.trim() && selectedEstado &&
        (!requiereMotivo || selectedMotivo) &&
        (!requiereSubmotivo || selectedSubmotivo));

    useEffect(() => {
        if (isJefeBO) return;
        if (vista === 'historial') {
            setLoadingHist(true);
            getPostVentaHistorial(usuario).then(r => {
                if (r.success) setHistorial((r.data ?? []).filter(h => h.ruc.startsWith('10')));
                setLoadingHist(false);
            });
        }
    }, [vista, usuario, isJefeBO]);

    useEffect(() => {
        setObs('');
        setSelectedEstado('');
        setSelectedMotivo('');
        setSelectedSubmotivo('');
        setUploadedFiles([]);
    }, [idx]);

    useEffect(() => {
        const lastRuc = localStorage.getItem(`pv10_pos_${usuario}`);
        if (lastRuc) {
            const i = cuentas.findIndex(c => c.ruc === lastRuc);
            if (i >= 0) setIdx(i);
        }
    }, []);

    useEffect(() => {
        if (cuenta) localStorage.setItem(`pv10_pos_${usuario}`, cuenta.ruc);
    }, [cuenta?.ruc, usuario]);

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
            AppSwal.fire({ icon: 'warning', title: 'Selecciona un estado', confirmButtonColor: '#10b981' });
            return;
        }
        if (requiereMotivo && !selectedMotivo) {
            AppSwal.fire({ icon: 'warning', title: 'Selecciona un motivo', confirmButtonColor: '#10b981' });
            return;
        }
        if (requiereSubmotivo && !selectedSubmotivo) {
            AppSwal.fire({ icon: 'warning', title: 'Selecciona un submotivo', confirmButtonColor: '#10b981' });
            return;
        }
        if (!cuenta) return;

        startTransition(async () => {
            const res = await savePostVentaObservacion({
                ruc: cuenta.ruc,
                razonSocial: cuenta.nombres,
                telefono: '',
                ejecutivoOriginal: cuenta.agente,
                lineas: cuenta.qLineas,
                cargoFijo: cuenta.cfFinalSinIgv,
                segmento: '',
                srIngreso: cuenta.idSolicitud,
                numOrden: cuenta.numOrden,
                observacion: obs.trim(),
                estado: selectedEstado,
                motivo: selectedMotivo,
                submotivo: selectedSubmotivo,
                evidenciaIds: uploadedFiles.map(f => f.id).join(','),
                usuario,
            });

            if (res.success) {
                setReGestionando(prev => { const n = new Set(prev); n.delete(cuenta.ruc); return n; });
                if (selectedEstado === 'SATISFECHO') {
                    setGuardadas(prev => new Set([...prev, cuenta.ruc]));
                    if (idx < total - 1) setTimeout(() => setIdx(i => i + 1), 600);
                } else {
                    setGuardadas(prev => { const n = new Set(prev); n.delete(cuenta.ruc); return n; });
                    const cfg = ESTADOS[selectedEstado];
                    AppSwal.fire({
                        icon: 'info',
                        title: `${cfg.emoji} Registrado como ${cfg.label}`,
                        text: 'La cuenta permanece en cola para seguimiento.',
                        confirmButtonColor: '#f59e0b',
                    });
                }
            } else {
                AppSwal.fire({ icon: 'error', title: 'Error', text: res.error ?? 'No se pudo guardar', confirmButtonColor: '#ef4444' });
            }
        });
    };

    const handleDownloadReporte = async () => {
        setReporteLoading(true);
        const res = await getPostVentaRuc10Data();
        setReporteLoading(false);
        if (!res.success || !res.data) {
            AppSwal.fire({ icon: 'error', title: 'Error', text: res.error ?? 'Error al generar el reporte', confirmButtonColor: '#ef4444' });
            return;
        }
        const rows = res.data.map(r => ({
            'AGENTE': r.agente,
            'RUC': r.ruc,
            'ID-SOLICITUD': r.idSolicitud,
            'N° ORDEN': r.numOrden,
            'NOMBRES': r.nombres,
            'TIPO VENTA': r.tipoVenta,
            'N° A PORTAR': r.numPortar,
            'MODALIDAD': r.modalidad,
            'TIPO DE ENTREGA': r.tipoEntrega,
            'Q LINEAS': r.qLineas,
            'CF COMPLETO': r.cfCompleto,
            'PROMOCION OFRECIDA': r.promocionOfrecida,
            'CF FINAL SIN IGV': r.cfFinalSinIgv,
            'PERIODO': r.periodo,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 25 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 35 },
            { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 10 },
            { wch: 14 }, { wch: 35 }, { wch: 18 }, { wch: 14 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'PostVenta RUC 10');
        XLSX.writeFile(wb, `postventa-ruc10-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleExportHistorial = () => {
        const rows = filteredHist.map(h => ({
            'ID': h.id ?? '',
            'RUC': h.ruc ?? '',
            'Nombres': h.razonSocial ?? '',
            'Agente': h.ejecutivoOriginal ?? '',
            'Líneas': h.lineas ?? '',
            'CF Final s/IGV': h.cargoFijo ?? '',
            'ID Solicitud': h.srIngreso ?? '',
            'N° Orden': h.numOrden ?? '',
            'Observación': h.observacion ?? '',
            'Estado': h.estado ?? '',
            'Motivo': h.motivo ?? '',
            'Submotivo': h.submotivo ?? '',
            'Usuario': h.usuario ?? '',
            'Fecha': h.fecha ?? '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 8 }, { wch: 14 }, { wch: 35 }, { wch: 25 }, { wch: 8 }, { wch: 16 },
            { wch: 16 }, { wch: 14 }, { wch: 60 }, { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 22 }, { wch: 20 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Gestión RUC 10');
        XLSX.writeFile(wb, `gestion-ruc10-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    async function handleUpdateHistorial(id: string) {
        setEditSaving(true);
        const res = await updatePostVentaObservacion(id, {
            estado: editEstado,
            motivo: editMotivo,
            submotivo: editSubmotivo,
            observacion: editObs,
        });
        if (res.success) {
            setHistorial(prev => prev.map(h => h.id === id
                ? { ...h, estado: editEstado, motivo: editMotivo, submotivo: editSubmotivo, observacion: editObs }
                : h
            ));
            setEditingId(null);
        } else {
            AppSwal.fire({ icon: 'error', title: 'Error', text: res.error ?? 'No se pudo actualizar', confirmButtonColor: '#ef4444' });
        }
        setEditSaving(false);
    }

    function startEditing(h: PostVentaObservacion) {
        setEditingId(h.id);
        setEditEstado((h.estado as EstadoKey) || '');
        setEditMotivo(h.motivo || '');
        setEditSubmotivo(h.submotivo || '');
        setEditObs(h.observacion || '');
    }

    const filteredHist = historial
        .filter(h => !filterHistAgente || h.ejecutivoOriginal === filterHistAgente)
        .filter(h => {
            if (!searchHistRuc) return true;
            const q = searchHistRuc.trim().toLowerCase();
            return h.ruc.includes(q) || h.razonSocial.toLowerCase().includes(q);
        });

    const histAgentesUnicos = [...new Set(historial.map(h => h.ejecutivoOriginal).filter(Boolean))].sort();

    return (
        <div style={{ color: 'white', maxWidth: '860px', margin: '0 auto' }}>
            <style>{`
                .pv10-tabs { display:flex; gap:0.5rem; margin-bottom:2rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:1rem; padding:4px; width:fit-content; }
                .pv10-tab { padding:8px 20px; border-radius:0.75rem; font-size:0.8rem; font-weight:800; letter-spacing:0.05em; cursor:pointer; border:none; background:transparent; color:#64748b; transition:all 0.2s; text-transform:uppercase; }
                .pv10-tab.active { background:rgba(129,140,248,0.15); color:#818cf8; box-shadow:inset 0 0 0 1px rgba(129,140,248,0.3); }

                .pv10-progress-wrap { margin-bottom:1.75rem; }
                .pv10-progress-labels { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; }
                .pv10-progress-text { font-size:0.72rem; font-weight:800; color:#64748b; letter-spacing:0.06em; text-transform:uppercase; }
                .pv10-progress-count { font-size:0.8rem; font-weight:900; color:#818cf8; }
                .pv10-bar-bg { height:6px; background:rgba(255,255,255,0.06); border-radius:999px; overflow:hidden; }
                .pv10-bar-fill { height:100%; background:linear-gradient(90deg,#6366f1,#818cf8); border-radius:999px; transition:width 0.6s cubic-bezier(0.4,0,0.2,1); }

                .pv10-select { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:0.75rem; color:white; font-size:0.82rem; padding:8px 14px; outline:none; cursor:pointer; transition:border-color 0.2s; }
                .pv10-select:focus { border-color:rgba(129,140,248,0.4); }
                .pv10-select option { background:#0f172a; color:white; }

                .pv10-card { border-radius:1.5rem; overflow:hidden; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); margin-bottom:1.25rem; transition:border-color 0.3s; }
                .pv10-card.guardada { border-color:rgba(129,140,248,0.35); background:rgba(99,102,241,0.03); }
                .pv10-card-top { padding:1.75rem 2rem 1.25rem; display:flex; align-items:flex-start; gap:1.25rem; }
                .pv10-avatar { width:52px; height:52px; border-radius:1rem; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); }
                .pv10-info { flex:1; min-width:0; }
                .pv10-ruc { font-size:0.68rem; font-weight:900; color:#475569; letter-spacing:0.12em; margin-bottom:3px; }
                .pv10-nombre { font-size:1.3rem; font-weight:950; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:-0.01em; }
                .pv10-agente { font-size:0.72rem; color:#64748b; margin-top:4px; }
                .pv10-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; border-top:1px solid rgba(255,255,255,0.05); }
                .pv10-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0; border-top:1px solid rgba(255,255,255,0.04); }
                .pv10-cell { padding:1rem 2rem; border-right:1px solid rgba(255,255,255,0.04); }
                .pv10-cell:last-child { border-right:none; }
                .pv10-cell-label { font-size:0.6rem; font-weight:900; color:#475569; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:3px; }
                .pv10-cell-value { font-size:0.95rem; font-weight:700; color:#e2e8f0; }
                .pv10-cell-value.accent { color:#818cf8; font-family:monospace; }
                .pv10-cell-value.money { color:#34d399; }
                .pv10-promo-row { padding:0.75rem 2rem; border-top:1px solid rgba(255,255,255,0.04); font-size:0.8rem; color:#94a3b8; }
                .pv10-promo-label { font-size:0.6rem; font-weight:900; color:#475569; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:3px; }

                .pv10-section-label { font-size:0.7rem; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem; }
                .pv10-required { color:#f43f5e; font-size:0.9rem; }
                .pv10-optional { color:#334155; font-size:0.65rem; font-weight:700; }

                .pv10-estado-section { margin-bottom:1rem; }
                .pv10-estado-btns { display:flex; gap:0.5rem; flex-wrap:wrap; }
                .pv10-estado-btn { padding:9px 16px; border-radius:0.875rem; font-size:0.75rem; font-weight:800; cursor:pointer; border:1px solid transparent; letter-spacing:0.03em; text-transform:uppercase; transition:all 0.2s; display:flex; align-items:center; gap:0.4rem; background:rgba(255,255,255,0.04); color:#64748b; border-color:rgba(255,255,255,0.08); white-space:nowrap; }
                .pv10-estado-btn.selected { transform:scale(1.03); box-shadow:0 4px 15px rgba(0,0,0,0.2); }

                .pv10-cascade-box { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:1rem; padding:1rem 1.25rem; margin-bottom:1rem; }
                .pv10-cascade-select { width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:0.75rem; color:white; font-size:0.85rem; font-weight:600; padding:10px 14px; outline:none; cursor:pointer; transition:border-color 0.2s; appearance:none; }
                .pv10-cascade-select:focus { border-color:rgba(245,158,11,0.5); }
                .pv10-cascade-select option { background:#0f172a; color:white; }
                .pv10-submotivo-select { border-color:rgba(239,68,68,0.3); }
                .pv10-submotivo-select:focus { border-color:rgba(239,68,68,0.6); }

                .pv10-obs-wrap { margin-bottom:1rem; }
                .pv10-obs-textarea { width:100%; min-height:100px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:1rem; padding:1rem 1.25rem; color:white; font-size:0.9rem; resize:vertical; outline:none; transition:border-color 0.2s, box-shadow 0.2s; font-family:inherit; box-sizing:border-box; }
                .pv10-obs-textarea:focus { border-color:rgba(129,140,248,0.5); box-shadow:0 0 0 3px rgba(129,140,248,0.08); }
                .pv10-obs-textarea::placeholder { color:#334155; }
                .pv10-obs-textarea:disabled { opacity:0.5; cursor:not-allowed; }

                .pv10-upload-section { margin-bottom:1.25rem; }
                .pv10-upload-btn { display:inline-flex; align-items:center; gap:0.5rem; padding:8px 16px; border-radius:0.75rem; font-size:0.78rem; font-weight:800; cursor:pointer; border:1px dashed rgba(255,255,255,0.15); background:rgba(255,255,255,0.03); color:#94a3b8; transition:all 0.2s; }
                .pv10-upload-btn:hover { border-color:rgba(129,140,248,0.4); color:#a78bfa; background:rgba(99,102,241,0.06); }
                .pv10-upload-files { display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.6rem; }
                .pv10-file-chip { display:inline-flex; align-items:center; gap:0.3rem; font-size:0.68rem; font-weight:700; color:#818cf8; background:rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.25); border-radius:999px; padding:3px 10px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

                .pv10-actions { display:flex; gap:0.75rem; align-items:center; }
                .pv10-btn { padding:12px 24px; border-radius:0.875rem; font-size:0.82rem; font-weight:800; cursor:pointer; border:none; letter-spacing:0.04em; text-transform:uppercase; transition:all 0.2s; display:flex; align-items:center; gap:0.5rem; }
                .pv10-btn:disabled { opacity:0.35; cursor:not-allowed; transform:none !important; }
                .pv10-btn-guardar { background:linear-gradient(135deg,#6366f1,#4f46e5); color:white; flex:1; justify-content:center; box-shadow:0 4px 15px rgba(99,102,241,0.25); }
                .pv10-btn-guardar:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(99,102,241,0.35); }
                .pv10-btn-nav { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); color:#94a3b8; padding:12px 16px; }
                .pv10-btn-nav:not(:disabled):hover { background:rgba(255,255,255,0.09); color:white; }
                .pv10-btn-siguiente { background:rgba(129,140,248,0.15); border:1px solid rgba(129,140,248,0.3); color:#818cf8; }
                .pv10-btn-siguiente:not(:disabled):hover { background:rgba(129,140,248,0.25); }
                .pv10-btn-regest { background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); color:#fbbf24; }
                .pv10-btn-regest:not(:disabled):hover { background:rgba(245,158,11,0.2); }
                .pv10-btn-export { background:rgba(129,140,248,0.1); border:1px solid rgba(129,140,248,0.3); color:#818cf8; padding:9px 18px; font-size:0.75rem; border-radius:0.75rem; cursor:pointer; font-weight:800; letter-spacing:0.04em; text-transform:uppercase; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.4rem; }
                .pv10-btn-export:hover { background:rgba(129,140,248,0.2); }
                .pv10-btn-reporte { background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.3); color:#38bdf8; padding:9px 18px; font-size:0.75rem; border-radius:0.75rem; cursor:pointer; font-weight:800; letter-spacing:0.04em; text-transform:uppercase; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.4rem; }
                .pv10-btn-reporte:hover { background:rgba(14,165,233,0.2); }

                .pv10-saved-badge { display:flex; align-items:center; gap:0.75rem; border-radius:0.875rem; padding:12px 18px; margin-bottom:1rem; font-size:0.82rem; font-weight:800; flex-wrap:wrap; }
                .pv10-done { text-align:center; padding:4rem 2rem; }
                .pv10-done-icon { font-size:4rem; margin-bottom:1rem; }
                .pv10-done-title { font-size:2rem; font-weight:950; color:white; margin:0 0 0.5rem; }
                .pv10-done-sub { color:#64748b; font-size:0.95rem; }

                .pv10-hist-grid { display:flex; flex-direction:column; gap:0.75rem; }
                .pv10-hist-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:1.25rem; padding:1.25rem 1.5rem; }
                .pv10-hist-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; gap:1rem; }
                .pv10-hist-nombre { font-size:0.95rem; font-weight:800; color:white; }
                .pv10-hist-ruc { font-size:0.68rem; font-weight:700; color:#475569; }
                .pv10-hist-fecha { font-size:0.68rem; color:#475569; white-space:nowrap; }
                .pv10-hist-obs { font-size:0.85rem; color:#94a3b8; line-height:1.5; background:rgba(255,255,255,0.03); border-radius:0.75rem; padding:0.75rem 1rem; border-left:3px solid rgba(129,140,248,0.4); }
                .pv10-hist-meta { display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.6rem; align-items:center; }
                .pv10-hist-chip { font-size:0.65rem; font-weight:700; color:#64748b; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); border-radius:999px; padding:3px 10px; }
                .pv10-hist-estado-chip { font-size:0.65rem; font-weight:900; border-radius:999px; padding:3px 10px; letter-spacing:0.05em; text-transform:uppercase; }
                .pv10-hist-motivo-chip { font-size:0.65rem; font-weight:700; color:#fbbf24; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); border-radius:999px; padding:3px 10px; }
                .pv10-hist-submotivo-chip { font-size:0.65rem; font-weight:700; color:#f87171; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:999px; padding:3px 10px; }
                .pv10-hist-file-link { font-size:0.65rem; font-weight:700; color:#818cf8; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:999px; padding:3px 10px; text-decoration:none; display:inline-flex; align-items:center; gap:0.3rem; }
                .pv10-hist-file-link:hover { background:rgba(99,102,241,0.2); }
                .pv10-empty-hist { text-align:center; padding:3rem; color:#475569; }
                .pv10-hist-search { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:0.75rem; padding:0.6rem 1rem; color:white; font-size:0.85rem; outline:none; transition:border-color 0.2s; margin-bottom:1rem; box-sizing:border-box; }
                .pv10-hist-search:focus { border-color:rgba(129,140,248,0.5); }
                .pv10-hist-search::placeholder { color:#334155; }
                .pv10-edit-box { background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.2); border-radius:0.875rem; padding:1rem 1.25rem; margin-top:0.75rem; }
                .pv10-edit-row { display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.75rem; }
                .pv10-edit-select { flex:1; min-width:160px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:0.6rem; color:white; font-size:0.8rem; padding:8px 12px; outline:none; }
                .pv10-edit-textarea { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:0.75rem; padding:0.75rem 1rem; color:white; font-size:0.85rem; resize:none; outline:none; font-family:inherit; box-sizing:border-box; }
                .pv10-edit-actions { display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.6rem; }
                .pv10-btn-edit { font-size:0.68rem; font-weight:800; padding:5px 14px; border-radius:0.6rem; cursor:pointer; border:1px solid rgba(99,102,241,0.35); background:rgba(99,102,241,0.12); color:#818cf8; transition:all 0.2s; text-transform:uppercase; letter-spacing:0.04em; }
                .pv10-btn-edit:hover { background:rgba(99,102,241,0.2); }
                .pv10-btn-save-edit { font-size:0.68rem; font-weight:800; padding:5px 14px; border-radius:0.6rem; cursor:pointer; border:none; background:linear-gradient(135deg,#6366f1,#4f46e5); color:white; transition:all 0.2s; text-transform:uppercase; letter-spacing:0.04em; }
                .pv10-btn-save-edit:disabled { opacity:0.4; cursor:not-allowed; }
                .pv10-btn-cancel-edit { font-size:0.68rem; font-weight:800; padding:5px 14px; border-radius:0.6rem; cursor:pointer; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#64748b; transition:all 0.2s; text-transform:uppercase; letter-spacing:0.04em; }

                @keyframes spin10 { to { transform:rotate(360deg); } }
                .pv10-spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,0.2); border-top-color:white; border-radius:50%; animation:spin10 0.7s linear infinite; flex-shrink:0; }
            `}</style>

            {/* TABS internos + botones de descarga */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
                <div className="pv10-tabs" style={{ marginBottom: 0 }}>
                    {!isJefeBO && (
                        <button className={`pv10-tab ${vista === 'gestion' ? 'active' : ''}`} onClick={() => setVista('gestion')}>
                            📞 Gestión
                        </button>
                    )}
                    <button className={`pv10-tab ${vista === 'historial' ? 'active' : ''}`} onClick={() => setVista('historial')}>
                        {isJefeBO ? '📋 Todos los registros' : '📋 Mis registros'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(userRole === 'ADMIN' || userRole === 'JEFE_BO') && (
                        <button className="pv10-btn-reporte" onClick={handleDownloadReporte} disabled={reporteLoading}>
                            {reporteLoading ? 'Generando...' : '📥 Descargar RUC 10'}
                        </button>
                    )}
                </div>
            </div>

            {/* ══════════ GESTIÓN ══════════ */}
            {vista === 'gestion' && (
                <>
                    {total === 0 ? (
                        <div className="pv10-done">
                            <div className="pv10-done-icon">📭</div>
                            <div className="pv10-done-title">Sin cuentas RUC 10</div>
                            <div className="pv10-done-sub">No hay registros en la hoja "POSTVENTA RUC 10"</div>
                        </div>
                    ) : terminado ? (
                        <div className="pv10-done">
                            <div className="pv10-done-icon">🎉</div>
                            <div className="pv10-done-title">¡Gestión completada!</div>
                            <div className="pv10-done-sub">Gestionaste las {total} cuentas RUC 10</div>
                            <button className="pv10-btn pv10-btn-siguiente" style={{ margin: '1.5rem auto 0', display: 'flex' }} onClick={() => setVista('historial')}>
                                Ver mis registros →
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* PROGRESO */}
                            <div className="pv10-progress-wrap">
                                <div className="pv10-progress-labels">
                                    <span className="pv10-progress-text">Progreso RUC 10</span>
                                    <span className="pv10-progress-count">{guardadasCount} / {total}</span>
                                </div>
                                <div className="pv10-bar-bg">
                                    <div className="pv10-bar-fill" style={{ width: `${progreso}%` }} />
                                </div>
                            </div>

                            {/* CUENTA CARD */}
                            {cuenta && (() => {
                                const tvStyle = getTipoVentaStyle(cuenta.tipoVenta);
                                return (
                                    <div className={`pv10-card ${yaGuardada && !enReGestion ? 'guardada' : ''}`}>
                                        <div className="pv10-card-top">
                                            <div className="pv10-avatar">👤</div>
                                            <div className="pv10-info">
                                                <div className="pv10-ruc">{cuenta.ruc}</div>
                                                <div className="pv10-nombre" title={cuenta.nombres}>{cuenta.nombres}</div>
                                                {cuenta.tipoVenta && (
                                                    <span style={{
                                                        display: 'inline-block', marginTop: 6,
                                                        fontSize: '0.62rem', fontWeight: 900, padding: '3px 10px',
                                                        borderRadius: '999px', letterSpacing: '0.05em',
                                                        color: tvStyle.color, background: tvStyle.bg, border: `1px solid ${tvStyle.border}`,
                                                    }}>
                                                        {cuenta.tipoVenta}
                                                    </span>
                                                )}
                                                {cuenta.agente && <div className="pv10-agente">👤 Agente: {cuenta.agente}</div>}
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cuenta</div>
                                                <div style={{ fontSize: '2rem', fontWeight: 950, lineHeight: 1 }}>
                                                    <span style={{ color: 'white' }}>{idx + 1}</span>
                                                    <span style={{ fontSize: '1rem', color: '#334155' }}>/{total}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Grid 3 col: Q Líneas / CF Completo / CF Final s/IGV */}
                                        <div className="pv10-grid">
                                            <div className="pv10-cell">
                                                <div className="pv10-cell-label">📶 Q Líneas</div>
                                                <div className="pv10-cell-value">{cuenta.qLineas || '—'}</div>
                                            </div>
                                            <div className="pv10-cell">
                                                <div className="pv10-cell-label">💰 CF Completo</div>
                                                <div className="pv10-cell-value">S/ {cuenta.cfCompleto || '—'}</div>
                                            </div>
                                            <div className="pv10-cell">
                                                <div className="pv10-cell-label">✅ CF Final s/IGV</div>
                                                <div className="pv10-cell-value money">S/ {cuenta.cfFinalSinIgv || '—'}</div>
                                            </div>
                                        </div>

                                        {/* Grid 2 col: Modalidad / Tipo Entrega */}
                                        <div className="pv10-grid2">
                                            <div className="pv10-cell">
                                                <div className="pv10-cell-label">📡 Modalidad</div>
                                                <div className="pv10-cell-value">{cuenta.modalidad || '—'}</div>
                                            </div>
                                            <div className="pv10-cell">
                                                <div className="pv10-cell-label">🚚 Tipo de Entrega</div>
                                                <div className="pv10-cell-value">{cuenta.tipoEntrega || '—'}</div>
                                            </div>
                                        </div>

                                        {/* N° A Portar (solo si aplica) */}
                                        {cuenta.numPortar && (
                                            <div className="pv10-grid2" style={{ gridTemplateColumns: '1fr' }}>
                                                <div className="pv10-cell">
                                                    <div className="pv10-cell-label">📲 N° a Portar</div>
                                                    <div className="pv10-cell-value accent">{cuenta.numPortar}</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Grid 3 col: ID Solicitud / N° Orden / Periodo */}
                                        <div className="pv10-grid">
                                            <div className="pv10-cell">
                                                <div className="pv10-cell-label">🔖 ID Solicitud</div>
                                                <div className="pv10-cell-value accent">{cuenta.idSolicitud || '—'}</div>
                                            </div>
                                            <div className="pv10-cell">
                                                <div className="pv10-cell-label">📋 N° Orden</div>
                                                <div className="pv10-cell-value" style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{cuenta.numOrden || '—'}</div>
                                            </div>
                                            <div className="pv10-cell">
                                                <div className="pv10-cell-label">📅 Periodo</div>
                                                <div className="pv10-cell-value">{cuenta.periodo || '—'}</div>
                                            </div>
                                        </div>

                                        {/* Promoción Ofrecida */}
                                        {cuenta.promocionOfrecida && (
                                            <div className="pv10-promo-row">
                                                <div className="pv10-promo-label">🎁 Promoción Ofrecida</div>
                                                <div style={{ marginTop: 2 }}>{cuenta.promocionOfrecida}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* FORM or SAVED BADGE */}
                            {yaGuardada && !enReGestion ? (
                                <div className="pv10-saved-badge"
                                     style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}>
                                    <span>✅ Cuenta gestionada</span>
                                    <button className="pv10-btn pv10-btn-regest" style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: '0.72rem' }}
                                            onClick={() => setReGestionando(prev => new Set([...prev, cuenta!.ruc]))}>
                                        Re-gestionar
                                    </button>
                                </div>
                            ) : mostrarForm && (
                                <>
                                    <div className="pv10-estado-section">
                                        <div className="pv10-section-label">
                                            Estado de la gestión <span className="pv10-required">*</span>
                                        </div>
                                        <div className="pv10-estado-btns">
                                            {ESTADO_KEYS.map(key => {
                                                const cfg = ESTADOS[key];
                                                return (
                                                    <button
                                                        key={key}
                                                        className={`pv10-estado-btn ${selectedEstado === key ? 'selected' : ''}`}
                                                        style={selectedEstado === key ? { background: cfg.bg, borderColor: cfg.border, color: cfg.color } : {}}
                                                        onClick={() => { setSelectedEstado(key); setSelectedMotivo(''); setSelectedSubmotivo(''); }}
                                                        disabled={isPending}
                                                    >
                                                        {cfg.emoji} {cfg.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {requiereMotivo && (
                                        <div className="pv10-cascade-box">
                                            <div className="pv10-section-label" style={{ marginBottom: '0.5rem' }}>
                                                Motivo <span className="pv10-required">*</span>
                                            </div>
                                            <select className="pv10-cascade-select" value={selectedMotivo}
                                                onChange={e => { setSelectedMotivo(e.target.value); setSelectedSubmotivo(''); }}
                                                disabled={isPending}>
                                                <option value="">— Selecciona el motivo —</option>
                                                {motivosParaEstado.map(m => (
                                                    <option key={m.key} value={m.key}>{m.label}</option>
                                                ))}
                                            </select>
                                            {requiereSubmotivo && (
                                                <div style={{ marginTop: '0.75rem' }}>
                                                    <div className="pv10-section-label" style={{ marginBottom: '0.5rem', color: '#f87171' }}>
                                                        Submotivo <span className="pv10-required">*</span>
                                                    </div>
                                                    <select className="pv10-cascade-select pv10-submotivo-select" value={selectedSubmotivo}
                                                        onChange={e => setSelectedSubmotivo(e.target.value)}
                                                        disabled={isPending}>
                                                        <option value="">— Selecciona el submotivo —</option>
                                                        {submotivosParaMotivo.map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="pv10-obs-wrap">
                                        <div className="pv10-section-label">
                                            Observación de la llamada <span className="pv10-required">*</span>
                                        </div>
                                        <textarea
                                            className="pv10-obs-textarea"
                                            placeholder="Ej: Cliente atendió, confirma que está activado. Conforme con el servicio..."
                                            value={obs}
                                            onChange={e => setObs(e.target.value)}
                                            disabled={isPending}
                                        />
                                    </div>

                                    <div className="pv10-upload-section">
                                        <div className="pv10-section-label">
                                            Evidencia <span className="pv10-optional">— Opcional</span>
                                        </div>
                                        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
                                        <button className="pv10-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading || isPending}>
                                            {uploading ? <><div className="pv10-spinner" style={{ borderTopColor: '#a78bfa' }} /> Subiendo...</> : <>📎 Adjuntar archivos</>}
                                        </button>
                                        {uploadedFiles.length > 0 && (
                                            <div className="pv10-upload-files">
                                                {uploadedFiles.map((f, i) => (
                                                    <span key={i} className="pv10-file-chip" title={f.name}>📄 {f.name}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* BOTONES */}
                            <div className="pv10-actions">
                                <button className="pv10-btn pv10-btn-nav" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} title="Anterior">←</button>
                                {yaGuardada && !enReGestion ? (
                                    <button className="pv10-btn pv10-btn-siguiente" onClick={() => setIdx(i => Math.min(total - 1, i + 1))} disabled={idx === total - 1} style={{ flex: 1, justifyContent: 'center' }}>
                                        Siguiente cuenta →
                                    </button>
                                ) : (
                                    <button className="pv10-btn pv10-btn-guardar" onClick={handleGuardar} disabled={isPending || !canSave}>
                                        {isPending ? <><div className="pv10-spinner" /> Guardando...</> : <>✓ Guardar gestión</>}
                                    </button>
                                )}
                                <button className="pv10-btn pv10-btn-nav" onClick={() => setIdx(i => Math.min(total - 1, i + 1))} disabled={idx === total - 1} title="Siguiente sin guardar">→</button>
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
                            {isJefeBO ? 'Todos los registros RUC 10' : 'Mis registros RUC 10'}
                        </h2>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700 }}>{filteredHist.length} registros</span>
                            {isJefeBO && (
                                <button className="pv10-btn-export" onClick={handleExportHistorial}>
                                    ⬇ Exportar Excel
                                </button>
                            )}
                        </div>
                    </div>

                    <input
                        className="pv10-hist-search"
                        type="text"
                        placeholder="🔍  Buscar por RUC o nombre..."
                        value={searchHistRuc}
                        onChange={e => setSearchHistRuc(e.target.value)}
                    />

                    {isJefeBO && histAgentesUnicos.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filtrar:</span>
                            <select className="pv10-select" value={filterHistAgente} onChange={e => setFilterHistAgente(e.target.value)}>
                                <option value="">Todos los agentes</option>
                                {histAgentesUnicos.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                    )}

                    {loadingHist ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
                            <div className="pv10-spinner" style={{ margin: '0 auto 1rem', width: 30, height: 30, borderWidth: 3 }} />
                            Cargando historial...
                        </div>
                    ) : filteredHist.length === 0 ? (
                        <div className="pv10-empty-hist">
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                            <div style={{ fontWeight: 700, color: '#64748b' }}>Sin registros RUC 10</div>
                            <div style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>
                                {historial.length > 0 ? 'Ningún registro coincide con los filtros' : 'Empieza a gestionar cuentas en la pestaña Gestión'}
                            </div>
                        </div>
                    ) : (
                        <div className="pv10-hist-grid">
                            {filteredHist.map((h, i) => {
                                const ec = getEstadoCfg(h.estado);
                                const fileIds = h.evidenciaIds ? h.evidenciaIds.split(',').filter(Boolean) : [];
                                const isEditing = editingId === h.id;
                                const editCfg = editEstado ? ESTADOS[editEstado] : null;
                                const editMotivosDisp = editCfg?.motivos ?? [];
                                const editRequiereMotivo = editMotivosDisp.length > 0;
                                const editMotivoObj = editMotivosDisp.find(m => m.key === editMotivo);
                                const editSubmotivosDisp = editMotivoObj?.submotivos ?? [];
                                const editRequiereSubmotivo = editSubmotivosDisp.length > 0;

                                return (
                                    <div className="pv10-hist-card" key={i} style={isEditing ? { borderColor: 'rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.04)' } : {}}>
                                        <div className="pv10-hist-header">
                                            <div>
                                                <div className="pv10-hist-nombre">{h.razonSocial}</div>
                                                <div className="pv10-hist-ruc">{h.ruc}</div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                                                {h.estado && (
                                                    <span className="pv10-hist-estado-chip"
                                                          style={{ background: ec.bg, border: `1px solid ${ec.border}`, color: ec.color }}>
                                                        {ec.emoji} {ec.label}
                                                    </span>
                                                )}
                                                <span className="pv10-hist-fecha">{h.fecha}</span>
                                            </div>
                                        </div>

                                        {!isEditing && <div className="pv10-hist-obs">{h.observacion}</div>}

                                        <div className="pv10-hist-meta">
                                            {isJefeBO && h.usuario && (
                                                <span className="pv10-hist-chip" style={{ color: '#a78bfa', borderColor: '#8b5cf640', background: 'rgba(139,92,246,0.08)' }}>
                                                    🎧 {h.usuario}
                                                </span>
                                            )}
                                            {h.motivo && <span className="pv10-hist-motivo-chip">⚡ {h.motivo}</span>}
                                            {h.submotivo && <span className="pv10-hist-submotivo-chip">↳ {h.submotivo}</span>}
                                            {h.ejecutivoOriginal && <span className="pv10-hist-chip">👤 {h.ejecutivoOriginal}</span>}
                                            {h.lineas && <span className="pv10-hist-chip">📶 {h.lineas} lín.</span>}
                                            {h.srIngreso && <span className="pv10-hist-chip" style={{ color: '#818cf8' }}>🔖 {h.srIngreso}</span>}
                                            {h.numOrden && <span className="pv10-hist-chip" style={{ color: '#fbbf24' }}>📋 {h.numOrden}</span>}
                                            {fileIds.map((fid, fi) => (
                                                <a key={fi} className="pv10-hist-file-link"
                                                   href={`https://drive.google.com/file/d/${fid}/view`}
                                                   target="_blank" rel="noopener noreferrer">
                                                    📎 Archivo {fi + 1}
                                                </a>
                                            ))}
                                            {!isEditing && (
                                                <button className="pv10-btn-edit" style={{ marginLeft: 'auto' }} onClick={() => startEditing(h)}>
                                                    ✏ Editar
                                                </button>
                                            )}
                                        </div>

                                        {isEditing && (
                                            <div className="pv10-edit-box">
                                                <div className="pv10-edit-row">
                                                    <select className="pv10-edit-select" value={editEstado}
                                                        onChange={e => { setEditEstado(e.target.value as EstadoKey); setEditMotivo(''); setEditSubmotivo(''); }}>
                                                        <option value="">— Estado —</option>
                                                        {ESTADO_KEYS.map(k => <option key={k} value={k}>{ESTADOS[k].emoji} {ESTADOS[k].label}</option>)}
                                                    </select>
                                                    {editRequiereMotivo && (
                                                        <select className="pv10-edit-select" value={editMotivo}
                                                            onChange={e => { setEditMotivo(e.target.value); setEditSubmotivo(''); }}>
                                                            <option value="">— Motivo —</option>
                                                            {editMotivosDisp.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                                        </select>
                                                    )}
                                                    {editRequiereSubmotivo && (
                                                        <select className="pv10-edit-select" value={editSubmotivo} onChange={e => setEditSubmotivo(e.target.value)}>
                                                            <option value="">— Submotivo —</option>
                                                            {editSubmotivosDisp.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    )}
                                                </div>
                                                <textarea className="pv10-edit-textarea" rows={3} value={editObs} onChange={e => setEditObs(e.target.value)}
                                                    placeholder="Observación..." />
                                                <div className="pv10-edit-actions">
                                                    <button className="pv10-btn-cancel-edit" onClick={() => setEditingId(null)} disabled={editSaving}>Cancelar</button>
                                                    <button className="pv10-btn-save-edit" onClick={() => handleUpdateHistorial(h.id)} disabled={editSaving || !editEstado || !editObs.trim()}>
                                                        {editSaving ? 'Guardando...' : '✓ Guardar cambios'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
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
