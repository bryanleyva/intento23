'use client';

import { useState } from 'react';
import { getVentasActivadasPlantilla } from '@/app/actions/erp-export';
import { PLANTILLA_HEADERS, type PlantillaRow } from '@/lib/plantilla-ventas';
import { AppSwal } from '@/lib/sweetalert';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function ErpExportPanel() {
    const now = new Date();
    const [mes, setMes] = useState(now.getMonth() + 1);
    const [anio, setAnio] = useState(now.getFullYear());
    const [todos, setTodos] = useState(false);
    const [rows, setRows] = useState<PlantillaRow[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [aplicado, setAplicado] = useState<{ mes: number; anio: number; todos: boolean } | null>(null);

    const years: number[] = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) years.push(y);

    const aplicarFiltro = async () => {
        setLoading(true);
        setRows(null);
        try {
            const res = await getVentasActivadasPlantilla(mes, anio, todos);
            if (!res.success || !res.data) {
                AppSwal.fire({ icon: 'error', title: 'Error', text: res.error || 'No se pudo obtener la data.' });
                return;
            }
            setRows(res.data);
            setAplicado({ mes, anio, todos });
        } catch (e) {
            console.error(e);
            AppSwal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un problema al obtener la data.' });
        } finally {
            setLoading(false);
        }
    };

    const descargar = async () => {
        if (!rows || rows.length === 0) return;
        setDownloading(true);
        try {
            const ExcelJS = (await import('exceljs')).default;
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Ventas');
            ws.columns = PLANTILLA_HEADERS.map(h => ({ header: h, key: h, width: 18 }));
            ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
            rows.forEach(r => ws.addRow(r));
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = aplicado?.todos
                ? 'ventas_cierre_TODOS.xlsx'
                : `ventas_cierre_${String(aplicado?.mes ?? mes).padStart(2, '0')}_${aplicado?.anio ?? anio}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            AppSwal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el archivo Excel.' });
        } finally {
            setDownloading(false);
        }
    };

    const selectStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '0.6rem', color: '#e2e8f0', padding: '9px 12px', fontSize: '0.85rem', outline: 'none',
    };

    return (
        <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            {/* FILTRO */}
            <div style={{
                display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '1rem', padding: '1.25rem',
            }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', opacity: todos ? 0.4 : 1 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b' }}>Mes</span>
                    <select style={selectStyle} value={mes} disabled={todos} onChange={e => setMes(Number(e.target.value))}>
                        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', opacity: todos ? 0.4 : 1 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b' }}>Año</span>
                    <select style={selectStyle} value={anio} disabled={todos} onChange={e => setAnio(Number(e.target.value))}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '9px 0', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700 }}>
                    <input type="checkbox" checked={todos} onChange={e => setTodos(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }} />
                    Todos los meses
                </label>
                <button
                    onClick={aplicarFiltro}
                    disabled={loading}
                    style={{
                        background: loading ? 'rgba(99,102,241,0.4)' : '#6366f1', color: '#fff', border: 'none',
                        borderRadius: '0.7rem', padding: '10px 22px', fontWeight: 800, fontSize: '0.85rem',
                        cursor: loading ? 'default' : 'pointer', letterSpacing: '0.03em',
                    }}
                >
                    {loading ? 'Cargando…' : '🔎 Aplicar filtro'}
                </button>
                {rows && rows.length > 0 && (
                    <button
                        onClick={descargar}
                        disabled={downloading}
                        style={{
                            background: downloading ? 'rgba(16,185,129,0.4)' : '#10b981', color: '#fff', border: 'none',
                            borderRadius: '0.7rem', padding: '10px 22px', fontWeight: 800, fontSize: '0.85rem',
                            cursor: downloading ? 'default' : 'pointer', marginLeft: 'auto', letterSpacing: '0.03em',
                            boxShadow: '0 6px 16px -6px rgba(16,185,129,0.6)',
                        }}
                    >
                        {downloading ? 'Generando…' : '⬇ Descargar XLSX'}
                    </button>
                )}
            </div>

            {/* RESULTADO */}
            {rows && (
                <div style={{ marginTop: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'white' }}>
                            {aplicado ? (aplicado.todos ? 'Todos los meses' : `${MESES[aplicado.mes - 1]} ${aplicado.anio}`) : ''} · Formato plantilla
                        </h3>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700 }}>{rows.length} ventas ACTIVADO</span>
                    </div>

                    {rows.length === 0 ? (
                        <div style={{
                            padding: '2.5rem', textAlign: 'center', color: '#64748b',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1rem',
                        }}>
                            No hay ventas ACTIVADO para ese mes.
                        </div>
                    ) : (
                        <div style={{
                            overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem',
                            background: 'rgba(255,255,255,0.02)',
                        }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(16,185,129,0.15)' }}>
                                        {PLANTILLA_HEADERS.map(h => (
                                            <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={i} style={{ background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                                            {PLANTILLA_HEADERS.map(h => (
                                                <td key={h} style={{ padding: '7px 12px', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{r[h] || ''}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
