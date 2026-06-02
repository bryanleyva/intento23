'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import LineProgressDashboard from "@/components/LineProgressDashboard";
import ExecutivePerformanceChart from "@/components/ExecutivePerformanceChart";
import PerformanceDetailsModal from "@/components/PerformanceDetailsModal";
import ExecutiveRanking from "@/components/ExecutiveRanking";
import GoalProgressGauge from "@/components/GoalProgressGauge";
import SupervisorRanking from "@/components/SupervisorRanking";
import TeamDetailsModal from "@/components/TeamDetailsModal";
import SalesRecordsModal from "@/components/SalesRecordsModal";
import StatusLegend from "@/components/StatusLegend";

// Helper for status colors
function getStatusColor(status: string) {
    const s = (status || '').trim().toUpperCase();
    if (['ACTIVADO'].includes(s)) return '#10b981';
    if (['RECHAZADO', 'ERROR DE DATA', 'VENTA CAIDA', 'ANULADO'].includes(s)) return '#ef4444';
    if (['INGRESADO'].includes(s)) return '#f59e0b';
    if (['APROBADO', 'DESPACHO'].includes(s)) return '#84cc16';
    if (['PENDIENTE ENVÍO'].includes(s)) return '#4ade80';
    if (['PENDIENTE', 'NUEVO INGRESO', 'NUEVO', 'NUEVOS INGRESOS'].includes(s)) return '#f97316';
    if (['PENDIENTE INGRESO', 'PENDIENTE INGRESOS'].includes(s)) return '#fb923c';
    if (['OBSERVADO POR ENTEL', 'OBSERVADO', 'EN EVALUACION'].includes(s)) return '#eab308';
    if (['PROCESO DE ACTIVACION', 'EN PROCESO DE ACTIVACION', 'FLUXO', 'EN DESPACHO'].includes(s)) return '#22c55e';
    return '#3b82f6';
}

interface BaseStat {
    name: string;
    color: string;
    emoji: string;
    interesados: number;
    lineas: number;
    noInteresados: number;
    pendientes: number;
}

interface ReportDashboardProps {
    rankingData: any[];
    supRankingData?: any[];
    rawVentas?: any[];
    reportData: any[];
    isStandard: boolean;
    userRole?: string;
    userName?: string;
    goal: number;
    selectedMonth: number;
    selectedYear: number;
    baseStats?: BaseStat[];
}

const MONTHS = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
];

const YEARS = [2024, 2025, 2026];

export default function ReportDashboard({ rankingData, supRankingData, rawVentas = [], reportData, isStandard, userRole, userName, goal, selectedMonth, selectedYear, baseStats = [] }: ReportDashboardProps) {
    const [selectedView, setSelectedView] = useState<'COMERCIAL' | 'GERENCIAL'>('COMERCIAL');
    const [showModal, setShowModal] = useState(false);
    const [showAccountsTable, setShowAccountsTable] = useState(false);

    // Drill-down states
    const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
    const [selectedExecutive, setSelectedExecutive] = useState<string | null>(null);

    const router = useRouter();

    const role = userRole?.trim().toUpperCase();
    const isAllowedSupervisorRanking = role === 'ADMIN' || role === 'SPECIAL';

    const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    const handleDownloadActivadas = () => {
        const activadas = rawVentas.filter(v => {
            const estado = (v.estado || '').trim().toUpperCase();
            const ruc = String(v.ruc || '').trim();
            return estado === 'ACTIVADO' && ruc.startsWith('20');
        });

        if (activadas.length === 0) {
            alert('No hay cuentas RUC 20 activadas en este mes.');
            return;
        }

        const rows = activadas.map(v => ({
            'ID': v.id ?? '',
            'RUC': v.ruc ?? '',
            'Razón Social': v.razonSocial ?? '',
            'Ejecutivo': v.ejecutivo ?? '',
            'Supervisor': v.supervisor ?? '',
            'Segmento': v.segmento ?? '',
            'Líneas': v.lineas ?? '',
            'CF Total': v.cargoFijo ?? '',
            'Descuento': v.descuento ?? '',
            'Contacto': v.contacto ?? '',
            'Teléfono': v.telefono ?? '',
            'Correo': v.correo ?? '',
            'Departamento': v.departamento ?? '',
            'Provincia': v.provincia ?? '',
            'Distrito': v.distrito ?? '',
            'Dirección': v.direccion ?? '',
            'DNI/Doc': v.dni ?? '',
            'Proceso': v.proceso ?? '',
            'Detalle': v.detalle ?? '',
            'Fecha Activación': v.fechaActivacion ?? '',
            'Fecha Periodo': v.fechaPeriodo ?? '',
            'Fecha Inicio': v.fechaInicio ?? '',
            'Fecha Fin': v.fechaFin ?? '',
            'SR Ingreso': v.srIngreso ?? '',
            'Nro. Orden': v.numOrden ?? '',
            'Operador': v.operador ?? '',
            'Estado': v.estado ?? '',
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
        XLSX.utils.book_append_sheet(wb, ws, 'Activadas RUC20');
        const mesLabel = MONTH_NAMES[selectedMonth - 1] ?? selectedMonth;
        XLSX.writeFile(wb, `activadas-ruc20-${mesLabel}-${selectedYear}.xlsx`.toLowerCase());
    };

    const handleFilterChange = (field: 'mes' | 'anio', value: string) => {
        const params = new URLSearchParams(window.location.search);
        params.set(field, value);
        router.push(`/reporte?${params.toString()}`);
    };

    const handleSelectSupervisor = (name: string) => {
        if (role === 'SPECIAL') {
            // Supervisors (SPECIAL) can only see their own details
            if (name.trim().toUpperCase() === userName?.trim().toUpperCase()) {
                setSelectedSupervisor(name);
            } else {
                // Potential feedback: alert or toast? For now just silent ignore or console
                console.log('Restringido: Solo puedes ver tus propios detalles como supervisor.');
            }
        } else {
            // ADMIN can see everything
            setSelectedSupervisor(name);
        }
    };

    const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || '';

    // Aggregation for Managerial View
    const getManagerialData = () => {
        const groups = [
            { label: 'RECHAZADO', sourceLabels: ['RECHAZADO'] },
            { label: 'INGRESADO', sourceLabels: ['NUEVOS INGRESOS', 'PENDIENTE INGRESOS', 'INGRESADO'] },
            { label: 'PENDIENTE', sourceLabels: ['OBSERVADO POR ENTEL', 'DESPACHO', 'PENDIENTE ENVÍO'] },
            { label: 'ACTIVO', sourceLabels: ['PROCESO DE ACTIVACION', 'ACTIVADO'] },
        ];

        return groups.map(group => {
            const relevantItems = reportData.filter(item => group.sourceLabels.includes(item.label));
            return {
                status: group.label,
                label: group.label,
                count: relevantItems.reduce((acc, item) => acc + item.count, 0),
                cfReal: relevantItems.reduce((acc, item) => acc + item.cfReal, 0),
                salesCount: relevantItems.reduce((acc, item) => acc + item.salesCount, 0),
                color: relevantItems[0]?.color || '#ffffff'
            };
        });
    };

    const displayReportData = [...(selectedView === 'GERENCIAL' ? getManagerialData() : reportData.filter(item => item.status !== 'TOTAL GENERAL'))];
    const totalItem = reportData.find(item => item.status === 'TOTAL GENERAL');
    if (totalItem) displayReportData.push(totalItem);

    return (
        <div className="animate-in fade-in duration-700" style={{ width: '100%', maxWidth: '100%' }}>

            {/* Header and Filters Section */}
            <div style={{
                padding: '3rem 2.5rem',
                borderBottom: '1px solid rgba(16, 185, 129, 0.1)',
                background: 'radial-gradient(circle at top left, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
                marginBottom: '4rem',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '3rem'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h1 style={{
                            color: 'white',
                            fontSize: '2.8rem',
                            fontWeight: 950,
                            letterSpacing: '-0.05em',
                            margin: 0,
                            lineHeight: 1,
                            textTransform: 'uppercase',
                            background: 'linear-gradient(to right, #ffffff, #10b981)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))'
                        }}>
                            Reporte de Gestión
                        </h1>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            background: 'rgba(16, 185, 129, 0.15)',
                            padding: '0.6rem 1.5rem',
                            borderRadius: '3rem',
                            width: 'fit-content',
                            border: '1.5px solid rgba(16, 185, 129, 0.4)',
                            boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)'
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>📅</span>
                            <span style={{
                                color: '#10b981',
                                fontWeight: 900,
                                fontSize: '1.3rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em'
                            }}>
                                {monthLabel} {selectedYear}
                            </span>
                        </div>
                    </div>

                    {/* Filters Section (Now allowed for isStandard) */}
                    <div style={{
                        display: 'flex',
                        gap: '2rem',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '2rem 3rem',
                        borderRadius: '2rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(15px)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <label style={{
                                color: 'rgba(16, 185, 129, 0.8)',
                                fontSize: '0.9rem',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.15em',
                                paddingLeft: '0.8rem'
                            }}>
                                Mes de Reporte
                            </label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => handleFilterChange('mes', e.target.value)}
                                className="custom-select-premium"
                                style={{
                                    width: '260px',
                                    height: '4rem',
                                    fontSize: '1.2rem',
                                    fontWeight: 800,
                                    padding: '0 2rem',
                                    borderRadius: '1.2rem',
                                    border: '1.5px solid rgba(255,255,255,0.15)',
                                    backgroundColor: 'rgba(0,0,0,0.3)'
                                }}
                            >
                                {MONTHS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <label style={{
                                color: 'rgba(16, 185, 129, 0.8)',
                                fontSize: '0.9rem',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.15em',
                                paddingLeft: '0.8rem'
                            }}>
                                Año
                            </label>
                            <select
                                value={selectedYear}
                                onChange={(e) => handleFilterChange('anio', e.target.value)}
                                className="custom-select-premium"
                                style={{
                                    width: '140px',
                                    height: '4rem',
                                    fontSize: '1.2rem',
                                    fontWeight: 800,
                                    padding: '0 2rem',
                                    borderRadius: '1.2rem',
                                    border: '1.5px solid rgba(255,255,255,0.15)',
                                    backgroundColor: 'rgba(0,0,0,0.3)'
                                }}
                            >
                                {YEARS.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        {/* View Selector */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <label style={{
                                color: 'rgba(16, 185, 129, 0.8)',
                                fontSize: '0.9rem',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.15em',
                                paddingLeft: '0.8rem'
                            }}>
                                Tipo de Vista
                            </label>
                            <select
                                value={selectedView}
                                onChange={(e) => setSelectedView(e.target.value as any)}
                                className="custom-select-premium"
                                style={{
                                    width: '220px',
                                    height: '4rem',
                                    fontSize: '1.2rem',
                                    fontWeight: 800,
                                    padding: '0 2rem',
                                    borderRadius: '1.2rem',
                                    border: '1.5px solid rgba(16, 185, 129, 0.3)',
                                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                                    color: '#10b981'
                                }}
                            >
                                <option value="COMERCIAL">Vista Comercial</option>
                                <option value="GERENCIAL">Vista Gerencial</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ minWidth: '320px', transform: 'scale(1.1)' }}>
                        <GoalProgressGauge
                            current={isStandard
                                ? (reportData.find(rd => rd.label === 'TOTAL GENERAL')?.count || 0)
                                : rankingData.reduce((acc, curr) => acc + curr.lineasActivas, 0)
                            }
                            goal={goal}
                        />
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '3rem' }}>
                <h2 style={{
                    color: 'white',
                    fontSize: '1.5rem',
                    fontWeight: 950,
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '1rem'
                }}>
                    Avance de Líneas
                </h2>
                <LineProgressDashboard data={displayReportData} hideTitle={true} />
            </div>

            <div style={{ padding: '0 2rem' }}>
                <StatusLegend />
            </div>

            {/* Origen de Prospectos por Base */}
            {baseStats.length > 0 && (
                <div style={{ marginTop: '4rem', padding: '0 2rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                        <h2 style={{
                            color: 'white',
                            fontSize: '2rem',
                            fontWeight: 950,
                            textTransform: 'uppercase',
                            letterSpacing: '-0.02em',
                            margin: 0,
                        }}>
                            Origen de Prospectos
                        </h2>
                        <p style={{ color: '#52525b', fontSize: '0.85rem', fontWeight: 700, marginTop: '0.5rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                            Estado acumulado de gestión por base
                        </p>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '1.5rem',
                    }}>
                        {baseStats.map((base) => {
                            const totalGestionados = base.interesados + base.noInteresados + base.pendientes;
                            const conversionRate = totalGestionados > 0
                                ? Math.round((base.interesados / totalGestionados) * 100)
                                : 0;

                            return (
                                <div key={base.name} style={{
                                    position: 'relative',
                                    background: 'rgba(9,9,11,0.7)',
                                    border: `1px solid ${base.color}30`,
                                    borderRadius: '2rem',
                                    padding: '2rem',
                                    overflow: 'hidden',
                                    backdropFilter: 'blur(10px)',
                                    boxShadow: `0 0 40px ${base.color}10`,
                                }}>
                                    {/* Decoración de fondo */}
                                    <div style={{
                                        position: 'absolute', top: '-30px', right: '-30px',
                                        width: '130px', height: '130px',
                                        background: `radial-gradient(circle, ${base.color}25 0%, transparent 70%)`,
                                        filter: 'blur(15px)',
                                        pointerEvents: 'none',
                                    }} />

                                    {/* Header de la tarjeta */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.8rem' }}>
                                        <div style={{
                                            width: '52px', height: '52px',
                                            background: `${base.color}18`,
                                            border: `1px solid ${base.color}40`,
                                            borderRadius: '1.2rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.6rem',
                                        }}>
                                            {base.emoji}
                                        </div>
                                        <div>
                                            <div style={{ color: 'white', fontWeight: 900, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                                {base.name}
                                            </div>
                                            <div style={{ color: '#52525b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                                {totalGestionados} gestionados
                                            </div>
                                        </div>
                                        {/* Tasa de conversión */}
                                        <div style={{
                                            marginLeft: 'auto',
                                            background: `${base.color}18`,
                                            border: `1px solid ${base.color}35`,
                                            borderRadius: '999px',
                                            padding: '0.3rem 1rem',
                                            fontSize: '0.8rem',
                                            fontWeight: 900,
                                            color: base.color,
                                        }}>
                                            {conversionRate}% conv.
                                        </div>
                                    </div>

                                    {/* Stats grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        {/* INTERESADOS */}
                                        <div style={{
                                            background: 'rgba(16,185,129,0.08)',
                                            border: '1px solid rgba(16,185,129,0.2)',
                                            borderRadius: '1.2rem',
                                            padding: '1.2rem',
                                        }}>
                                            <div style={{ color: '#52525b', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
                                                Interesados
                                            </div>
                                            <div style={{ color: '#34d399', fontSize: '2rem', fontWeight: 950, lineHeight: 1 }}>
                                                {base.interesados}
                                            </div>
                                            <div style={{ color: '#34d399', fontSize: '0.7rem', fontWeight: 700, marginTop: '0.3rem', opacity: 0.7 }}>
                                                → Pipeline
                                            </div>
                                        </div>

                                        {/* LINEAS */}
                                        <div style={{
                                            background: `${base.color}08`,
                                            border: `1px solid ${base.color}20`,
                                            borderRadius: '1.2rem',
                                            padding: '1.2rem',
                                        }}>
                                            <div style={{ color: '#52525b', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
                                                Líneas Potenciales
                                            </div>
                                            <div style={{ color: base.color, fontSize: '2rem', fontWeight: 950, lineHeight: 1 }}>
                                                {base.lineas}
                                            </div>
                                            <div style={{ color: base.color, fontSize: '0.7rem', fontWeight: 700, marginTop: '0.3rem', opacity: 0.7 }}>
                                                de interesados
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        {/* NO INTERESADOS */}
                                        <div style={{
                                            background: 'rgba(239,68,68,0.07)',
                                            border: '1px solid rgba(239,68,68,0.18)',
                                            borderRadius: '1.2rem',
                                            padding: '1.2rem',
                                        }}>
                                            <div style={{ color: '#52525b', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
                                                No Interesados
                                            </div>
                                            <div style={{ color: '#f87171', fontSize: '2rem', fontWeight: 950, lineHeight: 1 }}>
                                                {base.noInteresados}
                                            </div>
                                            <div style={{ color: '#f87171', fontSize: '0.7rem', fontWeight: 700, marginTop: '0.3rem', opacity: 0.7 }}>
                                                descartados
                                            </div>
                                        </div>

                                        {/* EN GESTIÓN */}
                                        <div style={{
                                            background: 'rgba(251,191,36,0.07)',
                                            border: '1px solid rgba(251,191,36,0.18)',
                                            borderRadius: '1.2rem',
                                            padding: '1.2rem',
                                        }}>
                                            <div style={{ color: '#52525b', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
                                                En Gestión
                                            </div>
                                            <div style={{ color: '#fbbf24', fontSize: '2rem', fontWeight: 950, lineHeight: 1 }}>
                                                {base.pendientes}
                                            </div>
                                            <div style={{ color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700, marginTop: '0.3rem', opacity: 0.7 }}>
                                                pendientes
                                            </div>
                                        </div>
                                    </div>

                                    {/* Barra de progreso de conversión */}
                                    <div style={{ marginTop: '1.5rem' }}>
                                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${conversionRate}%`,
                                                background: `linear-gradient(90deg, ${base.color}80, ${base.color})`,
                                                borderRadius: '999px',
                                                transition: 'width 1s ease',
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div style={{ marginTop: '4rem', padding: '0 2rem' }}>
                <h2 style={{
                    color: 'white',
                    fontSize: '2rem',
                    fontWeight: 800,
                    textAlign: 'center',
                    marginBottom: '2rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                }}>
                    Ranking de Ejecutivos
                </h2>
                <ExecutiveRanking
                    data={rankingData}
                    showTable={false}
                    onSelect={(name) => setSelectedExecutive(name)}
                />
            </div>

            <ExecutivePerformanceChart
                data={rankingData}
                onShowDetail={() => setShowModal(true)}
            />

            <PerformanceDetailsModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                data={rankingData}
            />

            {isAllowedSupervisorRanking && supRankingData && (
                <div style={{ marginTop: '8rem', padding: '3rem 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <h2 style={{
                        color: '#10b981',
                        fontSize: '2rem',
                        fontWeight: 800,
                        textAlign: 'center',
                        marginBottom: '3rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                    }}>
                        Resumen por Supervisores
                    </h2>
                    <SupervisorRanking
                        data={supRankingData}
                        onSelect={handleSelectSupervisor}
                        currentUserName={userName}
                        isSpecial={role === 'SPECIAL'}
                    />
                </div>
            )}

            {/* Drill-down Modals */}
            <TeamDetailsModal
                isOpen={!!selectedSupervisor}
                onClose={() => setSelectedSupervisor(null)}
                supervisorName={selectedSupervisor || ''}
                executiveData={rankingData}
                onSelectExecutive={(name) => {
                    setSelectedExecutive(name);
                }}
            />

            <SalesRecordsModal
                isOpen={!!selectedExecutive}
                onClose={() => setSelectedExecutive(null)}
                executiveName={selectedExecutive || ''}
                salesData={rawVentas}
            />

            {/* NEW: Cuentas Ingresadas Section */}
            <div style={{ marginTop: '8rem', padding: '0 2rem 5rem 2rem' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '3rem'
                }}>
                    <button
                        onClick={() => setShowAccountsTable(!showAccountsTable)}
                        style={{
                            background: showAccountsTable ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                            border: `2px solid ${showAccountsTable ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                            color: showAccountsTable ? '#10b981' : 'white',
                            padding: '1.2rem 3rem',
                            borderRadius: '3rem',
                            fontSize: '1.2rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.5rem',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: showAccountsTable ? '0 0 30px rgba(16, 185, 129, 0.2)' : 'none',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em'
                        }}
                    >
                        <span>{showAccountsTable ? 'Ocultar Detalle de Cuentas' : 'Ver Detalle de Cuentas Ingresadas'}</span>
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                                transform: showAccountsTable ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.4s ease'
                            }}
                        >
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>

                {showAccountsTable && (
                    <div className="animate-in fade-in slide-in-from-bottom-10 duration-500" style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '2.5rem',
                        overflow: 'hidden',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <div style={{
                            padding: '2rem 3rem',
                            background: 'rgba(16, 185, 129, 0.05)',
                            borderBottom: '1px solid rgba(16, 185, 129, 0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{
                                color: 'white',
                                margin: 0,
                                fontSize: '1.8rem',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Listado Detallado - {monthLabel} {selectedYear}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{
                                    color: '#10b981',
                                    fontWeight: 800,
                                    fontSize: '1rem',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: '2rem',
                                    border: '1px solid rgba(16, 185, 129, 0.2)'
                                }}>
                                    {rawVentas.length} Registros
                                </span>
                                <button
                                    onClick={handleDownloadActivadas}
                                    style={{
                                        background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                                        border: 'none',
                                        borderRadius: '2rem',
                                        color: '#fff',
                                        padding: '0.5rem 1.5rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 900,
                                        cursor: 'pointer',
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                        boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    ⬇ Activadas RUC 20
                                </button>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.6, fontWeight: 900 }}>Fecha</th>
                                        <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.6, fontWeight: 900 }}>RUC</th>
                                        <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.6, fontWeight: 900 }}>Razón Social</th>
                                        <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.6, fontWeight: 900 }}>Ejecutivo</th>
                                        <th style={{ padding: '1.5rem', textAlign: 'left', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.6, fontWeight: 900 }}>Estado</th>
                                        <th style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.6, fontWeight: 900 }}>Líneas</th>
                                        <th style={{ padding: '1.5rem', textAlign: 'right', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.6, fontWeight: 900 }}>Cargo Fijo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rawVentas.length > 0 ? [...rawVentas].reverse().map((r, i) => (
                                        <tr key={i} style={{
                                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                                            transition: 'all 0.2s ease',
                                        }} className="record-row-hoverable">
                                            <td style={{ padding: '1.5rem', fontSize: '0.9rem', opacity: 0.7 }}>{r.fecha || r.fechaInicio}</td>
                                            <td style={{ padding: '1.5rem', fontSize: '0.9rem', fontFamily: 'monospace', color: '#10b981' }}>{r.ruc}</td>
                                            <td style={{ padding: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>{r.razonSocial}</td>
                                            <td style={{ padding: '1.5rem', fontSize: '0.9rem', fontWeight: 500, opacity: 0.8 }}>{r.ejecutivo}</td>
                                            <td style={{ padding: '1.5rem' }}>
                                                <div style={{
                                                    background: `${getStatusColor(r.estado)}15`,
                                                    color: getStatusColor(r.estado),
                                                    padding: '0.5rem 1.2rem',
                                                    borderRadius: '2rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 900,
                                                    display: 'inline-block',
                                                    border: `1px solid ${getStatusColor(r.estado)}33`,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em'
                                                }}>
                                                    {r.estado}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem', textAlign: 'center', fontWeight: 900, fontSize: '1.1rem' }}>{r.lineas}</td>
                                            <td style={{ padding: '1.5rem', textAlign: 'right', color: '#10b981', fontWeight: 800 }}>S/ {Number(r.cargoFijo || 0).toFixed(2)}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '6rem', textAlign: 'center' }}>
                                                <div style={{ opacity: 0.4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                                                    <span style={{ fontSize: '3rem' }}>📁</span>
                                                    <p style={{ fontSize: '1.3rem', fontWeight: 700 }}>No hay registros para el periodo seleccionado.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .record-row-hoverable:hover {
                    background: rgba(16, 185, 129, 0.05);
                    transform: translateX(5px);
                }
            `}</style>
        </div>
    );
}