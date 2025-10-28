// app/telemedicina/[appointmentId]/page.tsx (Versão Final Completa)
"use client";

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
// Importa o tipo correto 'Appointment'
import { getAppointmentById, saveAppointmentDetails, type Appointment } from '@/lib/appointment-service';
import { getCurrentUserData, type DoctorProfile, getUserProfile } from '@/lib/auth-service';
import { useAuth } from '@/components/auth-provider';
import { DailyProvider, useLocalParticipant, useParticipant, useParticipantIds, useDailyEvent } from '@daily-co/daily-react';
import Daily, { type DailyCall as CallObject, type DailyParticipant } from '@daily-co/daily-js';
import { AIAnalysisDashboard } from '@/components/ai/AIAnalysisDashboard';
import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff, AlertTriangle, User, Save, History, FileText, Pill, ScanFace, Scale, Ruler, BrainCircuit, Download, ArrowLeft, Hospital, Calendar, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { PatientHistoryDialog } from '@/components/ui/PatientHistoryDialog';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

// Define a interface detalhada estendendo o tipo correto 'Appointment'
interface DetailedAppointment extends Appointment {
    patientSUSCard?: string;
    patientMedicalHistorySummary?: string;
    previousPrescriptions?: Array<{ date: Timestamp; medication: string; }>;
    // Os campos opcionais como 'generatedDocuments' já vêm do tipo 'Appointment' se existirem lá
    generatedDocuments?: Array<{ name: string; type: string; url: string; createdAt: Timestamp }>;
}

// --- Componente VideoTile (sem alterações) ---
const VideoTile = memo(({ id }: { id: string }) => {
    const participant = useParticipant(id);
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoTrack = participant?.tracks.video.persistentTrack;
    useEffect(() => {
        if (videoRef.current && videoTrack) {
            videoRef.current.srcObject = new MediaStream([videoTrack]);
        } else if (videoRef.current) {
            videoRef.current.srcObject = null; // Limpa se não houver track
        }
    }, [videoTrack]);
    return (
        <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden shadow-lg h-full w-full"> {/* Garante preenchimento */}
            <video autoPlay muted={participant?.local} playsInline ref={videoRef} className="w-full h-full object-cover" />
            {!videoTrack && ( /* Exibe placeholder se vídeo desligado */
                <div className="absolute inset-0 flex items-center justify-center">
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
});
VideoTile.displayName = 'VideoTile';

// --- Componente CallTray (sem alterações) ---
const CallTray = memo(({ callObject }: { callObject: CallObject | null }) => {
    const localParticipant = useLocalParticipant();
    const router = useRouter();
    const [isLeaving, setIsLeaving] = useState(false); // Estado para feedback visual

    useDailyEvent('left-meeting', useCallback(() => {
        console.log("Evento 'left-meeting' recebido.");
        router.push('/dashboard/agenda'); // Ou outra rota apropriada
    }, [router]));

    if (!callObject) return null;

    const toggleMic = () => callObject.setLocalAudio(!localParticipant?.audio);
    const toggleCam = () => callObject.setLocalVideo(!localParticipant?.video);

    const leaveCall = useCallback(async () => {
        setIsLeaving(true);
        try {
            await callObject.leave();
             // O redirecionamento agora é feito pelo evento 'left-meeting'
        } catch (error) {
            console.error("Erro ao tentar sair da chamada:", error);
             router.push('/dashboard/agenda'); // Fallback de redirecionamento
        } finally {
            setIsLeaving(false);
        }
    }, [callObject, router]);

    return (
        <div className="flex justify-center items-center gap-3 p-4 bg-gray-800/80 backdrop-blur-sm border-t border-gray-700 rounded-t-xl">
            <Button onClick={toggleMic} variant="outline" size="icon" className="bg-gray-700 hover:bg-gray-600 border-gray-600 rounded-full h-12 w-12 text-white">
                {localParticipant?.audio ? <Mic size={20} /> : <MicOff size={20} className="text-red-500" />}
            </Button>
            <Button onClick={toggleCam} variant="outline" size="icon" className="bg-gray-700 hover:bg-gray-600 border-gray-600 rounded-full h-12 w-12 text-white">
                {localParticipant?.video ? <Video size={20} /> : <VideoOff size={20} className="text-red-500" />}
            </Button>
            <Button onClick={leaveCall} variant="destructive" size="icon" className="rounded-full h-14 w-14" disabled={isLeaving}>
                {isLeaving ? <Loader2 className="animate-spin" /> : <PhoneOff size={24} />}
            </Button>
        </div>
    );
});
CallTray.displayName = 'CallTray';

// --- COMPONENTE DO PRONTUÁRIO ELETRÔNICO (EHR) APRIMORADO ---
const ElectronicHealthRecordEnhanced = memo(({
    appointment,
    userProfile,
    patientVideoTrack,
    refreshData
}: {
    appointment: DetailedAppointment | null;
    userProfile: DoctorProfile | null;
    patientVideoTrack: MediaStreamTrack | null;
    refreshData: () => void;
}) => {
    const { toast } = useToast();
    const [clinicalEvolution, setClinicalEvolution] = useState(appointment?.clinicalEvolution || '');
    const [diagnosticHypothesis, setDiagnosticHypothesis] = useState(appointment?.diagnosticHypothesis || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    useEffect(() => {
        if (appointment) {
            setClinicalEvolution(appointment.clinicalEvolution || '');
            setDiagnosticHypothesis(appointment.diagnosticHypothesis || '');
        }
    }, [appointment]);

    const handleSave = async () => {
        if (!appointment) return;
        setIsSaving(true);
        try {
            await saveAppointmentDetails(appointment.id, { clinicalEvolution, diagnosticHypothesis });
            toast({ title: "Sucesso!", description: "Prontuário salvo." });
        } catch (error: any) {
            toast({ title: "Erro ao Salvar", description: error.message, variant: "destructive" });
        } finally { setIsSaving(false); }
    };

    if (!appointment || !userProfile) { return <Card className="h-full flex items-center justify-center p-4 bg-gray-800 border-gray-700 text-white"><Loader2 className="h-6 w-6 animate-spin" /></Card>; }

    return (
        <Card className="h-full flex flex-col bg-gray-800 border-gray-700 text-white overflow-hidden">
            <CardHeader className="flex-shrink-0"><CardTitle className="text-lg">Prontuário e Análise</CardTitle></CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4 overflow-y-auto p-4"> {/* Adicionado padding */}
                <Tabs defaultValue="atendimento" className="flex-grow flex flex-col">
                    <TabsList className="grid w-full grid-cols-4 bg-gray-900 sticky top-0 z-10">
                        <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
                        <TabsTrigger value="paciente">Paciente</TabsTrigger>
                        <TabsTrigger value="analise_ia" className="text-purple-400">Análise IA</TabsTrigger>
                        <TabsTrigger value="documentos">Documentos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="atendimento" className="flex-grow flex flex-col gap-4 mt-4">
                        <div className="space-y-1.5 flex flex-col flex-grow"><Label htmlFor="evolution">Evolução Clínica</Label><Textarea id="evolution" value={clinicalEvolution} onChange={e => setClinicalEvolution(e.target.value)} className="min-h-[150px] flex-grow bg-gray-700 border-gray-600 text-white placeholder-gray-400" placeholder="Descreva a evolução..." /></div>
                        <div className="space-y-1.5"><Label htmlFor="hypothesis">Hipótese Diagnóstica / Conduta</Label><Textarea id="hypothesis" value={diagnosticHypothesis} onChange={e => setDiagnosticHypothesis(e.target.value)} className="bg-gray-700 border-gray-600 text-white placeholder-gray-400" placeholder="Descreva a hipótese..." /></div>
                    </TabsContent>
                    <TabsContent value="paciente" className="text-sm space-y-4 mt-4 flex-grow">
                        <div className="p-3 bg-gray-700/50 rounded-md"><Label className="text-gray-400 block mb-1">Nome</Label><p className="font-medium text-lg">{appointment.patientName}</p></div>
                        <div className="p-3 bg-gray-700/50 rounded-md"><Label className="text-gray-400 block mb-1">Nº SUS</Label><p>{appointment.patientSUSCard || <span className='italic text-gray-500'>Não informado</span>}</p></div>
                        <div className="p-3 bg-gray-700/50 rounded-md"><Label className="text-gray-400 block mb-1">Histórico Resumido</Label><p className="whitespace-pre-wrap">{appointment.patientMedicalHistorySummary || <span className='italic text-gray-500'>Sem resumo</span>}</p></div>
                        
                        {/* ============================================================================ */}
                        {/* 🔹 CORREÇÃO DEFINITIVA DO TYPESCRIPT (patientId) APLICADA AQUI 🔹         */}
                        {/* ============================================================================ */}
                        {/* Só renderiza o botão/dialog se patientId existir */}
                        {appointment.patientId ? (
                            <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                                        <History className="mr-2 h-4 w-4" />Ver Histórico Detalhado
                                    </Button>
                                </DialogTrigger>
                                {/* Agora temos certeza que appointment.patientId é uma string */}
                                <PatientHistoryDialog patientId={appointment.patientId} currentConsultationId={appointment.id} />
                            </Dialog>
                        ) : (
                            // Se não houver patientId, exibe um botão desabilitado
                            <Button variant="outline" className="w-full border-gray-600 text-gray-400" disabled>
                                <History className="mr-2 h-4 w-4" />Histórico Indisponível (Sem ID do Paciente)
                            </Button>
                        )}
                        {/* ============================================================================ */}

                    </TabsContent>
                    <TabsContent value="documentos" className="mt-4 space-y-4">
                        <Dialog open={isPrescriptionModalOpen} onOpenChange={setIsPrescriptionModalOpen}><DialogTrigger asChild><Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"><Pill className="mr-2 h-4 w-4"/>Gerar Receita</Button></DialogTrigger><DialogContent><p>Modal de Prescrição (a implementar)</p></DialogContent></Dialog>
                        <div className="space-y-2 pt-4 border-t border-gray-700"><h3 className="text-sm font-semibold">Documentos Anteriores</h3>
                             {appointment.generatedDocuments && appointment.generatedDocuments.length > 0 ? (
                                appointment.generatedDocuments.map((doc, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-700/50 border border-gray-600 rounded-md">
                                        <div className="flex items-center gap-2">
                                            {doc.type === 'prescription' ? <Pill className="h-4 w-4 text-blue-400"/> : <FileText className="h-4 w-4 text-green-400"/>}
                                            <span className="font-medium text-sm">{doc.name}</span>
                                            <span className="text-xs text-gray-400">({(doc.createdAt as Timestamp)?.toDate().toLocaleDateString('pt-BR') || 'Data?'})</span>
                                        </div>
                                        <Button asChild variant="ghost" size="icon" className="h-7 w-7 text-gray-300 hover:text-white"><Link href={doc.url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4"/></Link></Button>
                                    </div>
                                ))
                             ) : (<p className="text-xs text-center text-gray-500 py-4">Nenhum documento.</p>)}
                        </div>
                    </TabsContent>
                    <TabsContent value="analise_ia" className="mt-4 flex-grow">
                       <AIAnalysisDashboard appointment={appointment} patientVideoTrack={patientVideoTrack} />
                       <Card className="mt-4 bg-gray-700/50 border-gray-600"><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BrainCircuit /> Ferramentas de Avaliação</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-xs text-gray-400">Iniciar protocolos específicos.</p><Button variant="secondary" className="w-full bg-purple-600 hover:bg-purple-700 text-white" disabled>Iniciar Protocolo TOC (em breve)</Button></CardContent></Card>
                    </TabsContent>
                </Tabs>
                <div className="mt-auto pt-4 border-t border-gray-700 flex-shrink-0">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Anotações
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
});
ElectronicHealthRecordEnhanced.displayName = 'ElectronicHealthRecordEnhanced';

// --- Componente ParticipantRenderer (sem alterações) ---
const ParticipantRenderer = memo(() => {
    const participantIds = useParticipantIds({ filter: 'remote' });
    return ( <div className="grid grid-cols-1 gap-4 h-full w-full">{participantIds.map(id => <VideoTile key={id} id={id} />)}</div> ) // Adicionado h-full w-full
});
ParticipantRenderer.displayName = 'ParticipantRenderer';

// --- Componente Principal da Sala de Atendimento ---
const TelemedicineAppointmentRoom = ({ callObject }: { callObject: CallObject | null }) => {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.appointmentId as string;
  const [appointment, setAppointment] = useState<DetailedAppointment | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientVideoTrack, setPatientVideoTrack] = useState<MediaStreamTrack | null>(null);
  const remoteParticipantIds = useParticipantIds({ filter: 'remote' });
  const remoteParticipant = useParticipant(remoteParticipantIds[0]); // Pega o primeiro participante remoto

  useEffect(() => {
    if(remoteParticipant?.tracks.video.persistentTrack) { setPatientVideoTrack(remoteParticipant.tracks.video.persistentTrack); }
    else { setPatientVideoTrack(null); }
  }, [remoteParticipant]);

  const fetchData = useCallback(async () => {
      if (!appointmentId || !user) return;
      try {
        const [appointmentData, profileData] = await Promise.all([
          getAppointmentById(appointmentId) as Promise<DetailedAppointment | null>,
          getCurrentUserData() as Promise<DoctorProfile>
        ]);
        if (!appointmentData) throw new Error("Agendamento não encontrado.");
        if (appointmentData.doctorId !== user.uid) throw new Error("Acesso não permitido.");
        if (!appointmentData.telemedicineRoomUrl) throw new Error("Link inválido.");

        setAppointment(appointmentData);
        setDoctorProfile(profileData);
        setError(null);

        if (callObject && callObject.meetingState() === 'new') {
             await callObject.join({ url: appointmentData.telemedicineRoomUrl, userName: profileData?.displayName || "Médico(a)" });
        }
      } catch (err: any) {
        console.error("Erro ao carregar dados da consulta:", err);
        setError(err.message || "Falha ao carregar a sala.");
      } finally { setIsLoading(false); }
  }, [appointmentId, callObject, user]);

  useEffect(() => { setIsLoading(true); fetchData(); }, [fetchData]);

  if (isLoading) { return <div className="h-screen flex items-center justify-center bg-gray-900 text-white"><Loader2 className="h-12 w-12 animate-spin text-blue-400" /><p className="ml-4">Carregando consulta...</p></div>; }
  if (error) { return <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4"><AlertTriangle className="h-12 w-12 text-red-400" /><p className="mt-4 text-center">{error}</p><Button onClick={() => router.push('/dashboard/agenda')} className="mt-4">Voltar para Agenda</Button></div>; }

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col md:flex-row gap-4 p-4 overflow-hidden">
      <div className="w-full md:w-2/5 xl:w-1/3 h-full overflow-y-auto">
        <ElectronicHealthRecordEnhanced appointment={appointment} userProfile={doctorProfile} patientVideoTrack={patientVideoTrack} refreshData={fetchData} />
      </div>
      <div className="w-full md:w-3/5 xl:w-2/3 h-full flex flex-col gap-4">
          <header className="flex justify-between items-center flex-shrink-0"><h1 className="text-xl font-bold">Atendimento Telemedicina</h1>{appointment && <p className="text-sm text-gray-400">Paciente: {appointment.patientName}</p>}</header>
          <main className="flex-grow flex flex-col items-center justify-center overflow-hidden bg-black rounded-lg relative">
            {remoteParticipantIds.length === 0 ? (
                <div className="text-center text-gray-400 p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />Aguardando o paciente...</div>
             ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                    <VideoTile key={remoteParticipantIds[0]} id={remoteParticipantIds[0]} />
                </div>
             )}
             <div className="absolute bottom-20 right-4 w-1/4 max-w-[200px] z-20 border-2 border-gray-700 rounded-md shadow-lg">
                <VideoTile id={useLocalParticipant()?.session_id || 'local'} />
             </div>
          </main>
          <footer className="flex-shrink-0 z-10"><CallTray callObject={callObject} /></footer>
      </div>
    </div>
  );
};

// --- Wrapper Principal da Página (sem alterações) ---
export default function TelemedicinePageWrapper() {
  const [callObject, setCallObject] = useState<CallObject | null>(null);
  useEffect(() => {
    const dailyCo = Daily.createCallObject(); setCallObject(dailyCo);
    return () => { dailyCo.leave().finally(() => { dailyCo.destroy(); }); };
  }, []);
  if (!callObject) { return <div className="h-screen flex items-center justify-center bg-gray-900 text-white"><Loader2 className="h-12 w-12 animate-spin" /><p className="ml-4">Inicializando vídeo...</p></div>; }
  return ( <DailyProvider callObject={callObject}><TelemedicineAppointmentRoom callObject={callObject} /></DailyProvider> );
}