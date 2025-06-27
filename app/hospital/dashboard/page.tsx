// app/hospital/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency, formatPercentage, formatHours } from "@/lib/utils";
import {
    getHospitalDashboardData,
    type DashboardData
} from "@/lib/hospital-shift-service";
import { getPendingContractsForHospital, signContractByHospital } from "@/lib/contract-service";
import type { ShiftProposal } from "@/lib/proposal-service";
import { 
    Loader2, AlertCircle, Users, DollarSign, TrendingUp, WalletCards, Target, Clock, Hourglass, FileSignature, ClipboardList, UserCheck, CalendarDays,
    AlertTriangle as LucideAlertTriangle, RotateCcw
} from "lucide-react";
import { useAuth } from '@/components/auth-provider';
import { getCurrentUserData, type HospitalProfile } from '@/lib/auth-service';
import ProfileStatusAlert, { type ProfileStatus } from '@/components/ui/ProfileStatusAlert';
import Link from "next/link";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import { SimpleLineChart } from "@/components/charts/SimpleLineChart";

// --- CORREÇÃO: Componentes auxiliares re-incluídos aqui ---
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ title, message }: { title: string, message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{message}</p></div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300"><LucideAlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="text-base font-semibold text-red-700 mb-1">Oops!</p><p>{message || "Não foi possível carregar."}</p>{onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}</div> ));

// --- Componente para o Card de Contrato ---
const ContractItem: React.FC<{ proposal: ShiftProposal, onAction: () => void }> = ({ proposal, onAction }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleSign = async () => {
        setIsProcessing(true);
        try {
            await signContractByHospital(proposal.id);
            toast({ title: "Contrato Assinado!", description: `O(A) Dr(a). ${proposal.doctorName} foi adicionado(a) à sua equipe para este plantão.`});
            onAction();
        } catch (error: any) {
            toast({ title: "Erro ao assinar", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Card className="border-l-4 border-indigo-500">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserCheck size={20}/> Contratação Pendente: Dr(a). {proposal.doctorName || 'N/A'}</CardTitle>
                <CardDescription>Especialidades: {proposal.specialties.join(', ')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><CalendarDays size={14}/> <strong>Data do Plantão:</strong> {proposal.shiftDates[0].toDate().toLocaleDateString('pt-BR')}</p>
                <p className="flex items-center gap-2"><Clock size={14}/> <strong>Horário:</strong> {proposal.startTime} - {proposal.endTime}</p>
                <p className="flex items-center gap-2"><DollarSign size={14}/> <strong>Valor Acordado:</strong> {formatCurrency(proposal.offeredRateToDoctor)}/h</p>
                <p className="text-xs text-gray-600 mt-3 pt-3 border-t">O médico aceitou a proposta. A sua assinatura é necessária para visualizar o contrato e formalizar a contratação.</p>
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button onClick={handleSign} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
                    Visualizar e Assinar Contrato
                </Button>
            </CardFooter>
        </Card>
    );
}

// --- Componente para o Card de KPI ---
const KPICard: React.FC<{ title: string; value: string | number; description?: string; icon: React.ElementType; isLoading: boolean; href?: string; }> = ({ title, value, description, icon: Icon, isLoading, href }) => {
    const cardContent = (
        <Card className={cn("shadow-sm transition-shadow duration-200 min-w-0", href ? "hover:shadow-md hover:border-primary cursor-pointer" : "")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-gray-600 truncate pr-2">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground shrink-0" /></CardHeader>
            <CardContent className="pt-0 pb-3 px-3 overflow-hidden">
                {isLoading ? (<div className="h-8 flex items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>) : (<div className={cn("font-bold text-gray-900", "text-lg md:text-xl lg:text-2xl", "leading-tight")} title={value?.toString()}>{value}</div>)}
                {description && !isLoading && <p className="text-xs text-muted-foreground pt-1 truncate">{description}</p>}
            </CardContent>
        </Card>
    );
    if (href) { return <Link href={href} className="no-underline">{cardContent}</Link>; }
    return cardContent;
};

// --- Componente Principal da Página ---
export default function HospitalDashboardPage() {
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [pendingContracts, setPendingContracts] = useState<ShiftProposal[]>([]);
    const [isLoadingContracts, setIsLoadingContracts] = useState(true);
    const [contractsError, setContractsError] = useState<string | null>(null);

    const loadAllData = useCallback(async () => {
        if (!user) {
            setIsLoadingData(false);
            setIsLoadingContracts(false);
            return;
        }
        setIsLoadingData(true);
        setIsLoadingContracts(true);
        setFetchError(null);
        setContractsError(null);

        try {
            const [profile, specificData, contracts] = await Promise.all([
                getCurrentUserData(),
                getHospitalDashboardData(user.uid),
                getPendingContractsForHospital(user.uid)
            ]);

            if (profile && profile.role === 'hospital') {
                setHospitalProfile(profile as HospitalProfile);
            } else if (profile) {
                setFetchError("Tipo de perfil inválido para este dashboard.");
            }
            setDashboardData(specificData);
            setPendingContracts(contracts);

        } catch (error: any) {
            console.error("Error fetching hospital dashboard page data:", error);
            const errorMsg = error.message || "Erro ao carregar dados.";
            setFetchError(errorMsg);
            setContractsError(errorMsg);
            toast({ title: "Erro nos Dados", description: errorMsg, variant: "destructive" });
        } finally {
            setIsLoadingData(false);
            setIsLoadingContracts(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (!authLoading && user) {
            loadAllData();
        } else if (!authLoading && !user) {
            setIsLoadingData(false);
            setIsLoadingContracts(false);
        }
    }, [user, authLoading, loadAllData]);

    if (authLoading || (isLoadingData && !hospitalProfile)) {
        return <div className="p-6"><LoadingState message="Carregando dashboard do hospital..." /></div>;
    }
    
    return (
        <div className="flex flex-col gap-6 md:gap-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">
                Visão Geral: {hospitalProfile?.displayName || user?.displayName || "Hospital"}
            </h1>

            {hospitalProfile && (
                <ProfileStatusAlert
                    status={hospitalProfile.documentVerificationStatus as ProfileStatus | undefined}
                    adminNotes={hospitalProfile.adminVerificationNotes}
                    userType="hospital"
                    editProfileLink={"/hospital/profile/edit"}
                />
            )}

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                    <TabsTrigger value="contracts">
                        Contratos para Assinatura
                        {pendingContracts.length > 0 && (
                            <Badge variant="destructive" className="ml-2">{pendingContracts.length}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-4">
                    <section aria-labelledby="kpi-heading">
                        <h2 id="kpi-heading" className="sr-only">Indicadores Chave</h2>
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                            <KPICard title="Vagas Abertas" value={dashboardData?.kpis?.openShiftsCount ?? '-'} icon={AlertCircle} isLoading={isLoadingData} description="Aguardando médicos" />
                            <KPICard title="Pendentes Ação" value={pendingContracts.length} icon={Hourglass} isLoading={isLoadingContracts} description="Contratos para assinar" />
                            <KPICard title="Taxa Preenchim. (30d)" value={formatPercentage(dashboardData?.kpis?.fillRateLast30Days)} icon={Target} isLoading={isLoadingData} description="Eficiência" />
                            <KPICard title="Custo Estimado (30d)" value={formatCurrency(dashboardData?.kpis?.costLast30Days)} icon={WalletCards} isLoading={isLoadingData} description="Gasto com plantões" />
                            <KPICard title="Tempo Médio Preench." value={formatHours(dashboardData?.kpis?.avgTimeToFillHours)} icon={Clock} isLoading={isLoadingData} description="Agilidade (horas)" />
                            <KPICard title="Médicos na Plataforma" value={dashboardData?.kpis?.totalDoctorsOnPlatform ?? '-'} icon={Users} isLoading={isLoadingData} description="Total cadastrados" />
                            <KPICard title="Top Demanda (Espec.)" value={dashboardData?.kpis?.topSpecialtyDemand ?? '-'} icon={TrendingUp} isLoading={isLoadingData} description="Mais requisitada" />
                        </div>
                    </section>
                    <section aria-labelledby="charts-heading">
                        <h2 id="charts-heading" className="text-xl font-semibold mb-4 mt-4 text-gray-700">Análises Gráficas</h2>
                        {fetchError && <ErrorState message={`Erro ao carregar dados para gráficos: ${fetchError}`} onRetry={loadAllData} />}
                        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                            {(isLoadingData && !dashboardData?.monthlyCosts) ? (<Card><CardContent className="h-[318px] flex items-center justify-center"><LoadingState /></CardContent></Card>) : (dashboardData?.monthlyCosts && <SimpleLineChart data={dashboardData.monthlyCosts} title="Custo Mensal Estimado" description="Evolução dos gastos" dataKey="valor" strokeColor="#16a34a" />)}
                            {(isLoadingData && !dashboardData?.specialtyDemand) ? (<Card><CardContent className="h-[318px] flex items-center justify-center"><LoadingState /></CardContent></Card>) : (dashboardData?.specialtyDemand && <SimpleBarChart data={dashboardData.specialtyDemand} title="Demanda por Especialidade" description="Especialidades mais requisitadas" dataKey="valor" fillColor="#3b82f6" />)}
                        </div>
                    </section>
                </TabsContent>

                <TabsContent value="contracts" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Contratos Aguardando sua Assinatura</CardTitle>
                            <CardDescription>Estes são os plantões que foram aceitos pelos médicos e precisam da sua assinatura final para serem confirmados.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingContracts ? <LoadingState message="Buscando contratos..." /> :
                             contractsError ? <ErrorState message={contractsError} onRetry={loadAllData} /> :
                             pendingContracts.length === 0 ? <EmptyState title="Nenhum contrato pendente" message="Quando um médico aceitar uma proposta, o contrato aparecerá aqui." /> :
                             <div className="space-y-4">
                                 {pendingContracts.map(contract => (
                                     <ContractItem key={contract.id} proposal={contract} onAction={loadAllData} />
                                 ))}
                             </div>
                            }
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}