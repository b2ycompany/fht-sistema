// components/ui/PatientHistoryDialog.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { getConsultationsForPatient, type Consultation } from '@/lib/consultation-service';
import { useToast } from '@/hooks/use-toast';

// Componentes da UI
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Calendar } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface PatientHistoryDialogProps {
  patientId: string;
  currentConsultationId: string;
}

export const PatientHistoryDialog: React.FC<PatientHistoryDialogProps> = ({ patientId, currentConsultationId }) => {
    const { toast } = useToast();
    const [history, setHistory] = useState<Consultation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!patientId) return;
            setIsLoading(true);
            setError(null);
            try {
                const results = await getConsultationsForPatient(patientId);
                // Filtra para não mostrar a consulta atual no histórico de consultas passadas
                setHistory(results.filter(c => c.id !== currentConsultationId));
            } catch (err: any) {
                setError(err.message);
                toast({ title: "Erro ao buscar histórico", description: err.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [patientId, currentConsultationId, toast]);

    return (
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Histórico de Consultas do Paciente</DialogTitle>
                <DialogDescription>Visualize os atendimentos anteriores para uma melhor tomada de decisão clínica.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto pr-4 py-4">
                {isLoading && <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>}
                
                {error && <div className="text-center text-red-600 p-8"><AlertTriangle className="mx-auto h-12 w-12 mb-4" /><p>{error}</p></div>}
                
                {!isLoading && !error && history.length === 0 && (
                    <div className="text-center text-muted-foreground p-12">
                        <p>Nenhuma consulta anterior encontrada para este paciente.</p>
                    </div>
                )}
                
                {!isLoading && !error && history.length > 0 && (
                    <Accordion type="single" collapsible className="w-full">
                        {history.map(consultation => (
                            <AccordionItem key={consultation.id} value={consultation.id}>
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4 items-center">
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                            <Calendar className="h-4 w-4" />
                                            {(consultation.createdAt as Timestamp).toDate().toLocaleDateString('pt-BR')}
                                        </div>
                                        <Badge variant={consultation.type === 'Telemedicina' ? 'default' : 'secondary'}>
                                            {consultation.type}
                                        </Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-3 text-sm">
                                    <p><strong className="font-medium">Médico:</strong> {consultation.doctorName}</p>
                                    <p><strong className="font-medium">Queixa Principal (Triagem):</strong> {consultation.triageData?.chiefComplaint || 'Não registada'}</p>
                                    <div>
                                        <strong className="font-medium">Hipótese Diagnóstica:</strong>
                                        <p className="pl-2 mt-1 border-l-2 ml-1 text-muted-foreground whitespace-pre-wrap">{consultation.diagnosticHypothesis || 'Não registada'}</p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </div>
        </DialogContent>
    );
};