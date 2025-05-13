// app/hospital/dashboard/page.tsx
"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react"; // Removido useMemo, ChangeEvent não usados aqui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
// --- Importando Utilitários e Componentes ---
import { cn, formatCurrency, formatPercentage, formatHours } from "@/lib/utils";
// --- Importando Funções de Serviço (NECESSITA IMPLEMENTAÇÃO) ---
import {
    // Exemplo: getHospitalDashboardData // <<-- VOCÊ PRECISA CRIAR ESTA FUNÇÃO!
    // Tipos relacionados (Defina no serviço ou importe)
    type HospitalKPIs,
    type MonthlyCostData,
    type SpecialtyDemandData,
    type DashboardData
} from "@/lib/hospital-shift-service"; // Ou um novo serviço: lib/hospital-dashboard-service

// --- Import Componentes Auxiliares e Gráficos ---
// Assumindo que KPICard está definido neste arquivo, mas outros estão separados
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/state-indicators"; // Ajuste o caminho
import { SimpleLineChart } from "@/components/charts/SimpleLineChart"; // << IMPORTADO
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";   // << IMPORTADO

// --- Import Icons ---
import { Loader2, AlertCircle, Users, DollarSign, TrendingUp, WalletCards, Target, Clock, Hourglass } from "lucide-react";


// --- Tipos Específicos do Dashboard (Definidos aqui se não importados) ---
// interface HospitalKPIs { openShiftsCount: number | null; pendingActionCount?: number | null; totalDoctorsOnPlatform?: number | null; costLast30Days?: number | null; fillRateLast30Days?: number | null; avgTimeToFillHours?: number | null; topSpecialtyDemand?: string | null; }
// interface MonthlyCostData { name: string; valor: number; }
// interface SpecialtyDemandData { name: string; valor: number; }
// interface DashboardData { kpis: HospitalKPIs | null; monthlyCosts: MonthlyCostData[]; specialtyDemand: SpecialtyDemandData[]; }


// --- Componente Principal ---
export default function HospitalDashboardPage() {
    const { toast } = useToast();
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // --- Função para buscar TODOS os dados do dashboard ---
    const fetchDashboardData = useCallback(async (currentOpenShiftsCount?: number) => {
        setIsLoadingData(true); setFetchError(null);
        try {
            // --- SUBSTITUIR PELA CHAMADA REAL ---
            console.log("Simulando busca de KPIs e Gráficos...");
            await new Promise(res => setTimeout(res, 800));
            const data: DashboardData = {
                kpis: { openShiftsCount: 7, pendingActionCount: 5, totalDoctorsOnPlatform: 152, costLast30Days: 25780.50, fillRateLast30Days: 85.7, avgTimeToFillHours: 4.2, topSpecialtyDemand: 'Clínica Médica' },
                monthlyCosts: [ { name: 'Jan', valor: 18000 }, { name: 'Fev', valor: 21500 }, { name: 'Mar', valor: 25780.50 }, { name: 'Abr', valor: 15300 } ],
                specialtyDemand: [ { name: 'Cl. Médica', valor: 8 }, { name: 'Cardio', valor: 5 }, { name: 'Pediatria', valor: 4 }, { name: 'Orto', valor: 3 }, { name: 'G.O.', valor: 2 }, { name: 'Cirurgia G.', valor: 1 } ]
            };
            // --- FIM SUBSTITUIÇÃO ---
            setDashboardData(data);
        } catch (error: any) { console.error("Error fetching dashboard data:", error); const errorMsg = error.message || "Erro dados painel."; setFetchError(errorMsg); toast({ title: "Erro Dados", description: errorMsg, variant: "destructive" }); }
        finally { setIsLoadingData(false); }
    }, [toast]);

    // Fetch inicial
    useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

    // --- Renderização ---
    return (
        <div className="flex flex-col gap-6 md:gap-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Visão Geral do Hospital</h1>

             {fetchError && !isLoadingData && ( <ErrorState message={fetchError} onRetry={fetchDashboardData} /> )}

            {/* Seção de Indicadores (KPIs) */}
             <section aria-labelledby="kpi-heading">
                <h2 id="kpi-heading" className="text-xl font-semibold mb-4 sr-only">Indicadores Chave</h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                    {/* KPICard definido abaixo */}
                    <KPICard title="Vagas Abertas" value={dashboardData?.kpis?.openShiftsCount ?? '-'} icon={AlertCircle} isLoading={isLoadingData} description="Aguardando médicos" />
                    <KPICard title="Pendentes Ação" value={dashboardData?.kpis?.pendingActionCount ?? '-'} icon={Hourglass} isLoading={isLoadingData} description="Matches/contratos" />
                    <KPICard title="Taxa Preenchim. (30d)" value={formatPercentage(dashboardData?.kpis?.fillRateLast30Days)} icon={Target} isLoading={isLoadingData} description="Eficiência" />
                    <KPICard title="Custo Estimado (30d)" value={formatCurrency(dashboardData?.kpis?.costLast30Days)} icon={WalletCards} isLoading={isLoadingData} description="Gasto com plantões" />
                    <KPICard title="Tempo Médio Preench." value={formatHours(dashboardData?.kpis?.avgTimeToFillHours)} icon={Clock} isLoading={isLoadingData} description="Agilidade (horas)" />
                    <KPICard title="Médicos na Plataforma" value={dashboardData?.kpis?.totalDoctorsOnPlatform ?? '-'} icon={Users} isLoading={isLoadingData} description="Total cadastrados" />
                    <KPICard title="Top Demanda (Espec.)" value={dashboardData?.kpis?.topSpecialtyDemand ?? '-'} icon={TrendingUp} isLoading={isLoadingData} description="Mais requisitada" />
                </div>
             </section>

             {/* Seção de Gráficos */}
             <section aria-labelledby="charts-heading">
                 <h2 id="charts-heading" className="text-xl font-semibold mb-4 mt-4 text-gray-700">Análises Gráficas</h2>
                 {(fetchError && !isLoadingData) && ( <ErrorState message={`Erro ao carregar dados para gráficos: ${fetchError}`} onRetry={fetchDashboardData} /> )}
                 <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                     {/* Gráfico de Custo Mensal */}
                     {(isLoadingData || !dashboardData?.monthlyCosts) ? (
                         <Card><CardContent className="h-[318px] flex items-center justify-center"><LoadingState /></CardContent></Card>
                      ) : (
                        // --- GRÁFICO RESTAURADO ---
                        <SimpleLineChart data={dashboardData.monthlyCosts} title="Custo Mensal Estimado" description="Evolução dos gastos (últimos meses)" dataKey="valor" strokeColor="#16a34a" />
                     )}
                     {/* Gráfico de Demanda por Especialidade */}
                      {(isLoadingData || !dashboardData?.specialtyDemand) ? (
                         <Card><CardContent className="h-[318px] flex items-center justify-center"><LoadingState /></CardContent></Card>
                      ) : (
                         // --- GRÁFICO RESTAURADO ---
                         <SimpleBarChart data={dashboardData.specialtyDemand} title="Demanda por Especialidade (Top)" description="Especialidades mais requisitadas" dataKey="valor" fillColor="#3b82f6" />
                     )}
                 </div>
             </section>

            {/* As Tabs de gerenciamento NÃO estão nesta página */}
        </div>
    );
}

// --- Componente Auxiliar KPICard (Definido aqui, com correção de overflow) ---
interface KPICardProps { title: string; value: string | number; description?: string; icon: React.ElementType; isLoading: boolean; }
const KPICard: React.FC<KPICardProps> = ({ title, value, description, icon: Icon, isLoading }) => {
    return (
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 truncate pr-2">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="pt-0 pb-3 px-3 overflow-hidden">
                {isLoading ? (
                    <div className="h-8 flex items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                 ) : (
                    <div
                        className={cn(
                            "font-bold text-gray-900", // SEM truncate
                            "text-lg md:text-xl lg:text-2xl", // Fonte responsiva
                            "leading-tight"
                        )}
                        title={value?.toString()}
                    >
                        {value}
                    </div>
                 )}
                {description && !isLoading && <p className="text-xs text-muted-foreground pt-1 truncate">{description}</p>}
            </CardContent>
        </Card>
    );
};
// --- FIM dos Componentes Definidos Neste Arquivo ---