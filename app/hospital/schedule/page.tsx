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

// NOVO: Importações do FullCalendar
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction'; // Para interatividade (cliques)

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CalendarDays, ClipboardList, AlertTriangle, RotateCcw, Search, User, Clock, CheckCircle, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Interfaces e Tipos Atualizados ---
interface Consultation {
    id: string;
    patientId: string;
    patientName: string;
    chiefComplaint: string;
    startTime: string; // Ex: "10:00"
    endTime: string;   // Ex: "10:30"
    contractId: string;
}

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    backgroundColor: string;
    borderColor: string;
    extendedProps: {
        type: 'SHIFT' | 'CONSULTATION';
        contractId: string;
        doctorName: string;
        consultations?: Consultation[];
        patientName?: string;
    };
}


// --- Componentes de Estado (Loading, Empty, Error) - Sem alterações ---
const LoadingState = () => <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
const EmptyState = ({ title, description }: { title: string, description: string }) => <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{description}</p></div>;
const ErrorState = ({ onRetry }: { onRetry: () => void }) => <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="font-semibold text-red-700 mb-1">Erro ao carregar dados</p><Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button></div>;

// --- PatientSelectionDialog - Componente reaproveitado e melhorado ---
const PatientSelectionDialog: React.FC<{ onPatientSelect: (patient: Patient) => void }> = ({ onPatientSelect }) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const fetchPatients = useCallback(async () => {
        setIsLoading(true);
        try {
            const patientList = await getPatientsByHospital();
            setPatients(patientList);
        } catch (error) { console.error("Erro ao carregar pacientes:", error); } 
        finally { setIsLoading(false); }
    }, []);
    useEffect(() => { fetchPatients(); }, [fetchPatients]);
    const filteredPatients = useMemo(() => {
        if (!searchTerm) return patients;
        return patients.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.cpf?.includes(searchTerm));
    }, [patients, searchTerm]);

    return (<DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Selecionar Paciente</DialogTitle><DialogDescription>Busque e selecione um paciente para a consulta.</DialogDescription></DialogHeader><div className="py-4"><Input placeholder="Buscar por nome ou CPF..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-4" /><div className="border rounded-md max-h-80 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CPF</TableHead></TableRow></TableHeader><TableBody>{isLoading && <TableRow><TableCell colSpan={2} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}{!isLoading && filteredPatients.map(patient => (<TableRow key={patient.id} className="cursor-pointer hover:bg-muted" onClick={() => onPatientSelect(patient)}><TableCell className="font-medium">{patient.name}</TableCell><TableCell>{patient.cpf || 'N/A'}</TableCell></TableRow>))}</TableBody></Table></div></div></DialogContent>);
};


// --- PÁGINA PRINCIPAL REESTRUTURADA ---
export default function HospitalSchedulePage() {
    const { user } = useAuth();
    const { toast } = useToast();

    // Estado unificado para os dados
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Estado para os modais (diálogos)
    const [isShiftDetailsOpen, setIsShiftDetailsOpen] = useState(false);
    const [isPatientSelectOpen, setIsPatientSelectOpen] = useState(false);
    const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);

    // Estado para dados selecionados
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [appointmentTime, setAppointmentTime] = useState("");
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Lógica de busca de dados universal
    const fetchData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);
        try {
            const hospitalId = user.uid;
            // Busca de CONTRATOS ATIVOS (sem filtro de tipo de serviço)
            const contractsQuery = query(collection(db, "contracts"), where("hospitalId", "==", hospitalId), where("status", "==", "ACTIVE_SIGNED"));
            const contractsSnapshot = await getDocs(contractsQuery);
            const fetchedContracts = contractsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Contract[];
            setContracts(fetchedContracts);

            // Busca de CONSULTAS JÁ AGENDADAS
            const consultsQuery = query(collection(db, "consultations"), where("hospitalId", "==", hospitalId));
            const consultsSnapshot = await getDocs(consultsQuery);
            const fetchedConsultations = consultsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Consultation[];
            setConsultations(fetchedConsultations);
            
        } catch (err) {
            console.error("Erro ao buscar dados da agenda:", err);
            setError("Falha ao carregar os dados. Por favor, tente novamente.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Mapeamento dos dados para o formato do FullCalendar
    const calendarEvents = useMemo((): CalendarEvent[] => {
        const events: CalendarEvent[] = [];

        contracts.forEach(contract => {
            const shiftDate = contract.shiftDates[0].toDate();
            const [startHour, startMinute] = contract.startTime.split(':').map(Number);
            const [endHour, endMinute] = contract.endTime.split(':').map(Number);

            const startDate = new Date(shiftDate.setHours(startHour, startMinute));
            const endDate = new Date(shiftDate.setHours(endHour, endMinute));
            
            // Adiciona o evento do plantão principal
            events.push({
                id: contract.id,
                title: `Plantão - Dr(a). ${contract.doctorName}`,
                start: startDate,
                end: endDate,
                backgroundColor: '#3b82f6', // Azul para plantão
                borderColor: '#1e40af',
                extendedProps: {
                    type: 'SHIFT',
                    contractId: contract.id,
                    doctorName: contract.doctorName || 'N/A',
                    consultations: consultations.filter(c => c.contractId === contract.id),
                }
            });

            // Adiciona os eventos de consulta dentro do plantão
            consultations.filter(c => c.contractId === contract.id).forEach(consult => {
                 const [consultStartHour, consultStartMinute] = consult.startTime.split(':').map(Number);
                 const [consultEndHour, consultEndMinute] = consult.endTime.split(':').map(Number);
                 const consultStartDate = new Date(new Date(shiftDate).setHours(consultStartHour, consultStartMinute));
                 const consultEndDate = new Date(new Date(shiftDate).setHours(consultEndHour, consultEndMinute));
                 events.push({
                     id: consult.id,
                     title: `Consulta: ${consult.patientName}`,
                     start: consultStartDate,
                     end: consultEndDate,
                     backgroundColor: '#16a34a', // Verde para consulta
                     borderColor: '#15803d',
                     extendedProps: {
                         type: 'CONSULTATION',
                         contractId: contract.id,
                         doctorName: contract.doctorName || 'N/A',
                         patientName: consult.patientName
                     }
                 });
            });
        });
        return events;
    }, [contracts, consultations]);

    // Lógicas de manipulação dos diálogos
    const handleEventClick = (clickInfo: any) => {
        const event = clickInfo.event;
        const calendarEvent: CalendarEvent = {
             id: event.id,
             title: event.title,
             start: event.start,
             end: event.end,
             backgroundColor: event.backgroundColor,
             borderColor: event.borderColor,
             extendedProps: event.extendedProps as any
        };
        setSelectedEvent(calendarEvent);
        setIsShiftDetailsOpen(true);
    };

    const handlePatientSelected = (patient: Patient) => {
        setSelectedPatient(patient);
        setIsPatientSelectOpen(false);
        setIsNewAppointmentOpen(true); // Abre o diálogo de agendamento
    };

    const handleScheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEvent || !selectedPatient || !appointmentTime.trim() || !chiefComplaint.trim() || !user) {
            toast({ title: "Campos obrigatórios", description: "Selecione um paciente, defina um horário e preencha a queixa principal.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const hospitalProfile = await getCurrentUserData() as HospitalProfile;
            const contract = contracts.find(c => c.id === selectedEvent.extendedProps.contractId);
            if (!hospitalProfile || !contract) throw new Error("Dados do hospital ou contrato não encontrados.");

            const [hour, minute] = appointmentTime.split(':').map(Number);
            const appointmentDuration = 30; // Duração padrão de 30 minutos
            const startDate = new Date(selectedEvent.start);
            startDate.setHours(hour, minute);
            const endDate = new Date(startDate.getTime() + appointmentDuration * 60000);

            const newConsultation = {
                patientId: selectedPatient.id,
                patientName: selectedPatient.name,
                chiefComplaint,
                startTime: appointmentTime,
                endTime: `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`,
                contractId: contract.id,
                doctorId: contract.doctorId,
                doctorName: contract.doctorName,
                serviceType: contract.serviceType,
                hospitalId: user.uid,
                hospitalName: hospitalProfile.displayName,
                status: "SCHEDULED",
                createdAt: serverTimestamp(),
            };
            
            const docRef = await addDoc(collection(db, "consultations"), newConsultation);

            toast({ title: "Consulta Agendada!", description: `${selectedPatient.name} foi agendado(a) com sucesso.`, variant: 'success' });
            
            // Atualiza o estado local para refletir a nova consulta imediatamente
            setConsultations(prev => [...prev, { id: docRef.id, ...newConsultation } as Consultation]);

            // Fecha todos os modais
            setIsNewAppointmentOpen(false);
            setIsShiftDetailsOpen(false);
            setSelectedEvent(null);

        } catch (err: any) {
            console.error("Erro ao agendar consulta:", err);
            toast({ title: "Erro no Agendamento", description: err.message || "Não foi possível salvar a consulta.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState onRetry={fetchData} />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">Agenda Hospitalar</h1>
                    <p className="text-muted-foreground">Visualize e gerencie seus plantões e consultas.</p>
                </div>
                {/* Futuro botão para criar plantão direto daqui */}
            </div>

            <Card>
                <CardContent className="p-2 sm:p-4">
                     {calendarEvents.length === 0 && !isLoading ? (
                        <EmptyState title="Nenhum plantão contratado" description="Quando um contrato for assinado, o plantão aparecerá aqui." />
                     ) : (
                        <FullCalendar
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView="timeGridWeek"
                            headerToolbar={{
                                left: 'prev,next today',
                                center: 'title',
                                right: 'dayGridMonth,timeGridWeek,timeGridDay'
                            }}
                            events={calendarEvents}
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

            {/* Diálogo de Detalhes do Plantão */}
            <Dialog open={isShiftDetailsOpen} onOpenChange={setIsShiftDetailsOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Plantão - Dr(a). {selectedEvent?.extendedProps.doctorName}</DialogTitle>
                        <DialogDescription>
                            {selectedEvent?.start.toLocaleDateString('pt-br', { weekday: 'long', day: '2-digit', month: 'long' })}
                             , das {selectedEvent?.start.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' })}
                             às {selectedEvent?.end.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' })}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <h3 className="font-semibold">Consultas já agendadas</h3>
                        {selectedEvent?.extendedProps.consultations?.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma consulta agendada para este plantão.</p>
                        ) : (
                            <Table>
                                <TableHeader><TableRow><TableHead>Paciente</TableHead><TableHead>Horário</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {selectedEvent?.extendedProps.consultations?.map(c => (
                                        <TableRow key={c.id}><TableCell>{c.patientName}</TableCell><TableCell>{c.startTime} - {c.endTime}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                         <Dialog open={isPatientSelectOpen} onOpenChange={setIsPatientSelectOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full mt-4"><PlusCircle className="mr-2 h-4 w-4"/>Agendar Nova Consulta</Button>
                            </DialogTrigger>
                            <PatientSelectionDialog onPatientSelect={handlePatientSelected} />
                        </Dialog>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Diálogo para Criar Novo Agendamento */}
            <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
                 <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Agendar Nova Consulta</DialogTitle>
                        <DialogDescription>
                            Defina os detalhes da consulta para <strong>{selectedPatient?.name}</strong> no plantão de Dr(a). {selectedEvent?.extendedProps.doctorName}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleScheduleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1.5"><Label htmlFor="appointmentTime">Horário da Consulta*</Label><Input id="appointmentTime" type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} required /></div>
                            <div className="space-y-1.5"><Label htmlFor="chiefComplaint">Queixa Principal*</Label><Textarea id="chiefComplaint" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} required /></div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsNewAppointmentOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

        </div>
    );
}