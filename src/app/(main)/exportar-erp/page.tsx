import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ErpExportPanel from "@/components/ErpExportPanel";
import UsuariosIdsPanel from "@/components/UsuariosIdsPanel";

export default async function ExportarErpPage() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) redirect('/login');

    const role = ((session.user as any).role || 'STANDAR') as string;
    if (role !== 'ADMIN') {
        return (
            <div style={{
                minHeight: '60vh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'white', textAlign: 'center', gap: '1rem',
            }}>
                <div style={{ fontSize: '4rem' }}>🔒</div>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>Acceso Restringido</h1>
                <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '420px', margin: 0 }}>
                    Este módulo es exclusivo para administradores.
                </p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-5 duration-300" style={{ padding: '1rem 1rem 4rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{
                    display: 'inline-block',
                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                    color: '#a5b4fc', fontSize: '0.7rem', fontWeight: 900,
                    letterSpacing: '0.15em', textTransform: 'uppercase',
                    padding: '5px 14px', borderRadius: '999px', marginBottom: '1rem',
                }}>
                    📤 Migración a erpviernes
                </div>
                <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 950, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                    Exportar Ventas (Cierre)
                </h1>
                <p style={{ color: '#475569', fontSize: '0.9rem', margin: 0, maxWidth: '640px', marginInline: 'auto' }}>
                    Filtra por mes y obtén todas las ventas en estado <strong style={{ color: '#94a3b8' }}>ACTIVADO</strong> con el
                    formato de la plantilla erpviernes. Lo que falte queda en blanco. Puedes descargarlo en XLSX.
                </p>
            </div>

            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <ErpExportPanel />

                <div style={{ margin: '2.5rem 0 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                    <span style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        Padrón de usuarios
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                </div>

                <UsuariosIdsPanel />
            </div>
        </div>
    );
}
