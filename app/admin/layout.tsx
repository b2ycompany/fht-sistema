// app/admin/layout.tsx
"use client";

import React, { useEffect, useState, type ReactNode, type FC, type SVGProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// --- ÍCONE ADICIONADO ---
import { ShieldCheck, Users, LogOut, Menu, X as IconX, Settings, LayoutDashboard, Loader2, FileText, DollarSign, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { logoutUser, getCurrentUserData, type UserProfile, type AdminProfile } from "@/lib/auth-service";
import Image from "next/image";
import Logo from "@/public/logo-fht.svg";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator"; // Para a separação visual

const useIsMobileHook = (breakpoint = 768) => {
  const [isMobileView, setIsMobileView] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkScreenSize = () => setIsMobileView(window.innerWidth < breakpoint);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [breakpoint]);
  return isMobileView;
};

type LucideIconComponent = FC<SVGProps<SVGSVGElement> & { className?: string; size?: number }>;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useIsMobileHook(768);
  const { user: authUser, loading: authLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | AdminProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!authUser) {
        router.push("/login");
        setProfileLoading(false);
      } else {
        setProfileLoading(true);
        getCurrentUserData()
          .then(profile => {
            // Adaptado para usar userType, mas mantendo a lógica de role para retrocompatibilidade
            const userRole = (profile as any)?.userType || (profile as any)?.role;
            if (profile && (userRole === 'admin' || userRole === 'backoffice')) {
              setUserProfile(profile as AdminProfile);
              setAccessDenied(false);
            } else {
              setAccessDenied(true); setUserProfile(null);
              toast({ title: "Acesso Negado", description: "Área restrita.", variant: "destructive" });
              router.push("/");
            }
          })
          .catch(() => { setAccessDenied(true); toast({ title: "Erro de Acesso", variant: "destructive" }); router.push("/"); })
          .finally(() => setProfileLoading(false));
      }
    }
  }, [authUser, authLoading, router, toast]);

  const handleLogout = async () => { try { await logoutUser(); toast({ title: "Logout!" }); router.push('/login'); } catch (e:any) { toast({ title: "Erro Logout", description: e.message, variant: "destructive" });}};
  
  const mainNavItems: Array<{ href: string; label: string; icon: React.ReactElement }> = [
    { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: "/admin/matches", label: "Painel de Revisão", icon: <ShieldCheck className="h-5 w-5" /> },
    { href: "/admin/contracts", label: "Contratos", icon: <FileText className="h-5 w-5" /> },
    { href: "/admin/users", label: "Utilizadores", icon: <Users className="h-5 w-5" /> },
    { href: "/admin/billing", label: "Faturamento", icon: <DollarSign className="h-5 w-5" /> },
  ];
  
  // --- NOVA LISTA DE ITENS DE MENU PARA PROJETOS ---
  const projectNavItems: Array<{ href: string; label: string; icon: React.ReactElement }> = [
    { href: "/admin/caravanas", label: "Gestão Multirão", icon: <Truck className="h-5 w-5" /> }
  ];


  if (authLoading || profileLoading) { return ( <div className="flex min-h-screen items-center justify-center bg-gray-100"> <Loader2 className="h-12 w-12 animate-spin text-blue-600" /> <p className="ml-3">Verificando acesso...</p></div> ); }
  if (accessDenied || !userProfile) { return null; }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <button className="md:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-full shadow-lg text-slate-700 hover:bg-slate-100" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? <IconX size={20}/> : <Menu size={20}/>}</button>
      <aside className={cn("bg-slate-800 text-slate-100 fixed inset-y-0 left-0 z-40 w-60 lg:w-64 transition-transform duration-300 ease-in-out md:static md:translate-x-0", isMobile && !isMobileMenuOpen ? "-translate-x-full" : "translate-x-0" )}>
        <div className="p-5 border-b border-slate-700 flex justify-center"><Link href="/admin/dashboard" onClick={() => isMobile && setIsMobileMenuOpen(false)}><Image src={Logo} alt="FHT Admin Panel" width={130} priority /></Link></div>
        <div className="p-3 mt-2 text-center text-sm"><p>Bem-vindo(a),</p><p className="font-semibold">{userProfile.displayName}</p></div>
        
        {/* --- ESTRUTURA DE NAVEGAÇÃO ATUALIZADA --- */}
        <nav className="px-3 py-4 flex-1">
          {/* Seção Principal */}
          <ul className="space-y-1.5">
            {mainNavItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={cn( "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all", pathname === item.href ? "bg-blue-600 text-white" : "hover:bg-slate-700 hover:text-blue-300" )} onClick={() => isMobile && setIsMobileMenuOpen(false)}>
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Seção de Projetos Sociais */}
          <div className="my-6">
            <Separator className="bg-slate-600" />
            <h4 className="px-3 pt-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Projetos Sociais</h4>
          </div>

          <ul className="space-y-1.5">
            {projectNavItems.map((item) => (
               <li key={item.href}>
                <Link href={item.href} className={cn( "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all", pathname.startsWith(item.href) ? "bg-blue-600 text-white" : "hover:bg-slate-700 hover:text-blue-300" )} onClick={() => isMobile && setIsMobileMenuOpen(false)}>
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-3 border-t border-slate-700"><Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-slate-300 hover:bg-slate-700 hover:text-white"><LogOut className="mr-2 h-4 w-4" /> Sair</Button></div>
      </aside>
      {isMobile && isMobileMenuOpen && (<div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} /> )}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">{children}</main>
    </div>
  );
}