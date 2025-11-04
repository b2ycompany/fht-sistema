// app/dashboard/triage/page.tsx (CORRIGIDO E COMPLETO)
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { listenToServiceQueue, startTriage, submitTriage, type ServiceQueueEntry, type TriageData } from '@/lib/patient-service';
import { printWristband } from '@/lib/print-service'; // <<< IMPORTA O SERVIÇO DE IMPRESSÃO
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Clock, ShieldAlert, HeartPulse } from 'lucide-react';
import { type UserType } from '@/lib/auth-service';
import { Timestamp } from 'firebase/firestore';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; 

type SeverityLevel = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul';

// --- FORMULÁRIO DE TRIAGEM (MODIFICADO) ---
const TriageForm = ({ queueEntry, onTriageSubmit }: { queueEntry: ServiceQueueEntry, onTriageSubmit: () => void }) => {
    const { toast } = useToast();
    const [triageData, setTriageData] = useState<TriageData>({
        chiefComplaint: '', bloodPressure: '', temperature: '', heartRate: '', respiratoryRate: '', oxygenSaturation: '', notes: ''
    });
    const [severity, setSeverity] = useState<SeverityLevel | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setTriageData(prev => ({ ...prev, [name]: value }));
    };

    const handleTriageSubmit = async () => {
        if (!triageData.chiefComplaint) {
            toast({ title: "Erro", description: "Queixa principal é obrigatória.", variant: "destructive" });
            return;
        }
        if (!severity) {
            toast({ title: "Erro", description: "Classificação de risco é obrigatória.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const fullTriageData = { ...triageData, severity };
            await submitTriage(queueEntry.id, fullTriageData); 
            
            toast({ title: "Triagem Salva!", description: `Paciente ${queueEntry.patientName} encaminhado para atendimento.` });

            // <<< CORREÇÃO: Fornece 'N/A' como fallback para dob >>>
            printWristband({
              patientName: queueEntry.patientName,
              dob: "N/A", // <<< CORRIGIDO AQUI
              patientId: queueEntry.patientId,
              severity: severity 
            });
            // <<< FIM DA CORREÇÃO >>>

            onTriageSubmit(); 
        } catch (error: any) {
            toast({ title: "Erro ao Salvar Triagem", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
            <div className="space-y-1.5">
                <Label htmlFor="chiefComplaint" className="text-base">Queixa Principal</Label>
                <Textarea id="chiefComplaint" name="chiefComplaint" value={triageData.chiefComplaint} onChange={handleChange} rows={3} />
            </div>
            
            <Label className="text-base">Sinais Vitais</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label htmlFor="bloodPressure">P.A. (mmHg)</Label><Input id="bloodPressure" name="bloodPressure" value={triageData.bloodPressure} onChange={handleChange} /></div>
                <div className="space-y-1.5"><Label htmlFor="temperature">Temp. (°C)</Label><Input id="temperature" name="temperature" value={triageData.temperature} onChange={handleChange} /></div>
                <div className="space-y-1.5"><Label htmlFor="heartRate">F.C. (bpm)</Label><Input id="heartRate" name="heartRate" value={triageData.heartRate} onChange={handleChange} /></div>
                <div className="space-y-1.5"><Label htmlFor="respiratoryRate">F.R. (rpm)</Label><Input id="respiratoryRate" name="respiratoryRate" value={triageData.respiratoryRate} onChange={handleChange} /></div>
                <div className="space-y-1.5"><Label htmlFor="oxygenSaturation">Sat O₂ (%)</Label><Input id="oxygenSaturation" name="oxygenSaturation" value={triageData.oxygenSaturation} onChange={handleChange} /></div>
            </div>

            <div className="space-y-2 pt-4 border-t">
                <Label className="text-base font-semibold">Classificação de Risco (Protocolo de Manchester)</Label>
                <RadioGroup onValueChange={(value) => setSeverity(value as SeverityLevel)} value={severity || ""}>
                    <div className="flex items-center space-x-2 p-2 rounded border border-red-300 bg-red-50">
                        <RadioGroupItem value="vermelho" id="sev-vermelho" />
                        <Label htmlFor="sev-vermelho" className="font-bold text-red-700">Vermelho (Emergência)</Label>
                    </div>
                    <div className="flex items-center space-x-2 p-2 rounded border border-orange-300 bg-orange-50">
                        <RadioGroupItem value="laranja" id="sev-laranja" />
                        <Label htmlFor="sev-laranja" className="font-bold text-orange-700">Laranja (Muito Urgente)</Label>
                    </div>
                    <div className="flex items-center space-x-2 p-2 rounded border border-yellow-300 bg-yellow-50">
                        <RadioGroupItem value="amarelo" id="sev-amarelo" />
                        <Label htmlFor="sev-amarelo" className="font-bold text-yellow-700">Amarelo (Urgente)</Label>
                    </div>
                    <div className="flex items-center space-x-2 p-2 rounded border border-green-300 bg-green-50">
                        <RadioGroupItem value="verde" id="sev-verde" />
                        <Label htmlFor="sev-verde" className="font-bold text-green-700">Verde (Pouco Urgente)</Label>
                    </div>
                     <div className="flex items-center space-x-2 p-2 rounded border border-blue-300 bg-blue-50">
                        <RadioGroupItem value="azul" id="sev-azul" />
                        <Label htmlFor="sev-azul" className="font-bold text-blue-700">Azul (Não Urgente)</Label>
                    </div>
                </RadioGroup>
            </div>

            <div className="space-y-1.5"><Label htmlFor="notes">Anotações Adicionais</Label><Textarea id="notes" name="notes" value={triageData.notes} onChange={handleChange} rows={2} /></div>
            
            <DialogFooter className="pt-4 border-t">
                <Button onClick={handleTriageSubmit} disabled={isSubmitting || !severity} className="w-full">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting ? "A salvar..." : "Salvar Triagem e Imprimir Pulseira"}
                </Button>
            </DialogFooter>
        </div>
    );
};


// --- PÁGINA PRINCIPAL DE TRIAGEM (MODIFICADA) ---
export default function TriagePage() {
    const { userProfile, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [queue, setQueue] = useState<ServiceQueueEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [triagePatient, setTriagePatient] = useState<ServiceQueueEntry | null>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!userProfile || !userProfile.hospitalId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const unitId = userProfile.hospitalId;
        
        const unsubscribe = listenToServiceQueue(
            unitId, 
            'Aguardando Triagem', 
            'Presencial', 
            (entries) => {
                setQueue(entries);
                setIsLoading(false);
            }
        );
        
        return () => unsubscribe();
    }, [userProfile, authLoading, toast]);

    const handleCallPatient = async (entry: ServiceQueueEntry) => {
        if (!userProfile) {
            toast({ title: "Erro", description: "Perfil do enfermeiro não carregado.", variant: "destructive" });
            return;
        }
        try {
            await startTriage(entry.id, userProfile.uid); 
            setTriagePatient(entry);
        } catch (error: any) {
            toast({ title: "Erro ao chamar paciente", description: error.message, variant: "destructive" });
        }
    };

    if (authLoading || isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    }
    
    const allowedRoles: UserType[] = ['admin', 'triage_nurse', 'hospital'];
    if (!userProfile || !allowedRoles.includes(userProfile.userType)) {
        return (
            <div className="container mx-auto flex h-screen items-center justify-center p-8 text-center">
                 <Card className="w-full max-w-md border-red-500 bg-red-50"><CardHeader><CardTitle className="flex items-center justify-center gap-2 text-2xl text-red-700"><ShieldAlert className="h-8 w-8" />Acesso Negado</CardTitle></CardHeader></Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><HeartPulse /> Fila de Triagem</CardTitle>
                    <CardDescription>Pacientes que passaram pela recepção e aguardam a classificação de risco.</CardDescription>
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
                    {triagePatient && (
                        <TriageForm 
                            queueEntry={triagePatient} 
                            onTriageSubmit={() => setTriagePatient(null)} 
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}