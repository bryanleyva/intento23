'use client';

import React, { useState, useEffect } from 'react';
import { getSupervisorDistributionStats, assignBaseToSupervisor } from '@/app/actions/base-distribution';
import { AppSwal } from '@/lib/sweetalert';

type DistributionBase = 'RYDERS' | 'ESPECIAL' | 'LINDA';

interface SupervisorStat {
    name: string;
    user: string;
    poolTotal: number;
    disponible: number;
    buckets: Record<string, number>;
}

const RANGES = [
    { id: '1-4', label: '1 a 4 Lins', short: '1-4 LINS' },
    { id: '5-10', label: '5 a 10 Lins', short: '5-10 LINS' },
    { id: '11-15', label: '11 a 15 Lins', short: '11-15 LINS' },
    { id: '16-21', label: '16 a 21 Lins', short: '16-21 LINS' },
    { id: '22-30', label: '22 a 30 Lins', short: '22-30 LINS' },
    { id: '30+', label: '30+ Lins', short: '30+ LINS' },
];

export default function SupervisorAssignmentPanel() {
    const [activeBase, setActiveBase] = useState<DistributionBase>('RYDERS');
    const [stats, setStats] = useState<SupervisorStat[]>([]);
    const [globalStock, setGlobalStock] = useState<Record<string, number>>({});
    const [globalTotal, setGlobalTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [selected, setSelected] = useState<SupervisorStat | null>(null);
    const [quantity, setQuantity] = useState(50);
    const [rangeId, setRangeId] = useState('1-4');
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        loadData();
    }, [activeBase]);

    const loadData = async () => {
        setLoading(true);
        const res = await getSupervisorDistributionStats(activeBase);
        if (res.success) {
            setStats(res.stats || []);
            setGlobalStock(res.globalStock || {});
            setGlobalTotal(res.globalTotal || 0);
        }
        setLoading(false);
    };

    const openModal = (sup: SupervisorStat) => {
        setSelected(sup);
        setQuantity(50);
        setRangeId('1-4');
        setShowModal(true);
    };

    const handleAssign = async () => {
        if (!selected) return;
        const available = globalStock[rangeId] || 0;

        if (quantity <= 0) {
            AppSwal.fire({ title: 'Atención', text: 'La cantidad debe ser mayor a 0', icon: 'warning' });
            return;
        }
        if (quantity > available) {
            AppSwal.fire({ title: 'Stock insuficiente', text: `Solo hay ${available} leads en el stock global de este rango`, icon: 'warning' });
            return;
        }

        const confirm = await AppSwal.fire({
            title: '¿Confirmar distribución?',
            text: `Asignar ${quantity} leads (${rangeId} lins) al pool de ${selected.name}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'SÍ, ASIGNAR',
            cancelButtonText: 'CANCELAR'
        });
        if (!confirm.isConfirmed) return;

        setAssigning(true);
        const res = await assignBaseToSupervisor(selected.name, quantity, rangeId, activeBase);
        setAssigning(false);

        if (res.success) {
            AppSwal.fire({ title: 'Éxito', text: `${res.count} leads asignados al pool de ${selected.name}`, icon: 'success' });
            setShowModal(false);
            loadData();
        } else {
            AppSwal.fire({ title: 'Error', text: res.error || 'Error en la distribución', icon: 'error' });
        }
    };

    if (loading) return (
        <div className="loadingContainer font-outfit uppercase">
            <span className="loadingText">Sincronizando Distribución de Base...</span>
        </div>
    );

    const accent = activeBase === 'ESPECIAL' ? '#8b5cf6' : activeBase === 'LINDA' ? '#f97316' : '#6366f1';

    return (
        <div className="distContainer font-outfit">

            {/* Base Selector */}
            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem', padding: '4px', width: 'fit-content' }}>
                {([
                    { id: 'RYDERS', label: '🚀 Base Ryders', color: '#34d399', bg: 'rgba(16,185,129,0.15)', ring: 'rgba(16,185,129,0.3)' },
                    { id: 'ESPECIAL', label: '⭐ Base Especial', color: '#a78bfa', bg: 'rgba(139,92,246,0.15)', ring: 'rgba(139,92,246,0.3)' },
                    { id: 'LINDA', label: '🌸 Base Linda', color: '#fb923c', bg: 'rgba(249,115,22,0.15)', ring: 'rgba(249,115,22,0.3)' },
                ] as const).map(b => (
                    <button
                        key={b.id}
                        onClick={() => setActiveBase(b.id)}
                        style={{ padding: '8px 20px', borderRadius: '0.75rem', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer', border: 'none', textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.2s', background: activeBase === b.id ? b.bg : 'transparent', color: activeBase === b.id ? b.color : '#64748b', boxShadow: activeBase === b.id ? `inset 0 0 0 1px ${b.ring}` : 'none' }}
                    >
                        {b.label}
                    </button>
                ))}
            </div>

            {/* Header / Summary */}
            <div className="distHeader">
                <div>
                    <h1 className="headerTitle">Distribución de Base</h1>
                    <p className="headerSubtitle">
                        <span className="stockIndicator" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}></span>
                        {globalTotal} leads sin asignar en stock global
                    </p>
                </div>

                <div className="stockGrid">
                    {RANGES.map(r => (
                        <div key={r.id} className="stockItem">
                            <span className="stockCount">{globalStock[r.id] || 0}</span>
                            <span className="stockRange">{r.short}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Supervisor Grid */}
            <div className="supGrid">
                {stats.map(sup => (
                    <div key={sup.user} className="supCard">
                        <div className="cardBgDecor">SV</div>
                        <div className="cardTop">
                            <div className="cardIcon" style={{ background: `${accent}22`, borderColor: `${accent}55` }}>👤</div>
                            <span className="cardBadge">SUPERVISOR</span>
                        </div>

                        <h3 className="supName">{sup.name}</h3>
                        <p className="supUser">{sup.user}</p>

                        <div className="poolBox">
                            <div className="poolRow">
                                <span className="poolLabel">Pool Total</span>
                                <span className="poolValue">{sup.poolTotal}</span>
                            </div>
                            <div className="poolRow">
                                <span className="poolLabel">Disponible</span>
                                <span className="poolValue" style={{ color: accent }}>{sup.disponible}</span>
                            </div>
                        </div>

                        {sup.poolTotal > 0 && (
                            <div className="bucketRow">
                                {RANGES.map(r => (
                                    <span key={r.id} className="bucketChip">
                                        <b>{sup.buckets?.[r.id] || 0}</b> {r.short}
                                    </span>
                                ))}
                            </div>
                        )}

                        <button onClick={() => openModal(sup)} className="assignBtn">
                            Asignar Base
                        </button>
                    </div>
                ))}
                {stats.length === 0 && (
                    <p style={{ color: '#71717a', gridColumn: '1/-1', textAlign: 'center', padding: '3rem' }}>
                        No hay supervisores (ROL SPECIAL) registrados.
                    </p>
                )}
            </div>

            {/* Modal */}
            {showModal && selected && (
                <div className="modalOverlay">
                    <div className="modalPanel">
                        <button onClick={() => setShowModal(false)} className="closeBtn">✕</button>
                        <span className="modalTag">Distribución a Supervisor</span>
                        <h2 className="modalTitle">{selected.name}</h2>

                        <div className="formGroup">
                            <div>
                                <label className="fieldLabel">Cantidad a Asignar</label>
                                <div className="quantityControl">
                                    <button onClick={() => setQuantity(Math.max(1, quantity - 10))} className="qtyBtn">-</button>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                        className="qtyInput"
                                    />
                                    <button onClick={() => setQuantity(quantity + 10)} className="qtyBtn">+</button>
                                </div>
                            </div>

                            <div>
                                <label className="fieldLabel">Rango de Líneas (Stock Global)</label>
                                <div className="rangeGrid">
                                    {RANGES.map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => setRangeId(r.id)}
                                            className={`rangeCard ${rangeId === r.id ? 'active' : ''}`}
                                            style={rangeId === r.id ? { background: accent, borderColor: accent } : undefined}
                                        >
                                            <span className="rangeLabel">{r.label}</span>
                                            <span className="rangeStock">Stock: {globalStock[r.id] || 0}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleAssign}
                                disabled={assigning || (globalStock[rangeId] || 0) === 0}
                                className="executeBtn"
                                style={{ background: accent }}
                            >
                                {assigning ? 'PROCESANDO...' : 'EJECUTAR DISTRIBUCIÓN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .font-outfit { font-family: 'Outfit', sans-serif; }
                .distContainer { width: 100%; display: flex; flex-direction: column; gap: 2.5rem; padding: 1rem 2rem; animation: fadeIn 0.7s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .loadingContainer { padding: 5rem; text-align: center; color: #6366f1; font-weight: 900; letter-spacing: 0.3em; }
                .loadingText { animation: pulse 2s infinite; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

                .distHeader { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2rem; gap: 2rem; flex-wrap: wrap; }
                .headerTitle { font-size: 2.5rem; font-weight: 950; color: white; letter-spacing: -0.04em; text-transform: uppercase; font-style: italic; margin: 0; }
                .headerSubtitle { color: #71717a; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
                .stockIndicator { width: 8px; height: 8px; border-radius: 50%; animation: pulse 2s infinite; }

                .stockGrid { display: flex; gap: 0.75rem; flex-wrap: wrap; }
                .stockItem { background: rgba(24,24,27,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 1rem; padding: 0.5rem 1rem; display: flex; flex-direction: column; align-items: center; min-width: 78px; backdrop-filter: blur(10px); }
                .stockCount { font-size: 1.1rem; font-weight: 900; color: #818cf8; }
                .stockRange { font-size: 8px; color: #52525b; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }

                .supGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
                .supCard { position: relative; background: rgba(24,24,27,0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 2rem; padding: 1.5rem; transition: all 0.4s cubic-bezier(0.175,0.885,0.32,1.275); overflow: hidden; backdrop-filter: blur(10px); }
                .supCard:hover { background: rgba(24,24,27,0.7); border-color: rgba(99,102,241,0.3); transform: translateY(-8px); }
                .cardBgDecor { position: absolute; top: 0; right: 0; padding: 1.5rem 2rem; opacity: 0.04; font-size: 5rem; font-weight: 900; font-style: italic; pointer-events: none; }
                .cardTop { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; }
                .cardIcon { width: 3rem; height: 3rem; border: 1px solid transparent; border-radius: 1.2rem; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
                .cardBadge { font-size: 9px; font-weight: 900; padding: 0.25rem 0.75rem; border-radius: 1rem; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); color: #818cf8; text-transform: uppercase; letter-spacing: 0.05em; }
                .supName { font-size: 1.1rem; font-weight: 900; color: white; text-transform: uppercase; margin: 0 0 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .supUser { font-size: 10px; color: #52525b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 1.25rem; }

                .poolBox { display: flex; flex-direction: column; gap: 0.5rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 1.25rem; padding: 1rem 1.1rem; margin-bottom: 1rem; }
                .poolRow { display: flex; justify-content: space-between; align-items: center; }
                .poolLabel { font-size: 10px; font-weight: 900; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; }
                .poolValue { font-size: 1.4rem; font-weight: 950; color: white; line-height: 1; }

                .bucketRow { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem; }
                .bucketChip { font-size: 9px; font-weight: 700; color: #a1a1aa; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 0.6rem; padding: 0.25rem 0.5rem; text-transform: uppercase; letter-spacing: 0.03em; }
                .bucketChip b { color: #c7d2fe; font-weight: 900; }

                .assignBtn { width: 100%; padding: 0.85rem; border-radius: 1.25rem; background: white; border: none; color: black; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; cursor: pointer; transition: all 0.3s; box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
                .assignBtn:hover { background: #6366f1; color: white; transform: scale(1.03); box-shadow: 0 10px 25px rgba(99,102,241,0.3); }

                .modalOverlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1.5rem; background: rgba(0,0,0,0.7); backdrop-filter: blur(12px); animation: fadeIn 0.4s ease-out; }
                .modalPanel { position: relative; background: #0c0c0e; border: 1px solid rgba(255,255,255,0.1); width: 100%; max-width: 460px; border-radius: 2.5rem; padding: 2.5rem; box-shadow: 0 0 100px rgba(99,102,241,0.15); }
                .closeBtn { position: absolute; top: 1.5rem; right: 1.5rem; width: 2.5rem; height: 2.5rem; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; cursor: pointer; }
                .modalTag { display: block; font-size: 10px; font-weight: 900; color: #818cf8; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 1rem; }
                .modalTitle { font-size: 1.8rem; font-weight: 950; color: white; text-transform: uppercase; font-style: italic; letter-spacing: -0.02em; margin: 0 0 2.5rem; }
                .formGroup { display: flex; flex-direction: column; gap: 2rem; }
                .fieldLabel { display: block; font-size: 9px; font-weight: 900; color: #52525b; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 0.75rem; }
                .quantityControl { display: flex; align-items: center; gap: 1rem; }
                .qtyBtn { width: 3rem; height: 3rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 1.25rem; color: white; font-size: 1.25rem; font-weight: 700; cursor: pointer; }
                .qtyInput { flex: 1; background: rgba(24,24,27,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 1.25rem; height: 3rem; text-align: center; font-size: 1.25rem; font-weight: 900; color: white; outline: none; }
                .rangeGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
                .rangeCard { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 1.25rem; padding: 0.9rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; text-align: left; cursor: pointer; transition: 0.3s; }
                .rangeLabel { font-size: 0.85rem; font-weight: 800; color: white; }
                .rangeCard.active .rangeLabel { color: white; }
                .rangeStock { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #818cf8; }
                .rangeCard.active .rangeStock { color: rgba(255,255,255,0.7); }
                .executeBtn { width: 100%; padding: 1.25rem; border-radius: 1.5rem; border: none; color: white; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; cursor: pointer; transition: 0.3s; margin-top: 0.5rem; }
                .executeBtn:disabled { background: #27272a !important; color: #52525b; cursor: not-allowed; }
                .qtyInput::-webkit-outer-spin-button, .qtyInput::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            `}</style>
        </div>
    );
}
