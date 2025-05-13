// components/layouts/HospitalSidebar.tsx
"use client";

import Link from "next/link";
import Image from "next/image"; // Importe o componente Image
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutUser } from "@/lib/auth-service";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, ClipboardList, BriefcaseMedical, FileText, Settings, LogOut, Building, Loader2, Hourglass, CheckCircle, History as HistoryIcon // Ícones para novos links
} from "lucide-react";
import { useState } from "react";

// --- NOVOS ITENS DE MENU ---
// Estes links apontam para as PÁGINAS QUE VOCÊ PRECISA CRIAR
const sidebarNavItems = [
  { title: "Visão Geral", href: "/hospital/dashboard", icon: LayoutDashboard }, // KPIs e Gráficos
  { title: "Vagas Abertas", href: "/hospital/vagas-abertas", icon: ClipboardList },
  { title: "Vagas Pendentes", href: "/hospital/vagas-pendentes", icon: Hourglass },
  { title: "Plantões Confirmados", href: "/hospital/plantoes-confirmados", icon: CheckCircle },
  { title: "Histórico", href: "/hospital/historico", icon: HistoryIcon },
  // Adicione outros links conforme cria as páginas:
  // { title: "Médicos", href: "/hospital/medicos", icon: BriefcaseMedical },
  // { title: "Contratos", href: "/hospital/contratos", icon: FileText },
  // { title: "Configurações", href: "/hospital/settings", icon: Settings },
];

export function HospitalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutUser();
      toast({ title: "Logout realizado com sucesso.", variant: "default"});
      router.push('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      toast({ title: "Erro ao sair", description: "Não foi possível fazer logout.", variant: "destructive" });
      setIsLoggingOut(false);
    }
  };

  return (
    // Sidebar fica oculta em telas pequenas (lg:block)
    <div className="hidden border-r bg-gray-100/40 lg:block dark:bg-gray-800/40">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-[60px] items-center border-b px-6">
          {/* --- LOGO FHT --- */}
          <Link href="/hospital/dashboard" className="flex items-center gap-2 font-semibold text-gray-800 hover:text-blue-700">
             {/* **IMPORTANTE:** Coloque seu logo em 'public/images/logo-fht.svg' ou ajuste o 'src' */}
             <Image
                src="/images/logo-fht.svg" // <<-- VERIFIQUE/AJUSTE ESTE CAMINHO!
                alt="FHT Logo"
                width={30}
                height={30}
                priority // Boa prática para logos no topo
                className="h-7 w-auto" // Mantém proporção
             />
            <span className="text-lg">Portal FHT</span>
          </Link>
          {/* --- FIM LOGO --- */}
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-4 text-sm font-medium">
            {sidebarNavItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-600 transition-all hover:bg-blue-100/50 hover:text-blue-700 dark:text-gray-400 dark:hover:text-gray-50", // Cor base e hover ajustados
                    isActive && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold" // Estilo ativo
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto p-4 border-t">
          <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-100/50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20" onClick={handleLogout} disabled={isLoggingOut} >
            {isLoggingOut ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <LogOut className="mr-2 h-4 w-4" /> )}
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}