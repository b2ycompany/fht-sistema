// app/dashboard/fila/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { type DoctorProfile } from '@/lib/auth-service';

// --- TIPO CORRIGIDO ---
// Esta interface agora reflete a estrutura completa de uma consulta, resolvendo os erros.
interface Consultation {
    id: string;
    patientId: string;
    patientName: string;
    chiefComplaint: string;
    specialty: string;
    serviceType: 'Presencial' | 'Telemedicina';
    status: 'AGUARDANDO' | 'EM_ANDAMENTO' | 'FINALIZADO';
    createdAt: Timestamp; // Usando o tipo Timestamp do Firebase
    doctorId?: string;
    telemedicineLink?: string;
}

// Componentes da UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, UserPlus, LogIn, Video } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LoadingState = () => <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-blue-600" /></div>;
const EmptyQueueState = () => <div className="text-center p-10 bg-green-50 rounded-lg"><UserPlus className="mx-auto h-12 w-12 text-green-400" /><p className="mt-4 font-semibold text-green-800">Fila Vazia</p><p className="mt-2 text-sm text-green-600">Nenhum paciente aguardando atendimento em suas especialidades.</p></div>;

export default function DoctorQueuePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const functions = getFunctions();

    const [queue, setQueue] = useState<Consultation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleStartConsultation = async (consultation: Consultation) => {
        if (!user) return;
        setProcessingId(consultation.id);

        try {
            // Se for telemedicina, primeiro cria a sala
            if (consultation.serviceType === 'Telemedicina') {
                const createRoom = httpsCallable(functions, 'createConsultationRoom');
                const result = await createRoom({ consultationId: consultation.id });
                if (!(result.data as any).success) {
                    throw new Error("Falha ao obter o link da sala de telemedicina.");
                }
            }
            
            // Atualiza o status da consulta e atribui o médico
            const consultationRef = doc(db, "consultations", consultation.id);
            await updateDoc(consultationRef, {
                status: "EM_ANDAMENTO",
                doctorId: user.uid
            });
            
            // Redireciona para a sala de atendimento
            const redirectPath = `/atendimento/${consultation.id}`;
            router.push(redirectPath);

        } catch (error: any) {
            console.error("Erro ao iniciar atendimento:", error);
            toast({ title: "Erro", description: error.message || "Não foi possível iniciar o atendimento.", variant: "destructive" });
            setProcessingId(null);
        }
    };

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const fetchProfileAndSubscribe = async () => {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                console.error("Perfil do médico não encontrado.");
                setIsLoading(false); return;
            }
            
            const doctorProfile = userDoc.data() as DoctorProfile;
            const doctorSpecialties = doctorProfile.specialties;

            if (!doctorSpecialties || doctorSpecialties.length === 0) {
                console.error("Médico sem especialidades definidas no perfil.");
                setIsLoading(false);
                toast({ title: "Perfil Incompleto", description: "Nenhuma especialidade foi encontrada no seu perfil.", variant: "destructive" });
                return;
            }

            const q = query(
                collection(db, "consultations"),
                where("specialty", "in", doctorSpecialties),
                where("status", "==", "AGUARDANDO"),
                orderBy("createdAt", "asc")
            );

            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const waitingList: Consultation[] = [];
                querySnapshot.forEach((doc) => {
                    // O casting 'as Consultation' agora funciona porque a interface está completa
                    waitingList.push({ id: doc.id, ...doc.data() } as Consultation);
                });
                setQueue(waitingList);
                setIsLoading(false);
            }, (error) => {
                console.error("Erro ao escutar a fila:", error);
                setIsLoading(false);
            });

            return () => unsubscribe();
        };

        fetchProfileAndSubscribe();

    }, [user, toast]);

    if (isLoading) return <LoadingState />;

    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-3xl font-bold tracking-tight">Fila de Atendimento</h1>
                <p className="text-muted-foreground">Pacientes aguardando para suas especialidades. Chame o próximo da fila.</p>
            </div>

            {queue.length === 0 && !isLoading ? (
                <EmptyQueueState />
            ) : (
                <div className="space-y-4">
                    {queue.map((consultation) => (
                        <Card key={consultation.id} className="shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-xl">{consultation.patientName}</CardTitle>
                                        <CardDescription>
                                            Aguardando há {consultation.createdAt ? formatDistanceToNow(consultation.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : 'algum tempo'}
                                            <span className="font-semibold text-primary ml-2">({consultation.specialty})</span>
                                        </CardDescription>
                                    </div>
                                    <Button 
                                        onClick={() => handleStartConsultation(consultation)}
                                        disabled={processingId === consultation.id}
                                    >
                                        {processingId === consultation.id ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            consultation.serviceType === 'Telemedicina' ? 
                                            <Video className="mr-2 h-4 w-4"/> : <LogIn className="mr-2 h-4 w-4"/>
                                        )}
                                        Iniciar Atendimento
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm font-semibold">Queixa Principal:</p>
                                <p className="text-sm text-muted-foreground italic">"{consultation.chiefComplaint}"</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}