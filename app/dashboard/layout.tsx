// app/dashboard/layout.tsx (CORRIGIDO com Gatekeeper de Segurança e Importações)
"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// --- ÍCONES ADICIONADOS ---
import { 
    Calendar, FileText, Home, LogOut, Menu, User, X, BookMarked, ClipboardCheck, HeartPulse, 
    ShieldAlert, FileWarning, BadgeCheck, Loader2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/components/auth-provider";
import { logoutUser, type UserType } from "@/lib/auth-service";
import Image from "next/image";
import Logo from "@/public/logo-fht.svg";
import { cn } from "@/lib/utils";
// --- IMPORTAÇÕES ADICIONADAS ---
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// ============================================================================
// 🔹 NOVO COMPONENTE: Ecrã de Bloqueio 🔹
// ============================================================================
const PendingApprovalScreen = ({ status, profilePagePath }: { status: string, profilePagePath: string }) => {
    const router = useRouter();
    
    let Icon = ShieldAlert;
    let title = "Perfil em Análise";
    let message = "O seu cadastro foi recebido e está a ser analisado pela nossa equipa. Você receberá um email assim que for aprovado.";
    let buttonText = "Ver Meu Perfil";
    let cardClass = "border-yellow-500 bg-yellow-50";
    let textClass = "text-yellow-700";
    let iconClass = "text-yellow-600";
    let buttonAction = () => router.push(profilePagePath);

    if (status === 'REJECTED_NEEDS_RESUBMISSION') {
        Icon = FileWarning;
        title = "Correções Necessárias";
        message = "A nossa equipa revisou o seu perfil e solicitou correções em alguns documentos. Por favor, aceda ao seu perfil para ver os detalhes e reenviar os arquivos.";
        cardClass = "border-red-500 bg-red-50";
        textClass = "text-red-700";
        iconClass = "text-red-600";
        buttonText = "Corrigir Meu Perfil";
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
            <Card className={cn("w-full max-w-lg text-center shadow-lg", cardClass)}>
                <CardHeader>
                    <Icon className={cn("mx-auto h-16 w-16", iconClass)} />
                    <CardTitle className={cn("text-2xl pt-4", textClass)}>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-700">{message}</p>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={buttonAction} className="w-full sm:w-auto">
                        {buttonText}
                    </Button>
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => logoutUser().then(() => router.push('/login'))}>
                        Sair
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useMobile(768); 
  // <<< CORREÇÃO: Puxa o 'documentVerificationStatus' do contexto >>>
  const { user, userProfile, loading, documentVerificationStatus } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      router.push("/");
    } catch (error) {
      toast({
        title: "Erro ao sair",
        description: "Ocorreu um erro ao fazer logout. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getNavItemsForRole = (role: UserType | undefined) => {
    const doctorNavItems = [
        { href: "/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" /> },
        { href: "/dashboard/agenda", label: "Minha Agenda", icon: <BookMarked className="h-5 w-5" /> },
        { href: "/dashboard/availability", label: "Disponibilidade", icon: <Calendar className="h-5 w-5" /> },
        { href: "/dashboard/contracts", label: "Meus Contratos", icon: <FileText className="h-5 w-5" /> },
        { href: "/dashboard/profile", label: "Meu Perfil", icon: <User className="h-5 w-5" /> },
    ];

    const receptionistNavItems = [
        { href: "/dashboard/reception", label: "Recepção / Check-in", icon: <ClipboardCheck className="h-5 w-5" /> },
        { href: "/dashboard/agendamento", label: "Agendamento", icon: <Calendar className="h-5 w-5" /> },
    ];

    const triageNurseNavItems = [
        { href: "/dashboard/triage", label: "Painel de Triagem", icon: <HeartPulse className="h-5 w-5" /> },
    ];
    
    // ============================================================================
    // 🔹 CORREÇÃO DE FLUXO 🔹
    // O Hospital também usa este layout, mas não estava na sua lista!
    // ============================================================================
    const hospitalNavItems = [
        { href: "/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" /> },
        // Adicione aqui outros links do hospital
        { href: "/dashboard/profile", label: "Meu Perfil", icon: <User className="h-5 w-5" /> },
    ];


    switch (role) {
        case 'doctor':
            return doctorNavItems;
        case 'hospital': // <<< ADICIONADO
            return hospitalNavItems;
        case 'receptionist':
        case 'caravan_admin':
            return receptionistNavItems;
        case 'triage_nurse':
            return triageNurseNavItems;
        case 'admin':
            // Filtra o menu de admin para não incluir itens de médico/hospital se não for relevante
             const allItems = [...receptionistNavItems, ...triageNurseNavItems, ...doctorNavItems];
             const uniqueItems = allItems.filter((item, index, self) =>
                 index === self.findIndex((t) => t.href === item.href)
             );
             return uniqueItems; // Admin vê tudo (ou um menu admin dedicado)
        default:
            return [];
    }
  };

  const navItems = getNavItemsForRole(userProfile?.userType);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  // ============================================================================
  // 🔹 CORREÇÃO DE SEGURANÇA (GATEKEEPER) 🔹
  // Verifica o status de aprovação ANTES de renderizar o dashboard.
  // ============================================================================
  
  // A página de perfil é a ÚNICA exceção. O utilizador DEVE poder aceder
  // a /dashboard/profile para ver as correções.
  const isAccessingProfile = pathname.startsWith('/dashboard/profile');
  const userRole = userProfile?.userType;

  // Se o utilizador não for admin/staff (que não precisam de aprovação)
  if (userRole === 'doctor' || userRole === 'hospital') {
      // E se o status NÃO for "Aprovado"
      if (documentVerificationStatus && documentVerificationStatus !== 'APPROVED') {
          // E se ele NÃO estiver a tentar aceder à sua página de perfil
          if (!isAccessingProfile) {
              // Bloqueia o acesso e mostra a tela de pendência.
              return <PendingApprovalScreen status={documentVerificationStatus} profilePagePath="/dashboard/profile" />;
          }
          // Se ele ESTIVER a aceder ao perfil, permitimos (o 'return' abaixo executa)
      }
  }
  // ============================================================================
  // Fim da Correção de Segurança
  // ============================================================================
  
  return (
    <div className="flex min-h-screen bg-gray-50">
      <button
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-full shadow-md text-blue-600 hover:bg-blue-50 transition-colors"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
      >
        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      <aside
        className={cn(
          "bg-gradient-to-b from-white to-blue-50 border-r border-blue-100 shadow-lg",
          "fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-300 ease-in-out",
          isMobile && !isMobileMenuOpen ? "-translate-x-full" : "translate-x-0",
          "md:static md:translate-x-0 md:shadow-md"
        )}
      >
        <div className="p-6 border-b border-blue-100">
          {/* <<< CORREÇÃO: Link do Logo para a Home >>> */}
          <Link href="/">
            <Image src={Logo} alt="FHT Soluções Hospitalares" width={150} height={50} className="w-auto h-10" />
          </Link>
        </div>

        <nav className="px-3 py-4 flex-1">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200",
                    pathname.startsWith(item.href)
                      ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                      : "text-gray-700 hover:bg-blue-100 hover:text-blue-600"
                  )}
                  onClick={() => isMobile && setIsMobileMenuOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-blue-100 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}