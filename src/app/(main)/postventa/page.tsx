import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPostVentaData } from "@/app/actions/postventa";
import { getPostVentaRuc10Data } from "@/app/actions/postventa-ruc10";
import { getPostVentaHistorial, getAllPostVentaHistorial } from "@/app/actions/postventa-actions";
import PostVentaTabs from "@/components/PostVentaTabs";

function isPostVentaAuthorized(role: string, cargo: string): boolean {
    if (role === 'ADMIN') return true;
    if (role === 'ANDREA') return true;
    if (role === 'JEFE_BO') return true;
    return (cargo || '').trim().toUpperCase().includes('POSTVENTA');
}

// Only ANDREA and ADMIN can manage/see the RUC10 tab
function canAccessRuc10(role: string): boolean {
    return role === 'ANDREA' || role === 'ADMIN' || role === 'JEFE_BO';
}

function getDateRangeLabel(): string {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const oldest = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const fmtOpts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    const prevLabel = prev.toLocaleString('es-PE', fmtOpts).toUpperCase();
    const oldestLabel = oldest.toLocaleString('es-PE', fmtOpts).toUpperCase();
    return `${oldestLabel} — ${prevLabel}`;
}

export default async function PostVentaPage() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) redirect('/login');

    const user = session.user as any;
    const role = (user.role || 'STANDAR') as string;
    const cargo = (user.cargo || '') as string;
    const userName = (user.name || user.email || '') as string;

    if (!isPostVentaAuthorized(role, cargo)) {
        return (
            <div style={{
                minHeight: '60vh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'white', textAlign: 'center', gap: '1rem'
            }}>
                <div style={{ fontSize: '4rem' }}>🔒</div>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>Acceso Restringido</h1>
                <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '420px', margin: 0 }}>
                    Este módulo es exclusivo para el equipo de{' '}
                    <strong style={{ color: '#f59e0b' }}>Post Venta</strong>.
                </p>
            </div>
        );
    }

    const rangeLabel = getDateRangeLabel();
    const isJefeBO = role === 'JEFE_BO';
    const showRuc10Tab = canAccessRuc10(role);

    // ── JEFE_BO: solo ve historial de todos ────────────────────────────────
    if (isJefeBO) {
        const allHistResult = await getAllPostVentaHistorial();
        const allHistorial = allHistResult.data ?? [];

        return (
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-300">
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
                        display: 'inline-block',
                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                        color: '#34d399', fontSize: '0.7rem', fontWeight: 900,
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                        padding: '5px 14px', borderRadius: '999px', marginBottom: '1rem'
                    }}>
                        📋 Post Venta — Supervisión
                    </div>
                    <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 950, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                        Registros de Gestión
                    </h1>
                    <p style={{ color: '#475569', fontSize: '0.9rem', margin: 0 }}>
                        {allHistorial.length} observaciones · {rangeLabel}
                    </p>
                </div>
                <PostVentaTabs
                    cuentasRuc20={[]}
                    cuentasRuc10={[]}
                    usuario={userName}
                    rangeLabel={rangeLabel}
                    userRole={role}
                    allHistorial={allHistorial}
                    showRuc10Tab={showRuc10Tab}
                />
            </div>
        );
    }

    // ── Usuarios regulares: gestión + historial ────────────────────────────
    // Fetch RUC20 always; fetch RUC10 only if user can access it
    const fetches: [
        Promise<{ success: boolean; data?: any[]; error?: string }>,
        Promise<{ success: boolean; data?: any[]; error?: string }>,
        Promise<{ success: boolean; data?: any[]; error?: string }>,
    ] = [
        getPostVentaData(),
        showRuc10Tab ? getPostVentaRuc10Data() : Promise.resolve({ success: true, data: [] }),
        getPostVentaHistorial(userName),
    ];

    const [ruc20Result, ruc10Result, histResult] = await Promise.all(fetches);

    const ruc20Data = ruc20Result.success ? (ruc20Result.data ?? []) : [];
    const ruc10Data = ruc10Result.success ? (ruc10Result.data ?? []) : [];
    const histList = histResult.data ?? [];

    // Compute initialGuardadas for both RUC types from historial
    // histList is reversed (newest first) — first occurrence per RUC = latest
    const latestEstadoByRuc = new Map<string, string>();
    for (const h of histList) {
        if (!latestEstadoByRuc.has(h.ruc)) latestEstadoByRuc.set(h.ruc, h.estado || '');
    }

    const isDone = (ruc: string) => {
        const est = latestEstadoByRuc.get(ruc) || '';
        return est === 'SATISFECHO' || est === 'ESCALADO';
    };

    const initialGuardadasRuc20 = ruc20Data.filter(c => isDone(c.ruc)).map(c => c.ruc);
    const initialGuardadasRuc10 = ruc10Data.filter(c => isDone(c.ruc)).map(c => c.ruc);

    const totalCuentas = ruc20Data.length + ruc10Data.length;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div style={{
                    display: 'inline-block',
                    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                    color: '#34d399', fontSize: '0.7rem', fontWeight: 900,
                    letterSpacing: '0.15em', textTransform: 'uppercase',
                    padding: '5px 14px', borderRadius: '999px', marginBottom: '1rem'
                }}>
                    📋 Post Venta
                </div>
                <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 950, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                    Gestión de Cuentas Activadas
                </h1>
                <p style={{ color: '#475569', fontSize: '0.9rem', margin: 0 }}>
                    {rangeLabel} · {totalCuentas} cuentas
                    {showRuc10Tab && ruc10Data.length > 0 && (
                        <span style={{ color: '#818cf8', marginLeft: '0.5rem' }}>
                            ({ruc20Data.length} RUC20 · {ruc10Data.length} RUC10)
                        </span>
                    )}
                </p>
            </div>

            {(!ruc20Result.success || !ruc10Result.success) && (
                <div style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '0.75rem', padding: '1rem 1.5rem',
                    color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1.5rem'
                }}>
                    ⚠️ {ruc20Result.error ?? ruc10Result.error ?? 'Error al cargar algunos datos.'}
                </div>
            )}

            <PostVentaTabs
                cuentasRuc20={ruc20Data}
                cuentasRuc10={ruc10Data}
                usuario={userName}
                rangeLabel={rangeLabel}
                userRole={role}
                initialGuardadasRuc20={initialGuardadasRuc20}
                initialGuardadasRuc10={initialGuardadasRuc10}
                showRuc10Tab={showRuc10Tab}
            />
        </div>
    );
}
