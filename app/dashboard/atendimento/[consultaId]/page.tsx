// app/dashboard/atendimento/[consultaId]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getConsultationById, saveConsultationDetails, completeConsultation, type Consultation } from '@/lib/consultation-service';
import { getCurrentUserData, type DoctorProfile } from '@/lib/auth-service';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, ArrowLeft, Calendar, Stethoscope, Save, Hospital, CheckCircle, FilePlus, Trash2, Download, Pill, FileText, Video } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { generatePrescription, type Medication, type PrescriptionPayload } from '@/lib/document-service';
import { Timestamp } from 'firebase/firestore';

// Componentes internos (TriageDataDisplay, PrescriptionForm) permanecem os mesmos
const TriageDataDisplay = ({ data }: { data: any }) => (
    <div className="space-y-3 mt-4"><div className="p-3 bg-blue-50 rounded-md border border-blue-200"><Label className="text-gray-500">Queixa Principal</Label><p className="font-semibold whitespace-pre-wrap">{data?.chiefComplaint || "Não informada"}</p></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-4"><div className="p-2 bg-slate-50 rounded-md border"><Label className="text-xs text-gray-500 block">Pressão Arterial</Label><p className="font-medium">{data?.bloodPressure || '-'}</p></div><div className="p-2 bg-slate-50 rounded-md border"><Label className="text-xs text-gray-500 block">Temperatura</Label><p className="font-medium">{data?.temperature ? `${data.temperature} °C` : '-'}</p></div><div className="p-2 bg-slate-50 rounded-md border"><Label className="text-xs text-gray-500 block">Freq. Cardíaca</Label><p className="font-medium">{data?.heartRate ? `${data.heartRate} bpm` : '-'}</p></div><div className="p-2 bg-slate-50 rounded-md border"><Label className="text-xs text-gray-500 block">Freq. Respiratória</Label><p className="font-medium">{data?.respiratoryRate ? `${data.respiratoryRate} rpm` : '-'}</p></div><div className="p-2 bg-slate-50 rounded-md border"><Label className="text-xs text-gray-500 block">Saturação O₂</Label><p className="font-medium">{data?.oxygenSaturation ? `${data.oxygenSaturation} %` : '-'}</p></div></div>{data?.notes && <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200"><Label className="text-gray-500">Outras Anotações da Triagem</Label><p className="whitespace-pre-wrap">{data.notes}</p></div>}</div>
);
const PrescriptionForm = ({ consultation, doctorProfile, onFinished }: { consultation: Consultation, doctorProfile: DoctorProfile, onFinished: () => void }) => {
    const { toast } = useToast();
    const [medications, setMedications] = useState<Medication[]>([{ name: '', dosage: '', instructions: '' }]);
    const [isGenerating, setIsGenerating] = useState(false);
    const handleMedicationChange = (index: number, field: keyof Medication, value: string) => { const newMeds = [...medications]; newMeds[index][field] = value; setMedications(newMeds); };
    const addMedication = () => setMedications([...medications, { name: '', dosage: '', instructions: '' }]);
    const removeMedication = (index: number) => setMedications(medications.filter((_, i) => i !== index));
    const handleSubmit = async () => {
        if (medications.some(m => !m.name || !m.dosage)) { toast({ title: "Campos obrigatórios", description: "O nome e a dose de cada medicamento são necessários.", variant: "destructive" }); return; }
        setIsGenerating(true);
        try {
            const payload: PrescriptionPayload = { consultationId: consultation.id, patientName: consultation.patientName, doctorName: doctorProfile.displayName, doctorCrm: doctorProfile.professionalCrm, medications };
            await generatePrescription(payload);
            toast({ title: "Receita Gerada!", description: "O PDF da receita foi criado. A lista de documentos será atualizada." });
            onFinished();
        } catch (error: any) {
            toast({ title: "Erro ao Gerar Receita", description: error.message, variant: "destructive" });
        } finally { setIsGenerating(false); }
    };
    return (
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Gerar Nova Receita Médica</DialogTitle><DialogDescription>Adicione um ou mais medicamentos.</DialogDescription></DialogHeader><div className="max-h-[60vh] overflow-y-auto space-y-4 p-1">{medications.map((med, index) => (<div key={index} className="space-y-2 p-3 border rounded-md relative bg-slate-50">{medications.length > 1 && <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeMedication(index)}><Trash2 className="h-4 w-4 text-red-500"/></Button>}<div className="space-y-1.5"><Label>Medicamento</Label><Input value={med.name} onChange={e => handleMedicationChange(index, 'name', e.target.value)} /></div><div className="space-y-1.5"><Label>Dose / Quantidade</Label><Input value={med.dosage} onChange={e => handleMedicationChange(index, 'dosage', e.target.value)} /></div><div className="space-y-1.5"><Label>Instruções (Posologia)</Label><Textarea value={med.instructions} onChange={e => handleMedicationChange(index, 'instructions', e.target.value)} /></div></div>))}<Button variant="outline" size="sm" onClick={addMedication}><FilePlus className="mr-2 h-4 w-4"/>Adicionar medicamento</Button></div><DialogFooter><Button onClick={handleSubmit} disabled={isGenerating}>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Pill className="mr-2 h-4 w-4"/>}Gerar e Salvar Receita</Button></DialogFooter></DialogContent>
    );
};


const ElectronicHealthRecord: React.FC<{ consultation: Consultation; userProfile: DoctorProfile | null; refreshData: () => void }> = ({ consultation, userProfile, refreshData }) => {
    const { toast } = useToast();
    const [clinicalEvolution, setClinicalEvolution] = useState(consultation?.clinicalEvolution || '');
    const [diagnosticHypothesis, setDiagnosticHypothesis] = useState(consultation?.diagnosticHypothesis || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveConsultationDetails(consultation.id, { clinicalEvolution, diagnosticHypothesis });
            toast({ title: "Sucesso!", description: "Prontuário salvo." });
        } catch (error: any) {
            toast({ title: "Erro ao Salvar", description: error.message, variant: "destructive" });
        } finally { setIsSaving(false); }
    };
    
    return (
        <Card className="h-full flex flex-col"><CardHeader><CardTitle className="text-lg">Prontuário Eletrônico</CardTitle></CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4 overflow-y-auto">
                <Tabs defaultValue="medical-record" className="flex-grow flex flex-col">
                    <TabsList className="grid w-full grid-cols-4"><TabsTrigger value="medical-record">Atendimento</TabsTrigger><TabsTrigger value="triage">Triagem</TabsTrigger><TabsTrigger value="patient-data">Paciente</TabsTrigger><TabsTrigger value="documents">Documentos</TabsTrigger></TabsList>
                    <TabsContent value="triage" className="flex-grow"><TriageDataDisplay data={consultation.triageData} /></TabsContent>
                    <TabsContent value="patient-data" className="text-sm space-y-3 mt-4 flex-grow"><div><Label className="text-gray-500">Nome</Label><p>{consultation.patientName}</p></div></TabsContent>
                    <TabsContent value="medical-record" className="flex-grow flex flex-col gap-4 mt-4"><div className="space-y-1.5 flex flex-col flex-grow"><Label htmlFor="evolution">Evolução Clínica</Label><Textarea id="evolution" value={clinicalEvolution} onChange={e => setClinicalEvolution(e.target.value)} className="min-h-[150px] flex-grow" /></div><div className="space-y-1.5"><Label htmlFor="hypothesis">Hipótese Diagnóstica</Label><Textarea id="hypothesis" value={diagnosticHypothesis} onChange={e => setDiagnosticHypothesis(e.target.value)} /></div></TabsContent>
                    <TabsContent value="documents" className="mt-4 space-y-4"><div className="flex gap-2"><Dialog open={isPrescriptionModalOpen} onOpenChange={setIsPrescriptionModalOpen}><DialogTrigger asChild><Button variant="outline"><FilePlus className="mr-2 h-4 w-4"/>Gerar Receita</Button></DialogTrigger>{userProfile && <PrescriptionForm consultation={consultation} doctorProfile={userProfile} onFinished={() => { setIsPrescriptionModalOpen(false); refreshData(); }} />}</Dialog></div><div className="space-y-2"><h3 className="text-sm font-semibold">Documentos Gerados</h3>{consultation.generatedDocuments && consultation.generatedDocuments.length > 0 ? (consultation.generatedDocuments.map((doc, index) => (<div key={index} className="flex items-center justify-between p-2 bg-slate-50 border rounded-md"><div className="flex items-center gap-2">{doc.type === 'prescription' ? <Pill className="h-4 w-4 text-blue-500"/> : <FileText className="h-4 w-4 text-green-500"/>}<span className="font-medium text-sm">{doc.name}</span><span className="text-xs text-gray-400">({(doc.createdAt as Timestamp).toDate().toLocaleDateString('pt-BR')})</span></div><Button asChild variant="ghost" size="icon" className="h-7 w-7"><Link href={doc.url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4"/></Link></Button></div>))) : (<p className="text-xs text-center text-gray-400 py-4">Nenhum documento gerado para esta consulta.</p>)}</div></TabsContent>
                </Tabs>
                <div className="mt-auto pt-4"><Button onClick={handleSave} disabled={isSaving} className="w-full">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar Anotações</Button></div>
            </CardContent>
        </Card>
    );
};

export default function InPersonAttendancePage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();
    const consultationId = params.consultaId as string;
    const [consultation, setConsultation] = useState<Consultation | null>(null);
    const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFinishing, setIsFinishing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        if (!consultationId || !user) return;
        setIsLoading(true);
        try {
            const [consultationData, profileData] = await Promise.all([ getConsultationById(consultationId), getCurrentUserData() ]);
            if (!consultationData || consultationData.doctorId !== user.uid) { throw new Error("Consulta não encontrada ou acesso não permitido."); }
            setConsultation(consultationData);
            setDoctorProfile(profileData as DoctorProfile);
        } catch (err: any) {
            setError(err.message); setConsultation(null);
        } finally { setIsLoading(false); }
    };
    
    useEffect(() => { fetchData(); }, [consultationId, user]);

    const handleFinishConsultation = async () => {
        if (!consultation) return;
        setIsFinishing(true);
        try {
            await completeConsultation(consultation);
            toast({ title: "Atendimento Finalizado!", description: "O paciente foi removido da sua fila de espera." });
            router.push('/dashboard');
        } catch (error: any) {
            toast({ title: "Erro ao Finalizar", description: error.message, variant: "destructive" });
            setIsFinishing(false);
        }
    };

    if (isLoading) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>; }
    if (error) { return <div className="text-center text-red-600 p-8"><AlertTriangle className="mx-auto h-12 w-12 mb-4" /><p>{error}</p></div>; }
    if (!consultation) { return <div className="p-4 text-center">Dados da consulta não encontrados.</div>; }

    return (
        <div className="space-y-4">
            <Link href="/dashboard" className="flex items-center text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para o Dashboard</Link>
            <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
                <div className="md:col-span-2 h-full"><ElectronicHealthRecord consultation={consultation} userProfile={doctorProfile} refreshData={fetchData} /></div>
                <div className="h-full flex flex-col gap-6">
                    {/* --- CARTÃO DE TELEMEDICINA (EXIBIÇÃO CONDICIONAL) --- */}
                    {consultation.type === 'Telemedicina' && (
                        <Card className="border-blue-500 border-2">
                            <CardHeader><CardTitle className="flex items-center gap-2"><Video />Sala de Telemedicina</CardTitle></CardHeader>
                            <CardContent>
                                {consultation.telemedicineLink ? (
                                    <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                                        <Link href={consultation.telemedicineLink} target="_blank" rel="noopener noreferrer">
                                            Entrar na Chamada de Vídeo
                                        </Link>
                                    </Button>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center">A sala de vídeo está a ser criada...</p>
                                )}
                            </CardContent>
                        </Card>
                    )}
                    <Card className="h-full flex flex-col">
                        <CardHeader><CardTitle>Detalhes do Atendimento</CardTitle></CardHeader>
                        <CardContent className="space-y-4 text-sm flex-grow">
                            <div className="flex items-center gap-3"><Hospital className="h-5 w-5 text-gray-500"/><div><p className="font-semibold">Local</p><p>{consultation.hospitalName}</p></div></div>
                            <div className="flex items-center gap-3"><Calendar className="h-5 w-5 text-gray-500"/><div><p className="font-semibold">Data</p><p>{consultation.createdAt.toDate().toLocaleDateString('pt-BR')}</p></div></div>
                            <div className="flex items-center gap-3"><Stethoscope className="h-5 w-5 text-gray-500"/><div><p className="font-semibold">Tipo</p><p>{consultation.type}</p></div></div>
                        </CardContent>
                        <CardFooter className="mt-auto border-t pt-4"><Button onClick={handleFinishConsultation} disabled={isFinishing} className="w-full bg-green-600 hover:bg-green-700">{isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}Finalizar Atendimento</Button></CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}