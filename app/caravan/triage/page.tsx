// app/caravan/triage/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, orderBy, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

// --- TIPO CORRIGIDO ---
// A interface agora inclui o objeto 'medicalHistory' opcional, resolvendo os erros.
interface Consultation {
    id: string;
    patientId: string;
    patientName: string;
    chiefComplaint: string;
    specialty: string;
    status: 'AGUARDANDO_TRIAGEM' | 'AGUARDANDO_ATENDIMENTO' | 'EM_ANDAMENTO' | 'FINALIZADO';
    createdAt: Timestamp;
    medicalHistory?: {
        allergies: string;
        chronicDiseases: string[];
        currentMedications: string;
        pastSurgeries: string;
    };
}

// Componentes da UI
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, UserCheck, ClipboardList } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- SUBCOMPONENTE: Formulário de Triagem ---
const TriageForm: React.FC<{ consultation: Consultation; onSave: () => void }> = ({ consultation, onSave }) => {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    // Os estados agora leem a propriedade 'medicalHistory' que existe no tipo
    const [allergies, setAllergies] = useState(consultation.medicalHistory?.allergies || '');
    const [chronicDiseases, setChronicDiseases] = useState<string[]>(consultation.medicalHistory?.chronicDiseases || []);
    const [currentMedications, setCurrentMedications] = useState(consultation.medicalHistory?.currentMedications || '');
    const [pastSurgeries, setPastSurgeries] = useState(consultation.medicalHistory?.pastSurgeries || '');

    const handleSaveTriage = async () => {
        setIsSaving(true);
        try {
            const consultationRef = doc(db, "consultations", consultation.id);
            await updateDoc(consultationRef, {
                medicalHistory: {
                    allergies,
                    chronicDiseases,
                    currentMedications,
                    pastSurgeries
                },
                status: "AGUARDANDO_ATENDIMENTO",
                updatedAt: serverTimestamp()
            });
            toast({ title: "Triagem Salva!", description: `Os dados de ${consultation.patientName} foram enviados para a fila médica.`, className: "bg-green-600 text-white" });
            onSave();
        } catch (error) {
            console.error("Erro ao salvar triagem:", error);
            toast({ title: "Erro", description: "Não foi possível salvar os dados da triagem.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const diseaseOptions = ["Hipertensão", "Diabetes", "Asma", "Doença Cardíaca"];

    return (
        <div className="space-y-6 p-1 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
                <Label className="text-lg font-semibold">Histórico Médico do Paciente</Label>
                <div className="space-y-4 p-4 border rounded-md">
                    <div>
                        <Label htmlFor="allergies">Alergias Conhecidas</Label>
                        <Textarea id="allergies" value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="Dipirona, frutos do mar, poeira, etc."/>
                    </div>
                     <div>
                        <Label>Doenças Crônicas</Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            {diseaseOptions.map(disease => (
                                <div key={disease} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={disease} 
                                        checked={chronicDiseases.includes(disease)}
                                        onCheckedChange={(checked) => {
                                            setChronicDiseases((prev: string[]) => checked ? [...prev, disease] : prev.filter((d: string) => d !== disease));
                                        }}
                                    />
                                    <Label htmlFor={disease} className="font-normal">{disease}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="medications">Medicamentos em Uso Contínuo</Label>
                        <Textarea id="medications" value={currentMedications} onChange={e => setCurrentMedications(e.target.value)} placeholder="Losartana 50mg (1x ao dia), AAS 100mg (1x ao dia), etc."/>
                    </div>
                    <div>
                        <Label htmlFor="surgeries">Cirurgias Anteriores Relevantes</Label>
                        <Textarea id="surgeries" value={pastSurgeries} onChange={e => setPastSurgeries(e.target.value)} placeholder="Apendicectomia em 2010, etc."/>
                    </div>
                </div>
            </div>
            <Button onClick={handleSaveTriage} disabled={isSaving} className="w-full">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Triagem e Enviar para Fila Médica
            </Button>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL DA PÁGINA DE TRIAGEM ---
export default function TriagePage() {
    const [triageQueue, setTriageQueue] = useState<Consultation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

    useEffect(() => {
        const q = query(collection(db, "consultations"), where("status", "==", "AGUARDANDO_TRIAGEM"), orderBy("createdAt", "asc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const queue = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation));
            setTriageQueue(queue);
            setIsLoading(false);
        }, (error) => {
            console.error("Erro ao carregar fila de triagem:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSelectPatient = (consultation: Consultation) => {
        setSelectedConsultation(consultation);
    };

    const handleCloseModal = () => {
        setSelectedConsultation(null);
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Fila de Triagem</h1>
                <p className="text-muted-foreground">Pacientes aguardando para coleta de informações pré-consulta.</p>
            </div>

            {triageQueue.length === 0 ? (
                <div className="text-center p-10 mt-10 bg-gray-50 rounded-lg">
                    <ClipboardList className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-4 font-semibold text-gray-800">Fila de Triagem Vazia</p>
                    <p className="mt-2 text-sm text-gray-600">Nenhum paciente da recepção aguardando no momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {triageQueue.map(consult => (
                        <Card key={consult.id} className="cursor-pointer hover:border-blue-500 transition-all" onClick={() => handleSelectPatient(consult)}>
                            <CardHeader>
                                <CardTitle>{consult.patientName}</CardTitle>
                                <CardDescription>Aguardando triagem há {consult.createdAt ? formatDistanceToNow(consult.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : '...'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm font-semibold">Queixa Principal:</p>
                                <p className="text-sm text-muted-foreground italic">"{consult.chiefComplaint}"</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
            
            <Dialog open={!!selectedConsultation} onOpenChange={(isOpen) => !isOpen && handleCloseModal()}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><UserCheck /> Triagem de {selectedConsultation?.patientName}</DialogTitle>
                        <DialogDescription>Colete o histórico médico do paciente antes do atendimento.</DialogDescription>
                    </DialogHeader>
                    {selectedConsultation && (
                        <TriageForm consultation={selectedConsultation} onSave={handleCloseModal} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}