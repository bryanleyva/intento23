'use client';

import { useState } from 'react';
import { generarTablaUsuariosIds, type UsuarioIdRow } from '@/app/actions/usuarios-ids';
import { AppSwal } from '@/lib/sweetalert';

const HEADERS: { key: keyof UsuarioIdRow; label: string }[] = [
    { key: 'id', label: 'ID' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'dni', label: 'DNI' },
    { key: 'campana', label: 'Campaña' },
];

export default function UsuariosIdsPanel() {
    const [rows, setRows] = useState<UsuarioIdRow[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [nuevos, setNuevos] = useState<number>(0);

    const generar = async () => {
        setLoading(true);
        setRows(null);
        try {
            const res = await generarTablaUsuariosIds();
            if (!res.success || !res.data) {
                AppSwal.fire({ icon: 'error', title: 'Error', text: res.error || 'No se pudo generar el padrón.' });
                return;
            }
            setRows(res.data);
            setNuevos(res.nuevos || 0);
            if (res.nuevos && res.nuevos > 0) {
                AppSwal.fire({ icon: 'success', title: 'Padrón actualizado', text: `Se agregaron ${res.nuevos} usuario(s) nuevo(s).`, timer: 2200, showConfirmButton: false });
            }
        } catch (e) {
            console.error(e);
            AppSwal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un problema al generar el padrón.' });
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
            const ws = wb.addWorksheet('Usuarios');
            ws.columns = HEADERS.map(h => ({ header: h.label, key: h.key, width: 26 }));
            ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
            rows.forEach(r => ws.addRow(r));
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'padron_usuarios.xlsx';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            AppSwal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el archivo Excel.' });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div style={{ maxWidth: '100%', margin: '0 auto' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '1rem', padding: '1.25rem',
            }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
                        Genera el padrón de <strong style={{ color: '#c7d2fe' }}>vendedores y supervisores</strong> de todas las ventas.
                        Cada persona mantiene un <strong style={{ color: '#c7d2fe' }}>ID fijo</strong>; los nuevos se agregan sin repetir.
                    </p>
                </div>
                <button
                    onClick={generar}
                    disabled={loading}
                    style={{
                        background: loading ? 'rgba(99,102,241,0.4)' : '#6366f1', color: '#fff', border: 'none',
                        borderRadius: '0.7rem', padding: '10px 22px', fontWeight: 800, fontSize: '0.85rem',
                        cursor: loading ? 'default' : 'pointer', letterSpacing: '0.03em',
                    }}
                >
                    {loading ? 'Generando…' : '🧾 Generar / actualizar padrón'}
                </button>
                {rows && rows.length > 0 && (
                    <button
                        onClick={descargar}
                        disabled={downloading}
                        style={{
                            background: downloading ? 'rgba(16,185,129,0.4)' : '#10b981', color: '#fff', border: 'none',
                            borderRadius: '0.7rem', padding: '10px 22px', fontWeight: 800, fontSize: '0.85rem',
                            cursor: downloading ? 'default' : 'pointer', letterSpacing: '0.03em',
                            boxShadow: '0 6px 16px -6px rgba(16,185,129,0.6)',
                        }}
                    >
                        {downloading ? 'Generando…' : '⬇ Descargar XLSX'}
                    </button>
                )}
            </div>

            {rows && (
                <div style={{ marginTop: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'white' }}>
                            Padrón de usuarios
                        </h3>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700 }}>
                            {rows.length} usuarios{nuevos > 0 ? ` · ${nuevos} nuevo(s)` : ''}
                        </span>
                    </div>

                    {rows.length === 0 ? (
                        <div style={{
                            padding: '2.5rem', textAlign: 'center', color: '#64748b',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1rem',
                        }}>
                            No se encontraron vendedores ni supervisores en las ventas.
                        </div>
                    ) : (
                        <div style={{
                            overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem',
                            background: 'rgba(255,255,255,0.02)',
                        }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(99,102,241,0.15)' }}>
                                        {HEADERS.map(h => (
                                            <th key={h.key} style={{ padding: '9px 14px', textAlign: 'left', color: '#a5b4fc', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{h.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={r.id || i} style={{ background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                                            {HEADERS.map(h => (
                                                <td key={h.key} style={{
                                                    padding: '7px 14px', color: h.key === 'id' ? '#c7d2fe' : '#cbd5e1',
                                                    fontWeight: h.key === 'id' ? 800 : 400,
                                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                }}>{r[h.key] || ''}</td>
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
