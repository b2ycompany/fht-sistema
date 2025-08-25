// app/dashboard/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { Loader2, Hospital, Monitor, Users } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from "@/hooks/use-toast";
import { type DoctorProfile, getUserProfile } from '@/lib/auth-service';
import ProfileStatusAlert, { type ProfileStatus } from '@/components/ui/ProfileStatusAlert';
import { listenToServiceQueue, type ServiceQueueEntry } from '@/lib/patient-service';
import { createConsultationFromQueue } from '@/lib/consultation-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';

type HealthUnitInfo = { id: string; name: string; };

/**
 * COMPONENTE REUTILIZÁVEL para exibir uma fila de atendimento.
 * Agora ele aceita o tipo de atendimento (Presencial ou Telemedicina) como propriedade.
 */
const AttendanceQueueCard = ({ 
    title,
    description,
    attendanceType,
    icon: Icon 
}: { 
    title: string, 
    description: string, 
    attendanceType: 'Presencial' | 'Telemedicina',
    icon: React.ElementType
}) => {
    const { userProfile } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [queue, setQueue] = useState<ServiceQueueEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isStartingConsultation, setIsStartingConsultation] = useState<string | null>(null);
    const [associatedUnits, setAssociatedUnits] = useState<HealthUnitInfo[]>([]);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

    useEffect(() => {
        const fetchAssociatedUnits = async () => {
            const doctorProfile = userProfile as DoctorProfile;
            if (doctorProfile?.healthUnitIds && doctorProfile.healthUnitIds.length > 0) {
                const unitPromises = doctorProfile.healthUnitIds.map(async (unitId) => {
                    const unitProfile = await getUserProfile(unitId);
                    return { id: unitId, name: unitProfile?.displayName || 'Unidade Desconhecida' };
                });
                const units = await Promise.all(unitPromises);
                setAssociatedUnits(units);
                if (units.length > 0) {
                    setSelectedUnitId(units[0].id);
                }
            }
        };
        fetchAssociatedUnits();
    }, [userProfile]);

    useEffect(() => {
        if (selectedUnitId) {
            setIsLoading(true);
            // Chama o serviço de escuta passando o TIPO de atendimento
            const unsubscribe = listenToServiceQueue(selectedUnitId, 'Aguardando Atendimento', attendanceType, (entries) => {
                setQueue(entries);
                setIsLoading(false);
            });
            return () => unsubscribe();
        } else {
            setQueue([]);
            setIsLoading(false);
        }
    }, [selectedUnitId, attendanceType]);

    const handleStartConsultation = async (queueEntry: ServiceQueueEntry) => {
        if (!userProfile) return;
        setIsStartingConsultation(queueEntry.id);
        try {
            const doctorInfo = { uid: userProfile.uid, displayName: userProfile.displayName };
            // Passa o nome da unidade para a função de criação da consulta
            const consultationId = await createConsultationFromQueue(queueEntry, doctorInfo, queueEntry.hospitalName);
            router.push(`/dashboard/atendimento/${consultationId}`);
        } catch(error: any) {
            toast({ title: "Erro ao iniciar consulta", description: error.message, variant: "destructive" });
            setIsStartingConsultation(null);
        }
    };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Icon size={22}/> {title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                {associatedUnits.length > 1 && (
                    <div className="mb-4 space-y-1.5"><Label htmlFor={`unit-selector-${attendanceType}`}>A trabalhar na unidade:</Label>
                        <Select value={selectedUnitId ?? ""} onValueChange={setSelectedUnitId}>
                            <SelectTrigger id={`unit-selector-${attendanceType}`} className="w-full"><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
                            <SelectContent>{associatedUnits.map(unit => (<SelectItem key={unit.id} value={unit.id}><div className="flex items-center gap-2"><Hospital className="h-4 w-4 text-muted-foreground" />{unit.name}</div></SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                )}
                {isLoading ? <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : 
                 queue.length > 0 ? (
                    <div className="space-y-2">{queue.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-md border border-blue-200">
                            <div><p className="font-bold text-xl text-blue-800">{entry.ticketNumber}</p><p className="text-sm font-semibold">{entry.patientName}</p></div>
                            <Button size="sm" onClick={() => handleStartConsultation(entry)} disabled={!!isStartingConsultation} className="bg-blue-600 hover:bg-blue-700">{isStartingConsultation === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar Atendimento"}</Button>
                        </div>))}
                    </div>
                 ) : <p className="text-center text-sm text-muted-foreground pt-8">Nenhum paciente na fila desta unidade no momento.</p>
                }
            </CardContent>
        </Card>
    );
};


export default function DashboardPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) { setIsLoading(false); }
  }, [authLoading]);

  if (authLoading || isLoading) { return <div className="p-6 flex justify-center items-center h-screen"><Loader2 className="mx-auto h-10 w-10 animate-spin" /></div>; }
  if (!userProfile) { return <div className="p-6 text-center">Não foi possível carregar o perfil do utilizador.</div>; }
  
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Bem-vindo(a) de volta, {userProfile.displayName}!</h1>
      <ProfileStatusAlert status={(userProfile as DoctorProfile).documentVerificationStatus as ProfileStatus | undefined} userType="doctor"/>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Renderiza o componente de fila para o tipo Presencial */}
        <AttendanceQueueCard
            title="Fila de Atendimento Presencial"
            description="Pacientes na unidade que aguardam por si."
            attendanceType="Presencial"
            icon={Users}
        />
        {/* Renderiza o mesmo componente para o tipo Telemedicina */}
        <AttendanceQueueCard
            title="Fila de Atendimento Telemedicina"
            description="Pacientes aguardando uma consulta remota."
            attendanceType="Telemedicina"
            icon={Monitor}
        />
      </div>
    </div>
  );
}