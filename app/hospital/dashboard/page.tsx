// app/hospital/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency, formatPercentage, formatHours } from "@/lib/utils";
import {
    getHospitalDashboardData, // <<< Importando a função real
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
import { getCurrentUserData, type HospitalProfile } from '@/lib/auth-service';
import ProfileStatusAlert, { type ProfileStatus } from '@/components/ui/ProfileStatusAlert';
import Link from "next/link";

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
                    <div className={cn( "font-bold text-gray-900", "text-lg md:text-xl lg:text-2xl", "leading-tight" )} title={value?.toString()}>
                        {value}
                    </div>
                )}
                {description && !isLoading && <p className="text-xs text-muted-foreground pt-1 truncate">{description}</p>}
            </CardContent>
        </Card>
    );
};

export default function HospitalDashboardPage() {
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();

    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const loadInitialData = useCallback(async () => {
        if (!user) {
            setIsLoadingData(false);
            return;
        }
        setIsLoadingData(true);
        setFetchError(null);
        try {
            // *** ALTERAÇÃO AQUI: Chamando as duas funções reais em paralelo ***
            const [profile, specificData] = await Promise.all([
                getCurrentUserData(),
                getHospitalDashboardData(user.uid) // <<< Usa a função real do serviço
            ]);

            if (profile && profile.role === 'hospital') {
                setHospitalProfile(profile as HospitalProfile);
            } else if (profile) {
                console.warn("[HospitalDashboardPage] Perfil logado não é de hospital:", profile.role);
                setFetchError("Tipo de perfil inválido para este dashboard.");
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
    }, [user, toast]);

    useEffect(() => {
        if (!authLoading && user) {
            loadInitialData();
        } else if (!authLoading && !user) {
            setIsLoadingData(false);
        }
    }, [user, authLoading, loadInitialData]);

    if (authLoading || (isLoadingData && !hospitalProfile)) {
        return <div className="p-6"><LoadingState message="Carregando dashboard do hospital..." /></div>;
    }

    if (fetchError && !dashboardData) {
        return <div className="p-6"><ErrorState message={fetchError} onRetry={loadInitialData} /></div>;
    }
    
    if (!user && !authLoading && !isLoadingData) {
        return (
            <div className="container mx-auto p-4 sm:p-6 space-y-6 text-center">
                <p>Você não está logado ou não tem permissão para ver esta página.</p>
            </div>
        );
    }
    
    const hospitalEditProfileLink = "/hospital/profile/edit";

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">
                Visão Geral: {hospitalProfile?.displayName || user?.displayName || "Hospital"}
            </h1>

            {hospitalProfile && (
                <ProfileStatusAlert
                    // *** ALTERAÇÃO AQUI: Corrigindo o nome da propriedade ***
                    status={hospitalProfile.documentVerificationStatus as ProfileStatus | undefined}
                    adminNotes={hospitalProfile.adminVerificationNotes}
                    userType="hospital"
                    editProfileLink={hospitalEditProfileLink}
                />
            )}

            <section aria-labelledby="kpi-heading">
                <h2 id="kpi-heading" className="sr-only">Indicadores Chave</h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                    <KPICard title="Vagas Abertas" value={dashboardData?.kpis?.openShiftsCount ?? '-'} icon={AlertCircle} isLoading={isLoadingData} description="Aguardando médicos" />
                    <KPICard title="Pendentes Ação" value={dashboardData?.kpis?.pendingActionCount ?? '-'} icon={Hourglass} isLoading={isLoadingData} description="Matches/contratos" />
                    <KPICard title="Taxa Preenchim. (30d)" value={formatPercentage(dashboardData?.kpis?.fillRateLast30Days)} icon={Target} isLoading={isLoadingData} description="Eficiência" />
                    <KPICard title="Custo Estimado (30d)" value={formatCurrency(dashboardData?.kpis?.costLast30Days)} icon={WalletCards} isLoading={isLoadingData} description="Gasto com plantões" />
                    <KPICard title="Tempo Médio Preench." value={formatHours(dashboardData?.kpis?.avgTimeToFillHours)} icon={Clock} isLoading={isLoadingData} description="Agilidade (horas)" />
                    <KPICard title="Médicos na Plataforma" value={dashboardData?.kpis?.totalDoctorsOnPlatform ?? '-'} icon={Users} isLoading={isLoadingData} description="Total cadastrados" />
                    <KPICard title="Top Demanda (Espec.)" value={dashboardData?.kpis?.topSpecialtyDemand ?? '-'} icon={TrendingUp} isLoading={isLoadingData} description="Mais requisitada" />
                </div>
            </section>

            <section aria-labelledby="charts-heading">
                <h2 id="charts-heading" className="text-xl font-semibold mb-4 mt-4 text-gray-700">Análises Gráficas</h2>
                {fetchError && (!dashboardData?.monthlyCosts || !dashboardData?.specialtyDemand) && ( <ErrorState message={`Erro ao carregar dados para gráficos: ${fetchError}`} onRetry={loadInitialData} /> )}
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