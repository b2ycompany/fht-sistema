// app/hospital/shifts/page.tsx
"use client";

import React from "react";
import { useState, useEffect, useMemo, useCallback, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

import { cn, formatCurrency, formatPercentage, formatHours } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import { Timestamp } from "firebase/firestore";

import {
  addShiftRequirement,
  getHospitalShiftRequirements,
  deleteShiftRequirement,
  type ShiftRequirement,
  type ShiftFormPayload,
  type HospitalKPIs,
  type MonthlyCostData,
  type SpecialtyDemandData,
  type PendingMatch,
  type ConfirmedShift,
  type PastShift,
  type DashboardData
} from "@/lib/hospital-shift-service";
import { medicalSpecialties, ServiceTypeRates } from "@/lib/availability-service";

import { SimpleLineChart } from "@/components/charts/SimpleLineChart";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";

import {
  Plus, Loader2, AlertCircle, Users, DollarSign, Briefcase, ClipboardList, Info, Trash2, CheckCircle, History, X, CalendarDays, TrendingUp, WalletCards, MapPin, Target, Clock, Hourglass, RotateCcw
} from "lucide-react";

type ButtonVariant = VariantProps<typeof Button>["variant"];
const timeOptions = Array.from({ length: 48 }, (_, i) => { const h = Math.floor(i/2); const m = i%2 === 0 ? "00" : "30"; return `${h.toString().padStart(2,"0")}:${m}`; });
const brazilianStates = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO" ];
const citiesByState: { [key: string]: string[] } = {
  "SP": ["São Paulo", "Campinas", "Guarulhos", "Osasco", "Santo André", "São Bernardo do Campo", "Santos", "Ribeirão Preto", "Sorocaba", "Jundiaí", "Piracicaba", "Bauru", "Franca", "Taubaté", "Limeira", "Barueri", "Cotia", "Itapevi", "Araçariguama"],
  "RJ": ["Rio de Janeiro", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Niterói", "Belford Roxo", "Campos dos Goytacazes", "São João de Meriti", "Petrópolis", "Volta Redonda"],
  "MG": ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Montes Claros", "Ribeirão das Neves", "Uberaba", "Governador Valadares", "Ipatinga"],
};
const serviceTypesOptions = Object.entries(ServiceTypeRates).map(([v, r]) => ({ value: v, label: v.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '), rateExample: r }));

export default function HospitalShiftsPage() {
  const { toast } = useToast();
  const [kpiData, setKpiData] = useState<HospitalKPIs | null>(null);
  const [monthlyCostData, setMonthlyCostData] = useState<MonthlyCostData[]>([]);
  const [specialtyDemandData, setSpecialtyDemandData] = useState<SpecialtyDemandData[]>([]);
  const [openShifts, setOpenShifts] = useState<ShiftRequirement[]>([]);
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [confirmedShifts, setConfirmedShifts] = useState<ConfirmedShift[]>([]);
  const [pastShifts, setPastShifts] = useState<PastShift[]>([]);
  const [isLoadingKPIs, setIsLoadingKPIs] = useState(true);
  const [isLoadingOpenShifts, setIsLoadingOpenShifts] = useState(true);
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [isLoadingConfirmed, setIsLoadingConfirmed] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [fetchErrorKPIs, setFetchErrorKPIs] = useState<string | null>(null);
  const [fetchErrorOpenShifts, setFetchErrorOpenShifts] = useState<string | null>(null);
  const [fetchErrorPending, setFetchErrorPending] = useState<string | null>(null);
  const [fetchErrorConfirmed, setFetchErrorConfirmed] = useState<string | null>(null);
  const [fetchErrorHistory, setFetchErrorHistory] = useState<string | null>(null);
  const [isAddShiftDialogOpen, setIsAddShiftDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("open");

  const fetchDashboardData = useCallback(async (currentOpenDemandCount?: number) => {
    setIsLoadingKPIs(true); setFetchErrorKPIs(null);
    try {
      console.log("[HospitalShiftsPage] Simulando busca de KPIs e Gráficos...");
      await new Promise(res => setTimeout(res, 600));
      const countOpen = currentOpenDemandCount ?? openShifts.length;
      const countPending = pendingMatches.length;
      const kpis: HospitalKPIs = { openShiftsCount: countOpen, pendingActionCount: countPending, totalDoctorsOnPlatform: Math.floor(Math.random() * 100) + 100, costLast30Days: (Math.random() * 30000) + 10000, fillRateLast30Days: Math.random() * 30 + 70, avgTimeToFillHours: Math.random() * 10 + 2, topSpecialtyDemand: medicalSpecialties[Math.floor(Math.random() * medicalSpecialties.length)] };
      const costs: MonthlyCostData[] = [ { name: 'Jan', valor: (Math.random() * 5000) + 15000 }, { name: 'Fev', valor: (Math.random() * 5000) + 18000 }, { name: 'Mar', valor: (Math.random() * 5000) + 20000 }, { name: 'Abr', valor: (Math.random() * 5000) + 12000 } ];
      const demand: SpecialtyDemandData[] = medicalSpecialties.slice(0,5).map(s => ({ name: s.substring(0,10), valor: Math.floor(Math.random() * 10) + 1}));
      const dashboardDataResult: DashboardData = { kpis, monthlyCosts: costs, specialtyDemand: demand };
      setKpiData(dashboardDataResult.kpis); setMonthlyCostData(dashboardDataResult.monthlyCosts); setSpecialtyDemandData(dashboardDataResult.specialtyDemand);
    } catch (error: any) { console.error("[HospitalShiftsPage] Error dashboard data:", error); setFetchErrorKPIs(error.message || "Erro dados painel."); }
    finally { setIsLoadingKPIs(false); }
  }, [openShifts.length, pendingMatches.length]);

  const fetchOpenShifts = useCallback(async (updateDashboard = true) => {
    console.log("[HospitalShiftsPage] fetchOpenShifts chamado. updateDashboard:", updateDashboard);
    setIsLoadingOpenShifts(true); setFetchErrorOpenShifts(null);
    let fetchedShiftRequirements: ShiftRequirement[] = [];
    try {
      fetchedShiftRequirements = await getHospitalShiftRequirements() || [];
      console.log("[HospitalShiftsPage] Demandas abertas recebidas:", fetchedShiftRequirements.length);
      setOpenShifts(fetchedShiftRequirements.sort((a, b) => {
        const dateA = a.dates?.[0] instanceof Timestamp ? a.dates[0].toDate().getTime() : 0;
        const dateB = b.dates?.[0] instanceof Timestamp ? b.dates[0].toDate().getTime() : 0;
        if (dateA === 0 && dateB === 0) return 0;
        if (dateA === 0) return 1;
        if (dateB === 0) return -1;
        const dateComparison = dateA - dateB;
        if (dateComparison !== 0) return dateComparison;
        return a.startTime.localeCompare(b.startTime);
      }));
    } catch (error: any) {
      console.error("[HospitalShiftsPage] Error fetching open shifts:", error);
      const errorMsg = error.message || "Erro ao carregar demandas abertas.";
      setFetchErrorOpenShifts(errorMsg);
      if (updateDashboard) setFetchErrorKPIs(errorMsg);
    } finally {
      setIsLoadingOpenShifts(false);
      console.log("[HospitalShiftsPage] fetchOpenShifts finalizado. isLoadingOpenShifts:", false);
      if (updateDashboard) {
        console.log("[HospitalShiftsPage] Atualizando dashboard data após fetchOpenShifts.");
        fetchDashboardData(fetchedShiftRequirements.length);
      }
    }
  }, [fetchDashboardData]);

  const fetchPendingMatches = useCallback(async () => { setIsLoadingPending(true); setFetchErrorPending(null); try { console.log("Buscando pendentes (sim)..."); await new Promise(res => setTimeout(res, 900)); const m: PendingMatch[] = [ { id: 'm1', date: Timestamp.fromDate(new Date(2025, 4, 20)), startTime: '07:00', endTime: '19:00', specialty: 'Pediatria', status: 'pending_doctor_acceptance', offeredRate: 160, doctorName: 'Dr. P A' }]; setPendingMatches(m); } catch (e:any) { setFetchErrorPending(e.message); } finally { setIsLoadingPending(false); } }, []);
  const fetchConfirmedShifts = useCallback(async () => { setIsLoadingConfirmed(true); setFetchErrorConfirmed(null); try { console.log("Buscando confirmados (sim)..."); await new Promise(res => setTimeout(res, 800)); const s: ConfirmedShift[] = [{ id: 'up1', date: Timestamp.fromDate(new Date(2025, 4, 15)), startTime: '07:00', endTime: '19:00', doctorName: 'Dr. Silva', specialty: 'Cardio' }]; setConfirmedShifts(s); } catch (e:any) { setFetchErrorConfirmed(e.message); } finally { setIsLoadingConfirmed(false); } }, []);
  const fetchPastShifts = useCallback(async () => { setIsLoadingHistory(true); setFetchErrorHistory(null); try { console.log("Buscando histórico (sim)..."); await new Promise(res => setTimeout(res, 1000)); const s: PastShift[] = [{ id: 'p1', date: Timestamp.fromDate(new Date(2025, 3, 1)), startTime: '07:00', endTime: '19:00', doctorName: 'Dr. Fulano', status: 'Concluído', cost: 1800 }]; setPastShifts(s); } catch (e:any) { setFetchErrorHistory(e.message); } finally { setIsLoadingHistory(false); } }, []);

  useEffect(() => {
    console.log("[HospitalShiftsPage] useEffect inicial: chamando fetchOpenShifts.");
    fetchOpenShifts(true);
  }, [fetchOpenShifts]);

  const handleTabChange = (value: string) => {
    console.log("[HospitalShiftsPage] Tab alterada para:", value);
    setActiveTab(value);
    if (value === 'pending' && pendingMatches.length === 0 && !isLoadingPending && !fetchErrorPending) { fetchPendingMatches(); }
    else if (value === 'confirmed' && confirmedShifts.length === 0 && !isLoadingConfirmed && !fetchErrorConfirmed) { fetchConfirmedShifts(); }
    else if (value === 'history' && pastShifts.length === 0 && !isLoadingHistory && !fetchErrorHistory) { fetchPastShifts(); }
  }

  const handleCancelShift = async (shiftId: string | undefined) => {
    if (!shiftId) { console.warn("[HospitalShiftsPage] Tentativa de cancelar demanda sem ID."); return; }
    console.log("[HospitalShiftsPage] Tentando cancelar demanda ID:", shiftId);
    try {
      await deleteShiftRequirement(shiftId);
      toast({ title: "Demanda Cancelada", description: "A demanda foi removida com sucesso.", variant: "default" });
      fetchOpenShifts(true);
    } catch (error: any) {
      console.error("[HospitalShiftsPage] Erro ao cancelar demanda:", error);
      toast({ title: "Erro ao Cancelar", description: error.message || "Não foi possível cancelar a demanda.", variant: "destructive"});
    }
  };

  const onShiftSuccessfullyAdded = () => {
    console.log("[HospitalShiftsPage] onShiftSuccessfullyAdded callback acionado.");
    setIsAddShiftDialogOpen(false);
    setActiveTab("open");
    fetchOpenShifts(true);
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8 p-1">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Painel de Gerenciamento de Plantões</h1>
      {(fetchErrorKPIs && isLoadingKPIs && isLoadingOpenShifts) && (
          <ErrorState message={fetchErrorKPIs || fetchErrorOpenShifts || "Erro ao carregar dados iniciais."} onRetry={() => fetchOpenShifts(true)} />
      )}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">Visão Geral e Indicadores Chave</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            <KPICard title="Demandas Abertas" value={kpiData?.openShiftsCount ?? '-'} icon={AlertCircle} isLoading={isLoadingOpenShifts || isLoadingKPIs} description="Aguardando médicos" />
            <KPICard title="Pendentes Ação" value={kpiData?.pendingActionCount ?? '-'} icon={Hourglass} isLoading={isLoadingKPIs || isLoadingPending} description="Matches/contratos" />
            <KPICard title="Taxa Preenchim." value={formatPercentage(kpiData?.fillRateLast30Days)} icon={Target} isLoading={isLoadingKPIs} description="Eficiência (30d)" />
            <KPICard title="Custo Estimado" value={formatCurrency(kpiData?.costLast30Days)} icon={WalletCards} isLoading={isLoadingKPIs} description="Gasto (30d)" />
            <KPICard title="Tempo Médio Preench." value={formatHours(kpiData?.avgTimeToFillHours)} icon={Clock} isLoading={isLoadingKPIs} description="Agilidade (h)" />
            <KPICard title="Médicos" value={kpiData?.totalDoctorsOnPlatform ?? '-'} icon={Users} isLoading={isLoadingKPIs} description="Na plataforma" />
            <KPICard title="Top Demanda" value={kpiData?.topSpecialtyDemand ?? '-'} icon={TrendingUp} isLoading={isLoadingKPIs} description="Especialidade" />
        </div>
      </section>
      <section aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="text-xl font-semibold mb-4 mt-4 text-gray-700 sr-only">Análises Gráficas</h2>
        {(fetchErrorKPIs && !isLoadingKPIs) && ( <ErrorState message={`Erro ao carregar dados para gráficos: ${fetchErrorKPIs}`} onRetry={() => fetchOpenShifts(true)} /> )}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {(isLoadingKPIs || !monthlyCostData || monthlyCostData.length === 0 && !fetchErrorKPIs) ? ( <Card><CardHeader><CardTitle className="text-base">Custo Mensal Estimado</CardTitle></CardHeader><CardContent className="h-[218px] flex items-center justify-center"><LoadingState /></CardContent></Card> ) : !fetchErrorKPIs ? ( <SimpleLineChart data={monthlyCostData} title="Custo Mensal Estimado" description="Evolução dos gastos" dataKey="valor" strokeColor="#16a34a" /> ) : null}
            {(isLoadingKPIs || !specialtyDemandData || specialtyDemandData.length === 0 && !fetchErrorKPIs) ? ( <Card><CardHeader><CardTitle className="text-base">Demanda por Especialidade</CardTitle></CardHeader><CardContent className="h-[218px] flex items-center justify-center"><LoadingState /></CardContent></Card> ) : !fetchErrorKPIs ? ( <SimpleBarChart data={specialtyDemandData} title="Demanda por Especialidade" description="Vagas recentes (Top)" dataKey="valor" fillColor="#3b82f6" /> ) : null}
        </div>
      </section>
      <section aria-labelledby="shifts-management-heading">
        <h2 id="shifts-management-heading" className="text-xl font-semibold mb-4 mt-4 text-gray-700">Gerenciamento Detalhado de Demandas</h2>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 border-b pb-3">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 sm:w-auto shrink-0">
              <TabsTrigger value="open" className="text-xs sm:text-sm px-2 sm:px-3">Abertas {isLoadingOpenShifts && activeTab === 'open' ? <Loader2 className="h-3 w-3 animate-spin ml-1.5"/> : `(${openShifts.length})`}</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs sm:text-sm px-2 sm:px-3">Pendentes {isLoadingPending && activeTab === 'pending' ? <Loader2 className="h-3 w-3 animate-spin ml-1.5"/> : `(${pendingMatches.length})`}</TabsTrigger>
              <TabsTrigger value="confirmed" className="text-xs sm:text-sm px-2 sm:px-3">Confirmados {isLoadingConfirmed && activeTab === 'confirmed' ? <Loader2 className="h-3 w-3 animate-spin ml-1.5"/> : `(${confirmedShifts.length})`}</TabsTrigger>
              <TabsTrigger value="history" className="text-xs sm:text-sm px-2 sm:px-3">Histórico {isLoadingHistory && activeTab === 'history' ? <Loader2 className="h-3 w-3 animate-spin ml-1.5"/> : `(${pastShifts.length})`}</TabsTrigger>
            </TabsList>
            <Dialog open={isAddShiftDialogOpen} onOpenChange={setIsAddShiftDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-1.5 h-4 w-4" /> Publicar Nova Demanda
                </Button>
              </DialogTrigger>
              <AddShiftDialog onShiftAdded={onShiftSuccessfullyAdded} />
            </Dialog>
          </div>
          <TabsContent value="open">
            <Card className="shadow-sm border-blue-100">
              <CardHeader className="border-b border-blue-50 py-3 px-4"><CardTitle className="text-base font-semibold text-gray-800">Demandas de Plantão em Aberto</CardTitle></CardHeader>
              <CardContent className="p-0 sm:p-4 sm:pt-6">
                {isLoadingOpenShifts ? ( <LoadingState /> )
                : fetchErrorOpenShifts ? ( <ErrorState message={fetchErrorOpenShifts} onRetry={() => fetchOpenShifts(false)}/> )
                : openShifts.length === 0 ? ( <EmptyState message="Nenhuma demanda de plantão publicada no momento." actionButton={<Button size="sm" onClick={() => setIsAddShiftDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1.5 h-4 w-4"/>Publicar Primeira Demanda</Button>} /> )
                : ( <div className="space-y-3">{openShifts.map(req => (<ShiftListItem key={req.id} shift={req} actions={[{ label: "Cancelar Demanda", icon: Trash2, onClick: () => handleCancelShift(req.id), variant: "ghost", className:"text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full w-8 h-8" }]}/>))}</div> )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="pending">
            <Card className="shadow-sm border-yellow-200">
              <CardHeader className="border-b border-yellow-100 py-3 px-4"><CardTitle className="text-base font-semibold text-gray-800">Demandas com Pendências</CardTitle><CardDescription className="text-sm">Matches ou demandas aguardando alguma ação.</CardDescription></CardHeader>
              <CardContent className="p-4 pt-6">
                {isLoadingPending ? ( <LoadingState /> )
                : fetchErrorPending ? ( <ErrorState message={fetchErrorPending} onRetry={fetchPendingMatches}/> )
                : pendingMatches.length === 0 ? ( <EmptyState message="Nenhuma demanda com pendências no momento." /> )
                : ( <div className="space-y-3">{pendingMatches.map(match => ( <div key={match.id} className="border p-3 rounded-md bg-white text-sm shadow-sm flex justify-between items-center"><span>Pendente ({match.status?.replace(/_/g,' ')}): {match.date instanceof Timestamp ? match.date.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : String(match.date)} - {match.specialty} {match.doctorName ? `- Dr(a). ${match.doctorName}` : ''}</span><Button variant="outline" size="sm" className="h-7 px-2 text-xs">Ver Detalhes</Button></div>))}</div> )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="confirmed">
            <Card className="shadow-sm border-green-200">
              <CardHeader className="border-b border-green-100 py-3 px-4"><CardTitle className="text-base font-semibold text-gray-800">Plantões Confirmados (Agendados)</CardTitle></CardHeader>
              <CardContent className="p-4 pt-6">
                {isLoadingConfirmed ? ( <LoadingState /> )
                : fetchErrorConfirmed ? ( <ErrorState message={fetchErrorConfirmed} onRetry={fetchConfirmedShifts}/> )
                : confirmedShifts.length === 0 ? ( <EmptyState message="Nenhum plantão confirmado para as próximas datas." /> )
                : ( <div className="space-y-3">{confirmedShifts.map(shift => ( <div key={shift.id} className="border p-3 rounded-md bg-white text-sm shadow-sm flex justify-between items-center"><span>Confirmado: {shift.date instanceof Timestamp ? shift.date.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : String(shift.date)} ({shift.startTime}-{shift.endTime}) - {shift.doctorName} ({shift.specialty || 'N/A'})</span></div>))}</div> )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="history">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="border-b border-gray-100 py-3 px-4"><CardTitle className="text-base font-semibold text-gray-800">Histórico de Plantões</CardTitle></CardHeader>
              <CardContent className="p-4 pt-6">
                {isLoadingHistory ? ( <LoadingState /> )
                : fetchErrorHistory ? ( <ErrorState message={fetchErrorHistory} onRetry={fetchPastShifts}/> )
                : pastShifts.length === 0 ? ( <EmptyState message="Nenhum histórico de plantões encontrado." /> )
                : ( <div className="space-y-3">{pastShifts.map(shift => ( <div key={shift.id} className="border p-3 rounded-md bg-white text-sm shadow-sm flex justify-between items-center"><span>Histórico: {shift.date instanceof Timestamp ? shift.date.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : String(shift.date)} - {shift.doctorName} ({shift.status}) {shift.cost ? `- ${formatCurrency(shift.cost)}` : ''}</span></div>))}</div> )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

// --- COMPONENTES AUXILIARES ---

const LoadingState = React.memo(() => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <span className="ml-3 text-sm text-gray-600 mt-3">Carregando dados...</span> </div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: React.ReactNode }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full"> <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/> <p className="font-medium text-gray-600 mb-1">Nada por aqui ainda!</p> <p className="max-w-xs">{message}</p> {actionButton && <div className="mt-4">{actionButton}</div>} </div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"> <AlertCircle className="w-12 h-12 text-red-400 mb-4"/> <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p> <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados. Por favor, tente novamente."}</p> {onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4 bg-red-600 hover:bg-red-700 text-white"> <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente </Button> )} </div> ));
ErrorState.displayName = 'ErrorState';

interface KPICardProps { title: string; value: string | number; description?: string; icon: React.ElementType; isLoading: boolean; }
const KPICard: React.FC<KPICardProps> = React.memo(({ title, value, description, icon: Icon, isLoading }) => { return ( <Card className="shadow-sm hover:shadow-lg transition-shadow duration-300 ease-in-out min-w-0 bg-white rounded-xl border border-slate-200"> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4 px-4"> <CardTitle className="text-[13px] font-semibold text-slate-600 truncate pr-2">{title}</CardTitle> <Icon className="h-4 w-4 text-slate-400 shrink-0" /> </CardHeader> <CardContent className="pt-0 pb-3 px-4 overflow-hidden"> {isLoading ? ( <div className="h-9 flex items-center mt-1"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> ) : ( <div className={cn("font-bold text-slate-800", "text-2xl lg:text-3xl", "leading-none mt-1")} title={String(value)} > {value} </div> )} {description && !isLoading && <p className="text-[11px] text-slate-500 pt-1.5 truncate">{description}</p>} </CardContent> </Card> ); });
KPICard.displayName = 'KPICard';

interface ShiftListItemProps { shift: ShiftRequirement; actions?: { label: string; icon: React.ElementType; onClick: () => void; variant?: ButtonVariant; className?: string; disabled?: boolean }[]; }
const ShiftListItem: React.FC<ShiftListItemProps> = React.memo(({ shift, actions }) => {
  const serviceTypeObj = serviceTypesOptions.find(opt => opt.value === shift.serviceType);
  const serviceTypeLabel = serviceTypeObj?.label || shift.serviceType;

  const getDisplayDate = () => {
    if (!shift.dates || shift.dates.length === 0) return "Datas não especificadas";
    // A primeira data do array é a principal para exibição resumida
    const firstDateObj = shift.dates[0] instanceof Timestamp ? shift.dates[0].toDate() : null;
    let displayStr = firstDateObj ? firstDateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Data Inválida";

    if (shift.dates.length > 1) {
      // Opcional: Mostrar um range se as datas forem sequenciais, ou apenas indicar "+X dias"
      // Por simplicidade, vamos manter "+X dias"
      displayStr += ` (e +${shift.dates.length - 1} outro(s) dia(s))`;
    }
    return displayStr;
  };

  const statusLabel = (status?: string): string => { return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Desconhecido'; };
  const statusBadgeVariant = (status?: string): VariantProps<typeof Badge>["variant"] => {
    switch (status) {
      case 'OPEN': return 'default';
      case 'FULLY_STAFFED': case 'CONFIRMED': case 'COMPLETED': case 'IN_PROGRESS': return 'default';
      case 'PARTIALLY_FILLED': return 'default';
      case 'PENDING_MATCH_REVIEW': case 'PENDING_DOCTOR_ACCEPTANCE': case 'PENDING_CONTRACT_SIGNATURES': return 'secondary';
      case 'CANCELLED_BY_HOSPITAL': case 'EXPIRED': return 'destructive';
      default: return 'outline';
    }
  };
  const statusBadgeColorClasses = (status?: string): string => {
    switch (status) {
        case 'OPEN': return 'bg-blue-100 text-blue-800 border-blue-300';
        case 'FULLY_STAFFED': case 'CONFIRMED': case 'COMPLETED': case 'IN_PROGRESS': return 'bg-green-100 text-green-800 border-green-300';
        case 'PARTIALLY_FILLED': return 'bg-sky-100 text-sky-800 border-sky-300';
        case 'PENDING_MATCH_REVIEW': case 'PENDING_DOCTOR_ACCEPTANCE': case 'PENDING_CONTRACT_SIGNATURES': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:justify-between border rounded-lg p-4 gap-x-4 gap-y-3 transition-all duration-300 bg-white shadow-xs hover:shadow-md")}>
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" />
            <span suppressHydrationWarning>{getDisplayDate()}</span>
            <span className="text-gray-500 font-normal">({shift.startTime} - {shift.endTime})</span>
          </div>
          <Badge variant={statusBadgeVariant(shift.status)} className={cn("text-xs capitalize self-start sm:self-center", statusBadgeColorClasses(shift.status))}>
            {statusLabel(shift.status)}
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600 mt-1 pl-1">
          <div className="flex items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5 shrink-0 text-purple-500" /><span>{shift.city}, {shift.state}</span></div>
          <div className="flex items-center gap-1.5 truncate"><Briefcase className="h-3.5 w-3.5 shrink-0 text-cyan-500" /><span>{serviceTypeLabel}</span></div>
          <div className="flex items-center gap-1.5 text-green-600 font-medium"><DollarSign className="h-3.5 w-3.5 shrink-0" /><span>{formatCurrency(shift.offeredRate)}/hora</span></div>
          <div className="flex items-center gap-1.5 text-gray-700 font-medium"><Users className="h-3.5 w-3.5 shrink-0" /><span>{shift.numberOfVacancies} profissional(is) por data</span></div>
        </div>
        {shift.specialtiesRequired && shift.specialtiesRequired.length > 0 && ( <div className="flex flex-wrap items-center gap-1.5 pt-1.5 pl-1"> <span className="text-xs text-gray-500 mr-1 font-medium shrink-0">Especialidades:</span> {shift.specialtiesRequired.map((s) => (<Badge key={s} variant="outline" className="text-gray-700 text-[11px] px-1.5 py-0.5 font-normal border-blue-200 bg-blue-50">{s}</Badge>))} </div> )}
        {shift.notes && ( <p className="text-xs text-gray-500 pt-1.5 pl-1 italic flex items-start gap-1.5"> <Info className="inline h-3.5 w-3.5 mr-0.5 shrink-0 relative top-0.5"/> <span className="truncate">{shift.notes}</span> </p> )}
      </div>
      {actions && actions.length > 0 && ( <div className="flex items-center space-x-1 shrink-0 mt-2 sm:mt-0 self-end sm:self-center"> {actions.map(action => ( <Button key={action.label} variant={action.variant ?? "ghost"} size="icon" onClick={action.onClick} className={cn("h-8 w-8 p-0", action.className)} aria-label={action.label} disabled={action.disabled} > <action.icon className="h-4 w-4"/> </Button> ))} </div> )}
    </div>
  );
});
ShiftListItem.displayName = 'ShiftListItem';

interface AddShiftDialogProps { onShiftAdded: () => void; }
const AddShiftDialog: React.FC<AddShiftDialogProps> = ({ onShiftAdded }) => {
  const { toast } = useToast();
  const [dates, setDates] = useState<Date[]>([]);
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("19:00");
  const [numberOfVacancies, setNumberOfVacancies] = useState<string>("1");
  const [isLoadingAdd, setIsLoadingAdd] = useState(false);
  const [specialtyPopoverOpen, setSpecialtyPopoverOpen] = useState(false);
  const [requiredSpecialties, setRequiredSpecialties] = useState<string[]>([]);
  const [specialtySearchValue, setSpecialtySearchValue] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<string>("");
  const [offeredRateInput, setOfferedRateInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const resetFormFields = useCallback(() => { setDates([]); setStartTime("07:00"); setEndTime("19:00"); setNumberOfVacancies("1"); setRequiredSpecialties([]); setSpecialtySearchValue(""); setTimeError(null); setSelectedState(""); setSelectedCity(""); setAvailableCities([]); setSelectedServiceType(""); setOfferedRateInput(""); setNotes(""); }, []);
  const validateTimes = useCallback((start: string, end: string) => { if (start && end && start === end ) { setTimeError("Início não pode ser igual ao término."); } else { setTimeError(null); } }, []);
  useEffect(() => { validateTimes(startTime, endTime); }, [startTime, endTime, validateTimes]);
  useEffect(() => { if (selectedState) setAvailableCities(citiesByState[selectedState] || []); else setAvailableCities([]); setSelectedCity(""); }, [selectedState]);
  const handleSelectRequiredSpecialty = (specialty: string) => { if (!requiredSpecialties.includes(specialty)) setRequiredSpecialties([...requiredSpecialties, specialty]); setSpecialtySearchValue(""); setSpecialtyPopoverOpen(false); };
  const handleRemoveRequiredSpecialty = (specialtyToRemove: string) => { setRequiredSpecialties(prev => prev.filter((s) => s !== specialtyToRemove)); };
  const filteredSpecialties = useMemo(() => medicalSpecialties.filter(s => typeof s === 'string' && s.toLowerCase().includes(specialtySearchValue.toLowerCase()) && !requiredSpecialties.includes(s)), [specialtySearchValue, requiredSpecialties]);
  const applyQuickShiftTime = (start: string, end: string) => { setStartTime(start); setEndTime(end); };

  const handleAddShiftSubmit = async () => {
    const offeredRate = parseFloat(offeredRateInput.replace(',', '.'));
    const numVacancies = parseInt(numberOfVacancies, 10);

    if (dates.length === 0) { toast({title:"Datas são obrigatórias", description: "Por favor, selecione pelo menos uma data para a demanda.", variant: "destructive"}); return; }
    if (timeError) { toast({title:"Horário Inválido", description: timeError, variant: "destructive"}); return; }
    if (!selectedServiceType) { toast({title:"Tipo de Atendimento Obrigatório", description: "Selecione o tipo de atendimento.", variant: "destructive"}); return; }
    if (isNaN(offeredRate) || offeredRate <= 0) { toast({title:"Valor Hora Inválido", description: "O valor da hora deve ser maior que zero.", variant: "destructive"}); return; }
    if (isNaN(numVacancies) || numVacancies <= 0) { toast({title:"Número de Profissionais Inválido", description: "Informe um número de profissionais maior que zero.", variant: "destructive"}); return; }
    if (!selectedState || !selectedCity) { toast({title:"Localização Obrigatória", description: "Selecione o estado e a cidade da demanda.", variant: "destructive"}); return; }

    setIsLoadingAdd(true);
    const currentUser = auth.currentUser;
    if (!currentUser) { toast({ title: "Usuário não autenticado", description: "Por favor, faça login novamente.", variant: "destructive"}); setIsLoadingAdd(false); return; }

    const dateTimestamps: Timestamp[] = dates.map(date => Timestamp.fromDate(date));
    const isOvernightShift = startTime > endTime;

    const shiftDataPayload: ShiftFormPayload = {
      publishedByUID: currentUser.uid,
      dates: dateTimestamps,
      startTime, endTime, isOvernight: isOvernightShift,
      state: selectedState, city: selectedCity,
      serviceType: selectedServiceType, specialtiesRequired: requiredSpecialties,
      offeredRate, numberOfVacancies: numVacancies,
      ...(notes.trim() && { notes: notes.trim() }),
    };

    try {
      await addShiftRequirement(shiftDataPayload);
      toast({
        title: "Demanda de Plantão Publicada!",
        description: `Sua demanda cobrindo ${dates.length} dia(s) com ${numVacancies} profissional(is) por dia foi publicada.`,
        variant: "default"
      });
      resetFormFields();
      onShiftAdded();
    } catch (err:any) {
      console.error(`Falha ao publicar demanda:`, err);
      toast({ title: `Erro ao Publicar Demanda`, description: err.message || "Ocorreu um erro desconhecido.", variant: "destructive"});
    } finally {
      setIsLoadingAdd(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl md:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="text-xl">Publicar Nova Demanda de Plantão</DialogTitle>
        <DialogDescription>Defina os critérios para a demanda. Ela será criada para todos os dias selecionados, e o "Número de Profissionais" se aplica a cada um desses dias.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-5 py-4 max-h-[70vh] overflow-y-auto px-1 pr-3 md:pr-4 custom-scrollbar">
        <div className="space-y-2">
          <Label className="font-semibold text-gray-800 flex items-center"><CalendarDays className="h-4 w-4 mr-2 text-blue-600"/>Data(s) da Demanda*</Label>
          <p className="text-xs text-gray-500">Selecione um ou mais dias no calendário.</p>
          <div className="flex flex-col sm:flex-row gap-2 items-start">
            <Calendar
              mode="multiple" selected={dates} onSelect={(selectedDays) => setDates(selectedDays || [])}
              disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
              className="p-0 border rounded-md shadow-sm bg-white w-full sm:w-auto"
              footer={ dates.length > 0 ? <p className="text-xs text-blue-700 font-medium p-2 border-t">{dates.length} dia(s) selecionado(s).</p> : <p className="text-xs text-gray-500 p-2 border-t">Nenhum dia selecionado.</p> }
            />
            {dates.length > 0 && <Button variant="outline" size="sm" onClick={() => setDates([])} className="text-xs self-start sm:self-end w-full sm:w-auto"><X className="h-3 w-3 mr-1"/> Limpar Datas</Button>}
          </div>
        </div>
        <div className="space-y-2">
            <Label className="font-semibold text-gray-800 flex items-center"><Clock className="h-4 w-4 mr-2 text-blue-600"/>Horário da Demanda*</Label>
            <div className="flex flex-wrap gap-2 mb-3">
                <Button variant="outline" size="sm" onClick={() => applyQuickShiftTime("07:00", "19:00")} className="text-xs">Diurno (07-19h)</Button>
                <Button variant="outline" size="sm" onClick={() => applyQuickShiftTime("19:00", "07:00")} className="text-xs">Noturno (19-07h)</Button>
                <Button variant="outline" size="sm" onClick={() => applyQuickShiftTime("08:00", "12:00")} className="text-xs">Manhã (08-12h)</Button>
                <Button variant="outline" size="sm" onClick={() => applyQuickShiftTime("13:00", "18:00")} className="text-xs">Tarde (13-18h)</Button>
                <Button variant="outline" size="sm" onClick={() => applyQuickShiftTime("00:00", "23:30")} className="text-xs">Dia Inteiro (24h)</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label htmlFor="start-time-modal">Horário de Início*</Label><Select value={startTime} onValueChange={setStartTime}><SelectTrigger id="start-time-modal" className={cn("h-9", timeError && "border-red-500 ring-1 ring-red-500")}><SelectValue/></SelectTrigger><SelectContent>{timeOptions.map(t=><SelectItem key={"st"+t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="end-time-modal">Horário de Término*</Label><Select value={endTime} onValueChange={setEndTime}><SelectTrigger id="end-time-modal" className={cn("h-9", timeError && "border-red-500 ring-1 ring-red-500")}><SelectValue/></SelectTrigger><SelectContent>{timeOptions.map(t=><SelectItem key={"et"+t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                {timeError && <p className="text-red-600 text-xs col-span-1 sm:col-span-2">{timeError}</p>}
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="state-modal" className="font-semibold text-gray-800 flex items-center"><MapPin className="h-4 w-4 mr-2 text-blue-600"/>Estado*</Label><Select value={selectedState} onValueChange={setSelectedState}><SelectTrigger id="state-modal" className="h-9"><SelectValue placeholder="Selecione o UF..."/></SelectTrigger><SelectContent>{brazilianStates.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="city-modal" className="font-semibold text-gray-800">Cidade*</Label><Select value={selectedCity} onValueChange={setSelectedCity} disabled={!selectedState||availableCities.length === 0}><SelectTrigger id="city-modal" className="h-9"><SelectValue placeholder={!selectedState?"Primeiro escolha o UF":(!availableCities.length?"Nenhuma cidade para este UF":"Selecione a cidade...")}/></SelectTrigger><SelectContent>{availableCities.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)} {selectedState && availableCities.length === 0 && <p className="p-2 text-xs text-gray-500">Nenhuma cidade cadastrada para {selectedState}.</p>}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label htmlFor="service-type-modal" className="font-semibold text-gray-800 flex items-center"><Briefcase className="h-4 w-4 mr-2 text-blue-600"/>Tipo de Atendimento*</Label><Select value={selectedServiceType} onValueChange={setSelectedServiceType}><SelectTrigger id="service-type-modal" className="h-9"><SelectValue placeholder="Selecione..."/></SelectTrigger><SelectContent>{serviceTypesOptions.map(o=><SelectItem key={o.value} value={o.value}>{o.label} <span className="text-xs text-gray-500 ml-1"> (Ref: {formatCurrency(o.rateExample)}/h)</span></SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="offered-rate-modal" className="font-semibold text-gray-800 flex items-center"><DollarSign className="h-4 w-4 mr-2 text-green-600"/>Valor Hora Oferecido (R$)*</Label><Input id="offered-rate-modal" type="number" min="0.01" step="0.01" placeholder="Ex: 150.00" value={offeredRateInput} onChange={(e)=>setOfferedRateInput(e.target.value)} className="h-9"/></div>
            <div className="space-y-1.5"><Label htmlFor="num-vacancies-modal" className="font-semibold text-gray-800 flex items-center"><Users className="h-4 w-4 mr-2 text-blue-600"/>Profissionais Necessários (por data/horário)*</Label><Input id="num-vacancies-modal" type="number" min="1" step="1" placeholder="1" value={numberOfVacancies} onChange={(e)=>setNumberOfVacancies(e.target.value)} className="h-9"/></div>
        </div>
        <div className="space-y-2">
            <Label className="font-semibold text-gray-800 flex items-center"><ClipboardList className="h-4 w-4 mr-2 text-blue-600"/>Especialidades Requeridas <span className="text-xs text-gray-500 ml-1 font-normal">(Opcional)</span></Label>
            <Popover open={specialtyPopoverOpen} onOpenChange={setSpecialtyPopoverOpen}>
                <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal text-muted-foreground h-9 border-dashed hover:border-solid">{requiredSpecialties.length > 0 ? `Selecionadas: ${requiredSpecialties.length}` : "Clique para selecionar especialidades..."}</Button></PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command filter={(value, search) => medicalSpecialties.find(s => s.toLowerCase() === value.toLowerCase())?.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}><CommandInput placeholder="Buscar especialidade..." value={specialtySearchValue} onValueChange={setSpecialtySearchValue}/><CommandList><CommandEmpty>Nenhuma especialidade encontrada.</CommandEmpty><CommandGroup heading={`${filteredSpecialties.length} encontradas`}>{filteredSpecialties.map((s) => (<CommandItem key={s} value={s} onSelect={() => handleSelectRequiredSpecialty(s)} className="cursor-pointer hover:bg-accent">{s}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
            </Popover>
            {requiredSpecialties.length > 0 && ( <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-dashed"> {requiredSpecialties.map((s) => ( <Badge key={s} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-normal"> {s} <button type="button" onClick={()=>handleRemoveRequiredSpecialty(s)} className="ml-1.5 p-0.5 rounded-full outline-none focus:ring-1 focus:ring-blue-500 hover:bg-blue-200"> <X className="h-3 w-3 text-blue-600 hover:text-blue-800" /> </button> </Badge> ))} </div> )}
        </div>
        <div className="space-y-1.5">
            <Label htmlFor="notes-modal" className="font-semibold text-gray-800 flex items-center"><Info className="h-4 w-4 mr-2 text-blue-600"/>Notas Adicionais <span className="text-xs text-gray-500 ml-1 font-normal">(Opcional)</span></Label>
            <Textarea id="notes-modal" placeholder="Ex: Necessário possuir certificação X, detalhes sobre a unidade, etc." value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[80px]"/>
        </div>
      </div>
      <DialogFooter className="mt-2 pt-4 border-t bg-slate-50 -m-6 px-6 pb-4 rounded-b-lg">
        <DialogClose asChild><Button type="button" variant="outline" disabled={isLoadingAdd}>Cancelar</Button></DialogClose>
        <Button type="button" onClick={handleAddShiftSubmit} disabled={isLoadingAdd || dates.length === 0} className="bg-blue-600 hover:bg-blue-700">
            {isLoadingAdd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoadingAdd ? `Publicando...` : `Publicar Demanda (${dates.length || 0} Dia(s))`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
// --- FIM DOS COMPONENTES AUXILIARES ---