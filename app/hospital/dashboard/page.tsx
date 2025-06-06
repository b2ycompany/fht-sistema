// app/hospital/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency, formatPercentage, formatHours } from "@/lib/utils";

import {
    type HospitalKPIs,
    type MonthlyCostData,
    type SpecialtyDemandData,
    type DashboardData
} from "@/lib/hospital-shift-service";

import { LoadingState, ErrorState } from "@/components/ui/state-indicators";
import { SimpleLineChart } from "@/components/charts/SimpleLineChart";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";

import { Loader2, AlertCircle, Users, DollarSign, TrendingUp, WalletCards, Target, Clock, Hourglass } from "lucide-react";

import { useAuth } from '@/components/auth-provider';
import { getCurrentUserData, type HospitalProfile } from '@/lib/auth-service'; // Importar HospitalProfile
import ProfileStatusAlert, { type ProfileStatus } from '@/components/ui/ProfileStatusAlert'; // Ajuste o caminho se necessário
import Link from "next/link";

export default function HospitalDashboardPage() {
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();

    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchHospitalSpecificDashboardData = useCallback(async () => {
        console.log("Simulando busca de KPIs e Gráficos para o hospital...");
        await new Promise(res => setTimeout(res, 700));
        const data: DashboardData = {
            kpis: { openShiftsCount: 12, pendingActionCount: 3, totalDoctorsOnPlatform: 152, costLast30Days: 32150.00, fillRateLast30Days: 78.2, avgTimeToFillHours: 6.5, topSpecialtyDemand: 'Pediatria' },
            monthlyCosts: [ { name: 'Jan', valor: 22000 }, { name: 'Fev', valor: 28500 }, { name: 'Mar', valor: 32150.00 }, { name: 'Abr', valor: 24000 } ],
            specialtyDemand: [ { name: 'Pediatria', valor: 10 }, { name: 'Cl. Médica', valor: 7 }, { name: 'G.O.', valor: 5 }, { name: 'Anestesia', valor: 4 } ]
        };
        return data;
    }, []);

    const loadInitialData = useCallback(async () => {
        if (!user) {
            setIsLoadingData(false);
            return;
        }
        setIsLoadingData(true);
        setFetchError(null);
        try {
            const [profile, specificData] = await Promise.all([
                getCurrentUserData(),
                fetchHospitalSpecificDashboardData()
            ]);

            if (profile && profile.role === 'hospital') {
                setHospitalProfile(profile as HospitalProfile);
            } else if (profile) {
                console.warn("[HospitalDashboardPage] Perfil logado não é de hospital:", profile.role);
                setFetchError("Tipo de perfil inválido para este dashboard.");
                // Em um cenário real, poderia redirecionar ou mostrar uma mensagem de acesso negado mais proeminente.
            } else {
                setFetchError("Não foi possível carregar os dados do perfil do hospital.");
            }
            setDashboardData(specificData);

        } catch (error: any) {
            console.error("Error fetching hospital dashboard page data:", error);
            const errorMsg = error.message || "Erro ao carregar dados do painel do hospital.";
            setFetchError(errorMsg);
            toast({ title: "Erro nos Dados", description: errorMsg, variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    }, [user, toast, fetchHospitalSpecificDashboardData]);

    useEffect(() => {
        if (!authLoading && user) {
            loadInitialData();
        } else if (!authLoading && !user) {
            setIsLoadingData(false);
        }
    }, [user, authLoading, loadInitialData]);

    if (authLoading || isLoadingData) {
        return <div className="p-6"><LoadingState message="Carregando dashboard do hospital..." /></div>;
    }

    if (fetchError && !isLoadingData) { // Mostra erro se fetchError existe e o loading principal da página terminou
        return <div className="p-6"><ErrorState message={fetchError} onRetry={loadInitialData} /></div>;
    }
    
    if (!user && !authLoading && !isLoadingData) { // Se não há usuário e os loadings terminaram
         return (
            <div className="container mx-auto p-4 sm:p-6 space-y-6 text-center">
                <p>Você não está logado ou não tem permissão para ver esta página.</p>
            </div>
        );
    }
    
    const hospitalEditProfileLink = "/hospital/profile/edit"; // Confirme ou ajuste este caminho

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">
                Visão Geral do Hospital: {hospitalProfile?.displayName || user?.displayName || "Hospital"}
            </h1>

            {hospitalProfile && (
                <ProfileStatusAlert
                    status={hospitalProfile.registrationStatus as ProfileStatus | undefined}
                    adminNotes={hospitalProfile.adminVerificationNotes}
                    userType="hospital"
                    editProfileLink={hospitalEditProfileLink}
                />
            )}

            {/* Se fetchError ocorreu mas hospitalProfile carregou, o alerta de erro individual já apareceu.
                Se o dashboardData (KPIs, gráficos) especificamente falhou, o ErrorState dentro das seções cuidará disso.
                Não precisamos de um ErrorState geral aqui se o perfil carregou mas os dados do dashboard não.
            */}

             <section aria-labelledby="kpi-heading">
                 <h2 id="kpi-heading" className="text-xl font-semibold mb-4 sr-only">Indicadores Chave</h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                    <KPICard title="Vagas Abertas" value={dashboardData?.kpis?.openShiftsCount ?? '-'} icon={AlertCircle} isLoading={isLoadingData && !dashboardData} description="Aguardando médicos" />
                    <KPICard title="Pendentes Ação" value={dashboardData?.kpis?.pendingActionCount ?? '-'} icon={Hourglass} isLoading={isLoadingData && !dashboardData} description="Matches/contratos" />
                    <KPICard title="Taxa Preenchim. (30d)" value={formatPercentage(dashboardData?.kpis?.fillRateLast30Days)} icon={Target} isLoading={isLoadingData && !dashboardData} description="Eficiência" />
                    <KPICard title="Custo Estimado (30d)" value={formatCurrency(dashboardData?.kpis?.costLast30Days)} icon={WalletCards} isLoading={isLoadingData && !dashboardData} description="Gasto com plantões" />
                    <KPICard title="Tempo Médio Preench." value={formatHours(dashboardData?.kpis?.avgTimeToFillHours)} icon={Clock} isLoading={isLoadingData && !dashboardData} description="Agilidade (horas)" />
                    <KPICard title="Médicos na Plataforma" value={dashboardData?.kpis?.totalDoctorsOnPlatform ?? '-'} icon={Users} isLoading={isLoadingData && !dashboardData} description="Total cadastrados" />
                    <KPICard title="Top Demanda (Espec.)" value={dashboardData?.kpis?.topSpecialtyDemand ?? '-'} icon={TrendingUp} isLoading={isLoadingData && !dashboardData} description="Mais requisitada" />
                </div>
             </section>

             <section aria-labelledby="charts-heading">
                <h2 id="charts-heading" className="text-xl font-semibold mb-4 mt-4 text-gray-700">Análises Gráficas</h2>
                 {fetchError && !isLoadingData && (!dashboardData?.monthlyCosts || !dashboardData?.specialtyDemand) && ( <ErrorState message={`Erro ao carregar dados para gráficos: ${fetchError}`} onRetry={loadInitialData} /> )}
                 <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                     {(isLoadingData && !dashboardData?.monthlyCosts) ?
                         (<Card><CardContent className="h-[318px] flex items-center justify-center"><LoadingState /></CardContent></Card>) :
                         (dashboardData?.monthlyCosts && <SimpleLineChart data={dashboardData.monthlyCosts} title="Custo Mensal Estimado" description="Evolução dos gastos (últimos meses)" dataKey="valor" strokeColor="#16a34a" />)
                     }
                     {(isLoadingData && !dashboardData?.specialtyDemand) ?
                         (<Card><CardContent className="h-[318px] flex items-center justify-center"><LoadingState /></CardContent></Card>) :
                         (dashboardData?.specialtyDemand && <SimpleBarChart data={dashboardData.specialtyDemand} title="Demanda por Especialidade (Top)" description="Especialidades mais requisitadas" dataKey="valor" fillColor="#3b82f6" />)
                     }
                 </div>
             </section>
        </div>
    );
}

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
                        className={cn( "font-bold text-gray-900", "text-lg md:text-xl lg:text-2xl", "leading-tight" )}
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