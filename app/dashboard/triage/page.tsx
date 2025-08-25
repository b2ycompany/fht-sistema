// app/dashboard/triage/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { listenToServiceQueue, startTriage, submitTriage, type ServiceQueueEntry, type TriageData } from '@/lib/patient-service';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Clock, ShieldAlert, HeartPulse } from 'lucide-react';
import { type UserType } from '@/lib/auth-service';
import { Timestamp } from 'firebase/firestore';

/**
 * Formulário para preenchimento dos dados de triagem.
 */
const TriageForm = ({ queueEntry, onTriageSubmit }: { queueEntry: ServiceQueueEntry, onTriageSubmit: () => void }) => {
    const { toast } = useToast();
    const [triageData, setTriageData] = useState<TriageData>({
        chiefComplaint: '', bloodPressure: '', temperature: '', heartRate: '', respiratoryRate: '', oxygenSaturation: '', notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setTriageData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        if (!triageData.chiefComplaint) {
            toast({ title: "Campo obrigatório", description: "A queixa principal é necessária.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await submitTriage(queueEntry.id, triageData);
            toast({ title: "Triagem Finalizada!", description: `${queueEntry.patientName} foi encaminhado(a) para o atendimento médico.` });
            onTriageSubmit();
        } catch(error: any) {
            toast({ title: "Erro ao Finalizar", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="chiefComplaint">Queixa Principal</Label><Textarea id="chiefComplaint" name="chiefComplaint" value={triageData.chiefComplaint} onChange={handleChange} /></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label htmlFor="bloodPressure">Pressão Arterial</Label><Input id="bloodPressure" name="bloodPressure" value={triageData.bloodPressure} onChange={handleChange} /></div>
                <div className="space-y-1.5"><Label htmlFor="temperature">Temperatura (°C)</Label><Input id="temperature" name="temperature" value={triageData.temperature} onChange={handleChange} /></div>
                <div className="space-y-1.5"><Label htmlFor="heartRate">Freq. Cardíaca (bpm)</Label><Input id="heartRate" name="heartRate" value={triageData.heartRate} onChange={handleChange} /></div>
                <div className="space-y-1.5"><Label htmlFor="respiratoryRate">Freq. Respiratória (rpm)</Label><Input id="respiratoryRate" name="respiratoryRate" value={triageData.respiratoryRate} onChange={handleChange} /></div>
                <div className="space-y-1.5"><Label htmlFor="oxygenSaturation">Saturação O₂ (%)</Label><Input id="oxygenSaturation" name="oxygenSaturation" value={triageData.oxygenSaturation} onChange={handleChange} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="notes">Outras Anotações</Label><Textarea id="notes" name="notes" value={triageData.notes} onChange={handleChange} /></div>
            <DialogFooter className="mt-4">
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HeartPulse className="mr-2 h-4 w-4" />}
                    Finalizar e Encaminhar para Atendimento
                </Button>
            </DialogFooter>
        </div>
    );
};


export default function TriagePage() {
    const { userProfile, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [queue, setQueue] = useState<ServiceQueueEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [triagePatient, setTriagePatient] = useState<ServiceQueueEntry | null>(null);

    useEffect(() => {
        if (userProfile?.hospitalId) {
            setIsLoading(true);
            const unsubscribe = listenToServiceQueue(userProfile.hospitalId, 'Aguardando Triagem', (entries) => {
                setQueue(entries);
                setIsLoading(false);
            });
            return () => unsubscribe();
        }
    }, [userProfile]);

    const handleCallPatient = async (queueEntry: ServiceQueueEntry) => {
        try {
            await startTriage(queueEntry.id, userProfile!.uid);
            setTriagePatient(queueEntry);
        } catch (error: any) {
            toast({ title: "Erro ao Chamar Paciente", description: error.message, variant: "destructive" });
        }
    };

    if (authLoading || !userProfile) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    }
    
    const allowedRoles: UserType[] = ['admin', 'triage_nurse', 'hospital'];
    if (!allowedRoles.includes(userProfile.userType)) {
        return (
            <div className="container mx-auto flex h-screen items-center justify-center p-8 text-center">
                 <Card className="w-full max-w-md border-red-500 bg-red-50"><CardHeader><CardTitle className="flex items-center justify-center gap-2 text-2xl text-red-700"><ShieldAlert className="h-8 w-8" />Acesso Negado</CardTitle></CardHeader></Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
            <h1 className="text-3xl font-bold">Painel de Triagem</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Fila de Pacientes Aguardando Triagem</CardTitle>
                    <CardDescription>Pacientes adicionados pela recepção aparecerão aqui em tempo real.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
                        queue.length > 0 ? (
                            <div className="divide-y">
                                {queue.map(entry => (
                                    <div key={entry.id} className="flex items-center justify-between p-4">
                                        <div>
                                            <p className="text-xl font-bold text-blue-700">{entry.ticketNumber}</p>
                                            <p className="font-semibold">{entry.patientName}</p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock size={12}/> Chegada: {(entry.createdAt as Timestamp).toDate().toLocaleTimeString('pt-BR')}
                                            </p>
                                        </div>
                                        <Button onClick={() => handleCallPatient(entry)}>Chamar para Triagem</Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-12">Nenhum paciente aguardando triagem no momento.</p>
                        )
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!triagePatient} onOpenChange={(isOpen) => !isOpen && setTriagePatient(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Triagem de Paciente: {triagePatient?.patientName} ({triagePatient?.ticketNumber})</DialogTitle>
                    </DialogHeader>
                    {triagePatient && <TriageForm queueEntry={triagePatient} onTriageSubmit={() => setTriagePatient(null)} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}