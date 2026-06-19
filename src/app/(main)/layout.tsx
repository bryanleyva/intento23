import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import SessionGuardian from "@/components/SessionGuardian";
import WhatsAppSupport from "@/components/WhatsAppSupport";
import AnnouncementModal from "@/components/AnnouncementModal";
import EvaluationFormModal from "@/components/EvaluationFormModal";

// Roles que ven el Formulario de Evaluación (ejecutivos y vendedores).
// Se excluye a administración / mesa de control.
const EVALUATION_EXCLUDED_ROLES = ['ADMIN', 'BACKOFFICE', 'JEFE_BO'];

export default async function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect('/login');
    }

    const user = session.user as any;
    const showEvaluationForm = !EVALUATION_EXCLUDED_ROLES.includes((user.role || '').toUpperCase());

    return (
        <div className="min-h-screen relative z-10 flex flex-col w-full bg-[#050505]">
            <SessionGuardian />
            <Navbar
                userRole={user.role}
                userName={session.user.name}
                userCargo={user.cargo}
                userPhoto={session.user.image ?? undefined}
                userCampana={user.campana ?? ''}
            />
            <main className="flex-1 w-full flex flex-col items-center" style={{ paddingTop: '94px' }}>
                <div className="container-custom w-full py-8">
                    {children}
                </div>
            </main>
            <WhatsAppSupport />
            <AnnouncementModal />
            {showEvaluationForm && (
                <EvaluationFormModal
                    dni={user.dni ?? user.id ?? ''}
                    usuario={session.user.email ?? ''}
                    nombre={session.user.name ?? ''}
                />
            )}
        </div>
    );
}