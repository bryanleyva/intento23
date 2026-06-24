'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import * as XLSX from 'xlsx';
import { PostVentaRecord } from '@/app/actions/postventa';
import { PostVentaObservacion, savePostVentaObservacion, getPostVentaHistorial, updatePostVentaObservacion } from '@/app/actions/postventa-actions';
import { createDriveUploadSession } from '@/app/actions/drive';
import { AppSwal } from '@/lib/sweetalert';
import { getPostVentaReporteData } from '@/app/actions/postventa-reporte';

interface Props {
    cuentas: PostVentaRecord[];
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
    const [selectedEstado, setSelectedEstado] = useState<EstadoKey | ''>('');
    const [selectedMotivo, setSelectedMotivo] = useState('');
    const [selectedSubmotivo, setSelectedSubmotivo] = useState('');
    const [reGestionando, setReGestionando] = useState<Set<string>>(new Set());
    const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [historial, setHistorial] = useState<PostVentaObservacion[]>(isJefeBO ? (allHistorial ?? []) : []);
    const [loadingHist, setLoadingHist] = useState(false);
    const [filterHistUsuario, setFilterHistUsuario] = useState('');
    const [filterHistEjecutivo, setFilterHistEjecutivo] = useState('');
    const [searchHistRuc, setSearchHistRuc] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editEstado, setEditEstado] = useState<EstadoKey | ''>('');
    const [editMotivo, setEditMotivo] = useState('');
    const [editSubmotivo, setEditSubmotivo] = useState('');
    const [editObs, setEditObs] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Reporte modal
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const [showReporte, setShowReporte] = useState(false);
    const [reporteMonth, setReporteMonth] = useState(now.getMonth() + 1);
    const [reporteYear, setReporteYear] = useState(now.getFullYear());
    const [reporteLoading, setReporteLoading] = useState(false);

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

    // Derived estado/motivo/submotivo config
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
        const firstUnsaved = filteredCuentas.findIndex(c => !guardadas.has(c.ruc));
        setIdx(firstUnsaved >= 0 ? firstUnsaved : 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterEjecutivo]);

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

    useEffect(() => {
        setObs('');
        setSelectedEstado('');
        setSelectedMotivo('');
        setSelectedSubmotivo('');
        setUploadedFiles([]);
    }, [idx]);

    // Restore last viewed account from localStorage on mount
    useEffect(() => {
        const lastRuc = localStorage.getItem(`pv_pos_${usuario}`);
        if (lastRuc) {
            const restoredIdx = cuentas.findIndex(c => c.ruc === lastRuc);
            if (restoredIdx >= 0) setIdx(restoredIdx);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist current account RUC whenever it changes
    useEffect(() => {
        if (cuenta) localStorage.setItem(`pv_pos_${usuario}`, cuenta.ruc);
    }, [cuenta?.ruc, usuario]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        for (const file of Array.from(files)) {
            try {
                const session = await createDriveUploadSession(file.name, file.type);
                if (!session.success || !session.uploadUrl) {
                    throw new Error(session.error ?? 'No se pudo iniciar la subida');
                }
                const putRes = await fetch(session.uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': file.type || 'application/octet-stream' },
                    body: file,
                });
                if (!putRes.ok) {
                    throw new Error(`Error al subir a Drive (${putRes.status})`);
                }
                const data = await putRes.json();
                if (!data.id) throw new Error('No se obtuvo el ID del archivo');
                setUploadedFiles(prev => [...prev, { id: data.id, name: file.name }]);
            } catch (err: any) {
                AppSwal.fire({ icon: 'error', title: 'Error al subir', text: err.message ?? 'Error desconocido', confirmButtonColor: '#ef4444' });
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
                razonSocial: cuenta.razonSocial,
                telefono: cuenta.telefono,
                ejecutivoOriginal: cuenta.ejecutivo,
                lineas: cuenta.lineas,
                cargoFijo: cuenta.cargoFijo,
                segmento: cuenta.segmento,
                distrito: cuenta.distrito,
                srIngreso: cuenta.srIngreso,
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
                    if (idx < total - 1) {
                        setTimeout(() => setIdx(i => i + 1), 600);
                    }
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

    const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    const handleDownloadReporte = async (all: boolean) => {
        setReporteLoading(true);
        const res = all
            ? await getPostVentaReporteData()
            : await getPostVentaReporteData(reporteMonth, reporteYear);
        setReporteLoading(false);

        if (!res.success || !res.data) {
            AppSwal.fire({ icon: 'error', title: 'Error', text: res.error ?? 'Error al generar el reporte', confirmButtonColor: '#ef4444' });
            return;
        }

        const rows = res.data.map(r => ({
            'ID': r.id,
            'RUC': r.ruc,
            'Razón Social': r.razonSocial,
            'Ejecutivo': r.ejecutivo,
            'Supervisor': r.supervisor,
            'Segmento': r.segmento,
            'Líneas': r.lineas,
            'CF Total': r.cargoFijo,
            'Descuento': r.descuento,
            'Contacto': r.contacto,
            'Teléfono': r.telefono,
            'Correo': r.correo,
            'Departamento': r.departamento,
            'Provincia': r.provincia,
            'Distrito': r.distrito,
            'Dirección': r.direccion,
            'DNI/RUC Rep.': r.dni,
            'Proceso': r.proceso,
            'Detalle': r.detalle,
            'Fecha Activación': r.fechaActivacion,
            'Fecha Periodo': r.fechaPeriodo,
            'Fecha Inicio': r.fechaInicio,
            'Fecha Fin': r.fechaFin,
            'SR Ingreso': r.srIngreso,
            'Nro. Orden': r.numOrden,
            'Operador': r.operador,
            'Estado': r.estado,
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 8 }, { wch: 14 }, { wch: 40 }, { wch: 30 }, { wch: 30 },
            { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 30 },
            { wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
            { wch: 40 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
            { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 14 },
            { wch: 16 }, { wch: 14 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cuentas Activas');
        const fileName = all
            ? `reporte-cuentas-activas-general.xlsx`
            : `reporte-cuentas-${MONTH_NAMES[reporteMonth - 1]}-${reporteYear}.xlsx`.toLowerCase();
        XLSX.writeFile(wb, fileName);
        setShowReporte(false);
    };

    const handleExportExcel = () => {
        const rows = filteredHist.map(h => ({
            'ID': h.id ?? '',
            'RUC': h.ruc ?? '',
            'Razón Social': h.razonSocial ?? '',
            'Teléfono': h.telefono ?? '',
            'Ejecutivo': h.ejecutivoOriginal ?? '',
            'Líneas': h.lineas ?? '',
            'Cargo Fijo': h.cargoFijo ?? '',
            'Segmento': h.segmento ?? '',
            'Distrito': h.distrito ?? '',
            'SR Ingreso': h.srIngreso ?? '',
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
            { wch: 8 }, { wch: 14 }, { wch: 40 }, { wch: 16 }, { wch: 30 },
            { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
            { wch: 60 }, { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 22 }, { wch: 20 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Post Venta');
        XLSX.writeFile(wb, `postventa-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
        .filter(h => !filterHistUsuario || h.usuario === filterHistUsuario)
        .filter(h => !filterHistEjecutivo || h.ejecutivoOriginal === filterHistEjecutivo)
        .filter(h => {
            if (!searchHistRuc) return true;
            const q = searchHistRuc.trim().toLowerCase();
            return h.ruc.includes(q) || h.razonSocial.toLowerCase().includes(q);
        });

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

                .pv-section-label { font-size:0.7rem; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem; }
                .pv-required { color:#f43f5e; font-size:0.9rem; }
                .pv-optional { color:#334155; font-size:0.65rem; font-weight:700; }

                .pv-estado-section { margin-bottom:1rem; }
                .pv-estado-btns { display:flex; gap:0.5rem; flex-wrap:wrap; }
                .pv-estado-btn { padding:9px 16px; border-radius:0.875rem; font-size:0.75rem; font-weight:800; cursor:pointer; border:1px solid transparent; letter-spacing:0.03em; text-transform:uppercase; transition:all 0.2s; display:flex; align-items:center; gap:0.4rem; background:rgba(255,255,255,0.04); color:#64748b; border-color:rgba(255,255,255,0.08); white-space:nowrap; }
                .pv-estado-btn:hover { opacity:0.85; }
                .pv-estado-btn.selected { transform:scale(1.03); box-shadow:0 4px 15px rgba(0,0,0,0.2); }

                .pv-cascade-box { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:1rem; padding:1rem 1.25rem; margin-bottom:1rem; }
                .pv-cascade-select { width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:0.75rem; color:white; font-size:0.85rem; font-weight:600; padding:10px 14px; outline:none; cursor:pointer; transition:border-color 0.2s; appearance:none; }
                .pv-cascade-select:focus { border-color:rgba(245,158,11,0.5); }
                .pv-cascade-select option { background:#0f172a; color:white; }
                .pv-submotivo-select { border-color:rgba(239,68,68,0.3); }
                .pv-submotivo-select:focus { border-color:rgba(239,68,68,0.6); }

                .pv-obs-wrap { margin-bottom:1rem; }
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
                .pv-hist-motivo-chip { font-size:0.65rem; font-weight:700; color:#fbbf24; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); border-radius:999px; padding:3px 10px; }
                .pv-hist-submotivo-chip { font-size:0.65rem; font-weight:700; color:#f87171; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:999px; padding:3px 10px; }
                .pv-hist-file-link { font-size:0.65rem; font-weight:700; color:#818cf8; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); border-radius:999px; padding:3px 10px; text-decoration:none; display:inline-flex; align-items:center; gap:0.3rem; }
                .pv-hist-file-link:hover { background:rgba(99,102,241,0.2); }
                .pv-empty-hist { text-align:center; padding:3rem; color:#475569; }
                .pv-hist-search { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:0.75rem; padding:0.6rem 1rem; color:white; font-size:0.85rem; outline:none; transition:border-color 0.2s; margin-bottom:1rem; box-sizing:border-box; }
                .pv-hist-search:focus { border-color:rgba(99,102,241,0.5); }
                .pv-hist-search::placeholder { color:#334155; }
                .pv-edit-box { background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.2); border-radius:0.875rem; padding:1rem 1.25rem; margin-top:0.75rem; }
                .pv-edit-row { display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.75rem; }
                .pv-edit-select { flex:1; min-width:160px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:0.6rem; color:white; font-size:0.8rem; padding:8px 12px; outline:none; }
                .pv-edit-textarea { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:0.75rem; padding:0.75rem 1rem; color:white; font-size:0.85rem; resize:none; outline:none; font-family:inherit; box-sizing:border-box; }
                .pv-edit-actions { display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.6rem; }
                .pv-btn-edit { font-size:0.68rem; font-weight:800; padding:5px 14px; border-radius:0.6rem; cursor:pointer; border:1px solid rgba(99,102,241,0.35); background:rgba(99,102,241,0.12); color:#818cf8; transition:all 0.2s; text-transform:uppercase; letter-spacing:0.04em; }
                .pv-btn-edit:hover { background:rgba(99,102,241,0.2); }
                .pv-btn-save-edit { font-size:0.68rem; font-weight:800; padding:5px 14px; border-radius:0.6rem; cursor:pointer; border:none; background:linear-gradient(135deg,#10b981,#059669); color:white; transition:all 0.2s; text-transform:uppercase; letter-spacing:0.04em; }
                .pv-btn-save-edit:disabled { opacity:0.4; cursor:not-allowed; }
                .pv-btn-cancel-edit { font-size:0.68rem; font-weight:800; padding:5px 14px; border-radius:0.6rem; cursor:pointer; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#64748b; transition:all 0.2s; text-transform:uppercase; letter-spacing:0.04em; }
                .pv-btn-cancel-edit:hover { color:#94a3b8; border-color:rgba(255,255,255,0.2); }

                @keyframes spin { to { transform:rotate(360deg); } }
                .pv-spinner { width:18px; height:18px; border:2px solid rgba(255,255,255,0.2); border-top-color:white; border-radius:50%; animation:spin 0.7s linear infinite; flex-shrink:0; }
            `}</style>

            {/* TABS */}
            <div className="pv-tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {!isJefeBO && (
                        <button className={`pv-tab ${vista === 'gestion' ? 'active' : ''}`} onClick={() => setVista('gestion')}>
                            📞 Gestión
                        </button>
                    )}
                    <button className={`pv-tab ${vista === 'historial' ? 'active' : ''}`} onClick={() => setVista('historial')}>
                        {isJefeBO ? '📋 Todos los registros' : '📋 Mis registros'}
                    </button>
                </div>
                {(userRole === 'ADMIN' || userRole === 'JEFE_BO') && (
                    <button
                        onClick={() => setShowReporte(true)}
                        style={{
                            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                            border: 'none',
                            borderRadius: '0.75rem',
                            color: '#fff',
                            padding: '7px 16px',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
                        }}
                    >
                        📥 Descargar Reporte
                    </button>
                )}
            </div>

            {/* ══════════ GESTIÓN ══════════ */}
            {vista === 'gestion' && (
                <>
                    {ejecutivosUnicos.length > 0 && (
                        <div className="pv-filter-bar">
                            <span className="pv-filter-label">Filtrar por ejecutivo:</span>
                            <select className="pv-select" value={filterEjecutivo} onChange={e => setFilterEjecutivo(e.target.value)}>
                                <option value="">Todos ({cuentas.length})</option>
                                {ejecutivosUnicos.map(ej => <option key={ej} value={ej}>{ej}</option>)}
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
                            {/* PROGRESO */}
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
                                            <div className="pv-cuenta-nombre" title={cuenta.razonSocial}>{cuenta.razonSocial}</div>
                                            {cuenta.segmento && (
                                                <span className="pv-cuenta-seg"
                                                      style={{ background: segColor.bg, color: segColor.text, border: `1px solid ${segColor.glow}` }}>
                                                    {cuenta.segmento}
                                                </span>
                                            )}
                                            {cuenta.ejecutivo && <div className="pv-cuenta-ejec">👤 {cuenta.ejecutivo}</div>}
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
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div className="pv-data-cell">
                                            <div className="pv-data-label">🔖 SR Ingreso</div>
                                            <div className="pv-data-value" style={{ color: '#818cf8', fontFamily: 'monospace' }}>{cuenta.srIngreso || '—'}</div>
                                        </div>
                                        <div className="pv-data-cell">
                                            <div className="pv-data-label">📋 N° Orden</div>
                                            <div className="pv-data-value" style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{cuenta.numOrden || '—'}</div>
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
                                            onClick={() => setReGestionando(prev => new Set([...prev, cuenta!.ruc]))}>
                                        Re-gestionar
                                    </button>
                                </div>
                            ) : mostrarForm && (
                                <>
                                    {/* ESTADO */}
                                    <div className="pv-estado-section">
                                        <div className="pv-section-label">
                                            Estado de la gestión <span className="pv-required">*</span>
                                        </div>
                                        <div className="pv-estado-btns">
                                            {ESTADO_KEYS.map(key => {
                                                const cfg = ESTADOS[key];
                                                return (
                                                    <button
                                                        key={key}
                                                        className={`pv-estado-btn ${selectedEstado === key ? 'selected' : ''}`}
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

                                    {/* MOTIVO (cuando el estado lo requiere) */}
                                    {requiereMotivo && (
                                        <div className="pv-cascade-box">
                                            <div className="pv-section-label" style={{ marginBottom: '0.5rem' }}>
                                                Motivo <span className="pv-required">*</span>
                                            </div>
                                            <select
                                                className="pv-cascade-select"
                                                value={selectedMotivo}
                                                onChange={e => { setSelectedMotivo(e.target.value); setSelectedSubmotivo(''); }}
                                                disabled={isPending}
                                            >
                                                <option value="">— Selecciona el motivo —</option>
                                                {motivosParaEstado.map(m => (
                                                    <option key={m.key} value={m.key}>{m.label}</option>
                                                ))}
                                            </select>

                                            {/* SUBMOTIVO (cuando el motivo lo requiere) */}
                                            {requiereSubmotivo && (
                                                <div style={{ marginTop: '0.75rem' }}>
                                                    <div className="pv-section-label" style={{ marginBottom: '0.5rem', color: '#f87171' }}>
                                                        Submotivo <span className="pv-required">*</span>
                                                    </div>
                                                    <select
                                                        className="pv-cascade-select pv-submotivo-select"
                                                        value={selectedSubmotivo}
                                                        onChange={e => setSelectedSubmotivo(e.target.value)}
                                                        disabled={isPending}
                                                    >
                                                        <option value="">— Selecciona el submotivo —</option>
                                                        {submotivosParaMotivo.map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* OBSERVACIÓN */}
                                    <div className="pv-obs-wrap">
                                        <div className="pv-section-label">
                                            Observación de la llamada <span className="pv-required">*</span>
                                        </div>
                                        <textarea
                                            className="pv-obs-textarea"
                                            placeholder="Ej: Cliente atendió, confirma que está activado. Conforme con el servicio..."
                                            value={obs}
                                            onChange={e => setObs(e.target.value)}
                                            disabled={isPending}
                                        />
                                    </div>

                                    {/* EVIDENCIA (opcional) */}
                                    <div className="pv-upload-section">
                                        <div className="pv-section-label">
                                            Evidencia (capturas, audios, docs) <span className="pv-optional">— Opcional</span>
                                        </div>
                                        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
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
                                    <button className="pv-btn pv-btn-guardar" onClick={handleGuardar} disabled={isPending || !canSave}>
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

                    {/* Búsqueda por RUC */}
                    <input
                        className="pv-hist-search"
                        type="text"
                        placeholder="🔍  Buscar por RUC o razón social..."
                        value={searchHistRuc}
                        onChange={e => setSearchHistRuc(e.target.value)}
                    />

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
                                const isEditing = editingId === h.id;

                                // Edit derived state
                                const editCfg = editEstado ? ESTADOS[editEstado] : null;
                                const editMotivosDisp = editCfg?.motivos ?? [];
                                const editRequiereMotivo = editMotivosDisp.length > 0;
                                const editMotivoObj = editMotivosDisp.find(m => m.key === editMotivo);
                                const editSubmotivosDisp = editMotivoObj?.submotivos ?? [];
                                const editRequiereSubmotivo = editSubmotivosDisp.length > 0;

                                return (
                                    <div className="pv-hist-card" key={i} style={isEditing ? { borderColor: 'rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.04)' } : {}}>
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

                                        {!isEditing && <div className="pv-hist-obs">{h.observacion}</div>}

                                        <div className="pv-hist-meta">
                                            {isJefeBO && h.usuario && (
                                                <span className="pv-hist-chip" style={{ color: '#a78bfa', borderColor: '#8b5cf640', background: 'rgba(139,92,246,0.08)' }}>
                                                    🎧 {h.usuario}
                                                </span>
                                            )}
                                            {h.motivo && <span className="pv-hist-motivo-chip">⚡ {h.motivo}</span>}
                                            {h.submotivo && <span className="pv-hist-submotivo-chip">↳ {h.submotivo}</span>}
                                            {h.segmento && <span className="pv-hist-chip" style={{ color: sc.text, borderColor: sc.glow }}>{h.segmento}</span>}
                                            {h.telefono && <span className="pv-hist-chip">📞 {h.telefono}</span>}
                                            {h.lineas && <span className="pv-hist-chip">📶 {h.lineas} lín.</span>}
                                            {h.srIngreso && <span className="pv-hist-chip" style={{ color: '#818cf8' }}>🔖 {h.srIngreso}</span>}
                                            {h.numOrden && <span className="pv-hist-chip" style={{ color: '#fbbf24' }}>📋 {h.numOrden}</span>}
                                            {h.ejecutivoOriginal && <span className="pv-hist-chip">👤 {h.ejecutivoOriginal}</span>}
                                            {fileIds.map((fid, fi) => (
                                                <a key={fi} className="pv-hist-file-link"
                                                   href={`https://drive.google.com/file/d/${fid}/view`}
                                                   target="_blank" rel="noopener noreferrer">
                                                    📎 Archivo {fi + 1}
                                                </a>
                                            ))}
                                            {!isEditing && (
                                                <button className="pv-btn-edit" style={{ marginLeft: 'auto' }} onClick={() => startEditing(h)}>
                                                    ✏ Editar
                                                </button>
                                            )}
                                        </div>

                                        {/* Editor inline */}
                                        {isEditing && (
                                            <div className="pv-edit-box">
                                                <div className="pv-edit-row">
                                                    <select className="pv-edit-select" value={editEstado}
                                                        onChange={e => { setEditEstado(e.target.value as EstadoKey); setEditMotivo(''); setEditSubmotivo(''); }}>
                                                        <option value="">— Estado —</option>
                                                        {ESTADO_KEYS.map(k => <option key={k} value={k}>{ESTADOS[k].emoji} {ESTADOS[k].label}</option>)}
                                                    </select>
                                                    {editRequiereMotivo && (
                                                        <select className="pv-edit-select" value={editMotivo}
                                                            onChange={e => { setEditMotivo(e.target.value); setEditSubmotivo(''); }}>
                                                            <option value="">— Motivo —</option>
                                                            {editMotivosDisp.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                                        </select>
                                                    )}
                                                    {editRequiereSubmotivo && (
                                                        <select className="pv-edit-select" value={editSubmotivo} onChange={e => setEditSubmotivo(e.target.value)}>
                                                            <option value="">— Submotivo —</option>
                                                            {editSubmotivosDisp.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    )}
                                                </div>
                                                <textarea className="pv-edit-textarea" rows={3} value={editObs} onChange={e => setEditObs(e.target.value)}
                                                    placeholder="Observación..." />
                                                <div className="pv-edit-actions">
                                                    <button className="pv-btn-cancel-edit" onClick={() => setEditingId(null)} disabled={editSaving}>Cancelar</button>
                                                    <button className="pv-btn-save-edit" onClick={() => handleUpdateHistorial(h.id)} disabled={editSaving || !editEstado || !editObs.trim()}>
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

            {/* ══════════ REPORTE MODAL ══════════ */}
            {showReporte && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
                }}>
                    <div style={{
                        background: '#0c0c0e', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '2rem', padding: '2.5rem', width: '100%', maxWidth: '440px',
                        boxShadow: '0 0 80px rgba(14,165,233,0.15)', position: 'relative',
                    }}>
                        <button
                            onClick={() => setShowReporte(false)}
                            style={{
                                position: 'absolute', top: '1.25rem', right: '1.25rem',
                                width: '2rem', height: '2rem', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem',
                            }}
                        >✕</button>

                        <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#0ea5e9', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                            Reporte de Cuentas Activas
                        </div>
                        <h2 style={{ color: 'white', fontWeight: 950, fontSize: '1.6rem', margin: '0 0 2rem', letterSpacing: '-0.02em' }}>
                            Descargar Excel
                        </h2>

                        {/* Month filter */}
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 900, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>
                                Filtrar por mes
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <select
                                    value={reporteMonth}
                                    onChange={e => setReporteMonth(Number(e.target.value))}
                                    style={{
                                        flex: 1, background: 'rgba(24,24,27,0.7)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '0.875rem', color: 'white', padding: '0.65rem 1rem',
                                        fontSize: '0.85rem', fontWeight: 700, outline: 'none',
                                    }}
                                >
                                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                </select>
                                <select
                                    value={reporteYear}
                                    onChange={e => setReporteYear(Number(e.target.value))}
                                    style={{
                                        width: '110px', background: 'rgba(24,24,27,0.7)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '0.875rem', color: 'white', padding: '0.65rem 1rem',
                                        fontSize: '0.85rem', fontWeight: 700, outline: 'none',
                                    }}
                                >
                                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button
                                onClick={() => handleDownloadReporte(false)}
                                disabled={reporteLoading}
                                style={{
                                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                                    border: 'none', borderRadius: '1rem', color: 'white',
                                    padding: '1rem', fontWeight: 900, fontSize: '0.85rem',
                                    cursor: reporteLoading ? 'not-allowed' : 'pointer',
                                    opacity: reporteLoading ? 0.6 : 1,
                                    letterSpacing: '0.05em', textTransform: 'uppercase',
                                    boxShadow: '0 8px 20px rgba(14,165,233,0.25)',
                                }}
                            >
                                {reporteLoading ? 'Generando...' : `⬇ Descargar ${MONTH_NAMES[reporteMonth - 1]} ${reporteYear}`}
                            </button>
                            <button
                                onClick={() => handleDownloadReporte(true)}
                                disabled={reporteLoading}
                                style={{
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '1rem', color: '#94a3b8',
                                    padding: '1rem', fontWeight: 900, fontSize: '0.85rem',
                                    cursor: reporteLoading ? 'not-allowed' : 'pointer',
                                    opacity: reporteLoading ? 0.6 : 1,
                                    letterSpacing: '0.05em', textTransform: 'uppercase',
                                }}
                            >
                                {reporteLoading ? 'Generando...' : '⬇ Reporte General (todo)'}
                            </button>
                        </div>

                        <div style={{ marginTop: '1.25rem', fontSize: '0.68rem', color: '#334155', fontWeight: 600, lineHeight: 1.5 }}>
                            Incluye: RUC, Razón Social, Ejecutivo, Supervisor, Segmento, Líneas, CF Total, Fechas, Proceso y más.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
