// app/hospital/layout.tsx
"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building, LogOut, Menu, ClipboardList, BarChart3, Users, X } from "lucide-react"; // Ícones de exemplo
import { useToast } from "@/hooks/use-toast";
import { useMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/components/auth-provider";
import { logoutUser, getCurrentUserData, type UserProfile } from "@/lib/auth-service"; // Importar getCurrentUserData e UserProfile
import Image from "next/image";
import Logo from "@/public/logo-fht.svg"; // Seu logo
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react"; // Importar Loader2

export default function HospitalLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useMobile();
  const { user: authUser, loading: authLoading } = useAuth(); // Usuário do Firebase Auth
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true); // Loading para o perfil do Firestore

  useEffect(() => {
    console.log("[HospitalLayout] Auth state - AuthLoading:", authLoading, "AuthUser:", authUser ? authUser.uid : null);
    if (!authLoading) {
      if (!authUser) {
        // Se não há usuário autenticado no Firebase, redireciona para login
        console.log("[HospitalLayout] No authUser found, redirecting to /login");
        router.push("/login");
      } else {
        // Se há usuário Firebase, busca o perfil no Firestore para verificar o role
        console.log("[HospitalLayout] AuthUser found. Fetching user profile from Firestore...");
        getCurrentUserData()
          .then(profile => {
            if (profile) {
              console.log("[HospitalLayout] Profile fetched:", profile);
              if (profile.role === 'hospital') {
                setUserProfile(profile);
              } else {
                // Usuário logado, mas não é hospital
                console.warn("[HospitalLayout] User is not a hospital. Role:", profile.role, ". Redirecting to /login (or an 'access-denied' page).");
                toast({ title: "Acesso Negado", description: "Esta área é restrita a hospitais.", variant: "destructive" });
                router.push("/login"); // Ou uma página específica de acesso negado
              }
            } else {
              // Usuário logado no Firebase, mas sem perfil no Firestore (situação de erro)
              console.error("[HospitalLayout] AuthUser exists, but profile not found in Firestore. UID:", authUser.uid);
              toast({ title: "Erro de Perfil", description: "Seu perfil não foi encontrado. Contate o suporte.", variant: "destructive" });
              router.push("/login");
            }
          })
          .catch(error => {
            console.error("[HospitalLayout] Error fetching user profile:", error);
            toast({ title: "Erro ao Carregar Perfil", description: "Não foi possível carregar seus dados de perfil.", variant: "destructive" });
            router.push("/login");
          })
          .finally(() => {
            setProfileLoading(false);
            console.log("[HospitalLayout] Finished profile fetching attempt.");
          });
      }
    }
  }, [authUser, authLoading, router, toast]);

  const handleLogout = async () => {
    console.log("[HospitalLayout] handleLogout called");
    try {
      await logoutUser();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      router.push("/"); // Redireciona para a home page após logout
    } catch (error) {
      console.error("[HospitalLayout] Logout error:", error);
      toast({
        title: "Erro ao sair",
        description: "Ocorreu um erro ao fazer logout. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Itens de navegação específicos para o Hospital (EXEMPLO)
  const navItems = [
    { href: "/hospital/dashboard", label: "Painel Hospital", icon: <BarChart3 className="h-5 w-5" /> },
    { href: "/hospital/shifts", label: "Plantões", icon: <ClipboardList className="h-5 w-5" /> },
    { href: "/hospital/doctors", label: "Médicos", icon: <Users className="h-5 w-5" /> },
    { href: "/hospital/profile", label: "Perfil Empresa", icon: <Building className="h-5 w-5" /> },
  ];

  // Se authLoading (do Firebase) ou profileLoading (do Firestore) estiverem ativos, mostra um loader.
  if (authLoading || profileLoading) {
    console.log("[HospitalLayout] Showing loader - AuthLoading:", authLoading, "ProfileLoading:", profileLoading);
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-blue-600" />
        <p className="ml-3 text-gray-700">Carregando dados do hospital...</p>
      </div>
    );
  }

  // Se após os loadings, não houver perfil de hospital (ou authUser), não renderiza nada.
  // O useEffect já deve ter cuidado do redirecionamento.
  if (!authUser || !userProfile || userProfile.role !== 'hospital') {
    console.log("[HospitalLayout] Conditions not met to render layout - AuthUser:", authUser ? authUser.uid : null, "UserProfile Role:", userProfile ? userProfile.role : null);
    // Retornar null é importante para evitar flash de conteúdo se o redirecionamento estiver ocorrendo.
    return null;
  }

  console.log("[HospitalLayout] Rendering hospital layout for user:", userProfile.displayName);
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
          <Image src={Logo} alt="FHT Soluções Hospitalares" width={150} height={50} className="w-auto h-10" />
        </div>
        <nav className="px-3 py-4 flex-1">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200",
                    pathname === item.href
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
        <div className="p-4 border-t border-blue-100">
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
  );
}