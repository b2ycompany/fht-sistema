// app/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { 
    ArrowRight, CalendarCheck, FileClock, BellDot, Briefcase, Clock, DollarSign, MapPinIcon, 
    MessageSquare, Users, AlertTriangle as LucideAlertTriangle, ClipboardList, Loader2, RotateCcw, 
    CalendarDays
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

import { getPendingProposalsForDoctor, type ShiftProposal } from '@/lib/proposal-service';
import { getContractsForDoctor, type Contract } from '@/lib/contract-service';
import { getTimeSlots, type TimeSlot } from '@/lib/availability-service';
import { useAuth } from '@/components/auth-provider';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

// Componentes de Estado
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex items-center justify-center py-10 text-sm text-gray-500"><Loader2 className="h-6 w-6 animate-spin mr-2"/>{message}</div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message }: { message: string }) => ( <div className="text-center py-10"><ClipboardList className="mx-auto h-12 w-12 text-gray-400"/><h3 className="mt-2 text-sm font-semibold text-gray-900">{message}</h3></div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void; }) => ( <div className="text-center py-10 bg-red-50 p-4 rounded-md border border-red-200"><LucideAlertTriangle className="mx-auto h-10 w-10 text-red-400"/><h3 className="mt-2 text-sm font-semibold text-red-700">{message}</h3>{onRetry && <Button variant="destructive" onClick={onRetry} size="sm" className="mt-3"><RotateCcw className="mr-2 h-4 w-4"/>Tentar Novamente</Button>}</div> ));
ErrorState.displayName = 'ErrorState';


interface DashboardStats {
  pendingProposalsCount: number;
  upcomingShiftsCount: number;
  totalAvailabilitySlotsCount: number;
}

interface UpcomingShiftDisplayItem extends Contract {
    displayDate: string;
    displayTime: string;
}
interface PendingProposalDisplayItem extends ShiftProposal {
    displayDate: string;
    displayTime: string;
}


export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [stats, setStats] = useState<DashboardStats>({ pendingProposalsCount: 0, upcomingShiftsCount: 0, totalAvailabilitySlotsCount: 0 });
  const [upcomingShifts, setUpcomingShifts] = useState<UpcomingShiftDisplayItem[]>([]);
  const [pendingProposals, setPendingProposals] = useState<PendingProposalDisplayItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user) { // Adicionado para garantir que user existe
        console.log("[DashboardPage] User not available yet for fetching data.");
        setIsLoading(false); // Para o loading se não há usuário
        return;
    }
    setIsLoading(true);
    setError(null);
    console.log("[DashboardPage] Fetching dashboard data for user:", user.uid);
    try {
      // Buscar todos os dados em paralelo
      const [contractsData, proposalsData, availabilitiesData] = await Promise.all([
        getContractsForDoctor(['ACTIVE_SIGNED', 'PENDING_HOSPITAL_SIGNATURE']), // Para "Próximos Plantões"
        getPendingProposalsForDoctor(),
        getTimeSlots()
      ]);

      console.log("[DashboardPage] Data fetched - Contracts:", contractsData.length, "Proposals:", proposalsData.length, "Availabilities:", availabilitiesData.length);

      setStats({
        pendingProposalsCount: proposalsData.length,
        upcomingShiftsCount: contractsData.filter(c => c.status === 'ACTIVE_SIGNED').length,
        totalAvailabilitySlotsCount: availabilitiesData.length,
      });

      const formattedUpcomingShifts: UpcomingShiftDisplayItem[] = contractsData
        .filter(contract => contract.status === 'ACTIVE_SIGNED')
        .sort((a, b) => (a.shiftDates?.[0]?.toDate()?.getTime() || 0) - (b.shiftDates?.[0]?.toDate()?.getTime() || 0))
        .slice(0, 3)
        .map(contract => ({
          ...contract,
          displayDate: contract.shiftDates?.[0] instanceof Timestamp ? contract.shiftDates[0].toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
          displayTime: `${contract.startTime} - ${contract.endTime}`,
        }));
      setUpcomingShifts(formattedUpcomingShifts);

      const formattedPendingProposals: PendingProposalDisplayItem[] = proposalsData
        .sort((a,b) => (a.createdAt?.toDate()?.getTime() || 0) - (b.createdAt?.toDate()?.getTime() || 0))
        .slice(0, 3)
        .map(proposal => ({
            ...proposal,
            displayDate: proposal.shiftDates?.[0] instanceof Timestamp ? proposal.shiftDates[0].toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
            displayTime: `${proposal.startTime} - ${proposal.endTime}`,
        }));
      setPendingProposals(formattedPendingProposals);

      console.log("[DashboardPage] Dashboard data processed and states updated.");

    } catch (err: any) {
      console.error("[DashboardPage] Error fetching dashboard data:", err);
      setError("Falha ao carregar dados do dashboard.");
      toast({ title: "Erro no Dashboard", description: err.message || "Não foi possível buscar os dados.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]); // user é a dependência chave aqui

  useEffect(() => {
    if (user) { // Só busca dados se o usuário do AuthProvider estiver carregado
        console.log("[DashboardPage] User detected in useEffect, calling fetchDashboardData.");
        fetchDashboardData();
    } else {
        console.log("[DashboardPage] No user in useEffect (yet), dashboard data not fetched.");
        // Se authLoading também for false e user for null, significa que não há usuário logado.
        // Não precisa setar isLoading(false) aqui se o estado inicial já é true e o if não for atendido.
    }
  }, [user, fetchDashboardData]); // fetchDashboardData é useCallback e depende de 'user'

  if (isLoading) {
    return <div className="p-6"><LoadingState message="Carregando seu dashboard..." /></div>;
  }
  if (error && !isLoading) {
    return <div className="p-6"><ErrorState message={error} onRetry={fetchDashboardData} /></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Bem-vindo(a) de volta, {user?.displayName || 'Doutor(a)'}!</h1>

      {pendingProposals.length > 0 && (
        <Card className="bg-amber-50 border-amber-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg text-amber-800 flex items-center"><BellDot className="mr-2 h-5 w-5"/> Você tem Novas Propostas!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">Há {stats.pendingProposalsCount} proposta(s) de plantão aguardando sua avaliação.</p>
          </CardContent>
          <CardFooter>
            <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                <Link href="/dashboard/proposals">Ver Propostas <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propostas Pendentes</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingProposalsCount}</div>
            <p className="text-xs text-muted-foreground">Aguardando sua resposta</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos Plantões</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingShiftsCount}</div>
            <p className="text-xs text-muted-foreground">Contratos ativos e agendados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horários Disponíveis</CardTitle>
            <FileClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAvailabilitySlotsCount}</div>
            <p className="text-xs text-muted-foreground">Cadastrados por você</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Seus Próximos Plantões</CardTitle>
            <CardDescription>Plantões confirmados e agendados.</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingShifts.length > 0 ? (
              <ul className="space-y-3">
                {upcomingShifts.map(shift => (
                  <li key={shift.id} className="p-3 border rounded-md hover:bg-gray-50 text-sm">
                    <p className="font-semibold text-blue-700">{shift.hospitalName}</p>
                    <p className="text-xs text-gray-600 flex items-center"><MapPinIcon size={12} className="mr-1"/>{shift.locationCity}, {shift.locationState}</p>
                    <p className="text-xs text-gray-600 flex items-center"><CalendarDays size={12} className="mr-1"/>{shift.displayDate}</p>
                    <p className="text-xs text-gray-600 flex items-center"><Clock size={12} className="mr-1"/>{shift.displayTime}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum plantão confirmado agendado.</p>
            )}
             <Button variant="link" asChild className="p-0 h-auto mt-3 text-sm"><Link href="/dashboard/contracts?tab=active">Ver todos os contratos ativos</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Propostas Aguardando Sua Resposta</CardTitle>
            <CardDescription>Avalie e responda às oportunidades.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingProposals.length > 0 ? (
              <ul className="space-y-3">
                {pendingProposals.map(proposal => (
                  <li key={proposal.id} className="p-3 border rounded-md hover:bg-gray-50 text-sm">
                    <p className="font-semibold text-amber-700">{proposal.hospitalName}</p>
                    <p className="text-xs text-gray-600 flex items-center"><MapPinIcon size={12} className="mr-1"/>{proposal.hospitalCity}, {proposal.hospitalState}</p>
                    <p className="text-xs text-gray-600 flex items-center"><CalendarDays size={12} className="mr-1"/>{proposal.displayDate}</p>
                    <p className="text-xs text-gray-600 flex items-center"><Briefcase size={12} className="mr-1"/>{proposal.specialties.join(', ')}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma proposta pendente no momento.</p>
            )}
             <Button variant="link" asChild className="p-0 h-auto mt-3 text-sm"><Link href="/dashboard/proposals">Ver todas as propostas</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}