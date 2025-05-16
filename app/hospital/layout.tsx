// app/hospital/layout.tsx
"use client";

import React, { useEffect, useState, type ReactNode, type FC, type SVGProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarClock, Users as UsersIconLucide, // Renomeado para evitar conflito
  UserCircle, LogOut, Menu, X as IconX, Settings, Hospital as HospitalIcon, DollarSign as DollarSignIcon,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// import { useMobile } from "@/hooks/use-mobile"; // Se você tem um hook global
import { useAuth } from "@/components/auth-provider";
import { logoutUser, getCurrentUserData, type UserProfile, type HospitalProfile } from "@/lib/auth-service";
import Image from "next/image";
import Logo from "@/public/logo-fht.svg";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Hook useMobile (exemplo simples, se não tiver um global)
const useIsMobileHook = (breakpoint = 768): boolean => {
  const [isMobileView, setIsMobileView] = useState(false); // Default para false SSR
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkScreenSize = () => setIsMobileView(window.innerWidth < breakpoint);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [breakpoint]);
  return isMobileView;
};

type LucideIconType = FC<SVGProps<SVGSVGElement> & { className?: string; size?: number | string }>;

export default function HospitalLayout({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useIsMobileHook(768);
  const { user: authUser, loading: authLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<HospitalProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    console.log("[HospitalLayout] Auth state - AuthLoading:", authLoading, "AuthUser:", authUser ? authUser.uid : null);
    if (!authLoading) {
      if (!authUser) {
        console.log("[HospitalLayout] No authUser found, redirecting to /login");
        router.push("/login?redirectUrl=" + pathname);
        setProfileLoading(false);
      } else {
        console.log("[HospitalLayout] AuthUser found. Fetching user profile from Firestore...");
        setProfileLoading(true);
        getCurrentUserData()
          .then(profile => {
            console.log("[HospitalLayout] Profile fetched:", profile);
            if (profile && profile.role === 'hospital') {
              setUserProfile(profile as HospitalProfile);
              setAccessDenied(false);
              console.log("[HospitalLayout] Profile is for a HOSPITAL. Access GRANTED.");
            } else {
              setAccessDenied(true); setUserProfile(null);
              const deniedRole = profile ? profile.role : "N/A (sem perfil)";
              console.warn("[HospitalLayout] Access DENIED. User role is not 'hospital'. Role:", deniedRole);
              toast({ title: "Acesso Negado", description: "Esta área é restrita a hospitais.", variant: "destructive" });
              router.push(profile?.role === 'doctor' ? "/dashboard" : "/");
            }
          })
          .catch(error => {
            console.error("[HospitalLayout] Error fetching user profile:", error);
            setAccessDenied(true);
            toast({ title: "Erro de Acesso", description: "Não foi possível verificar suas permissões.", variant: "destructive" });
            router.push("/");
          })
          .finally(() => {
            setProfileLoading(false);
            console.log("[HospitalLayout] Finished profile fetching attempt.");
          });
      }
    }
  }, [authUser, authLoading, router, toast, pathname]);

  const handleLogout = async () => { try { await logoutUser(); toast({ title: "Logout!" }); router.push('/login'); } catch (e:any) { toast({ title: "Erro Logout", description: e.message, variant: "destructive" });}};
  
  const navItems: Array<{ href: string; label: string; icon: React.ReactElement }> = [
    { href: "/hospital/dashboard", label: "Painel Hospital", icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: "/hospital/shifts", label: "Plantões", icon: <CalendarClock className="h-5 w-5" /> },
    { href: "/hospital/doctors", label: "Médicos", icon: <UsersIconLucide className="h-5 w-5" /> },
    { href: "/hospital/profile", label: "Perfil Empresa", icon: <HospitalIcon className="h-5 w-5" /> },
  ];

  if (authLoading || profileLoading) {
    return ( <div className="flex min-h-screen items-center justify-center bg-gray-100"> <Loader2 className="h-12 w-12 animate-spin text-blue-600" /> <p className="ml-3">Carregando painel do hospital...</p></div> );
  }
  if (accessDenied || !userProfile) {
    return null;
  }

  console.log("[HospitalLayout] Rendering hospital layout for user:", userProfile.displayName);
  return (
    <div className="flex min-h-screen bg-slate-100">
      <button className="md:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-full shadow-lg text-slate-700 hover:bg-slate-100" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}> {isMobileMenuOpen ? <IconX size={20}/> : <Menu size={20}/>} </button>
      <aside className={cn("bg-slate-800 text-slate-100 fixed inset-y-0 left-0 z-40 w-60 lg:w-64 transition-transform duration-300 ease-in-out md:static md:translate-x-0", isMobile && !isMobileMenuOpen ? "-translate-x-full" : "translate-x-0" )}>
        <div className="p-5 border-b border-slate-700 flex justify-center">
          <Link href="/hospital/dashboard" onClick={() => isMobile && setIsMobileMenuOpen(false)}>
            <Image src={Logo} alt="FHT Hospital Panel" width={130} priority />
          </Link>
        </div>
        <div className="p-3 mt-2 text-center text-sm"> <p className="truncate">Bem-vindo(a),</p> <p className="font-semibold truncate">{userProfile.displayName}</p> </div>
        <nav className="px-3 py-4 flex-1">
          <ul className="space-y-1.5">
            {navItems.map((item) => {
              const IconComponent = item.icon.type as LucideIconType;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn( "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all", pathname === item.href ? "bg-blue-600 text-white" : "hover:bg-slate-700 hover:text-blue-300" )}
                    onClick={() => isMobile && setIsMobileMenuOpen(false)}
                  > 
                    {React.cloneElement(item.icon, { className: cn("h-5 w-5", item.icon.props.className)})}
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-3 border-t border-slate-700"> 
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-slate-300 hover:bg-slate-700 hover:text-white"> 
            <LogOut className="mr-2 h-4 w-4" /> Sair 
          </Button> 
        </div>
      </aside>
      {isMobile && isMobileMenuOpen && (<div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} /> )}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto"> {children} </main>
    </div>
  );
}