// app/dashboard/reception/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Timestamp } from "firebase/firestore";
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { searchPatients, createPatient, addPatientToServiceQueue, type Patient, type PatientPayload } from '@/lib/patient-service';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Search, UserPlus, ListPlus, UserCheck, ShieldAlert, Monitor, Hospital } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { type UserType } from '@/lib/auth-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ... (Componente NewPatientForm permanece o mesmo) ...
const NewPatientForm = ({ onPatientCreated, unitId, createdBy }: { onPatientCreated: (patient: Patient) => void, unitId: string, createdBy: string }) => {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [cpf, setCpf] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleSubmit = async () => {
        if (!name || !birthDate) {
            toast({ title: "Campos obrigatórios", description: "Nome Completo e Data de Nascimento são necessários.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const newPatientData: PatientPayload = { name, cpf, dob: birthDate, phone, unitId, createdBy, };
            const newPatientId = await createPatient(newPatientData);
            const createdPatient: Patient = { id: newPatientId, createdAt: new Timestamp(Math.floor(Date.now() / 1000), 0), name_lowercase: name.toLowerCase(), ...newPatientData };
            toast({ title: "Paciente Cadastrado!", description: `${name} foi adicionado(a) com sucesso.` });
            onPatientCreated(createdPatient);
        } catch(error: any) {
            toast({ title: "Erro ao Cadastrar", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    return (
        <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="name">Nome Completo</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="cpf">CPF (Opcional)</Label><Input id="cpf" value={cpf} onChange={e => setCpf(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label htmlFor="birthDate">Data de Nascimento</Label><Input id="birthDate" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="phone">Telefone (Opcional)</Label><Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} /></div>
            </div>
            <DialogFooter className="mt-4"><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}Salvar Paciente</Button></DialogFooter>
        </div>
    );
};


export default function ReceptionPage() {
    const { userProfile, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAddingToQueue, setIsAddingToQueue] = useState(false);
    const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
    const [attendanceType, setAttendanceType] = useState<'Presencial' | 'Telemedicina'>('Presencial');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    useEffect(() => {
        if (debouncedSearchTerm && userProfile?.hospitalId) {
            const performSearch = async () => {
                setIsLoading(true);
                try {
                    const results = await searchPatients(debouncedSearchTerm, userProfile.hospitalId!);
                    setSearchResults(results);
                } catch(error: any) {
                    toast({ title: "Erro na Busca", description: error.message, variant: "destructive" });
                } finally { setIsLoading(false); }
            };
            performSearch();
        } else { setSearchResults([]); }
    }, [debouncedSearchTerm, userProfile, toast]);

    const handleSelectPatient = (patient: Patient) => {
        setSelectedPatient(patient);
        setSearchTerm(patient.name);
        setSearchResults([]);
    };

    const handleAddToQueue = async () => {
        if (!selectedPatient || !userProfile?.hospitalId) {
            toast({ title: "Nenhum paciente selecionado", variant: "destructive" });
            return;
        }
        setIsAddingToQueue(true);
        try {
            // <<< MUDANÇA AQUI: Passa o userProfile.displayName como o nome da unidade
            await addPatientToServiceQueue(selectedPatient, userProfile.hospitalId, userProfile.displayName, attendanceType);
            toast({ title: "Sucesso!", description: `${selectedPatient.name} foi adicionado(a) à fila de ${attendanceType}.` });
            setSelectedPatient(null);
            setSearchTerm('');
        } catch (error: any) {
            toast({ title: "Erro ao adicionar à Fila", description: error.message, variant: "destructive" });
        } finally { setIsAddingToQueue(false); }
    };

    if (authLoading || !userProfile) { return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>; }
    const allowedRoles: UserType[] = ['admin', 'receptionist', 'caravan_admin', 'hospital', 'backoffice'];
    if (!allowedRoles.includes(userProfile.userType)) { return ( <div className="container mx-auto flex h-[calc(100vh-80px)] items-center justify-center p-8 text-center"><Card className="w-full max-w-md border-red-500 bg-red-50"><CardHeader><CardTitle className="flex items-center justify-center gap-2 text-2xl text-red-700"><ShieldAlert className="h-8 w-8" />Acesso Negado</CardTitle></CardHeader></Card></div> ); }

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
            <h1 className="text-3xl font-bold">Recepção - Check-in de Pacientes</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle>1. Encontrar ou Cadastrar Paciente</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative"><Label htmlFor="search">Buscar Paciente por Nome ou CPF</Label><Search className="absolute left-2 top-9 h-4 w-4 text-muted-foreground" /><Input id="search" placeholder="Digite para buscar..." className="pl-8" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedPatient(null); }} /></div>
                        {isLoading && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}
                        {searchResults.length > 0 && ( <div className="border rounded-md max-h-48 overflow-y-auto">{searchResults.map(patient => (<div key={patient.id} onClick={() => handleSelectPatient(patient)} className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"><p className="font-semibold">{patient.name}</p><p className="text-sm text-muted-foreground">CPF: {patient.cpf || 'Não informado'}</p></div>))}</div> )}
                        <div className="text-center pt-2"><p className="text-sm text-muted-foreground mb-2">Não encontrou o paciente?</p>
                             <Dialog open={isNewPatientModalOpen} onOpenChange={setIsNewPatientModalOpen}><DialogTrigger asChild><Button variant="outline"><UserPlus className="mr-2 h-4 w-4"/>Cadastrar Novo Paciente</Button></DialogTrigger>
                                <DialogContent><DialogHeader><DialogTitle>Cadastrar Novo Paciente</DialogTitle></DialogHeader><NewPatientForm unitId={userProfile.hospitalId!} createdBy={userProfile.uid!} onPatientCreated={(patient) => { handleSelectPatient(patient); setIsNewPatientModalOpen(false); }} /></DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-1 sticky top-24">
                    <CardHeader><CardTitle>2. Adicionar à Fila</CardTitle></CardHeader>
                    <CardContent>
                        {selectedPatient ? (
                            <div className="space-y-4">
                                <div><p className="text-lg font-semibold flex items-center gap-2"><UserCheck className="text-green-500"/>{selectedPatient.name}</p><p className="text-sm text-muted-foreground">CPF: {selectedPatient.cpf || 'Não informado'}</p></div>
                                <div className="space-y-1.5"><Label htmlFor="attendance-type">Tipo de Atendimento</Label>
                                    <Select value={attendanceType} onValueChange={(value) => setAttendanceType(value as any)}><SelectTrigger id="attendance-type"><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                                        <SelectContent><SelectItem value="Presencial"><div className="flex items-center gap-2"><Hospital className="h-4 w-4"/> Presencial</div></SelectItem><SelectItem value="Telemedicina"><div className="flex items-center gap-2"><Monitor className="h-4 w-4"/> Telemedicina</div></SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleAddToQueue} disabled={isAddingToQueue} className="w-full">{isAddingToQueue ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ListPlus className="mr-2 h-4 w-4" />}Adicionar à Fila</Button>
                            </div>
                        ) : (<p className="text-center text-sm text-muted-foreground h-full flex items-center justify-center">Selecione ou cadastre um paciente para continuar.</p>)}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}