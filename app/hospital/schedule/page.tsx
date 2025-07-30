// app/hospital/schedule/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { type Contract } from '@/lib/contract-service';
import { getCurrentUserData, type HospitalProfile } from '@/lib/auth-service';
import { getPatientsByHospital, type Patient } from '@/lib/patient-service';

// Importações do FullCalendar
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction'; 

// Importações de componentes de UI para os filtros
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CalendarDays, ClipboardList, AlertTriangle, RotateCcw, Search, User, Clock, CheckCircle, PlusCircle, Filter, Stethoscope, Video, Hospital } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Interfaces e Tipos ---
interface Consultation { id: string; patientId: string; patientName: string; chiefComplaint: string; startTime: string; endTime: string; contractId: string; }
interface CalendarEvent { id: string; title: string; start: Date; end: Date; backgroundColor: string; borderColor: string; extendedProps: { type: 'SHIFT' | 'CONSULTATION'; contractId: string; doctorName: string; consultations?: Consultation[]; patientName?: string; }; }

// --- Componentes de Estado e Diálogos (Helpers) ---
const LoadingState = () => <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
const EmptyState = ({ title, description }: { title: string, description: string }) => <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{description}</p></div>;
const ErrorState = ({ onRetry }: { onRetry: () => void }) => <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="font-semibold text-red-700 mb-1">Erro ao carregar dados</p><Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button></div>;
const PatientSelectionDialog: React.FC<{ onPatientSelect: (patient: Patient) => void }> = ({ onPatientSelect }) => { const [patients, setPatients] = useState<Patient[]>([]); const [isLoading, setIsLoading] = useState(true); const [searchTerm, setSearchTerm] = useState(""); const fetchPatients = useCallback(async () => { setIsLoading(true); try { const patientList = await getPatientsByHospital(); setPatients(patientList); } catch (error) { console.error("Erro ao carregar pacientes:", error); } finally { setIsLoading(false); } }, []); useEffect(() => { fetchPatients(); }, [fetchPatients]); const filteredPatients = useMemo(() => { if (!searchTerm) return patients; return patients.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.cpf?.includes(searchTerm)); }, [patients, searchTerm]); return (<DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Selecionar Paciente</DialogTitle><DialogDescription>Busque e selecione um paciente para a consulta.</DialogDescription></DialogHeader><div className="py-4"><Input placeholder="Buscar por nome ou CPF..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-4" /><div className="border rounded-md max-h-80 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CPF</TableHead></TableRow></TableHeader><TableBody>{isLoading && <TableRow><TableCell colSpan={2} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}{!isLoading && filteredPatients.map(patient => (<TableRow key={patient.id} className="cursor-pointer hover:bg-muted" onClick={() => onPatientSelect(patient)}><TableCell className="font-medium">{patient.name}</TableCell><TableCell>{patient.cpf || 'N/A'}</TableCell></TableRow>))}</TableBody></Table></div></div></DialogContent>); };


// --- Componente Principal da Página ---
export default function HospitalSchedulePage() {
    const { user } = useAuth();
    const { toast } = useToast();

    // Estado dos dados brutos
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    
    // Estado dos filtros
    const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
    const [selectedServiceType, setSelectedServiceType] = useState<string>('all');

    // Estado de carregamento e erro
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Estados para os modais (diálogos)
    const [isShiftDetailsOpen, setIsShiftDetailsOpen] = useState(false);
    const [isPatientSelectOpen, setIsPatientSelectOpen] = useState(false);
    const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [appointmentTime, setAppointmentTime] = useState("");
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Função para buscar os dados do Firestore
    const fetchData = useCallback(async () => { if (!user) return; setIsLoading(true); setError(null); try { const hospitalId = user.uid; const contractsQuery = query(collection(db, "contracts"), where("hospitalId", "==", hospitalId), where("status", "==", "ACTIVE_SIGNED")); const contractsSnapshot = await getDocs(contractsQuery); const fetchedContracts = contractsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Contract[]; setContracts(fetchedContracts); const consultsQuery = query(collection(db, "consultations"), where("hospitalId", "==", hospitalId)); const consultsSnapshot = await getDocs(consultsQuery); const fetchedConsultations = consultsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Consultation[]; setConsultations(fetchedConsultations); } catch (err) { console.error("Erro ao buscar dados da agenda:", err); setError("Falha ao carregar os dados. Por favor, tente novamente."); } finally { setIsLoading(false); } }, [user]);
    useEffect(() => { fetchData(); }, [fetchData]);

    // Geração das opções para os filtros
    const filterOptions = useMemo(() => { const doctors = new Map<string, string>(); const specialties = new Set<string>(); contracts.forEach(c => { if (c.doctorId && c.doctorName) doctors.set(c.doctorId, c.doctorName); c.specialties.forEach(s => specialties.add(s)); }); return { doctors: Array.from(doctors.entries()).map(([id, name]) => ({ id, name })), specialties: Array.from(specialties), }; }, [contracts]);

    // Mapeamento dos dados para o calendário, aplicando os filtros
    const calendarEvents = useMemo((): CalendarEvent[] => { const filteredContracts = contracts.filter(contract => { const doctorMatch = selectedDoctor === 'all' || contract.doctorId === selectedDoctor; const specialtyMatch = selectedSpecialty === 'all' || contract.specialties.includes(selectedSpecialty); const serviceTypeMatch = selectedServiceType === 'all' || contract.serviceType === selectedServiceType; return doctorMatch && specialtyMatch && serviceTypeMatch; }); const events: CalendarEvent[] = []; filteredContracts.forEach(contract => { const shiftDate = contract.shiftDates[0].toDate(); const [startHour, startMinute] = contract.startTime.split(':').map(Number); const [endHour, endMinute] = contract.endTime.split(':').map(Number); const startDate = new Date(new Date(shiftDate).setHours(startHour, startMinute)); const endDate = new Date(new Date(shiftDate).setHours(endHour, endMinute)); events.push({ id: contract.id, title: `Plantão - Dr(a). ${contract.doctorName}`, start: startDate, end: endDate, backgroundColor: '#3b82f6', borderColor: '#1e40af', extendedProps: { type: 'SHIFT', contractId: contract.id, doctorName: contract.doctorName || 'N/A', consultations: consultations.filter(c => c.contractId === contract.id), } }); consultations.filter(c => c.contractId === contract.id).forEach(consult => { const [consultStartHour, consultStartMinute] = consult.startTime.split(':').map(Number); const consultEndDate = new Date(new Date(shiftDate).setHours(consultStartHour, consultStartMinute + 30)); events.push({ id: consult.id, title: `Consulta: ${consult.patientName}`, start: new Date(new Date(shiftDate).setHours(consultStartHour, consultStartMinute)), end: consultEndDate, backgroundColor: '#16a34a', borderColor: '#15803d', extendedProps: { type: 'CONSULTATION', contractId: contract.id, doctorName: contract.doctorName || 'N/A', patientName: consult.patientName } }); }); }); return events; }, [contracts, consultations, selectedDoctor, selectedSpecialty, selectedServiceType]);

    // Funções de manipulação dos diálogos e submissão
    const handleEventClick = (clickInfo: any) => { const event = clickInfo.event; const calendarEvent: CalendarEvent = { id: event.id, title: event.title, start: event.start, end: event.end, backgroundColor: event.backgroundColor, borderColor: event.borderColor, extendedProps: event.extendedProps as any }; setSelectedEvent(calendarEvent); setIsShiftDetailsOpen(true); };
    const handlePatientSelected = (patient: Patient) => { setSelectedPatient(patient); setIsPatientSelectOpen(false); setIsNewAppointmentOpen(true); };
    const handleScheduleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (!selectedEvent || !selectedPatient || !appointmentTime.trim() || !chiefComplaint.trim() || !user) { toast({ title: "Campos obrigatórios", variant: "destructive" }); return; } setIsSubmitting(true); try { const hospitalProfile = await getCurrentUserData() as HospitalProfile; const contract = contracts.find(c => c.id === selectedEvent.extendedProps.contractId); if (!hospitalProfile || !contract) throw new Error("Dados do hospital ou contrato não encontrados."); const [hour, minute] = appointmentTime.split(':').map(Number); const appointmentDuration = 30; const startDate = new Date(selectedEvent.start); startDate.setHours(hour, minute); const endDate = new Date(startDate.getTime() + appointmentDuration * 60000); const newConsultation = { patientId: selectedPatient.id, patientName: selectedPatient.name, chiefComplaint, startTime: appointmentTime, endTime: `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`, contractId: contract.id, doctorId: contract.doctorId, doctorName: contract.doctorName, serviceType: contract.serviceType, hospitalId: user.uid, hospitalName: hospitalProfile.displayName, status: "SCHEDULED", createdAt: serverTimestamp(), }; const docRef = await addDoc(collection(db, "consultations"), newConsultation); toast({ title: "Consulta Agendada!", variant: 'success' }); setConsultations(prev => [...prev, { id: docRef.id, ...newConsultation } as Consultation]); setIsNewAppointmentOpen(false); setIsShiftDetailsOpen(false); setSelectedEvent(null); } catch (err: any) { toast({ title: "Erro no Agendamento", description: err.message, variant: "destructive" }); } finally { setIsSubmitting(false); } };

    if (isLoading) return <div className="p-4"><LoadingState /></div>;
    if (error) return <div className="p-4"><ErrorState onRetry={fetchData} /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><h1 className="text-2xl md:text-3xl font-bold">Agenda Hospitalar</h1><p className="text-muted-foreground">Visualize e gerencie seus plantões e consultas.</p></div>
            </div>

            {/* PAINEL DE FILTROS */}
            <Card className="bg-muted/40">
                <CardHeader><CardTitle className="flex items-center gap-2 text-md"><Filter size={18}/> Filtros da Agenda</CardTitle></CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                        <Label>Tipo de Atendimento</Label>
                        {/* ALTERADO: Adicionado o tipo 'string' ao parâmetro 'value' para corrigir o erro do TypeScript */}
                        <ToggleGroup type="single" value={selectedServiceType} onValueChange={(value: string) => value && setSelectedServiceType(value)} className="w-full sm:w-auto">
                            <ToggleGroupItem value="all" aria-label="Todos os tipos">Todos</ToggleGroupItem>
                            <ToggleGroupItem value="Presencial" aria-label="Presencial"><Hospital className="h-4 w-4 mr-2"/>Presencial</ToggleGroupItem>
                            <ToggleGroupItem value="Telemedicina" aria-label="Telemedicina"><Video className="h-4 w-4 mr-2"/>Telemedicina</ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                     <div className="flex-1 space-y-2">
                        <Label htmlFor="doctor-filter">Médico</Label>
                        <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                            <SelectTrigger id="doctor-filter"><SelectValue placeholder="Selecione um médico" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">Todos os Médicos</SelectItem>{filterOptions.doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 space-y-2">
                        <Label htmlFor="specialty-filter">Especialidade</Label>
                        <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                            <SelectTrigger id="specialty-filter"><SelectValue placeholder="Selecione uma especialidade" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">Todas as Especialidades</SelectItem>{filterOptions.specialties.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-2 sm:p-4">
                     {calendarEvents.length === 0 && !isLoading ? (<EmptyState title="Nenhum plantão encontrado" description="Nenhum plantão corresponde aos filtros selecionados ou não há plantões ativos." />) : (<FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }} events={calendarEvents} locale="pt-br" buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' }} eventClick={handleEventClick} allDaySlot={false} slotMinTime="06:00:00" slotMaxTime="23:00:00" contentHeight="auto" />)}
                </CardContent>
            </Card>

            {/* Diálogos */}
            <Dialog open={isShiftDetailsOpen} onOpenChange={setIsShiftDetailsOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader><DialogTitle>Detalhes do Plantão - Dr(a). {selectedEvent?.extendedProps.doctorName}</DialogTitle><DialogDescription>{selectedEvent?.start.toLocaleDateString('pt-br', { weekday: 'long', day: '2-digit', month: 'long' })}, das {selectedEvent?.start.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' })} às {selectedEvent?.end.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' })}.</DialogDescription></DialogHeader>
                    <div className="py-4 space-y-4"><h3 className="font-semibold">Consultas já agendadas</h3>{selectedEvent?.extendedProps.consultations?.length === 0 ? (<p className="text-sm text-muted-foreground">Nenhuma consulta agendada para este plantão.</p>) : (<Table><TableHeader><TableRow><TableHead>Paciente</TableHead><TableHead>Horário</TableHead></TableRow></TableHeader><TableBody>{selectedEvent?.extendedProps.consultations?.map(c => (<TableRow key={c.id}><TableCell>{c.patientName}</TableCell><TableCell>{c.startTime} - {c.endTime}</TableCell></TableRow>))}</TableBody></Table>)}<Dialog open={isPatientSelectOpen} onOpenChange={setIsPatientSelectOpen}><DialogTrigger asChild><Button className="w-full mt-4"><PlusCircle className="mr-2 h-4 w-4"/>Agendar Nova Consulta</Button></DialogTrigger><PatientSelectionDialog onPatientSelect={handlePatientSelected} /></Dialog></div>
                </DialogContent>
            </Dialog>
            <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
                 <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>Agendar Nova Consulta</DialogTitle><DialogDescription>Defina os detalhes da consulta para <strong>{selectedPatient?.name}</strong> no plantão de Dr(a). {selectedEvent?.extendedProps.doctorName}.</DialogDescription></DialogHeader>
                    <form onSubmit={handleScheduleSubmit}><div className="grid gap-4 py-4"><div className="space-y-1.5"><Label htmlFor="appointmentTime">Horário da Consulta*</Label><Input id="appointmentTime" type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} required /></div><div className="space-y-1.5"><Label htmlFor="chiefComplaint">Queixa Principal*</Label><Textarea id="chiefComplaint" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} required /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setIsNewAppointmentOpen(false)}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar</Button></DialogFooter></form>
                </DialogContent>
            </Dialog>
        </div>
    );
}