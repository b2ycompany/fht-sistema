"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Users, Truck, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from "@/hooks/use-toast";
import { type DoctorProfile } from '@/lib/auth-service';
import ProfileStatusAlert, { type ProfileStatus } from '@/components/ui/ProfileStatusAlert';
import { listenToServiceQueue, type ServiceQueueEntry } from '@/lib/patient-service';
import { createConsultationFromQueue } from '@/lib/consultation-service';

const ServiceQueueCard = () => {
    const { userProfile } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [queue, setQueue] = useState<ServiceQueueEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isStartingConsultation, setIsStartingConsultation] = useState<string | null>(null);

    useEffect(() => {
        const doctorProfile = userProfile as DoctorProfile;
        if (doctorProfile?.healthUnitIds && doctorProfile.healthUnitIds.length > 0) {
            const unitId = doctorProfile.healthUnitIds[0];
            const unsubscribe = listenToServiceQueue(unitId, 'Aguardando Atendimento', (entries) => {
                setQueue(entries);
                setIsLoading(false);
            });
            return () => unsubscribe();
        } else {
            setIsLoading(false);
        }
    }, [userProfile]);

    const handleStartConsultation = async (queueEntry: ServiceQueueEntry) => {
        if (!userProfile) return;
        setIsStartingConsultation(queueEntry.id);
        try {
            const doctorInfo = { uid: userProfile.uid, displayName: userProfile.displayName };
            const consultationId = await createConsultationFromQueue(queueEntry, doctorInfo);
            router.push(`/dashboard/atendimento/${consultationId}`);
        } catch(error: any) {
            toast({ title: "Erro ao iniciar consulta", description: error.message, variant: "destructive" });
            setIsStartingConsultation(null);
        }
    };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users size={22}/> Fila de Atendimento Presencial</CardTitle>
                <CardDescription>Pacientes que passaram pela triagem e aguardam por si.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                {isLoading ? <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : 
                 queue.length > 0 ? (
                    <div className="space-y-2">
                        {queue.map(entry => (
                            <div key={entry.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-md">
                                <div>
                                    <p className="font-bold text-blue-800">{entry.ticketNumber}</p>
                                    <p className="text-sm font-semibold">{entry.patientName}</p>
                                </div>
                                <Button size="sm" onClick={() => handleStartConsultation(entry)} disabled={!!isStartingConsultation}>
                                    {isStartingConsultation === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar Atendimento"}
                                </Button>
                            </div>
                        ))}
                    </div>
                 ) : <p className="text-center text-sm text-muted-foreground pt-8">Nenhum paciente na fila no momento.</p>
                }
            </CardContent>
        </Card>
    );
};

export default function DashboardPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
        setIsLoading(false);
    }
  }, [authLoading]);

  if (authLoading || isLoading) {
    return <div className="p-6 flex justify-center items-center h-screen"><Loader2 className="mx-auto h-10 w-10 animate-spin" /></div>;
  }
  
  if (!userProfile) {
    return <div className="p-6 text-center">Não foi possível carregar o perfil do utilizador.</div>;
  }
  
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Bem-vindo(a) de volta, {userProfile.displayName}!</h1>
      <ProfileStatusAlert status={(userProfile as DoctorProfile).documentVerificationStatus as ProfileStatus | undefined} userType="doctor"/>
      <div className="grid gap-6 md:grid-cols-2">
        <ServiceQueueCard />
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Truck size={22}/> Caravana da Saúde</CardTitle>
                <CardDescription>Acesse a fila de atendimentos de telemedicina para o projeto.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow"><p className="text-sm text-muted-foreground">Clique para visualizar os pacientes que aguardam por você.</p></CardContent>
            <CardFooter><Button asChild className="w-full sm:w-auto"><Link href="/dashboard/fila">Acessar Fila de Atendimento</Link></Button></CardFooter>
        </Card>
      </div>
    </div>
  );
}