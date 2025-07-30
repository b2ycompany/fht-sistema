// app/dashboard/agenda/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';

// Tipos de dados
import { type Contract } from '@/lib/contract-service';
interface Consultation { id: string; contractId: string; patientId: string; patientName: string; startTime: string; endTime: string; serviceType: string; status: string; }
interface CalendarEvent { id: string; title: string; start: Date; end: Date; backgroundColor: string; borderColor: string; extendedProps: { type: 'SHIFT' | 'CONSULTATION'; data: Contract | Consultation; }; }

// Componentes da UI
import FullCalendar from '@fullcalendar/react';
import { type CalendarApi } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
// CORREÇÃO: Adicionados CardHeader e CardTitle que estavam faltando.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
// CORREÇÃO: Adicionado Label que estava faltando.
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Calendar, Clock, Hospital, User, Video, LogIn, CheckCircle, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';


// --- Componentes de Estado (sem alterações) ---
const LoadingState = () => <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
const EmptyState = ({ title, description }: { title: string; description: string }) => <div className="text-center text-sm text-gray-500 py-20 flex flex-col items-center justify-center"><Calendar className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{description}</p></div>;
const ErrorState = ({ onRetry }: { onRetry: () => void }) => <div className="text-center text-red-600 py-10"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="font-semibold text-red-700 mb-1">Erro ao carregar sua agenda</p><Button variant="destructive" size="sm" onClick={onRetry} className="mt-4">Tentar Novamente</Button></div>;

// --- Componente Principal da Página ---
export default function DoctorAgendaPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();

    const calendarRef = useRef<FullCalendar>(null);

    // Estados dos dados
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Estado para filtros do médico
    const [selectedHospital, setSelectedHospital] = useState<string>('all');
    const [selectedServiceType, setSelectedServiceType] = useState<string>('all');
    
    // Estados do modal de detalhes
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    // Função para buscar TODOS os dados da agenda do médico (sem alteração)
    const fetchScheduleData = useCallback(async () => { if (!user) return; setIsLoading(true); setError(null); try { const contractsQuery = query(collection(db, "contracts"), where("doctorId", "==", user.uid), where("status", "==", "ACTIVE_SIGNED")); const contractsSnapshot = await getDocs(contractsQuery); const fetchedContracts = contractsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract)); setContracts(fetchedContracts); if (fetchedContracts.length > 0) { const contractIds = fetchedContracts.map(c => c.id); const consultsQuery = query(collection(db, "consultations"), where("contractId", "in", contractIds)); const consultsSnapshot = await getDocs(consultsQuery); const fetchedConsultations = consultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation)); setConsultations(fetchedConsultations); } } catch (err: any) { console.error("Erro ao carregar agenda do médico:", err); setError(err.message || "Ocorreu um erro desconhecido."); } finally { setIsLoading(false); } }, [user]);
    useEffect(() => { fetchScheduleData(); }, [fetchScheduleData]);

    const hospitalFilterOptions = useMemo(() => { const hospitals = new Map<string, string>(); contracts.forEach(c => { if (c.hospitalId && c.hospitalName) hospitals.set(c.hospitalId, c.hospitalName); }); return Array.from(hospitals.entries()).map(([id, name]) => ({ id, name })); }, [contracts]);

    const calendarEvents = useMemo((): CalendarEvent[] => {
        const filteredContracts = contracts.filter(contract => {
            const hospitalMatch = selectedHospital === 'all' || contract.hospitalId === selectedHospital;
            
            let serviceTypeMatch = true;
            if (selectedServiceType === 'Telemedicina') {
                serviceTypeMatch = contract.serviceType === 'Telemedicina';
            } else if (selectedServiceType === 'Presencial') {
                serviceTypeMatch = contract.serviceType !== 'Telemedicina';
            }
            
            return hospitalMatch && serviceTypeMatch;
        });
        
        const events: CalendarEvent[] = [];
        filteredContracts.forEach(contract => { const shiftDate = contract.shiftDates[0].toDate(); const [startHour, startMinute] = contract.startTime.split(':').map(Number); const [endHour, endMinute] = contract.endTime.split(':').map(Number); const startDate = new Date(new Date(shiftDate).setHours(startHour, startMinute)); const endDate = new Date(new Date(shiftDate).setHours(endHour, endMinute)); events.push({ id: contract.id, title: `Plantão: ${contract.hospitalName}`, start: startDate, end: endDate, backgroundColor: '#3b82f6', borderColor: '#1e40af', extendedProps: { type: 'SHIFT', data: contract } }); }); const filteredContractIds = new Set(filteredContracts.map(c => c.id)); consultations.filter(c => filteredContractIds.has(c.contractId)).forEach(consult => { const contract = contracts.find(c => c.id === consult.contractId); if (!contract) return; const shiftDate = contract.shiftDates[0].toDate(); const [consultStartHour, consultStartMinute] = consult.startTime.split(':').map(Number); const consultStartDate = new Date(new Date(shiftDate).setHours(consultStartHour, consultStartMinute)); const consultEndDate = consult.endTime ? new Date(new Date(shiftDate).setHours(...consult.endTime.split(':').map(Number) as [number, number])) : new Date(consultStartDate.getTime() + 30 * 60000); events.push({ id: consult.id, title: `Paciente: ${consult.patientName}`, start: consultStartDate, end: consultEndDate, backgroundColor: '#16a34a', borderColor: '#15803d', extendedProps: { type: 'CONSULTATION', data: consult } }); }); return events; }, [contracts, consultations, selectedHospital, selectedServiceType]);

    // Lógicas de cliques e navegação (sem alteração)
    const handleEventClick = (clickInfo: any) => { const event = clickInfo.event; setSelectedEvent({ id: event.id, title: event.title, start: event.start, end: event.end, backgroundColor: event.backgroundColor, borderColor: event.borderColor, extendedProps: event.extendedProps as any }); setIsDetailModalOpen(true); };
    const handleStartAppointment = (consultation: Consultation) => { const route = consultation.serviceType === 'Telemedicina' ? `/telemedicine/${consultation.contractId}` : `/dashboard/atendimento/${consultation.id}`; router.push(route); };
    const handleCheckIn = (contract: Contract) => { toast({ title: "Funcionalidade em Desenvolvimento", description: "O Ponto Eletrônico com geolocalização será implementado em breve!" }); };
    const handleDateNavigation = (mode: 'today' | 'week' | 'month') => { const calendarApi = calendarRef.current?.getApi(); if (!calendarApi) return; const now = new Date(); switch(mode) { case 'today': calendarApi.changeView('timeGridDay', now); break; case 'week': calendarApi.changeView('timeGridWeek', now); break; case 'month': calendarApi.changeView('dayGridMonth', now); break; } };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold">Minha Agenda</h1>
            
            <Card className="bg-muted/40">
                <CardHeader><CardTitle className="flex items-center gap-2 text-md"><Filter size={18}/> Filtros da Agenda</CardTitle></CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                        <Label>Tipo de Atendimento</Label>
                        <ToggleGroup type="single" value={selectedServiceType} onValueChange={(value: string) => value && setSelectedServiceType(value)}>
                            <ToggleGroupItem value="all" aria-label="Todos os tipos" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Todos</ToggleGroupItem>
                            <ToggleGroupItem value="Presencial" aria-label="Presencial" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"><Hospital className="h-4 w-4 mr-2"/>Presencial</ToggleGroupItem>
                            <ToggleGroupItem value="Telemedicina" aria-label="Telemedicina" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"><Video className="h-4 w-4 mr-2"/>Telemedicina</ToggleGroupItem>
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
                            <ToggleGroupItem value="today" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Hoje</ToggleGroupItem>
                            <ToggleGroupItem value="week" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Esta Semana</ToggleGroupItem>
                            <ToggleGroupItem value="month" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Este Mês</ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-2 sm:p-4">
                    {isLoading && <LoadingState />}
                    {!isLoading && error && <ErrorState onRetry={fetchScheduleData} />}
                    {!isLoading && !error && (
                        <FullCalendar ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }} events={calendarEvents} locale="pt-br" buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' }} eventClick={handleEventClick} allDaySlot={false} slotMinTime="06:00:00" slotMaxTime="23:00:00" contentHeight="auto" />
                    )}
                </CardContent>
            </Card>

            {/* Modal de Detalhes do Evento (sem alteração) */}
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2">{selectedEvent?.extendedProps.type === 'SHIFT' ? <Hospital size={20}/> : <User size={20}/>}Detalhes do {selectedEvent?.extendedProps.type === 'SHIFT' ? 'Plantão' : 'Atendimento'}</DialogTitle><DialogDescription>{selectedEvent?.start.toLocaleDateString('pt-br', { weekday: 'long', day: '2-digit', month: 'long' })}</DialogDescription></DialogHeader>
                    <div className="py-4 space-y-3">
                        <p className="flex items-center gap-2"><Clock size={16}/> <strong>Horário:</strong> {selectedEvent?.start.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' })} - {selectedEvent?.end.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' })}</p>
                        {selectedEvent?.extendedProps.type === 'SHIFT' && (<><p className="flex items-center gap-2"><Hospital size={16}/> <strong>Hospital:</strong> {(selectedEvent.extendedProps.data as Contract).hospitalName}</p><Button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700" onClick={() => handleCheckIn(selectedEvent.extendedProps.data as Contract)}><CheckCircle size={18} className="mr-2"/> Fazer Check-in no Plantão</Button></>)}
                        {selectedEvent?.extendedProps.type === 'CONSULTATION' && (<><p className="flex items-center gap-2"><User size={16}/> <strong>Paciente:</strong> {(selectedEvent.extendedProps.data as Consultation).patientName}</p><Button className="w-full mt-4" onClick={() => handleStartAppointment(selectedEvent.extendedProps.data as Consultation)}>{(selectedEvent.extendedProps.data as Consultation).serviceType === 'Telemedicina' ? <Video size={16} className="mr-2"/> : <LogIn size={16} className="mr-2"/>}Iniciar Atendimento</Button></>)}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}