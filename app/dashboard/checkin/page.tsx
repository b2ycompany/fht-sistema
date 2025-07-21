// app/dashboard/checkin/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import {
    MapPinIcon, LogIn, LogOut, CalendarDays, ClockIcon, AlertTriangle, Loader2,
    ClipboardList, RotateCcw, Camera
} from "lucide-react";
import { getActiveShiftsForCheckin, performCheckin, performCheckout, type CheckinRecord } from "@/lib/checkin-service";
import { uploadFileToStorage } from "@/lib/storage-service";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";

// --- COMPONENTES DE ESTADO (Loading, Empty, Error) ---
const LoadingState = React.memo(({ message = "A carregar os seus plantões..." }: { message?: string }) => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ message }: { message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">Nenhum plantão encontrado</p><p className="max-w-xs">{message}</p></div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p><p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados."}</p>{onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente</Button> )}</div> ));

// --- FUNÇÃO UTILITÁRIA PARA CONVERTER DATAURL PARA FILE ---
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

// --- TIPOS E INTERFACE PARA PROPS ---
interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

// --- COMPONENTE DO MODAL DA CÂMERA ---
const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startCamera = useCallback(async () => {
        setError(null);
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } else {
                setError("O seu navegador não suporta acesso à câmera.");
            }
        } catch (err) {
            console.error("Erro ao aceder à câmera:", err);
            setError("Não foi possível aceder à câmera. Verifique as permissões do seu navegador.");
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }, [stream]);

    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen, startCamera, stopCamera]);
    
    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            const dataUrl = canvas.toDataURL('image/jpeg');
            onCapture(dataUrl);
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Verificação por Foto</DialogTitle>
                    <DialogDescription>Centralize o seu rosto e capture a imagem para o check-in.</DialogDescription>
                </DialogHeader>
                <div className="relative">
                    {error && <div className="text-red-500 text-sm p-4 bg-red-50 rounded-md">{error}</div>}
                    <video ref={videoRef} autoPlay playsInline className={cn("w-full h-auto rounded-md bg-gray-200", { 'hidden': error })}></video>
                    <canvas ref={canvasRef} className="hidden"></canvas>
                </div>
                <Button onClick={handleCapture} disabled={!stream || !!error}>
                    <Camera className="mr-2 h-4 w-4" /> Capturar Foto
                </Button>
            </DialogContent>
        </Dialog>
    );
};

// --- COMPONENTE PRINCIPAL DA PÁGINA ---
export default function DoctorCheckinPage() {
    const { toast } = useToast();
    const [activeShifts, setActiveShifts] = useState<CheckinRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

    const fetchActiveShifts = useCallback(async () => {
        setIsLoading(true); setError(null);
        try {
            const data = await getActiveShiftsForCheckin();
            setActiveShifts(data);
        } catch (err: any) {
            setError(err.message || "Falha ao carregar plantões.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActiveShifts();
    }, [fetchActiveShifts]);

    const handlePhotoCaptured = (photoDataUrl: string) => {
        if (!selectedRecordId || !auth.currentUser) return;
        
        const recordId = selectedRecordId;
        const userId = auth.currentUser.uid;
        
        setActionLoadingId(recordId);
        
        toast({ title: "A obter a sua localização..." });
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
                    // 1. Converter dataURL para File
                    const photoFile = dataURLtoFile(photoDataUrl, `${recordId}.jpg`);

                    // 2. Fazer upload da foto usando o novo serviço
                    toast({ title: "A enviar a sua foto..." });
                    const storagePath = `checkin_photos/${userId}/${recordId}.jpg`;
                    const photoUrl = await uploadFileToStorage(photoFile, storagePath);
                    
                    // 3. Realizar o check-in
                    toast({ title: "A registar o seu check-in..." });
                    await performCheckin(recordId, latitude, longitude, photoUrl);
                    
                    toast({ title: "Check-in Realizado!", description: "O seu início de plantão foi registado com sucesso.", variant: "success" });
                    fetchActiveShifts();
                } catch (err: any) {
                    toast({ title: `Erro no Processo de Check-in`, description: err.message, variant: "destructive" });
                } finally {
                    setActionLoadingId(null);
                }
            },
            (geoError) => {
                let message = "Não foi possível obter a sua localização. ";
                switch(geoError.code) {
                    case geoError.PERMISSION_DENIED: message += "Por favor, ative a permissão de localização no seu navegador."; break;
                    case geoError.POSITION_UNAVAILABLE: message += "Informação de localização indisponível no momento."; break;
                    case geoError.TIMEOUT: message += "Tempo esgotado ao buscar localização."; break;
                    default: message += "Ocorreu um erro desconhecido."; break;
                }
                toast({ title: "Falha na Geolocalização", description: message, variant: "destructive" });
                setActionLoadingId(null);
            },
            { timeout: 15000, enableHighAccuracy: true }
        );
    };

    const handleCheckout = async (recordId: string) => {
        setActionLoadingId(recordId);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    await performCheckout(recordId, position.coords.latitude, position.coords.longitude);
                    toast({ title: "Check-out Realizado!", description: "O seu fim de plantão foi registado.", variant: "success" });
                    fetchActiveShifts();
                } catch (err: any)                    {
                    toast({ title: "Erro ao fazer Check-out", description: err.message, variant: "destructive" });
                } finally {
                    setActionLoadingId(null);
                }
            },
             (geoError) => {
                let message = "Não foi possível obter sua localização para o checkout.";
                toast({ title: "Falha na Geolocalização", description: message, variant: "destructive" });
                setActionLoadingId(null);
             }
        );
    };

    const openCameraForCheckin = (recordId: string) => {
        setSelectedRecordId(recordId);
        setIsCameraOpen(true);
    };

    return (
        <div className="space-y-6">
            <CameraModal 
                isOpen={isCameraOpen} 
                onClose={() => setIsCameraOpen(false)}
                onCapture={handlePhotoCaptured}
            />
            <h1 className="text-2xl md:text-3xl font-bold">Check-in / Check-out de Plantões</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Seus Próximos Plantões</CardTitle>
                    <CardDescription>Realize o check-in ao iniciar e o check-out ao finalizar seus plantões aqui.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && <LoadingState />}
                    {!isLoading && error && <ErrorState message={error} onRetry={fetchActiveShifts} />}
                    {!isLoading && !error && activeShifts.length === 0 && <EmptyState message="Você não tem plantões confirmados que requerem check-in/out." />}
                    {!isLoading && !error && activeShifts.length > 0 && (
                        <div className="space-y-4">
                            {activeShifts.map(record => (
                                <ShiftCheckinItem
                                    key={record.id}
                                    record={record}
                                    onCheckinClick={() => openCameraForCheckin(record.id)}
                                    onCheckoutClick={handleCheckout}
                                    isActionLoading={actionLoadingId}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            <div className="mt-6 p-4 border rounded-lg bg-amber-50 text-amber-800">
                <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 text-amber-600" />
                    <div>
                        <h3 className="font-semibold">Importante sobre Geolocalização e Câmera</h3>
                        <p className="text-xs mt-1">Para realizar o check-in, o seu navegador solicitará permissão para aceder à sua localização e câmera. Isto é necessário para validar a sua presença e identidade no local do plantão.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// -- Interface de Props para o Item do Plantão ---
interface ShiftCheckinItemProps {
  record: CheckinRecord;
  onCheckinClick: () => void;
  onCheckoutClick: (recordId: string) => void;
  isActionLoading: string | null;
}

// -- Componente do Item do Plantão (Tipado) ---
const ShiftCheckinItem: React.FC<ShiftCheckinItemProps> = ({ record, onCheckinClick, onCheckoutClick, isActionLoading }) => {
    const shiftDate = record.shiftDate.toDate();
    const isCurrentlyLoading = isActionLoading === record.id;
    const canCheckin = record.status === 'SCHEDULED';
    const canCheckout = record.status === 'CHECKED_IN';
    const getStatusBadgeProps = (status: CheckinRecord['status']): { variant: BadgeProps["variant"], className: string } => {
        switch (status) {
            case 'SCHEDULED': return { variant: 'outline', className: 'border-blue-300 text-blue-700 bg-blue-50' };
            case 'CHECKED_IN': return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-300' };
            case 'CHECKED_OUT': return { variant: 'secondary', className: 'bg-gray-200 text-gray-700' };
            default: return { variant: 'destructive', className: '' };
        }
    };
    const statusBadgeInfo = getStatusBadgeProps(record.status);

    return (
        <Card className={cn("shadow-sm transition-all", record.status === 'CHECKED_IN' && "border-green-500 ring-2 ring-green-500/50")}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-md mb-1">{record.hospitalName}</CardTitle>
                    <Badge variant={statusBadgeInfo.variant} className={cn("capitalize", statusBadgeInfo.className)}>
                        {record.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                </div>
                <CardDescription className="text-xs">
                    <MapPinIcon className="inline h-3 w-3 mr-1 text-gray-500" />
                    {record.locationCity}, {record.locationState}
                </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
                <div className="flex items-center"><CalendarDays size={14} className="mr-2 text-gray-500"/><strong>Data:</strong><span className="ml-1">{shiftDate.toLocaleDateString('pt-BR')}</span></div>
                <div className="flex items-center"><ClockIcon size={14} className="mr-2 text-gray-500"/><strong>Horário Esperado:</strong><span className="ml-1">{record.expectedStartTime} - {record.expectedEndTime}</span></div>
                {record.checkinAt && <div className="text-xs text-green-700 flex items-center pt-2"><LogIn size={13} className="mr-1.5"/>Check-in realizado às {record.checkinAt.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</div>}
                {record.checkoutAt && <div className="text-xs text-red-700 flex items-center"><LogOut size={13} className="mr-1.5"/>Check-out realizado às {record.checkoutAt.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</div>}
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t pt-4">
                {canCheckin && (
                    <Button onClick={onCheckinClick} size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={isCurrentlyLoading}>
                        {isCurrentlyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <LogIn className="mr-2 h-4 w-4" /> Fazer Check-in
                    </Button>
                )}
                {canCheckout && (
                    <Button onClick={() => onCheckoutClick(record.id)} size="sm" variant="outline" disabled={isCurrentlyLoading}>
                        {isCurrentlyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <LogOut className="mr-2 h-4 w-4" /> Fazer Check-out
                    </Button>
                )}
                {record.status === 'CHECKED_OUT' && <Badge variant="default" className="bg-green-100 text-green-800">Plantão Finalizado</Badge>}
            </CardFooter>
        </Card>
    );
};