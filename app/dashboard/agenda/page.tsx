// app/dashboard/agenda/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import Webcam from 'react-webcam';

// --- NOSSOS NOVOS TIPOS E SERVIÇOS ---
import { type TelemedicineAppointment } from '@/lib/appointment-service'; // IMPORTAÇÃO DO NOVO TIPO

// --- SEUS TIPOS DE DADOS EXISTENTES ---
import { type Contract } from '@/lib/contract-service';
interface Consultation { id: string; contractId: string; patientId: string; patientName: string; startTime: string; endTime: string; serviceType: string; status: string; }

// --- TIPO DE EVENTO UNIFICADO ---
interface CalendarEvent { 
    id: string; 
    title: string; 
    start: Date; 
    end: Date; 
    backgroundColor: string; 
    borderColor: string; 
    extendedProps: { 
        // TIPOS EXISTENTES + NOSSO NOVO TIPO
        type: 'SHIFT' | 'CONSULTATION' | 'TELEMEDICINE_APPOINTMENT'; 
        data: Contract | Consultation | TelemedicineAppointment; 
    }; 
}

// Componentes da UI (sem alteração)
import FullCalendar from '@fullcalendar/react';
import { type CalendarApi } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Calendar, Clock, Hospital, User, Video, LogIn, CheckCircle, Filter, Camera, LogOut } from 'lucide-react';

// Componentes de Estado (sem alteração)
const LoadingState = () => <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
const EmptyState = ({ title, description }: { title: string; description: string }) => <div className="text-center text-sm text-gray-500 py-20 flex flex-col items-center justify-center"><Calendar className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{description}</p></div>;
const ErrorState = ({ onRetry }: { onRetry: () => void }) => <div className="text-center text-red-600 py-10"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="font-semibold text-red-700 mb-1">Erro ao carregar sua agenda</p><Button variant="destructive" size="sm" onClick={onRetry} className="mt-4">Tentar Novamente</Button></div>;

// Componente Principal da Página
export default function DoctorAgendaPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();

    const calendarRef = useRef<FullCalendar>(null);
    const webcamRef = useRef<Webcam>(null);
    const functions = getFunctions();

    // --- ESTADO ADICIONAL PARA OS NOVOS AGENDAMENTOS ---
    const [telemedicineAppointments, setTelemedicineAppointments] = useState<TelemedicineAppointment[]>([]);

    // Estados de dados existentes
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Outros estados existentes (filtros, modais, etc) - sem alteração
    const [selectedHospital, setSelectedHospital] = useState<string>('all');
    const [selectedServiceType, setSelectedServiceType] = useState<string>('all');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isTimeRecordModalOpen, setIsTimeRecordModalOpen] = useState(false);
    const [selectedContractForTimeRecord, setSelectedContractForTimeRecord] = useState<Contract | null>(null);
    const [isSubmittingTimeRecord, setIsSubmittingTimeRecord] = useState(false);
    const [timeRecordMode, setTimeRecordMode] = useState<'IN' | 'OUT'>('IN');

    // --- FUNÇÃO DE BUSCA DE DADOS ATUALIZADA ---
    const fetchScheduleData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);
        try {
            // Usamos Promise.all para buscar os dados em paralelo
            const [contractsData, appointmentsData] = await Promise.all([
                // Query 1: Busca os contratos (plantoes) existentes
                getDocs(query(collection(db, "contracts"), where("doctorId", "==", user.uid), where("status", "in", ["ACTIVE_SIGNED", "IN_PROGRESS"]))),
                // Query 2: Busca os novos agendamentos de telemedicina
                getDocs(query(collection(db, "telemedicineAppointments"), where("doctorId", "==", user.uid), where("status", "in", ["SCHEDULED", "IN_PROGRESS"]))),
            ]);

            const fetchedContracts = contractsData.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract));
            setContracts(fetchedContracts);

            const fetchedAppointments = appointmentsData.docs.map(doc => ({ id: doc.id, ...doc.data() } as TelemedicineAppointment));
            setTelemedicineAppointments(fetchedAppointments);

            // Busca as consultas antigas ligadas aos contratos, como antes
            if (fetchedContracts.length > 0) {
                const contractIds = fetchedContracts.map(c => c.id);
                const consultsQuery = query(collection(db, "consultations"), where("contractId", "in", contractIds));
                const consultsSnapshot = await getDocs(consultsQuery);
                const fetchedConsultations = consultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation));
                setConsultations(fetchedConsultations);
            } else {
                setConsultations([]);
            }
        } catch (err: any) {
            console.error("Erro ao carregar agenda unificada do médico:", err);
            setError(err.message || "Ocorreu um erro desconhecido.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if(user) fetchScheduleData();
    }, [user, fetchScheduleData]);

    // Opções de filtro (sem alteração)
    const hospitalFilterOptions = useMemo(() => {
        const hospitals = new Map<string, string>();
        contracts.forEach(c => {
            if (c.hospitalId && c.hospitalName) hospitals.set(c.hospitalId, c.hospitalName);
        });
        return Array.from(hospitals.entries()).map(([id, name]) => ({ id, name }));
    }, [contracts]);

    // --- GERAÇÃO DE EVENTOS DO CALENDÁRIO ATUALIZADA ---
    const calendarEvents = useMemo((): CalendarEvent[] => {
        const events: CalendarEvent[] = [];

        // Lógica para Plantões (Contracts) - Respeitando os filtros existentes
        const filteredContracts = contracts.filter(contract => {
            const hospitalMatch = selectedHospital === 'all' || contract.hospitalId === selectedHospital;
            const serviceTypeMatch = selectedServiceType === 'all' || (selectedServiceType === 'Presencial' && contract.serviceType !== 'Telemedicina') || (selectedServiceType === 'Telemedicina' && contract.serviceType === 'Telemedicina');
            return hospitalMatch && serviceTypeMatch;
        });
        
        filteredContracts.forEach(contract => {
            const shiftDate = contract.shiftDates[0].toDate();
            const [startHour, startMinute] = contract.startTime.split(':').map(Number);
            const [endHour, endMinute] = contract.endTime.split(':').map(Number);
            const startDate = new Date(new Date(shiftDate).setHours(startHour, startMinute));
            const endDate = new Date(new Date(shiftDate).setHours(endHour, endMinute));
            let backgroundColor = contract.status === 'IN_PROGRESS' ? '#059669' : '#3b82f6';
            let borderColor = contract.status === 'IN_PROGRESS' ? '#047857' : '#1e40af';
            events.push({ id: contract.id, title: `Plantão: ${contract.hospitalName}`, start: startDate, end: endDate, backgroundColor, borderColor, extendedProps: { type: 'SHIFT', data: contract } });
        });
        
        // Lógica para Consultas antigas (vinculadas a contratos)
        const filteredContractIds = new Set(filteredContracts.map(c => c.id));
        consultations.filter(c => filteredContractIds.has(c.contractId)).forEach(consult => {
            const contract = contracts.find(c => c.id === consult.contractId);
            if (!contract) return;
            const shiftDate = contract.shiftDates[0].toDate();
            const [consultStartHour, consultStartMinute] = consult.startTime.split(':').map(Number);
            const consultStartDate = new Date(new Date(shiftDate).setHours(consultStartHour, consultStartMinute));
            const consultEndDate = consult.endTime ? new Date(new Date(shiftDate).setHours(...consult.endTime.split(':').map(Number) as [number, number])) : new Date(consultStartDate.getTime() + 30 * 60000);
            events.push({ id: consult.id, title: `Paciente: ${consult.patientName}`, start: consultStartDate, end: consultEndDate, backgroundColor: '#16a34a', borderColor: '#15803d', extendedProps: { type: 'CONSULTATION', data: consult } });
        });

        // --- NOVA LÓGICA: Adiciona os novos agendamentos de telemedicina ao calendário ---
        if(selectedServiceType === 'all' || selectedServiceType === 'Telemedicina') {
            telemedicineAppointments.forEach(appointment => {
                const startDate = appointment.appointmentDate.toDate();
                const endDate = new Date(startDate.getTime() + 30 * 60000); // Assumindo 30 min de duração
                events.push({
                    id: appointment.id,
                    title: `Teleconsulta: ${appointment.patientName}`,
                    start: startDate,
                    end: endDate,
                    backgroundColor: '#8b5cf6', // Roxo para diferenciar
                    borderColor: '#6d28d9',
                    extendedProps: {
                        type: 'TELEMEDICINE_APPOINTMENT',
                        data: appointment,
                    }
                });
            });
        }
        
        return events;
    }, [contracts, consultations, telemedicineAppointments, selectedHospital, selectedServiceType]);

    // Função de clique no evento (sem alteração, o modal fará a diferenciação)
    const handleEventClick = (clickInfo: any) => {
        const event = clickInfo.event;
        setSelectedEvent({ id: event.id, title: event.title, start: event.start, end: event.end, backgroundColor: event.backgroundColor, borderColor: event.borderColor, extendedProps: event.extendedProps as any });
        setIsDetailModalOpen(true);
    };

    // --- FUNÇÃO ATUALIZADA para iniciar atendimento ---
    const handleStartAppointment = (eventData: CalendarEvent['extendedProps']) => {
        if (eventData.type === 'CONSULTATION') { // Lógica antiga
            const consultation = eventData.data as Consultation;
            const route = consultation.serviceType === 'Telemedicina' ? `/telemedicine/${consultation.contractId}` : `/dashboard/atendimento/${consultation.id}`;
            router.push(route);
        } else if (eventData.type === 'TELEMEDICINE_APPOINTMENT') { // Nova lógica
            const appointment = eventData.data as TelemedicineAppointment;
            // Redireciona para a nova página de atendimento que iremos criar
            router.push(`/dashboard/telemedicina/${appointment.id}`);
        }
    };

    // Funções de navegação do calendário e ponto eletrônico (sem alteração)
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
        if (!webcamRef.current || !selectedContractForTimeRecord) return toast({ title: "Erro", description: "Câmera ou contrato não encontrado.", variant: "destructive" });
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
            fetchScheduleData();
        } catch (error: any) {
            let errorMessage = error.details?.message || error.message || "Ocorreu um erro.";
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
                     {/* Seus filtros existentes, sem alteração */}
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
                    {!isLoading && !error && ( <FullCalendar ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }} events={calendarEvents} locale="pt-br" buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' }} eventClick={handleEventClick} allDaySlot={false} slotMinTime="06:00:00" slotMaxTime="23:00:00" contentHeight="auto" /> )}
                </CardContent>
            </Card>

            {/* --- SEU MODAL DE DETALHES ATUALIZADO --- */}
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                           {selectedEvent?.extendedProps.type === 'SHIFT' ? <Hospital size={20}/> : <User size={20}/>}
                           Detalhes do Evento
                        </DialogTitle>
                        <DialogDescription>{selectedEvent?.start.toLocaleDateString('pt-br', { weekday: 'long', day: '2-digit', month: 'long' })}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        <p className="font-bold text-lg">{selectedEvent?.title}</p>
                        <p className="flex items-center gap-2"><Clock size={16}/> <strong>Horário:</strong> {selectedEvent?.start.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' })} - {selectedEvent?.end.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' })}</p>
                        
                        {/* Lógica para Plantões (SHIFT) - sem alteração */}
                        {selectedEvent?.extendedProps.type === 'SHIFT' && (() => {
                            const contract = selectedEvent.extendedProps.data as Contract;
                            if (contract.status === 'IN_PROGRESS') {
                                return <Button className="w-full mt-4 bg-orange-500 hover:bg-orange-600" onClick={() => handleOpenTimeRecordModal(contract, 'OUT')}><LogOut size={18} className="mr-2"/> Fazer Check-out</Button>;
                            }
                            if (contract.status === 'ACTIVE_SIGNED') {
                                return <Button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700" onClick={() => handleOpenTimeRecordModal(contract, 'IN')}><CheckCircle size={18} className="mr-2"/> Fazer Check-in</Button>;
                            }
                            return null;
                        })()}
                        
                        {/* Lógica para Consultas Antigas (CONSULTATION) - sem alteração */}
                        {selectedEvent?.extendedProps.type === 'CONSULTATION' && (
                             <Button className="w-full mt-4" onClick={() => handleStartAppointment(selectedEvent.extendedProps)}>
                                {(selectedEvent.extendedProps.data as Consultation).serviceType === 'Telemedicina' ? <Video size={16} className="mr-2"/> : <LogIn size={16} className="mr-2"/>}
                                Iniciar Atendimento (Contrato)
                            </Button>
                        )}

                        {/* --- NOVA LÓGICA PARA NOSSOS AGENDAMENTOS --- */}
                        {selectedEvent?.extendedProps.type === 'TELEMEDICINE_APPOINTMENT' && (
                            <Button className="w-full mt-4" onClick={() => handleStartAppointment(selectedEvent.extendedProps)}>
                                <Video size={16} className="mr-2"/>
                                Iniciar Teleconsulta
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Seu modal de Ponto Eletrônico - sem alteração */}
            <Dialog open={isTimeRecordModalOpen} onOpenChange={setIsTimeRecordModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ponto Eletrônico: Check-{timeRecordMode === 'IN' ? 'in' : 'out'}</DialogTitle>
                        <DialogDescription>Posicione seu rosto na câmera para registrar o ponto. A sua localização será solicitada.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-black rounded-md overflow-hidden"><Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-auto" /></div>
                        <Button className="w-full" onClick={handleSubmitTimeRecord} disabled={isSubmittingTimeRecord}>
                            {isSubmittingTimeRecord ? <Loader2 size={18} className="mr-2 animate-spin"/> : (timeRecordMode === 'IN' ? <Camera size={18} className="mr-2"/> : <LogOut size={18} className="mr-2"/>)}
                            Capturar e Registrar Check-{timeRecordMode === 'IN' ? 'in' : 'out'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}