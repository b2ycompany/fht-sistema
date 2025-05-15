// app/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"; // <<< ADICIONADO CardFooter
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { 
    ArrowRight, 
    CalendarCheck, 
    FileClock, 
    BellDot, 
    Briefcase, 
    Clock, 
    DollarSign, 
    MapPinIcon,
    MessageSquare, // <<< ADICIONADO
    CalendarDays  // <<< ADICIONADO
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

// Serviços
import { getPendingProposalsForDoctor, type ShiftProposal } from '@/lib/proposal-service';
import { getContractsForDoctor, type Contract } from '@/lib/contract-service';
import { getTimeSlots, type TimeSlot } from '@/lib/availability-service';
import { useAuth } from '@/components/auth-provider';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast"; // <<< ADICIONADO
// Assumindo que você tem esses componentes de estado globais ou definidos em outro lugar
// Se não, precisaremos defini-los aqui ou ajustar.
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state-indicators'; 

interface DashboardStats {
  pendingProposals: number;
  upcomingShifts: number;
  totalAvailabilitySlots: number;
}

interface UpcomingShiftDisplay extends Contract {
    displayDate: string;
    displayTime: string;
}
interface PendingProposalDisplay extends ShiftProposal {
    displayDate: string;
    displayTime: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast(); // Inicializado

  const [stats, setStats] = useState<DashboardStats>({ pendingProposals: 0, upcomingShifts: 0, totalAvailabilitySlots: 0 });
  const [upcomingShifts, setUpcomingShifts] = useState<UpcomingShiftDisplay[]>([]);
  const [pendingProposals, setPendingProposals] = useState<PendingProposalDisplay[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log("[DashboardPage] Fetching dashboard data...");
    try {
      // Para getContractsForDoctor, precisamos passar um array de status
      // Para "próximos plantões", geralmente seriam os 'ACTIVE_SIGNED'
      const activeContracts = await getContractsForDoctor(['ACTIVE_SIGNED']);
      const proposals = await getPendingProposalsForDoctor();
      const availabilities = await getTimeSlots();

      setStats({
        pendingProposals: proposals.length,
        upcomingShifts: activeContracts.length, // Contagem de contratos ativos
        totalAvailabilitySlots: availabilities.length,
      });

      const formattedUpcomingShifts = activeContracts
        .sort((a, b) => (a.shiftDates?.[0]?.toDate()?.getTime() || 0) - (b.shiftDates?.[0]?.toDate()?.getTime() || 0))
        .slice(0, 3)
        .map(contract => ({
          ...contract,
          displayDate: contract.shiftDates?.[0] instanceof Timestamp ? contract.shiftDates[0].toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'N/A',
          displayTime: `${contract.startTime} - ${contract.endTime}`,
        }));
      setUpcomingShifts(formattedUpcomingShifts);

      const formattedPendingProposals = proposals
        .sort((a,b) => (a.createdAt?.toDate()?.getTime() || 0) - (b.createdAt?.toDate()?.getTime() || 0)) // Ordenar por data de criação
        .slice(0, 3)
        .map(proposal => ({
            ...proposal,
            displayDate: proposal.shiftDates?.[0] instanceof Timestamp ? proposal.shiftDates[0].toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'N/A',
            displayTime: `${proposal.startTime} - ${proposal.endTime}`,
        }));
      setPendingProposals(formattedPendingProposals);

      console.log("[DashboardPage] Dashboard data fetched/processed. Upcoming shifts:", formattedUpcomingShifts.length, "Pending proposals:", formattedPendingProposals.length);

    } catch (err: any) {
      console.error("[DashboardPage] Error fetching dashboard data:", err);
      setError("Falha ao carregar dados do dashboard. Tente recarregar a página.");
      toast({ title: "Erro no Dashboard", description: err.message || "Não foi possível buscar os dados.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  // Adicione user?.uid às dependências se as funções de serviço dependem implicitamente do usuário logado via `auth.currentUser`
  // e você quer re-buscar se o usuário mudar (embora o layout já deva lidar com logout).
  }, [toast, user]); 

  useEffect(() => {
    if (user) { // Só busca dados se o usuário (do AuthProvider) estiver carregado
        console.log("[DashboardPage] User detected, calling fetchDashboardData.");
        fetchDashboardData();
    } else {
        console.log("[DashboardPage] No user from AuthProvider yet, or user is null.");
        // Se for o caso de usuário null e authLoading for false, o layout já deve ter redirecionado.
        // Mas se chegou aqui sem usuário, não busca os dados.
        setIsLoading(false); // Para de carregar se não houver usuário
    }
  }, [user, fetchDashboardData]);

  if (isLoading) {
    return <div className="p-6"><LoadingState message="Carregando seu dashboard..." /></div>;
  }
  if (error && !isLoading) { // Mostra erro apenas se não estiver mais carregando
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
            <p className="text-sm text-amber-700">Há {stats.pendingProposals} proposta(s) de plantão aguardando sua avaliação.</p>
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
            <div className="text-2xl font-bold">{stats.pendingProposals}</div>
            <p className="text-xs text-muted-foreground">Aguardando sua resposta</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos Plantões Confirmados</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingShifts}</div>
            <p className="text-xs text-muted-foreground">Contratos ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horários Disponíveis</CardTitle>
            <FileClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAvailabilitySlots}</div>
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