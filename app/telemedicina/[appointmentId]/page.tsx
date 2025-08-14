"use client";

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DailyProvider, useLocalParticipant, useParticipant, useParticipantIds, useDailyEvent } from '@daily-co/daily-react';
import Daily, { type DailyCall as CallObject, type DailyParticipant } from '@daily-co/daily-js';
import { getAppointmentById, saveAppointmentDetails, type TelemedicineAppointment } from '@/lib/appointment-service';
import { getCurrentUserData, type DoctorProfile } from '@/lib/auth-service';
import { useAuth } from '@/components/auth-provider';
import { AIAnalysisDashboard } from '@/components/ai/AIAnalysisDashboard';
import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff, AlertTriangle, User, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const VideoTile = memo(({ id }: { id: string }) => {
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
});
VideoTile.displayName = 'VideoTile';

const CallTray = memo(({ callObject }: { callObject: CallObject | null }) => {
  const localParticipant = useLocalParticipant();
  const router = useRouter();
  if (!callObject) return null;
  const toggleMic = () => callObject.setLocalAudio(!localParticipant?.audio);
  const toggleCam = () => callObject.setLocalVideo(!localParticipant?.video);
  const leaveCall = () => callObject.leave();
  useDailyEvent('left-meeting', () => { router.push('/dashboard/agenda'); });
  return (
    <div className="flex justify-center items-center gap-3 p-4 bg-gray-800/80 backdrop-blur-sm border-t border-gray-700 rounded-t-xl">
      <Button onClick={toggleMic} variant="outline" size="icon" className="bg-gray-700 hover:bg-gray-600 border-gray-600 rounded-full h-12 w-12">{localParticipant?.audio ? <Mic size={20} /> : <MicOff size={20} className="text-red-500" />}</Button>
      <Button onClick={toggleCam} variant="outline" size="icon" className="bg-gray-700 hover:bg-gray-600 border-gray-600 rounded-full h-12 w-12">{localParticipant?.video ? <Video size={20} /> : <VideoOff size={20} className="text-red-500" />}</Button>
      <Button onClick={leaveCall} variant="destructive" size="icon" className="rounded-full h-14 w-14"><PhoneOff size={24} /></Button>
    </div>
  );
});
CallTray.displayName = 'CallTray';

const ElectronicHealthRecord = memo(({ appointment, userProfile, patientVideoTrack }: { appointment: TelemedicineAppointment | null; userProfile: DoctorProfile | null, patientVideoTrack: MediaStreamTrack | null }) => {
    const { toast } = useToast();
    const [clinicalEvolution, setClinicalEvolution] = useState(appointment?.clinicalEvolution || '');
    const [diagnosticHypothesis, setDiagnosticHypothesis] = useState(appointment?.diagnosticHypothesis || '');
    const [isSaving, setIsSaving] = useState(false);
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
            await saveAppointmentDetails(appointment.id, { clinicalEvolution, diagnosticHypothesis, });
            toast({ title: "Sucesso!", description: "Prontuário salvo." });
        } catch (error: any) {
            toast({ title: "Erro ao Salvar", description: error.message, variant: "destructive" });
        } finally { setIsSaving(false); }
    };
    if (!appointment || !userProfile) { return <div className="h-full flex items-center justify-center p-4 bg-gray-800 rounded-lg"><Loader2 className="h-6 w-6 animate-spin" /></div>; }
    return (
        <Card className="h-full flex flex-col bg-gray-800 border-gray-700 text-white">
            <CardHeader><CardTitle className="text-lg">Prontuário Eletrônico</CardTitle></CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4 overflow-y-auto">
                <Tabs defaultValue="ai-analysis" className="flex-grow flex flex-col">
                    <TabsList className="grid w-full grid-cols-4 bg-gray-900">
                        <TabsTrigger value="ai-analysis" className="text-purple-400">Análise IA</TabsTrigger>
                        <TabsTrigger value="medical-record">Atendimento</TabsTrigger>
                        <TabsTrigger value="patient-data">Paciente</TabsTrigger>
                        <TabsTrigger value="documents">Documentos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="patient-data" className="text-sm space-y-3 mt-4 flex-grow">{/* ... */}</TabsContent>
                    <TabsContent value="medical-record" className="flex-grow flex flex-col gap-4 mt-4">{/* ... */}</TabsContent>
                    <TabsContent value="documents" className="mt-4 space-y-4">{/* ... */}</TabsContent>
                    <TabsContent value="ai-analysis" className="mt-4 flex-grow">
                       <AIAnalysisDashboard appointment={appointment} patientVideoTrack={patientVideoTrack} />
                    </TabsContent>
                </Tabs>
                <div className="mt-auto pt-4 border-t border-gray-700">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Anotações</Button>
                </div>
            </CardContent>
        </Card>
    );
});
ElectronicHealthRecord.displayName = 'ElectronicHealthRecord';

const ParticipantRenderer = memo(() => {
    const participantIds = useParticipantIds({ filter: 'remote' });
    return ( <div className="grid grid-cols-1 gap-4">{participantIds.map(id => <VideoTile key={id} id={id} />)}</div> )
});
ParticipantRenderer.displayName = 'ParticipantRenderer';

const TelemedicineAppointmentRoom = ({ callObject }: { callObject: CallObject | null }) => {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.appointmentId as string;
  const [appointment, setAppointment] = useState<TelemedicineAppointment | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientVideoTrack, setPatientVideoTrack] = useState<MediaStreamTrack | null>(null);
  const remoteParticipantIds = useParticipantIds({ filter: 'remote' });
  const remoteParticipant = useParticipant(remoteParticipantIds[0]);

  useEffect(() => {
    if(remoteParticipant?.tracks.video.persistentTrack) {
        setPatientVideoTrack(remoteParticipant.tracks.video.persistentTrack);
    }
  }, [remoteParticipant]);

  useEffect(() => {
    if (!appointmentId || !callObject || !user) return;
    const fetchAndJoin = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [appointmentData, profileData] = await Promise.all([getAppointmentById(appointmentId), getCurrentUserData() as Promise<DoctorProfile>]);
        if (!appointmentData) throw new Error("Agendamento não encontrado.");
        if (appointmentData.doctorId !== user.uid) throw new Error("Acesso não permitido a este agendamento.");
        if (!appointmentData.telemedicineRoomUrl) throw new Error("Link de telemedicina inválido.");
        setAppointment(appointmentData);
        setDoctorProfile(profileData);
        await callObject.join({ url: appointmentData.telemedicineRoomUrl, userName: profileData?.displayName || "Médico(a)" });
      } catch (err: any) { setError(err.message || "Falha ao carregar a sala."); } finally { setIsLoading(false); }
    };
    fetchAndJoin();
  }, [appointmentId, callObject, user, router]);

  if (isLoading) { return <div className="h-screen flex items-center justify-center bg-gray-900"><Loader2 className="h-12 w-12 animate-spin text-blue-400" /><p className="ml-4">A carregar...</p></div>; }
  if (error) { return <div className="h-screen flex flex-col items-center justify-center bg-gray-900 p-4"><AlertTriangle className="h-12 w-12 text-red-400" /><p className="mt-4 text-center">{error}</p><Button onClick={() => router.push('/dashboard/agenda')} className="mt-4">Voltar</Button></div>; }
  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col md:flex-row gap-4 p-4">
      <div className="w-full md:w-2/5 xl:w-1/3 h-full overflow-y-auto">
        <ElectronicHealthRecord appointment={appointment} userProfile={doctorProfile} patientVideoTrack={patientVideoTrack} />
      </div>
      <div className="w-full md:w-3/5 xl:w-2/3 h-full flex flex-col gap-4">
          <header className="flex justify-between items-center"><h1 className="text-xl font-bold">Atendimento Telemedicina</h1>{appointment && <p className="text-sm text-gray-400">Paciente: {appointment.patientName}</p>}</header>
          <main className="flex-grow flex items-center justify-center overflow-hidden">
            {remoteParticipantIds.length === 0 ? <div className="text-center text-gray-400">A aguardar o paciente entrar...</div> : <ParticipantRenderer />}
          </main>
          <footer className="flex-shrink-0"><CallTray callObject={callObject} /></footer>
      </div>
    </div>
  );
};

export default function TelemedicinePageWrapper() {
  const [callObject, setCallObject] = useState<CallObject | null>(null);
  useEffect(() => {
    const dailyCo = Daily.createCallObject();
    setCallObject(dailyCo);
    return () => { dailyCo.leave().finally(() => { dailyCo.destroy(); }); };
  }, []);
  if (!callObject) { return <div className="h-screen flex items-center justify-center bg-gray-900"><Loader2 className="h-12 w-12 animate-spin" /><p className="ml-4">A inicializar vídeo...</p></div>; }
  return (
    <DailyProvider callObject={callObject}>
        <TelemedicineAppointmentRoom callObject={callObject} />
    </DailyProvider>
  );
}