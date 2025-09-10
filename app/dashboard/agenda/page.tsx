// app/dashboard/agenda/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';

// --- NOSSOS SERVIÇOS E TIPOS CENTRALIZADOS ---
import { getUnifiedDoctorAgenda, type CalendarEvent } from '@/lib/agenda-service';
import { type Appointment } from '@/lib/appointment-service';
import { type Contract } from '@/lib/contract-service';
import Link from 'next/link';

// --- Componentes da UI ---
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Calendar, Clock, Hospital, User, Video, CheckCircle, Filter, Camera } from 'lucide-react';
import Webcam from 'react-webcam';

const LoadingState = () => <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
const ErrorState = ({ onRetry }: { onRetry: () => void }) => <div className="text-center text-red-600 py-10"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="font-semibold text-red-700 mb-1">Erro ao carregar sua agenda</p><Button variant="destructive" size="sm" onClick={onRetry} className="mt-4">Tentar Novamente</Button></div>;

export default function DoctorAgendaPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();
    const calendarRef = useRef<FullCalendar>(null);
    const webcamRef = useRef<Webcam>(null);
    const functions = getFunctions();
    
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedHospital, setSelectedHospital] = useState<string>('all');
    const [selectedServiceType, setSelectedServiceType] = useState<string>('all');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isTimeRecordModalOpen, setIsTimeRecordModalOpen] = useState(false);
    const [selectedContractForTimeRecord, setSelectedContractForTimeRecord] = useState<Contract | null>(null);
    const [isSubmittingTimeRecord, setIsSubmittingTimeRecord] = useState(false);
    const [timeRecordMode, setTimeRecordMode] = useState<'IN' | 'OUT'>('IN');

    const fetchScheduleData = useCallback(async () => {
        if (!user?.uid) return;
        setIsLoading(true);
        setError(null);
        try {
            const fetchedEvents = await getUnifiedDoctorAgenda(user.uid);
            setEvents(fetchedEvents);
        } catch (err: any) {
            setError(err.message || "Ocorreu um erro desconhecido.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchScheduleData();
    }, [fetchScheduleData]);

    const hospitalFilterOptions = useMemo(() => {
        const hospitals = new Map<string, string>();
        events.forEach(event => {
            if (event.extendedProps.type === 'SHIFT') {
                const contract = event.extendedProps.data as Contract;
                if (contract.hospitalId && contract.hospitalName) {
                    hospitals.set(contract.hospitalId, contract.hospitalName);
                }
            }
        });
        return Array.from(hospitals.entries()).map(([id, name]) => ({ id, name }));
    }, [events]);

    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            const isShift = event.extendedProps.type === 'SHIFT';
            const isAppointment = event.extendedProps.type === 'APPOINTMENT';

            const hospitalMatch = selectedHospital === 'all' || (isShift && (event.extendedProps.data as Contract).hospitalId === selectedHospital);
            
            let serviceTypeMatch = selectedServiceType === 'all';
            if (selectedServiceType === 'Presencial') {
                serviceTypeMatch = (isShift && (event.extendedProps.data as Contract).serviceType !== 'Telemedicina') || (isAppointment && (event.extendedProps.data as Appointment).type === 'Presencial');
            } else if (selectedServiceType === 'Telemedicina') {
                serviceTypeMatch = (isShift && (event.extendedProps.data as Contract).serviceType === 'Telemedicina') || (isAppointment && (event.extendedProps.data as Appointment).type === 'Telemedicina');
            }
            
            return hospitalMatch && serviceTypeMatch;
        });
    }, [events, selectedHospital, selectedServiceType]);

    const handleEventClick = (clickInfo: any) => {
        setSelectedEvent(clickInfo.event.toPlainObject());
        setIsDetailModalOpen(true);
    };

    const handleStartAppointment = (eventData: CalendarEvent['extendedProps']) => {
        if (eventData.type === 'APPOINTMENT') {
            const appointment = eventData.data as Appointment;
            router.push(`/dashboard/atendimento/${appointment.id}`);
        }
    };
    
    const handleDateNavigation = (mode: 'today' | 'week' | 'month') => {
        const calendarApi = calendarRef.current?.getApi();
        if (!calendarApi) return;
        calendarApi.changeView(mode === 'today' ? 'timeGridDay' : (mode === 'week' ? 'timeGridWeek' : 'dayGridMonth'), new Date());
    };

    const handleOpenTimeRecordModal = (contract: Contract, mode: 'IN' | 'OUT') => {
        setTimeRecordMode(mode);
        setSelectedContractForTimeRecord(contract);
        setIsTimeRecordModalOpen(true);
        setIsDetailModalOpen(false);
    };

    const handleSubmitTimeRecord = async () => {
        if (!webcamRef.current || !selectedContractForTimeRecord) {
            toast({ title: "Erro", description: "Câmera ou contrato não encontrado.", variant: "destructive" });
            return;
        }
        setIsSubmittingTimeRecord(true);
        try {
            const photoBase64 = webcamRef.current.getScreenshot();
            if (!photoBase64) throw new Error("Não foi possível capturar a foto.");
            
            const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
            const { latitude, longitude } = position.coords;

            const payload = { contractId: selectedContractForTimeRecord.id, latitude, longitude, photoBase64 };
            const functionName = timeRecordMode === 'IN' ? 'registerTimeRecord' : 'registerCheckout';
            
            await httpsCallable(functions, functionName)(payload);
            
            toast({ title: "Sucesso!", description: `Seu check-${timeRecordMode === 'IN' ? 'in' : 'out'} foi registrado.`, className: timeRecordMode === 'IN' ? "bg-green-600 text-white" : "bg-orange-500 text-white" });
            
            setIsTimeRecordModalOpen(false);
            fetchScheduleData(); // Recarrega os dados para atualizar o status do evento
        } catch (error: any) {
            let errorMessage = "Ocorreu um erro.";
            if (error instanceof Error) errorMessage = error.message;
            toast({ title: `Falha no Check-${timeRecordMode === 'IN' ? 'in' : 'out'}`, description: errorMessage, variant: "destructive" });
        } finally {
            setIsSubmittingTimeRecord(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold">Minha Agenda</h1>
            
            <Card className="bg-muted/40">
                <CardHeader><CardTitle className="flex items-center gap-2 text-md"><Filter size={18}/> Filtros da Agenda</CardTitle></CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                     <div className="flex-1 space-y-2">
                        <Label>Tipo de Atendimento</Label>
                        <ToggleGroup type="single" value={selectedServiceType} onValueChange={(value: string) => value && setSelectedServiceType(value)}>
                            <ToggleGroupItem value="all" aria-label="Todos os tipos">Todos</ToggleGroupItem>
                            <ToggleGroupItem value="Presencial" aria-label="Presencial"><Hospital className="h-4 w-4 mr-2"/>Presencial</ToggleGroupItem>
                            <ToggleGroupItem value="Telemedicina" aria-label="Telemedicina"><Video className="h-4 w-4 mr-2"/>Telemedicina</ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                     <div className="flex-1 space-y-2">
                        <Label htmlFor="hospital-filter">Hospital</Label>
                        <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                            <SelectTrigger id="hospital-filter"><SelectValue placeholder="Selecione um hospital" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">Todos os Hospitais</SelectItem>{hospitalFilterOptions.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="flex-shrink-0 self-end">
                        <ToggleGroup type="single" onValueChange={(value) => value && handleDateNavigation(value as any)}>
                            <ToggleGroupItem value="today">Hoje</ToggleGroupItem>
                            <ToggleGroupItem value="week">Esta Semana</ToggleGroupItem>
                            <ToggleGroupItem value="month">Este Mês</ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-2 sm:p-4">
                    {isLoading && <LoadingState />}
                    {!isLoading && error && <ErrorState onRetry={fetchScheduleData} />}
                    {!isLoading && !error && (
                        <FullCalendar 
                            ref={calendarRef} 
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} 
                            initialView="timeGridWeek" 
                            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }} 
                            events={filteredEvents} 
                            locale="pt-br" 
                            buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' }} 
                            eventClick={handleEventClick} 
                            allDaySlot={false} 
                            slotMinTime="06:00:00" 
                            slotMaxTime="23:00:00" 
                            contentHeight="auto" 
                        />
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                           {selectedEvent?.extendedProps.type === 'SHIFT' ? <Hospital size={20}/> : <User size={20}/>}
                           Detalhes do Evento
                        </DialogTitle>
                        {selectedEvent?.start && <DialogDescription>{new Date(selectedEvent.start).toLocaleDateString('pt-br', { weekday: 'long', day: '2-digit', month: 'long' })}</DialogDescription>}
                    </DialogHeader>
                    {selectedEvent && 
                        <div className="py-4 space-y-3">
                            <p className="font-bold text-lg">{selectedEvent.title}</p>
                            <p className="flex items-center gap-2"><Clock size={16}/> <strong>Horário:</strong> {new Date(selectedEvent.start).toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedEvent.end).toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' })}</p>
                            
                            {selectedEvent.extendedProps.type === 'SHIFT' && (() => {
                                const contract = selectedEvent.extendedProps.data as Contract;
                                if (contract.status === 'IN_PROGRESS') {
                                    return <Button className="w-full mt-4 bg-orange-500 hover:bg-orange-600" onClick={() => handleOpenTimeRecordModal(contract, 'OUT')}> Sair</Button>;
                                }
                                if (contract.status === 'ACTIVE_SIGNED') {
                                    return <Button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700" onClick={() => handleOpenTimeRecordModal(contract, 'IN')}><CheckCircle size={18} className="mr-2"/> Fazer Check-in</Button>;
                                }
                                return null;
                            })()}
                            
                            {selectedEvent.extendedProps.type === 'APPOINTMENT' && ((eventData) => {
                                const appointment = eventData.data as Appointment;
                                if (appointment.type === 'Telemedicina' && appointment.telemedicineRoomUrl) {
                                    return (<Button asChild className="w-full mt-4"><Link href={appointment.telemedicineRoomUrl} target="_blank"><Video size={16} className="mr-2"/>Entrar na Teleconsulta</Link></Button>);
                                }
                                return (<Button className="w-full mt-4" onClick={() => handleStartAppointment(selectedEvent.extendedProps)}> Iniciar Atendimento</Button>);
                            })(selectedEvent.extendedProps)}
                        </div>
                    }
                </DialogContent>
            </Dialog>

            <Dialog open={isTimeRecordModalOpen} onOpenChange={setIsTimeRecordModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ponto Eletrônico: Check-{timeRecordMode === 'IN' ? 'in' : 'out'}</DialogTitle>
                        <DialogDescription>Posicione seu rosto na câmera para registrar o ponto. A sua localização será solicitada.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-black rounded-md overflow-hidden">
                            <Webcam 
                                audio={false} 
                                ref={webcamRef} 
                                screenshotFormat="image/jpeg" 
                                className="w-full h-auto" 
                            />
                        </div>
                        <Button className="w-full" onClick={handleSubmitTimeRecord} disabled={isSubmittingTimeRecord}>
                            {isSubmittingTimeRecord ? <Loader2 size={18} className="mr-2 animate-spin"/> : <Camera size={18} className="mr-2"/>}
                            Capturar e Registrar Check-{timeRecordMode === 'IN' ? 'in' : 'out'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}