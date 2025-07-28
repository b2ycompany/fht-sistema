// app/telemedicine/[contractId]/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  DailyProvider,
  useLocalParticipant,
  useParticipant,
  useParticipantIds,
  useDailyEvent,
} from '@daily-co/daily-react';
import Daily, { type DailyCall as CallObject } from '@daily-co/daily-js';

import { getContractById, type Contract } from '@/lib/contract-service';
import { getConsultationByContractId, saveConsultationDetails, type Consultation, type ConsultationDetailsPayload } from '@/lib/consultation-service';
import { generatePrescription, type Medication, type Prescription } from '@/lib/prescription-service';
import { getCurrentUserData } from '@/lib/auth-service'; // ADICIONADO: Para buscar o perfil do médico

import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff, AlertTriangle, User, Save, PlusCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";


const VideoTile = ({ id }: { id: string }) => {
  const participant = useParticipant(id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoTrack = participant?.tracks.video.persistentTrack;

  useEffect(() => {
    if (videoRef.current && videoTrack) {
      videoRef.current.srcObject = new MediaStream([videoTrack]);
    }
  }, [videoTrack]);

  return (
    <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden shadow-lg">
      <video autoPlay muted={participant?.local} playsInline ref={videoRef} className="w-full h-full object-cover" />
      {!videoTrack && (
        <div className="w-full h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <User className="w-16 h-16" />
            <p className="font-bold">{participant?.user_name || 'Participante'}</p>
            <p className="text-xs">Câmera desligada</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        {participant?.local ? 'Você' : participant?.user_name || 'Participante'}
      </div>
    </div>
  );
};

const CallTray = ({ callObject }: { callObject: CallObject | null }) => {
  const localParticipant = useLocalParticipant();
  const router = useRouter();

  if (!callObject) return null;

  const toggleMic = () => callObject.setLocalAudio(!localParticipant?.audio);
  const toggleCam = () => callObject.setLocalVideo(!localParticipant?.video);
  const leaveCall = () => callObject.leave();

  useDailyEvent('left-meeting', () => {
    router.push('/dashboard/contracts');
  });

  return (
    <div className="flex justify-center items-center gap-3 p-4 bg-gray-800/80 backdrop-blur-sm border-t border-gray-700 rounded-t-xl">
      <Button onClick={toggleMic} variant="outline" size="icon" className="bg-gray-700 hover:bg-gray-600 border-gray-600 rounded-full h-12 w-12">
        {localParticipant?.audio ? <Mic size={20} /> : <MicOff size={20} className="text-red-500" />}
      </Button>
      <Button onClick={toggleCam} variant="outline" size="icon" className="bg-gray-700 hover:bg-gray-600 border-gray-600 rounded-full h-12 w-12">
        {localParticipant?.video ? <Video size={20} /> : <VideoOff size={20} className="text-red-500" />}
      </Button>
      <Button onClick={leaveCall} variant="destructive" size="icon" className="rounded-full h-14 w-14">
        <PhoneOff size={24} />
      </Button>
    </div>
  );
};

const PrescriptionForm: React.FC<{ consultation: Consultation, doctorName: string, doctorCrm: string, onPrescriptionGenerated: () => void }> = 
({ consultation, doctorName, doctorCrm, onPrescriptionGenerated }) => {
    const { toast } = useToast();
    const [medications, setMedications] = useState<Medication[]>([{ name: '', dosage: '', instructions: '' }]);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleMedicationChange = (index: number, field: keyof Medication, value: string) => {
        const newMeds = [...medications];
        newMeds[index][field] = value;
        setMedications(newMeds);
    };

    const addMedication = () => {
        setMedications([...medications, { name: '', dosage: '', instructions: '' }]);
    };

    const removeMedication = (index: number) => {
        if (medications.length <= 1) return;
        setMedications(medications.filter((_, i) => i !== index));
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsGenerating(true);
        try {
            const validMeds = medications.filter(m => m.name.trim() !== '' && m.dosage.trim() !== '' && m.instructions.trim() !== '');
            if (validMeds.length === 0) {
              toast({ title: "Nenhum medicamento válido", description: "Preencha todos os campos do medicamento.", variant: "destructive" });
              return;
            }
            await generatePrescription({
                consultationId: consultation.id,
                patientName: consultation.patientName,
                doctorName,
                doctorCrm,
                medications: validMeds,
            });
            toast({ title: "Sucesso!", description: "Receita gerada e salva." });
            onPrescriptionGenerated(); // Fecha o dialog e atualiza a lista
        } catch (error: any) {
            toast({ title: "Erro ao Gerar Receita", description: error.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <form onSubmit={handleGenerate} className="space-y-4">
            <div className="max-h-[50vh] overflow-y-auto pr-4 space-y-4">
                {medications.map((med, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2 relative bg-gray-900/50">
                        {medications.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeMedication(index)}>
                                <Trash2 className="h-4 w-4 text-red-500"/>
                            </Button>
                        )}
                        <div className="space-y-1">
                            <Label htmlFor={`med-name-${index}`}>Medicamento</Label>
                            <Input id={`med-name-${index}`} value={med.name} onChange={e => handleMedicationChange(index, 'name', e.target.value)} placeholder="Ex: Amoxicilina 500mg" required />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor={`med-dosage-${index}`}>Dose/Quantidade</Label>
                            <Input id={`med-dosage-${index}`} value={med.dosage} onChange={e => handleMedicationChange(index, 'dosage', e.target.value)} placeholder="Ex: 1 comprimido" required/>
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor={`med-instructions-${index}`}>Instruções</Label>
                            <Textarea id={`med-instructions-${index}`} value={med.instructions} onChange={e => handleMedicationChange(index, 'instructions', e.target.value)} placeholder="Ex: Tomar a cada 8 horas por 7 dias" required/>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
                <Button type="button" variant="outline" onClick={addMedication}><PlusCircle className="mr-2 h-4 w-4"/> Adicionar Medicamento</Button>
                <div className="flex gap-2">
                    <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                    <Button type="submit" disabled={isGenerating}>{isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Gerar Receita</Button>
                </div>
            </div>
        </form>
    );
};


const ElectronicHealthRecord: React.FC<{ consultation: Consultation | null; userProfile: any | null }> = ({ consultation, userProfile }) => {
    const { toast } = useToast();
    const [clinicalEvolution, setClinicalEvolution] = useState(consultation?.clinicalEvolution || '');
    const [diagnosticHypothesis, setDiagnosticHypothesis] = useState(consultation?.diagnosticHypothesis || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isPrescriptionDialogOpen, setIsPrescriptionDialogOpen] = useState(false);

    const handleSave = async () => {
        if (!consultation) return;
        setIsSaving(true);
        try {
            await saveConsultationDetails(consultation.id, {
                clinicalEvolution,
                diagnosticHypothesis,
            });
            toast({ title: "Sucesso!", description: "Prontuário salvo." });
        } catch (error: any) {
            toast({ title: "Erro ao Salvar", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!consultation) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 text-sm text-center text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
                <Loader2 className="h-6 w-6 animate-spin mb-4" />
                A carregar dados da consulta...
            </div>
        );
    }

    return (
        <Card className="h-full flex flex-col bg-gray-800 border-gray-700 text-white">
            <CardHeader>
                <CardTitle className="text-lg">Prontuário Eletrônico</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4 overflow-y-auto">
                <Tabs defaultValue="patient-data" className="flex-grow flex flex-col">
                    <TabsList className="grid w-full grid-cols-3 bg-gray-900">
                        <TabsTrigger value="patient-data">Paciente</TabsTrigger>
                        <TabsTrigger value="medical-record">Atendimento</TabsTrigger>
                        <TabsTrigger value="documents">Documentos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="patient-data" className="text-sm space-y-3 mt-4 flex-grow">
                        <div>
                            <Label className="text-gray-400">Nome</Label>
                            <p>{consultation.patientName}</p>
                        </div>
                        <div>
                            <Label className="text-gray-400">Queixa Principal</Label>
                            <p>{consultation.chiefComplaint}</p>
                        </div>
                        <div>
                            <Label className="text-gray-400">Histórico Resumido</Label>
                            <p className="whitespace-pre-wrap">{consultation.medicalHistorySummary || "Nenhum histórico informado."}</p>
                        </div>
                    </TabsContent>
                    <TabsContent value="medical-record" className="flex-grow flex flex-col gap-4 mt-4">
                         <div className="space-y-1.5 flex flex-col flex-grow">
                            <Label htmlFor="evolution">Evolução Clínica</Label>
                            <Textarea id="evolution" value={clinicalEvolution} onChange={e => setClinicalEvolution(e.target.value)} className="bg-gray-900 border-gray-600 text-white min-h-[150px] flex-grow" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="hypothesis">Hipótese Diagnóstica</Label>
                            <Textarea id="hypothesis" value={diagnosticHypothesis} onChange={e => setDiagnosticHypothesis(e.target.value)} className="bg-gray-900 border-gray-600 text-white" />
                        </div>
                    </TabsContent>
                    <TabsContent value="documents" className="mt-4 space-y-4">
                        <Dialog open={isPrescriptionDialogOpen} onOpenChange={setIsPrescriptionDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full bg-gray-700 hover:bg-gray-600 border-gray-600">Gerar Receita</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Nova Receita Médica</DialogTitle>
                                    <DialogDescription>Preencha os medicamentos e instruções para o paciente.</DialogDescription>
                                </DialogHeader>
                                {consultation && userProfile ? (
                                    <PrescriptionForm 
                                        consultation={consultation} 
                                        doctorName={userProfile.displayName || 'Nome não encontrado'}
                                        doctorCrm={userProfile.professionalCrm || 'CRM não encontrado'}
                                        onPrescriptionGenerated={() => {
                                            setIsPrescriptionDialogOpen(false);
                                            // TODO: Adicionar lógica para recarregar a lista de documentos gerados
                                        }}
                                    />
                                ) : <div className="py-8 text-center">A carregar dados do médico...</div>}
                            </DialogContent>
                        </Dialog>
                    </TabsContent>
                </Tabs>
                <div className="mt-auto pt-4">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Prontuário
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};


const TelemedicineRoom = ({ callObject }: { callObject: CallObject | null }) => {
  const { user } = useAuth(); // CORRIGIDO: Removido 'profile' daqui
  const router = useRouter();
  const params = useParams();
  const contractId = params.contractId as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<any | null>(null); // ADICIONADO: Estado para o perfil do médico
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const participantIds = useParticipantIds();

  useEffect(() => {
    if (!contractId || !callObject || !user) return;

    const fetchAndJoin = async () => {
      try {
        // ADICIONADO: Busca o perfil do médico em paralelo com os outros dados
        const [contractData, consultationData, profileData] = await Promise.all([
            getContractById(contractId),
            getConsultationByContractId(contractId),
            getCurrentUserData() 
        ]);

        setDoctorProfile(profileData); // Salva o perfil no estado

        if (!contractData || contractData.doctorId !== user.uid) {
          setError("Contrato não encontrado ou acesso não permitido.");
          setIsLoading(false); return;
        }
        if (!contractData.telemedicineLink) {
          setError("Link de telemedicina não encontrado para este contrato.");
          setIsLoading(false); return;
        }
        setContract(contractData);
        setConsultation(consultationData);

        await callObject.join({
          url: contractData.telemedicineLink,
          userName: user.displayName || "Médico(a)"
        });
      } catch (err: any) {
        setError(err.message || "Falha ao carregar a sala de atendimento.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndJoin();

    return () => {
      callObject?.leave();
    };
  }, [contractId, callObject, user, router]);

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
            <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
            <p className="mt-4 text-lg">A carregar dados da consulta...</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
            <AlertTriangle className="h-12 w-12 text-red-400" />
            <p className="mt-4 text-lg text-center">Erro: {error}</p>
            <Button onClick={() => router.push('/dashboard/contracts')} className="mt-4">Voltar</Button>
        </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col md:flex-row gap-4 p-4">
      <div className="w-full md:w-1/3 h-full">
        {/* CORRIGIDO: Passa o perfil buscado do estado */}
        <ElectronicHealthRecord consultation={consultation} userProfile={doctorProfile} />
      </div>
      <div className="w-full md:w-2/3 h-full flex flex-col gap-4">
          <header className="flex justify-between items-center flex-shrink-0">
            <h1 className="text-xl font-bold">Atendimento Telemedicina</h1>
            {contract && <p className="text-sm text-gray-400">Contrato com: {contract.hospitalName}</p>}
          </header>
          <main className="flex-grow grid grid-cols-1 place-content-center">
            {participantIds.map(id => <VideoTile key={id} id={id} />)}
          </main>
          <footer className="flex-shrink-0">
            <CallTray callObject={callObject} />
          </footer>
      </div>
    </div>
  );
};


export default function TelemedicinePageWrapper() {
  const [callObject, setCallObject] = useState<CallObject | null>(null);

  useEffect(() => {
    const newCallObject = Daily.createCallObject();
    setCallObject(newCallObject);
    return () => {
      newCallObject.destroy();
    };
  }, []);

  if (!callObject) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
            <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
            <p className="mt-4 text-lg">A inicializar a sala de vídeo...</p>
        </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <TelemedicineRoom callObject={callObject} />
    </DailyProvider>
  );
}