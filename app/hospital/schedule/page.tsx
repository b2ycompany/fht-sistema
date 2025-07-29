// app/hospital/schedule/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { type Contract } from '@/lib/contract-service';
import { getCurrentUserData, type HospitalProfile } from '@/lib/auth-service';
// ADICIONADO: Importando a busca de pacientes
import { getPatientsByHospital, type Patient } from '@/lib/patient-service';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CalendarDays, Clock, User, ClipboardList, AlertTriangle, RotateCcw, CheckCircle, Search } from 'lucide-react';

// --- Interfaces e Tipos ---
type TelemedicineShift = Pick<Contract, 'id' | 'doctorId' | 'doctorName' | 'shiftDates' | 'startTime' | 'endTime'> & {
    patientName?: string;
};

// --- Componentes de Estado ---
const LoadingState = () => <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
const EmptyState = ({ title, description }: { title: string, description: string }) => <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{description}</p></div>;
const ErrorState = ({ onRetry }: { onRetry: () => void }) => <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="font-semibold text-red-700 mb-1">Erro ao carregar plantões</p><Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button></div>;

// --- NOVO COMPONENTE: DIÁLOGO DE SELEÇÃO DE PACIENTE ---
const PatientSelectionDialog: React.FC<{ onPatientSelect: (patient: Patient) => void }> = ({ onPatientSelect }) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const patientList = await getPatientsByHospital();
                setPatients(patientList);
            } catch (error) {
                console.error("Erro ao carregar pacientes para seleção:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPatients();
    }, []);

    const filteredPatients = useMemo(() => {
        if (!searchTerm) return patients;
        return patients.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.cpf?.includes(searchTerm)
        );
    }, [patients, searchTerm]);

    return (
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Selecionar Paciente</DialogTitle>
                <DialogDescription>Busque e selecione um paciente para este agendamento.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Input
                    placeholder="Buscar por nome ou CPF..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="mb-4"
                />
                <div className="border rounded-md max-h-80 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>CPF</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={2} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
                            {!isLoading && filteredPatients.length === 0 && <TableRow><TableCell colSpan={2} className="h-24 text-center">Nenhum paciente encontrado.</TableCell></TableRow>}
                            {!isLoading && filteredPatients.map(patient => (
                                <TableRow key={patient.id} className="cursor-pointer hover:bg-gray-100" onClick={() => onPatientSelect(patient)}>
                                    <TableCell className="font-medium">{patient.name}</TableCell>
                                    <TableCell>{patient.cpf || 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </DialogContent>
    );
};


// --- PÁGINA PRINCIPAL DE AGENDAMENTO (ATUALIZADA) ---
export default function SchedulePage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [availableShifts, setAvailableShifts] = useState<TelemedicineShift[]>([]);
    const [scheduledShifts, setScheduledShifts] = useState<TelemedicineShift[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
    const [isPatientSelectOpen, setIsPatientSelectOpen] = useState(false);
    
    const [selectedShift, setSelectedShift] = useState<TelemedicineShift | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estado do formulário atualizado
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [medicalHistory, setMedicalHistory] = useState('');

    const fetchShifts = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);
        try {
            const contractsRef = collection(db, "contracts");
            const q = query(
                contractsRef,
                where("hospitalId", "==", user.uid),
                where("status", "==", "ACTIVE_SIGNED"),
                where("serviceType", "==", "Telemedicina")
            );
            const contractsSnapshot = await getDocs(q);
            const allShifts = contractsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as TelemedicineShift[];

            const consultsRef = collection(db, "consultations");
            const scheduledContractIds: string[] = [];
            const shiftsWithPatientData: TelemedicineShift[] = [];

            const consultsQuery = query(consultsRef, where("hospitalId", "==", user.uid));
            const consultsSnapshot = await getDocs(consultsQuery);
            consultsSnapshot.forEach(doc => {
                const data = doc.data();
                scheduledContractIds.push(data.contractId);
                const correspondingShift = allShifts.find(s => s.id === data.contractId);
                if(correspondingShift) {
                    shiftsWithPatientData.push({ ...correspondingShift, patientName: data.patientName });
                }
            });

            setAvailableShifts(allShifts.filter(s => !scheduledContractIds.includes(s.id)));
            setScheduledShifts(shiftsWithPatientData);

        } catch (err) {
            console.error("Erro ao buscar plantões:", err);
            setError("Falha ao buscar os plantões disponíveis.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    const openScheduleDialog = (shift: TelemedicineShift) => {
        setSelectedShift(shift);
        setSelectedPatient(null);
        setChiefComplaint('');
        setMedicalHistory('');
        setIsScheduleDialogOpen(true);
    };

    const handlePatientSelected = (patient: Patient) => {
        setSelectedPatient(patient);
        setIsPatientSelectOpen(false);
    };

    const handleScheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedShift || !selectedPatient || !chiefComplaint || !user) {
            toast({ title: "Campos obrigatórios", description: "Selecione um paciente e preencha a queixa principal.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const hospitalProfile = await getCurrentUserData() as HospitalProfile | null;
            if (!hospitalProfile || !hospitalProfile.displayName) {
                throw new Error("Não foi possível obter os dados do hospital para o agendamento.");
            }

            const consultationsRef = collection(db, "consultations");
            await addDoc(consultationsRef, {
                patientId: selectedPatient.id,
                patientName: selectedPatient.name,
                chiefComplaint,
                medicalHistorySummary: medicalHistory,
                contractId: selectedShift.id,
                doctorId: selectedShift.doctorId,
                doctorName: selectedShift.doctorName,
                serviceType: 'Telemedicina',
                hospitalId: user.uid,
                hospitalName: hospitalProfile.displayName,
                status: "SCHEDULED",
                createdAt: serverTimestamp(),
            });

            toast({ title: "Consulta Agendada!", description: `${selectedPatient.name} foi agendado(a).`, variant: 'success' });
            setIsScheduleDialogOpen(false);
            
            const newlyScheduledShift = { ...selectedShift, patientName: selectedPatient.name };
            setScheduledShifts(prev => [...prev, newlyScheduledShift]);
            setAvailableShifts(prev => prev.filter(s => s.id !== selectedShift.id));
            
        } catch (err: any) {
            console.error("Erro ao agendar consulta:", err);
            toast({ title: "Erro no Agendamento", description: err.message || "Não foi possível salvar a consulta. Tente novamente.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold">Agendamento de Telemedicina</h1>
            <p className="text-gray-600">Selecione um plantão disponível para agendar a consulta de um paciente.</p>

            <Card>
                <CardHeader><CardTitle>Plantões Disponíveis para Agendamento</CardTitle></CardHeader>
                <CardContent>
                    {isLoading && <LoadingState />}
                    {error && <ErrorState onRetry={fetchShifts} />}
                    {!isLoading && !error && availableShifts.length === 0 && <EmptyState title="Nenhum plantão disponível" description='Crie e aprove um novo plantão de "Telemedicina" para que ele apareça aqui.'/>}
                    {!isLoading && !error && availableShifts.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {availableShifts.map(shift => (
                                <Card key={shift.id} className="flex flex-col">
                                    <CardHeader><CardTitle className="text-md">Dr(a). {shift.doctorName}</CardTitle></CardHeader>
                                    <CardContent className="text-sm space-y-2 flex-grow">
                                        <div className="flex items-center gap-2"><CalendarDays size={14} className="text-gray-500" /><span>{shift.shiftDates[0].toDate().toLocaleDateString('pt-BR')}</span></div>
                                        <div className="flex items-center gap-2"><Clock size={14} className="text-gray-500" /><span>{shift.startTime} - {shift.endTime}</span></div>
                                    </CardContent>
                                    <CardFooter><Button className="w-full" onClick={() => openScheduleDialog(shift)}>Agendar Paciente</Button></CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4">Consultas Agendadas</h2>
                <Card>
                    <CardContent className="pt-6">
                        {isLoading && <LoadingState />}
                         {!isLoading && !error && scheduledShifts.length === 0 && <EmptyState title="Nenhuma consulta agendada" description='As consultas que você agendar aparecerão aqui.'/>}
                         {!isLoading && !error && scheduledShifts.length > 0 && (
                             <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                 {scheduledShifts.map(shift => (
                                     <Card key={shift.id} className="flex flex-col bg-green-50 border-green-200">
                                         <CardHeader><CardTitle className="text-md">Dr(a). {shift.doctorName}</CardTitle></CardHeader>
                                         <CardContent className="text-sm space-y-2 flex-grow">
                                             <div className="flex items-center gap-2"><User size={14} className="text-gray-600"/><strong>Paciente: {shift.patientName}</strong></div>
                                             <div className="flex items-center gap-2"><CalendarDays size={14} className="text-gray-500" /><span>{shift.shiftDates[0].toDate().toLocaleDateString('pt-BR')}</span></div>
                                             <div className="flex items-center gap-2"><Clock size={14} className="text-gray-500" /><span>{shift.startTime} - {shift.endTime}</span></div>
                                         </CardContent>
                                         <CardFooter><Button className="w-full" variant="outline" disabled><CheckCircle size={16} className="mr-2"/>Agendado</Button></CardFooter>
                                     </Card>
                                 ))}
                             </div>
                         )}
                    </CardContent>
                </Card>
            </div>
            
            <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Agendar Consulta</DialogTitle>
                        <DialogDescription>
                            Selecione o paciente e preencha os detalhes para o plantão de Dr(a). {selectedShift?.doctorName}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleScheduleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Paciente*</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={selectedPatient ? `${selectedPatient.name} (${selectedPatient.cpf || 'sem CPF'})` : 'Nenhum paciente selecionado'}
                                        readOnly
                                        className="flex-grow"
                                    />
                                    <Dialog open={isPatientSelectOpen} onOpenChange={setIsPatientSelectOpen}>
                                        <DialogTrigger asChild>
                                            <Button type="button" variant="outline"><Search className="mr-2 h-4 w-4"/>Buscar</Button>
                                        </DialogTrigger>
                                        <PatientSelectionDialog onPatientSelect={handlePatientSelected} />
                                    </Dialog>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="chiefComplaint">Queixa Principal*</Label>
                                <Textarea id="chiefComplaint" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="medicalHistory">Histórico Resumido</Label>
                                <Textarea id="medicalHistory" value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmar Agendamento
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}