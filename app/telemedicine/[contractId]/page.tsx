// app/telemedicine/[contractId]/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

// CORREÇÃO: Importações separadas para a biblioteca React e a biblioteca JS principal.
import {
  DailyProvider,
  useLocalParticipant,
  useParticipant,
  useParticipantIds,
  useDailyEvent,
} from '@daily-co/daily-react';
import Daily, { type DailyCall as CallObject } from '@daily-co/daily-js'; // Importa o Daily e o tipo CallObject daqui

import { getContractById, type Contract } from '@/lib/contract-service';
import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff, AlertTriangle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';

// --- Componentes da UI da Videochamada ---

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

// --- Componente principal da Sala de Atendimento ---

const TelemedicineRoom = ({ callObject }: { callObject: CallObject | null }) => {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const contractId = params.contractId as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const participantIds = useParticipantIds();

  useEffect(() => {
    if (!contractId || !callObject || !user) return;

    const fetchAndJoin = async () => {
      try {
        const contractData = await getContractById(contractId);
        if (!contractData || contractData.doctorId !== user.uid) {
          setError("Contrato não encontrado ou acesso não permitido.");
          setIsLoading(false);
          return;
        }
        if (!contractData.telemedicineLink) {
          setError("Link de telemedicina não encontrado para este contrato.");
          setIsLoading(false);
          return;
        }
        setContract(contractData);
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
    return <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white"><Loader2 className="h-12 w-12 animate-spin text-blue-400" /><p className="mt-4 text-lg">A entrar na sala de atendimento...</p></div>;
  }

  if (error) {
    return <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4"><AlertTriangle className="h-12 w-12 text-red-400" /><p className="mt-4 text-lg text-center">Erro: {error}</p><Button onClick={() => router.push('/dashboard/contracts')} className="mt-4">Voltar</Button></div>;
  }

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col p-4 gap-4">
      <header className="flex justify-between items-center flex-shrink-0">
        <h1 className="text-xl font-bold">Atendimento Telemedicina</h1>
        {contract && <p className="text-sm text-gray-400">Contrato com: {contract.hospitalName}</p>}
      </header>
      <main className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 place-content-center">
        {participantIds.map(id => <VideoTile key={id} id={id} />)}
      </main>
      <footer className="flex-shrink-0">
        <CallTray callObject={callObject} />
      </footer>
    </div>
  );
};

export default function TelemedicinePageWrapper() {
  // CORREÇÃO: `Daily.createCallObject()` agora funciona porque `Daily` foi importado de '@daily-co/daily-js'
  const callObject = useMemo(() => Daily.createCallObject(), []);

  return (
    <DailyProvider callObject={callObject}>
      <TelemedicineRoom callObject={callObject} />
    </DailyProvider>
  );
}