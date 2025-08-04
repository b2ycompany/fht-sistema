// app/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { 
    ArrowRight, CalendarCheck, FileClock, Briefcase, Clock, MapPinIcon, 
    FileSignature, Truck, ClipboardList, Loader2, RotateCcw, 
    CalendarDays
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

import { getContractsForDoctor, type Contract } from '@/lib/contract-service';
import { getTimeSlots, type TimeSlot } from '@/lib/availability-service';
import { useAuth } from '@/components/auth-provider';
import { useToast } from "@/hooks/use-toast";
import { getCurrentUserData, type DoctorProfile, UserProfile } from '@/lib/auth-service'; 
import ProfileStatusAlert, { type ProfileStatus } from '@/components/ui/ProfileStatusAlert'; 

// Componentes de Estado (Loading, Empty, Error)
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex items-center justify-center py-10 text-sm text-gray-500"><Loader2 className="h-6 w-6 animate-spin mr-2"/>{message}</div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message }: { message: string }) => ( <div className="text-center py-10"><ClipboardList className="mx-auto h-12 w-12 text-gray-400"/><h3 className="mt-2 text-sm font-semibold text-gray-900">{message}</h3></div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void; }) => ( <div className="text-center py-10 bg-red-50 p-4 rounded-md border border-red-200"><RotateCcw className="mx-auto h-10 w-10 text-red-400"/><h3 className="mt-2 text-sm font-semibold text-red-700">{message}</h3>{onRetry && <Button variant="destructive" onClick={onRetry} size="sm" className="mt-3"><RotateCcw className="mr-2 h-4 w-4"/>Tentar Novamente</Button>}</div> ));
ErrorState.displayName = 'ErrorState';

interface DashboardStats {
  pendingSignatureContractsCount: number;
  upcomingShiftsCount: number;
  totalAvailabilitySlotsCount: number;
}

interface UpcomingShiftDisplayItem extends Contract {
    displayDate: string;
    displayTime: string;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [stats, setStats] = useState<DashboardStats>({ pendingSignatureContractsCount: 0, upcomingShiftsCount: 0, totalAvailabilitySlotsCount: 0 });
  const [upcomingShifts, setUpcomingShifts] = useState<UpcomingShiftDisplayItem[]>([]);
  const [pendingSignatureContracts, setPendingSignatureContracts] = useState<Contract[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
        setIsLoading(false); 
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [pendingContractsData, activeContractsData, availabilitiesData, currentProfileData] = await Promise.all([
        getContractsForDoctor(['PENDING_DOCTOR_SIGNATURE']),
        getContractsForDoctor(['ACTIVE_SIGNED']),
        getTimeSlots(),
        getCurrentUserData() 
      ]);

      // --- CORREÇÃO: Verifica 'userType' em vez de 'role' ---
      if (currentProfileData?.userType === 'doctor') {
        setDoctorProfile(currentProfileData as DoctorProfile);
      }

      setStats({
        pendingSignatureContractsCount: pendingContractsData.length,
        upcomingShiftsCount: activeContractsData.length,
        totalAvailabilitySlotsCount: availabilitiesData.length,
      });

      setPendingSignatureContracts(pendingContractsData);

      const formattedUpcomingShifts: UpcomingShiftDisplayItem[] = activeContractsData
        .sort((a, b) => (a.shiftDates?.[0]?.toDate()?.getTime() || 0) - (b.shiftDates?.[0]?.toDate()?.getTime() || 0))
        .slice(0, 3)
        .map(contract => ({
          ...contract,
          displayDate: contract.shiftDates?.[0] instanceof Timestamp ? contract.shiftDates[0].toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
          displayTime: `${contract.startTime} - ${contract.endTime}`,
        }));
      setUpcomingShifts(formattedUpcomingShifts);

    } catch (err: any) {
      setError("Falha ao carregar dados do dashboard.");
      toast({ title: "Erro no Dashboard", description: err.message || "Não foi possível buscar os dados.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]); 

  useEffect(() => {
    if (authLoading) {
        setIsLoading(true);
        return;
    }
    if (user) {
        fetchDashboardData();
    } else {
        setIsLoading(false);
    }
  }, [user, authLoading, fetchDashboardData]);

  if (isLoading || authLoading) {
    return <div className="p-6"><LoadingState message="Carregando seu dashboard..." /></div>;
  }
  
  if (error && !isLoading) {
    return <div className="p-6"><ErrorState message={error} onRetry={fetchDashboardData} /></div>;
  }
  
  const doctorEditProfileLink = "/dashboard/profile/edit"; 

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Bem-vindo(a) de volta, {doctorProfile?.displayName || 'Doutor(a)'}!</h1>

      {doctorProfile && (
        <ProfileStatusAlert 
          status={doctorProfile.documentVerificationStatus as ProfileStatus | undefined}
          adminNotes={doctorProfile.adminVerificationNotes}
          userType="doctor"
          editProfileLink={doctorEditProfileLink}
        />
      )}

      {pendingSignatureContracts.length > 0 && (
        <Card className="bg-indigo-50 border-indigo-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg text-indigo-800 flex items-center"><FileSignature className="mr-2 h-5 w-5"/> Você tem Contratos para Assinar!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-indigo-700">Há {stats.pendingSignatureContractsCount} contrato(s) de plantão aguardando sua assinatura digital para serem confirmados.</p>
          </CardContent>
          <CardFooter>
            <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Link href="/dashboard/contracts?tab=pending_doctor">Rever e Assinar Contratos <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardFooter>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Projetos da Saúde</h2>
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Truck size={22}/> Caravana da Saúde</CardTitle>
                    <CardDescription>Acesse a fila de atendimentos de telemedicina para o projeto da caravana.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">Clique no botão abaixo para visualizar os pacientes que aguardam por você e iniciar os atendimentos.</p>
                </CardContent>
                <CardFooter>
                     <Button asChild className="w-full sm:w-auto">
                        <Link href="/dashboard/fila">
                            <ArrowRight className="mr-2 h-4 w-4" /> Acessar Fila de Atendimento
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos para Assinar</CardTitle>
            <FileSignature className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingSignatureContractsCount}</div>
            <p className="text-xs text-muted-foreground">Aguardando sua assinatura</p>
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

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Seus Próximos Plantões</CardTitle>
            <CardDescription>Estes são seus plantões já confirmados e agendados.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <LoadingState/> : upcomingShifts.length > 0 ? (
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
              <EmptyState message="Nenhum plantão confirmado agendado."/>
            )}
             <Button variant="link" asChild className="p-0 h-auto mt-3 text-sm"><Link href="/dashboard/contracts">Ver todos os seus contratos</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}