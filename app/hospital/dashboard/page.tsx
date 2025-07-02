// app/hospital/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency, formatPercentage, formatHours } from "@/lib/utils";
import { getHospitalDashboardData, type DashboardData } from "@/lib/hospital-shift-service";
// MUDANÇA: Usando a função genérica para consistência
import { getContractsForHospital, signContractByHospital, type Contract } from "@/lib/contract-service"; 
import { Loader2, AlertCircle, Users, DollarSign, TrendingUp, WalletCards, Target, Clock, Hourglass, FileSignature, ClipboardList, UserCheck, CalendarDays, RotateCcw, Briefcase } from "lucide-react";
import { useAuth } from '@/components/auth-provider';
import { getCurrentUserData, type HospitalProfile } from '@/lib/auth-service';
import ProfileStatusAlert, { type ProfileStatus } from '@/components/ui/ProfileStatusAlert';
import Link from "next/link";
import { SimpleLineChart } from "@/components/charts/SimpleLineChart";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ title, message }: { title: string, message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{message}</p></div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300"><AlertCircle className="w-12 h-12 text-red-400 mb-4"/><p className="text-base font-semibold text-red-700 mb-1">Oops!</p><p>{message || "Não foi possível carregar."}</p>{onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}</div> ));


const ContractItem: React.FC<{ contract: Contract, onAction: () => void }> = ({ contract, onAction }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();
    const handleSign = async () => { setIsProcessing(true); try { await signContractByHospital(contract.id); toast({ title: "Contrato Assinado!", description: `O(A) Dr(a). ${contract.doctorName} foi adicionado à sua equipe.`}); onAction(); } catch (error: any) { toast({ title: "Erro ao assinar", description: error.message, variant: "destructive" }); } finally { setIsProcessing(false); } };
    const shiftDate = contract.shiftDates[0]?.toDate()?.toLocaleDateString('pt-BR') || 'Data inválida';

    return ( 
        <Card className="border-l-4 border-indigo-500">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserCheck size={20}/> Contratação Pendente: Dr(a). {contract.doctorName || 'N/A'}</CardTitle>
                <CardDescription>Especialidades: {contract.specialties.join(', ')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><CalendarDays size={14}/> <strong>Data do Plantão:</strong> {shiftDate}</p>
                <p className="flex items-center gap-2"><Clock size={14}/> <strong>Horário:</strong> {contract.startTime} - {contract.endTime}</p>
                {/* MUDANÇA: Exibindo o 'hospitalRate' e corrigindo a etiqueta. */}
                <p className="flex items-center gap-2 text-red-700 font-semibold"><DollarSign size={14}/> <strong>Seu Custo:</strong> {formatCurrency(contract.hospitalRate)}/h</p>
                <p className="text-xs text-gray-600 mt-3 pt-3 border-t">O médico aceitou a proposta. A sua assinatura é necessária para formalizar a contratação.</p>
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button onClick={handleSign} disabled={isProcessing}>{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}Visualizar e Assinar Contrato</Button>
            </CardFooter>
        </Card> 
    );
};

const KPICard: React.FC<{ title: string; value: string | number; description?: string; icon: React.ElementType; isLoading: boolean; href?: string; }> = ({ title, value, description, icon: Icon, isLoading, href }) => {
    const cardContent = ( <Card className={cn("shadow-sm transition-shadow duration-200 min-w-0", href ? "hover:shadow-md hover:border-primary cursor-pointer" : "")}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-gray-600 truncate pr-2">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground shrink-0" /></CardHeader><CardContent className="pt-0 pb-3 px-3 overflow-hidden">{isLoading ? (<div className="h-8 flex items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>) : (<div className={cn("font-bold text-gray-900", "text-lg md:text-xl lg:text-2xl", "leading-tight")} title={value?.toString()}>{value}</div>)}{description && !isLoading && <p className="text-xs text-muted-foreground pt-1 truncate">{description}</p>}</CardContent></Card> );
    if (href) { return <Link href={href} className="no-underline">{cardContent}</Link>; }
    return cardContent;
};

export default function HospitalDashboardPage() {
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
    const [pendingContracts, setPendingContracts] = useState<Contract[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAllData = useCallback(async () => {
        if (!user) { setIsLoading(false); return; }
        setIsLoading(true);
        setError(null);
        try {
            const [profile, specificData, contracts] = await Promise.all([
                getCurrentUserData(),
                getHospitalDashboardData(user.uid),
                // MUDANÇA: Usando a função genérica para buscar os contratos pendentes.
                getContractsForHospital(['PENDING_HOSPITAL_SIGNATURE']),
            ]);
            if (profile?.role === 'hospital') setHospitalProfile(profile as HospitalProfile);
            setDashboardData(specificData);
            setPendingContracts(contracts);
        } catch (error: any) {
            setError(error.message || "Erro ao carregar dados.");
            toast({ title: "Erro nos Dados", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (!authLoading && user) loadAllData();
        else if (!authLoading && !user) setIsLoading(false);
    }, [user, authLoading, loadAllData]);

    if (isLoading && !hospitalProfile) return <div className="p-6"><LoadingState message="A carregar dashboard..." /></div>;
    
    return (
        <div className="flex flex-col gap-6 md:gap-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Visão Geral: {hospitalProfile?.displayName || "Hospital"}</h1>
            {hospitalProfile && <ProfileStatusAlert status={hospitalProfile.documentVerificationStatus as ProfileStatus | undefined} adminNotes={hospitalProfile.adminVerificationNotes} userType="hospital" editProfileLink={"/hospital/profile/edit"}/>}

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                    <TabsTrigger value="contracts">Contratos Pendentes<Badge variant={pendingContracts.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : pendingContracts.length}</Badge></TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-4">
                    <section aria-labelledby="kpi-heading">
                        <h2 id="kpi-heading" className="sr-only">Indicadores Chave</h2>
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                            <KPICard title="Vagas Abertas" value={dashboardData?.kpis?.openShiftsCount ?? '-'} icon={AlertCircle} isLoading={isLoading} description="Aguardando médicos" href="/hospital/shifts" />
                            <KPICard title="Pendentes Ação" value={pendingContracts.length} icon={Hourglass} isLoading={isLoading} description="Contratos para assinar" href="/hospital/contracts" />
                            <KPICard title="Taxa Preenchim. (30d)" value={formatPercentage(dashboardData?.kpis?.fillRateLast30Days)} icon={Target} isLoading={isLoading} description="Eficiência" />
                            <KPICard title="Custo Estimado (30d)" value={formatCurrency(dashboardData?.kpis?.costLast30Days)} icon={WalletCards} isLoading={isLoading} description="Gasto com plantões" />
                            <KPICard title="Tempo Médio Preench." value={formatHours(dashboardData?.kpis?.avgTimeToFillHours)} icon={Clock} isLoading={isLoading} description="Agilidade (horas)" />
                            <KPICard title="Médicos na Plataforma" value={dashboardData?.kpis?.totalDoctorsOnPlatform ?? '-'} icon={Users} isLoading={isLoading} description="Total cadastrados" />
                            <KPICard title="Top Demanda (Espec.)" value={dashboardData?.kpis?.topSpecialtyDemand ?? '-'} icon={TrendingUp} isLoading={isLoading} description="Mais requisitada" />
                        </div>
                    </section>
                    <section aria-labelledby="charts-heading" className="mt-6">
                        <h2 id="charts-heading" className="text-xl font-semibold mb-4 text-gray-700">Análises Gráficas</h2>
                        {error && (!dashboardData?.monthlyCosts || !dashboardData?.specialtyDemand) && (<ErrorState message={`Erro ao carregar dados para gráficos: ${error}`} onRetry={loadAllData} />)}
                        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                            {(isLoading && !dashboardData?.monthlyCosts) ? (<Card><CardContent className="h-[318px] flex items-center justify-center"><LoadingState /></CardContent></Card>) : (dashboardData?.monthlyCosts && <SimpleLineChart data={dashboardData.monthlyCosts} title="Custo Mensal Estimado" description="Evolução dos gastos" dataKey="valor" strokeColor="#16a34a" />)}
                            {(isLoading && !dashboardData?.specialtyDemand) ? (<Card><CardContent className="h-[318px] flex items-center justify-center"><LoadingState /></CardContent></Card>) : (dashboardData?.specialtyDemand && <SimpleBarChart data={dashboardData.specialtyDemand} title="Demanda por Especialidade" description="Especialidades mais requisitadas" dataKey="valor" fillColor="#3b82f6" />)}
                        </div>
                    </section>
                </TabsContent>

                <TabsContent value="contracts" className="mt-4">
                     <Card>
                        <CardHeader><CardTitle>Contratos Aguardando sua Assinatura</CardTitle><CardDescription>Plantões aceitos pelos médicos que precisam da sua assinatura final.</CardDescription></CardHeader>
                        <CardContent>
                            {isLoading ? <LoadingState message="A buscar contratos..." /> : error ? <ErrorState message={error} onRetry={loadAllData} /> : pendingContracts.length === 0 ? <EmptyState title="Nenhum contrato pendente" message="Quando um médico aceitar uma proposta, aparecerá aqui." /> :
                             <div className="space-y-4">{pendingContracts.map(contract => (<ContractItem key={contract.id} contract={contract} onAction={loadAllData} />))}</div>
                            }
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}