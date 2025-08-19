// app/caravan/reception/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth-provider'; // CORREÇÃO FINAL: Caminho correto
import { createPatient, searchPatients, type Patient, type PatientPayload } from '@/lib/patient-service';

// Componentes da UI
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PlusCircle, UserPlus } from 'lucide-react';


const NewPatientForm: React.FC<{ onPatientCreated: (patient: Patient) => void }> = ({ onPatientCreated }) => {
    const { toast } = useToast();
    const { user, userProfile } = useAuth(); // CORREÇÃO: userProfile contém os dados
    const [name, setName] = useState('');
    const [cpf, setCpf] = useState('');
    const [dob, setDob] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        // CORREÇÃO: Verifica user e userProfile, e usa hospitalId de userProfile
        if (!user || !userProfile || !userProfile.hospitalId) { 
            toast({ title: "Erro de Autenticação", description: "Utilizador ou unidade não identificada.", variant: "destructive" });
            return;
        }
        if (!name) {
            toast({ title: "Nome Obrigatório", description: "O nome do paciente é necessário.", variant: "destructive" });
            return;
        }
        setIsCreating(true);
        try {
            const payload: PatientPayload = { 
                name, 
                cpf,
                dob: dob || undefined,
                unitId: userProfile.hospitalId, // Usa hospitalId do perfil
                createdBy: user.uid 
            };
            
            const newPatientId = await createPatient(payload);

            const newPatient: Patient = { 
                id: newPatientId, 
                name, 
                cpf,
                dob,
                name_lowercase: name.toLowerCase(),
                createdAt: new Date() as any,
                unitId: userProfile.hospitalId,
                createdBy: user.uid,
            };

            toast({ title: "Paciente Cadastrado!", description: `${name} foi adicionado(a) com sucesso.`, className: "bg-green-600 text-white" });
            onPatientCreated(newPatient);
        } catch (error: any) {
            console.error("Erro ao criar paciente:", error);
            toast({ title: "Erro ao Cadastrar", description: error.message, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="new-patient-name">Nome Completo</Label>
                <Input id="new-patient-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nome do paciente" />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="new-patient-cpf">CPF (Opcional)</Label>
                <Input id="new-patient-cpf" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="new-patient-dob">Data de Nascimento (Opcional)</Label>
                <Input id="new-patient-dob" type="date" value={dob} onChange={e => setDob(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={isCreating || !userProfile} className="w-full">
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Salvar Paciente
            </Button>
        </div>
    );
};

const PatientSelectionDialog: React.FC<{ onPatientSelect: (patient: Patient) => void, onCancel: () => void }> = ({ onPatientSelect, onCancel }) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
    const { toast } = useToast();
    const { userProfile } = useAuth(); // CORREÇÃO: Usa userProfile

    useEffect(() => {
        const fetchPatients = async () => {
             // CORREÇÃO: Valida com userProfile
            if (!userProfile || !userProfile.hospitalId || searchTerm.length < 2) {
                setPatients([]);
                return;
            }
            setIsLoading(true);
            try {
                const patientList = await searchPatients(searchTerm, userProfile.hospitalId); 
                setPatients(patientList);
            } catch (error) {
                toast({ title: "Erro", description: "Não foi possível carregar a lista de pacientes.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        const debounceTimer = setTimeout(() => {
            fetchPatients();
        }, 300);

        return () => clearTimeout(debounceTimer);

    }, [searchTerm, userProfile, toast]);

    const handlePatientCreated = (newPatient: Patient) => {
        setIsNewPatientModalOpen(false);
        onPatientSelect(newPatient);
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>Passo 1 de 2: Identificar Paciente</DialogTitle>
                <DialogDescription>Busque um paciente existente ou cadastre um novo para iniciar o atendimento.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Input
                    placeholder="Buscar por nome ou CPF (mínimo 2 letras)..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="mb-4"
                />
                <div className="border rounded-md max-h-80 overflow-y-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CPF</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={2} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>}
                            {!isLoading && searchTerm.length < 2 && (
                                <TableRow><TableCell colSpan={2} className="h-24 text-center text-muted-foreground">Digite ao menos 2 caracteres para buscar.</TableCell></TableRow>
                            )}
                            {!isLoading && searchTerm.length >= 2 && patients.length === 0 && (
                                <TableRow><TableCell colSpan={2} className="h-24 text-center">Nenhum paciente encontrado.</TableCell></TableRow>
                            )}
                            {!isLoading && patients.map(patient => (
                                <TableRow key={patient.id} className="cursor-pointer hover:bg-muted" onClick={() => onPatientSelect(patient)}>
                                    <TableCell className="font-medium">{patient.name}</TableCell>
                                    <TableCell>{patient.cpf || 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
             <DialogFooter className="sm:justify-between">
                <Dialog open={isNewPatientModalOpen} onOpenChange={setIsNewPatientModalOpen}>
                    <Button type="button" variant="secondary" onClick={() => setIsNewPatientModalOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" /> Cadastrar Novo Paciente
                    </Button>
                     <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Paciente</DialogTitle>
                        </DialogHeader>
                        <NewPatientForm onPatientCreated={handlePatientCreated} />
                    </DialogContent>
                </Dialog>
                <Button type="button" variant="outline" onClick={onCancel}>Cancelar Fluxo</Button>
            </DialogFooter>
        </>
    );
};


// Componente Principal
export default function CaravanReceptionPage() {
    const { toast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalStep, setModalStep] = useState<'SELECT_PATIENT' | 'TRIAGE_FORM'>('SELECT_PATIENT');
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [selectedSpecialty, setSelectedSpecialty] = useState('');
    const [serviceType, setServiceType] = useState('Telemedicina');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const specialties = ["Clínica Geral", "Cardiologia", "Pediatria", "Ginecologia", "Oftalmologia", "Dermatologia"];

    const handleOpenModal = () => {
        setModalStep('SELECT_PATIENT');
        setSelectedPatient(null);
        setChiefComplaint('');
        setSelectedSpecialty('');
        setServiceType('Telemedicina');
        setIsSubmitting(false);
        setIsModalOpen(true);
    };

    const handlePatientSelected = (patient: Patient) => {
        setSelectedPatient(patient);
        setModalStep('TRIAGE_FORM');
    };

    const handleSubmitTriage = async () => {
        if (!selectedPatient || !chiefComplaint || !selectedSpecialty || !serviceType) {
            toast({ title: "Campos Incompletos", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const newConsultation = {
                patientId: selectedPatient.id,
                patientName: selectedPatient.name,
                unitId: selectedPatient.unitId,
                chiefComplaint,
                specialty: selectedSpecialty,
                serviceType: serviceType,
                status: "AGUARDANDO",
                createdAt: serverTimestamp(),
                doctorId: null, 
            };
            await addDoc(collection(db, "consultations"), newConsultation);
            toast({ title: "Sucesso!", description: `${selectedPatient.name} foi enviado(a) para a fila de ${selectedSpecialty}.`, className: "bg-green-600 text-white" });
            setIsModalOpen(false);
        } catch (error: any) {
            toast({ title: "Erro no Servidor", description: "Não foi possível encaminhar o paciente.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
            <div className="text-center">
                <h1 className="text-4xl font-bold tracking-tight">Recepção do Multirão</h1>
                <p className="text-lg text-muted-foreground mt-2">Clique abaixo para iniciar um novo atendimento.</p>
            </div>
            <Button size="lg" className="mt-8 text-lg py-8 px-10" onClick={handleOpenModal}>
                <PlusCircle className="mr-3 h-6 w-6" />
                Registrar Novo Atendimento
            </Button>
            
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-2xl">
                    {modalStep === 'SELECT_PATIENT' && (
                        <PatientSelectionDialog onPatientSelect={handlePatientSelected} onCancel={() => setIsModalOpen(false)} />
                    )}
                    {modalStep === 'TRIAGE_FORM' && selectedPatient && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Passo 2 de 2: Triagem e Encaminhamento</DialogTitle>
                                <DialogDescription>Preencha os dados de triagem para <span className="font-bold">{selectedPatient.name}</span>.</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                                <div className="sm:col-span-2 space-y-1.5">
                                    <Label htmlFor="chiefComplaint">Queixa Principal do Paciente</Label>
                                    <Textarea id="chiefComplaint" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="Ex: Dor de cabeça e febre há 3 dias..." rows={3} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="specialty">Encaminhar para a Especialidade</Label>
                                    <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}><SelectTrigger id="specialty"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{specialties.map(spec => (<SelectItem key={spec} value={spec}>{spec}</SelectItem>))}</SelectContent></Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="serviceType">Tipo de Atendimento</Label>
                                    <Select value={serviceType} onValueChange={setServiceType}><SelectTrigger id="serviceType"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="Presencial">Presencial</SelectItem><SelectItem value="Telemedicina">Telemedicina</SelectItem></SelectContent></Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setModalStep('SELECT_PATIENT')}>Voltar</Button>
                                <Button onClick={handleSubmitTriage} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Encaminhar para Fila
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}