// app/dashboard/page.tsx (Código Completo e Corrigido)
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { Loader2, Hospital, Monitor, Users, LogIn, Video } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from "@/hooks/use-toast";
import { type DoctorProfile } from '@/lib/auth-service';
import ProfileStatusAlert, { type ProfileStatus } from '@/components/ui/ProfileStatusAlert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';

// --- Importações Corrigidas ---
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns'; // <<< CORREÇÃO: Importa 'format'
import { ptBR } from 'date-fns/locale'; // <<< CORREÇÃO: Importa 'ptBR'
import { Badge } from "@/components/ui/badge"; // <<< CORREÇÃO: Importa 'Badge'

// ===================================================================
// 🔹 CORREÇÃO: Definição da interface 'Appointment' 🔹
// Esta interface estava em falta, causando os erros de tipo.
// Ela é baseada no que é criado no logic.ts (telemedicina) e agendamento/page.tsx (presencial).
// ===================================================================
export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  type: 'Presencial' | 'Telemedicina';
  appointmentDate: Timestamp; // Usando o tipo Timestamp do Firebase
  createdAt: Timestamp;
  createdBy: string;
  telemedicineRoomUrl?: string;
  aiAnalysisReport?: string; // O relatório da IA que já está a ser gerado
}
// ===================================================================

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
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [queue, setQueue] = useState<Appointment[]>([]); // <<< CORREÇÃO: Usa a interface Appointment
    const [isLoading, setIsLoading] = useState(true);
    const [isStartingConsultation, setIsStartingConsultation] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.uid || !userProfile) {
            setIsLoading(false);
            return;
        }

        let q;
        const doctorProfile = userProfile as DoctorProfile;

        // Lógica de query baseada no tipo de atendimento
        if (attendanceType === 'Telemedicina') {
            // FILA DE TELEMEDICINA: Puxa pelas especialidades do médico
            if (!doctorProfile.specialties || doctorProfile.specialties.length === 0) {
                setIsLoading(false);
                return; // Médico não tem especialidades, a fila ficará vazia
            }
            q = query(
                collection(db, "appointments"),
                where("specialty", "in", doctorProfile.specialties),
                where("type", "==", "Telemedicina"),
                where("status", "==", "SCHEDULED"),
                orderBy("appointmentDate", "asc")
            );
        } else {
            // FILA PRESENCIAL: Puxa pelo ID do médico
            q = query(
                collection(db, "appointments"),
                where("doctorId", "==", user.uid),
                where("type", "==", "Presencial"),
                where("status", "==", "SCHEDULED"),
                orderBy("appointmentDate", "asc")
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
            setQueue(entries);
            setIsLoading(false);
        }, (error) => {
            console.error(`Erro ao buscar fila ${attendanceType}:`, error);
            toast({ title: "Erro na Fila", description: `Não foi possível carregar a fila de ${attendanceType}.`, variant: "destructive"});
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, userProfile, attendanceType, toast]);

    // ===================================================================
    // 🔹 CORREÇÃO: Fluxo de Atendimento 🔹
    // Esta função agora atualiza o status e redireciona para o prontuário.
    // ===================================================================
    const handleStartConsultation = async (appointment: Appointment) => {
        if (!userProfile) return;
        setIsStartingConsultation(appointment.id);
        
        try {
            // 1. Atualiza o status do agendamento para "Em Andamento"
            const appRef = doc(db, "appointments", appointment.id);
            await updateDoc(appRef, {
                status: "IN_PROGRESS",
                doctorId: userProfile.uid // Garante que o médico seja atribuído (especialmente em telemedicina)
            });
            
            // 2. Redireciona o médico para a TELA DE ATENDIMENTO (Prontuário)
            // É nesta tela que ele verá o Relatório da IA e o link do Daily.co
            router.push(`/dashboard/atendimento/${appointment.id}`);

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
                {/* O seletor de Unidade foi removido pois a query agora cuida disso */}
                {isLoading ? <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : 
                 queue.length > 0 ? (
                    <div className="space-y-2">{queue.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-md border border-blue-200">
                            <div>
                                <p className="text-sm font-semibold">{entry.patientName}</p>
                                <p className="text-xs text-gray-600">
                                    {/* <<< CORREÇÃO: 'format' e 'ptBR' agora estão importados >>> */}
                                    Agendado para: {format(entry.appointmentDate.toDate(), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                </p>
                                {/* <<< CORREÇÃO: 'Badge' agora está importado >>> */}
                                <Badge variant="secondary" className="mt-1">{entry.specialty}</Badge>
                            </div>
                            <Button size="sm" onClick={() => handleStartConsultation(entry)} disabled={!!isStartingConsultation} className="bg-blue-600 hover:bg-blue-700">
                                {isStartingConsultation === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                                 (attendanceType === 'Telemedicina' ? <Video className="h-4 w-4 mr-2"/> : <LogIn className="h-4 w-4 mr-2"/>)
                                }
                                Iniciar
                            </Button>
                        </div>))}
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