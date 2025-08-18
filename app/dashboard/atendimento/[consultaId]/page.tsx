"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getConsultationById, saveConsultationDetails, completeConsultation, type Consultation } from '@/lib/consultation-service';
import { getCurrentUserData, type DoctorProfile } from '@/lib/auth-service';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, ArrowLeft, User, Calendar, Stethoscope, Save, Hospital, Clock, HeartPulse, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TriageDataDisplay = ({ data }: { data: any }) => (
    <div className="space-y-3 mt-4">
        <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
            <Label className="text-gray-500">Queixa Principal</Label>
            <p className="font-semibold whitespace-pre-wrap">{data?.chiefComplaint || "Não informada"}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-2 bg-slate-50 rounded-md border"><Label className="text-xs text-gray-500 block">Pressão Arterial</Label><p className="font-medium">{data?.bloodPressure || '-'}</p></div>
            <div className="p-2 bg-slate-50 rounded-md border"><Label className="text-xs text-gray-500 block">Temperatura</Label><p className="font-medium">{data?.temperature ? `${data.temperature} °C` : '-'}</p></div>
            <div className="p-2 bg-slate-50 rounded-md border"><Label className="text-xs text-gray-500 block">Freq. Cardíaca</Label><p className="font-medium">{data?.heartRate ? `${data.heartRate} bpm` : '-'}</p></div>
            <div className="p-2 bg-slate-50 rounded-md border"><Label className="text-xs text-gray-500 block">Freq. Respiratória</Label><p className="font-medium">{data?.respiratoryRate ? `${data.respiratoryRate} rpm` : '-'}</p></div>
            <div className="p-2 bg-slate-50 rounded-md border"><Label className="text-xs text-gray-500 block">Saturação O₂</Label><p className="font-medium">{data?.oxygenSaturation ? `${data.oxygenSaturation} %` : '-'}</p></div>
        </div>
        {data?.notes && <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200"><Label className="text-gray-500">Outras Anotações da Triagem</Label><p className="whitespace-pre-wrap">{data.notes}</p></div>}
    </div>
);

const ElectronicHealthRecord: React.FC<{ consultation: Consultation; userProfile: DoctorProfile | null }> = ({ consultation, userProfile }) => {
    const { toast } = useToast();
    const [clinicalEvolution, setClinicalEvolution] = useState(consultation?.clinicalEvolution || '');
    const [diagnosticHypothesis, setDiagnosticHypothesis] = useState(consultation?.diagnosticHypothesis || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveConsultationDetails(consultation.id, { clinicalEvolution, diagnosticHypothesis });
            toast({ title: "Sucesso!", description: "Prontuário salvo." });
        } catch (error: any) {
            toast({ title: "Erro ao Salvar", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Card className="h-full flex flex-col">
            <CardHeader><CardTitle className="text-lg">Prontuário Eletrônico</CardTitle></CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4 overflow-y-auto">
                <Tabs defaultValue="triage" className="flex-grow flex flex-col">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="triage">Triagem</TabsTrigger>
                        <TabsTrigger value="patient-data">Paciente</TabsTrigger>
                        <TabsTrigger value="medical-record">Atendimento</TabsTrigger>
                        <TabsTrigger value="documents">Documentos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="triage" className="flex-grow"><TriageDataDisplay data={consultation.triageData} /></TabsContent>
                    <TabsContent value="patient-data" className="text-sm space-y-3 mt-4 flex-grow">
                        <div><Label className="text-gray-500">Nome</Label><p>{consultation.patientName}</p></div>
                        <div><Label className="text-gray-500">Histórico</Label><p className="whitespace-pre-wrap">{consultation.medicalHistorySummary || "Nenhum histórico informado."}</p></div>
                    </TabsContent>
                    <TabsContent value="medical-record" className="flex-grow flex flex-col gap-4 mt-4">
                         <div className="space-y-1.5 flex flex-col flex-grow"><Label htmlFor="evolution">Evolução Clínica</Label><Textarea id="evolution" value={clinicalEvolution} onChange={e => setClinicalEvolution(e.target.value)} className="min-h-[150px] flex-grow" /></div>
                        <div className="space-y-1.5"><Label htmlFor="hypothesis">Hipótese Diagnóstica</Label><Textarea id="hypothesis" value={diagnosticHypothesis} onChange={e => setDiagnosticHypothesis(e.target.value)} /></div>
                    </TabsContent>
                     <TabsContent value="documents" className="mt-4 space-y-4">
                        <p className="text-xs text-center text-gray-400">A geração de documentos (receitas, atestados, etc.) aparecerá aqui.</p>
                    </TabsContent>
                </Tabs>
                <div className="mt-auto pt-4">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Anotações
                    </Button>
                </div>
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

    useEffect(() => {
        if (!consultationId || !user) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [consultationData, profileData] = await Promise.all([ getConsultationById(consultationId), getCurrentUserData() ]);
                if (!consultationData || consultationData.doctorId !== user.uid) {
                    throw new Error("Consulta não encontrada ou acesso não permitido.");
                }
                setConsultation(consultationData);
                setDoctorProfile(profileData as DoctorProfile);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [consultationId, user]);

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

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    if (error) {
        return <div className="text-center text-red-600 p-8"><AlertTriangle className="mx-auto h-12 w-12 mb-4" /><p>{error}</p></div>;
    }
    if (!consultation) {
        return <div className="p-4 text-center">Dados da consulta não encontrados.</div>;
    }

    return (
        <div className="space-y-4">
             <Link href="/dashboard" className="flex items-center text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Dashboard
            </Link>
            <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
                <div className="md:col-span-2 h-full">
                    <ElectronicHealthRecord consultation={consultation} userProfile={doctorProfile} />
                </div>
                <div className="h-full">
                    <Card className="h-full flex flex-col">
                        <CardHeader><CardTitle>Detalhes do Atendimento</CardTitle></CardHeader>
                        <CardContent className="space-y-4 text-sm flex-grow">
                            <div className="flex items-center gap-3"><Hospital className="h-5 w-5 text-gray-500"/><div><p className="font-semibold">Local</p><p>{consultation.hospitalName}</p></div></div>
                            <div className="flex items-center gap-3"><Calendar className="h-5 w-5 text-gray-500"/><div><p className="font-semibold">Data</p><p>{consultation.createdAt.toDate().toLocaleDateString('pt-BR')}</p></div></div>
                            <div className="flex items-center gap-3"><Stethoscope className="h-5 w-5 text-gray-500"/><div><p className="font-semibold">Tipo de Atendimento</p><p>{consultation.serviceType}</p></div></div>
                        </CardContent>
                        <CardFooter className="mt-auto border-t pt-4">
                             <Button onClick={handleFinishConsultation} disabled={isFinishing} className="w-full bg-green-600 hover:bg-green-700">
                                {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Finalizar Atendimento
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}