// app/atendimento/[consultaId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { getPatientById, type Patient } from '@/lib/patient-service';
// --- NOVO: Importa função para buscar perfil e o tipo DoctorProfile ---
import { getCurrentUserData, type DoctorProfile } from '@/lib/auth-service';

// Tipos de dados
interface Consultation {
    id: string;
    patientId: string;
    patientName: string;
    chiefComplaint: string;
    specialty: string;
    serviceType: 'Presencial' | 'Telemedicina';
    status: 'AGUARDANDO' | 'EM_ANDAMENTO' | 'FINALIZADO';
    createdAt: any;
    telemedicineLink?: string;
    clinicalEvolution?: string;
    diagnosticHypothesis?: string;
    prescriptions?: Medication[];
}
interface Medication {
    name: string;
    dosage: string;
    instructions: string;
}

// Componentes da UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertTriangle, User, Clipboard, Video, FileText, Plus, Trash2, BookText, Stethoscope } from 'lucide-react';

// --- COMPONENTE PRINCIPAL DA PÁGINA ---
export default function ConsultationPage() {
    const router = useRouter();
    const params = useParams();
    // --- CORREÇÃO 1: Removemos 'profile' do useAuth ---
    const { user } = useAuth();
    const { toast } = useToast();

    const consultaId = params.consultaId as string;

    // Estados dos dados
    const [consultation, setConsultation] = useState<Consultation | null>(null);
    const [patient, setPatient] = useState<Patient | null>(null);
    // --- NOVO: Estado dedicado para o perfil do médico ---
    const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Estados do Prontuário
    const [clinicalEvolution, setClinicalEvolution] = useState('');
    const [diagnosticHypothesis, setDiagnosticHypothesis] = useState('');
    const [medications, setMedications] = useState<Medication[]>([]);
    
    // Estados dos Modais e Formulários
    const [isAtestadoModalOpen, setIsAtestadoModalOpen] = useState(false);
    const [daysOff, setDaysOff] = useState(0);
    const [cid, setCid] = useState('');
    
    const [newMedName, setNewMedName] = useState('');
    const [newMedDosage, setNewMedDosage] = useState('');
    const [newMedInstructions, setNewMedInstructions] = useState('');

    // Estados de Ações
    const [isSaving, setIsSaving] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Busca de dados em tempo real
    useEffect(() => {
        if (!consultaId) return;

        // --- CORREÇÃO 1: Busca o perfil do médico ---
        const fetchDoctorProfile = async () => {
            if (user && !doctorProfile) {
                const profileData = await getCurrentUserData();
                if (profileData?.role === 'doctor') {
                    setDoctorProfile(profileData as DoctorProfile);
                }
            }
        };
        fetchDoctorProfile();

        const consultRef = doc(db, "consultations", consultaId);
        const unsubscribe = onSnapshot(consultRef, async (docSnap) => {
            if (docSnap.exists()) {
                const consultData = { id: docSnap.id, ...docSnap.data() } as Consultation;
                setConsultation(consultData);

                setClinicalEvolution(consultData.clinicalEvolution || '');
                setDiagnosticHypothesis(consultData.diagnosticHypothesis || '');
                setMedications(consultData.prescriptions || []);

                if (consultData.patientId && !patient) {
                    const patientData = await getPatientById(consultData.patientId);
                    setPatient(patientData);
                }
            } else {
                console.error("Consulta não encontrada.");
                toast({ title: "Erro", description: "Consulta não encontrada.", variant: "destructive" });
                router.push('/dashboard/fila');
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [consultaId, user, doctorProfile, patient, router, toast]);

    // --- FUNÇÕES DE AÇÃO ---

    const handleSaveDraft = async () => {
        setIsSaving(true);
        try {
            const consultRef = doc(db, "consultations", consultaId);
            await updateDoc(consultRef, {
                clinicalEvolution,
                diagnosticHypothesis,
                prescriptions: medications,
                updatedAt: serverTimestamp(),
            });
            toast({ title: "Rascunho Salvo!", description: "As informações foram salvas com sucesso." });
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível salvar o rascunho.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFinalizeConsultation = async () => {
        setIsFinalizing(true);
        try {
            const consultRef = doc(db, "consultations", consultaId);
            await updateDoc(consultRef, {
                clinicalEvolution,
                diagnosticHypothesis,
                prescriptions: medications,
                status: "FINALIZADO",
                updatedAt: serverTimestamp(),
            });
            toast({ title: "Atendimento Finalizado!", description: "A consulta foi concluída e registrada.", className: "bg-green-600 text-white" });
            router.push('/dashboard/fila');
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível finalizar o atendimento.", variant: "destructive" });
        } finally {
            setIsFinalizing(false);
        }
    };
    
    const handleAddMedication = () => {
        if (!newMedName || !newMedDosage) {
            toast({ title: "Campos da Prescrição Vazios", description: "Preencha pelo menos o nome e a dosagem.", variant: "destructive"});
            return;
        }
        setMedications([...medications, { name: newMedName, dosage: newMedDosage, instructions: newMedInstructions }]);
        setNewMedName(''); setNewMedDosage(''); setNewMedInstructions('');
    };

    const handleRemoveMedication = (index: number) => {
        setMedications(medications.filter((_, i) => i !== index));
    };

    const handleGeneratePdf = async (type: 'prescription' | 'certificate') => {
        if (!consultation || !patient || !doctorProfile) return;
        setIsGeneratingPdf(true);
        try {
            let result: any;
            if (type === 'prescription') {
                if (medications.length === 0) {
                    toast({ title: "Prescrição Vazia", description: "Adicione pelo menos um medicamento.", variant: "destructive" });
                    return;
                }
                const generatePrescriptionPdf = httpsCallable(functions, 'generatePrescriptionPdf');
                result = await generatePrescriptionPdf({
                    // --- CORREÇÃO 2: Usa 'consultaId' com 'c' minúsculo ---
                    consultationId: consultaId,
                    patientName: patient.name,
                    doctorName: doctorProfile.displayName,
                    doctorCrm: doctorProfile.professionalCrm || 'CRM não informado',
                    medications: medications,
                });
            } else { // certificate
                const generateDocumentPdf = httpsCallable(functions, 'generateDocumentPdf');
                result = await generateDocumentPdf({
                    type: 'medicalCertificate',
                    // --- CORREÇÃO 2: Usa 'consultaId' com 'c' minúsculo ---
                    consultationId: consultaId,
                    patientName: patient.name,
                    doctorName: doctorProfile.displayName,
                    doctorCrm: doctorProfile.professionalCrm || 'CRM não informado',
                    details: { daysOff, cid }
                });
                setIsAtestadoModalOpen(false);
            }
            
            const pdfUrl = (result.data as any).pdfUrl;
            if (pdfUrl) {
                window.open(pdfUrl, '_blank');
            }
        } catch (error) {
            toast({ title: "Erro ao Gerar PDF", description: "Não foi possível gerar o documento.", variant: "destructive" });
        } finally {
            setIsGeneratingPdf(false);
        }
    };
    
    if (isLoading || !consultation || !patient) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="container mx-auto p-4 space-y-4">
            {/* Cabeçalho e Ações Principais */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Atendimento - {patient.name}</h1>
                    <p className="text-muted-foreground">Consulta de {consultation.specialty}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Salvar Rascunho
                    </Button>
                    <Button onClick={handleFinalizeConsultation} disabled={isFinalizing} className="bg-green-600 hover:bg-green-700">
                        {isFinalizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Finalizar Atendimento
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Layout Principal: Contexto do Paciente | Área de Trabalho do Médico */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Coluna da Esquerda: Contexto */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Video /> Sala de Telemedicina</CardTitle></CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            {consultation.telemedicineLink ? (
                                <>
                                    <Button asChild size="lg"><a href={consultation.telemedicineLink} target="_blank" rel="noopener noreferrer">Entrar na Videochamada</a></Button>
                                    <Button variant="secondary" onClick={() => navigator.clipboard.writeText(consultation.telemedicineLink || '')}>Copiar Link para Paciente</Button>
                                </>
                            ) : <p className="text-sm text-muted-foreground">Link da sala ainda não gerado.</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><User /> Informações do Paciente</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <p><strong>Nome:</strong> {patient.name}</p>
                            <p><strong>CPF:</strong> {patient.cpf || 'Não informado'}</p>
                            <p><strong>Nascimento:</strong> {patient.dateOfBirth?.toDate().toLocaleDateString('pt-BR') || 'Não informado'}</p>
                            <p className="font-medium pt-2"><strong>Queixa Principal:</strong></p>
                            <p className="italic text-muted-foreground">"{consultation.chiefComplaint}"</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Coluna da Direita: Prontuário */}
                <div className="lg:col-span-2">
                    <Tabs defaultValue="evolution">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="evolution"><Stethoscope className="mr-2 h-4 w-4" />Evolução</TabsTrigger>
                            <TabsTrigger value="prescription"><BookText className="mr-2 h-4 w-4" />Prescrição</TabsTrigger>
                            <TabsTrigger value="documents"><FileText className="mr-2 h-4 w-4" />Documentos</TabsTrigger>
                        </TabsList>

                        <TabsContent value="evolution" className="mt-4">
                            <Card>
                                <CardHeader><CardTitle>Anamnese e Evolução Clínica</CardTitle></CardHeader>
                                <CardContent>
                                    <Textarea
                                        placeholder="Descreva a evolução do paciente, exame físico, etc."
                                        rows={15}
                                        value={clinicalEvolution}
                                        onChange={(e) => setClinicalEvolution(e.target.value)}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="prescription" className="mt-4">
                            <Card>
                                <CardHeader><CardTitle>Prescrição Médica</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-4 border rounded-lg space-y-3">
                                        <h4 className="font-semibold">Adicionar Medicamento</h4>
                                        <Input placeholder="Nome do Medicamento" value={newMedName} onChange={e => setNewMedName(e.target.value)} />
                                        <Input placeholder="Dosagem (ex: 500mg)" value={newMedDosage} onChange={e => setNewMedDosage(e.target.value)} />
                                        <Textarea placeholder="Instruções (ex: 1 comprimido a cada 8 horas por 7 dias)" value={newMedInstructions} onChange={e => setNewMedInstructions(e.target.value)} rows={2}/>
                                        <Button onClick={handleAddMedication} size="sm"><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
                                    </div>
                                    <Separator />
                                    <div>
                                        {medications.map((med, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 border-b">
                                                <div>
                                                    <p className="font-semibold">{med.name} - {med.dosage}</p>
                                                    <p className="text-xs text-muted-foreground">{med.instructions}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveMedication(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                            </div>
                                        ))}
                                        {medications.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">Nenhum medicamento adicionado.</p>}
                                    </div>
                                    <Button className="w-full" onClick={() => handleGeneratePdf('prescription')} disabled={isGeneratingPdf || medications.length === 0}>
                                        {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>} Gerar PDF da Prescrição
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        
                        <TabsContent value="documents" className="mt-4">
                             <Card>
                                <CardHeader><CardTitle>Emissão de Documentos</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <Button onClick={() => setIsAtestadoModalOpen(true)} disabled={isGeneratingPdf}>
                                        <FileText className="mr-2 h-4 w-4" /> Gerar Atestado Médico
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Modal para gerar atestado */}
            <Dialog open={isAtestadoModalOpen} onOpenChange={setIsAtestadoModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gerar Atestado Médico</DialogTitle>
                        <DialogDescription>Preencha as informações para o atestado de afastamento.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="days-off">Dias de Afastamento</Label>
                            <Input id="days-off" type="number" value={daysOff} onChange={(e) => setDaysOff(parseInt(e.target.value, 10) || 0)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="cid">CID (Opcional)</Label>
                            <Input id="cid" value={cid} onChange={(e) => setCid(e.target.value)} placeholder="Ex: A09" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAtestadoModalOpen(false)}>Cancelar</Button>
                        <Button onClick={() => handleGeneratePdf('certificate')} disabled={isGeneratingPdf}>
                            {isGeneratingPdf && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Gerar Atestado
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}