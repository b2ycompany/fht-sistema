// app/hospital/patients/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/components/auth-provider';
import { createPatient, searchPatients, type Patient, type PatientPayload } from "@/lib/patient-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, PlusCircle, AlertTriangle } from 'lucide-react';
import { IMaskInput } from 'react-imask'; // <<< ADICIONADO PARA MÁSCARA

// Função para formatar a data de YYYY-MM-DD para DD/MM/YYYY
const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
};

const AddPatientDialog: React.FC<{ onPatientAdded: () => void }> = ({ onPatientAdded }) => {
    const [name, setName] = useState('');
    const [cpf, setCpf] = useState('');
    const [dob, setDob] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { user, userProfile } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !userProfile || !userProfile.hospitalId) {
            toast({ title: "Erro de Autenticação", description: "Utilizador ou unidade não identificada.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const payload: PatientPayload = {
                name,
                cpf: cpf || undefined,
                dob: dob || undefined,
                phone: phone || undefined,
                unitId: userProfile.hospitalId,
                createdBy: user.uid,
            };
            await createPatient(payload);
            toast({ title: "Paciente Adicionado!", description: `${name} foi cadastrado com sucesso.`, variant: 'success' });
            onPatientAdded();
        } catch (error: any) {
            toast({ title: "Erro ao Adicionar Paciente", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Adicionar Novo Paciente</DialogTitle>
                <DialogDescription>Preencha os dados demográficos do paciente.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Nome*</Label>
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cpf" className="text-right">CPF</Label>
                        {/* <<< CORREÇÃO: INPUT COM MÁSCARA APLICADA AQUI >>> */}
                        <IMaskInput
                            mask="000.000.000-00"
                            value={cpf}
                            unmask={true} // Salva o valor sem a máscara
                            onAccept={(value) => setCpf(value as string)}
                            placeholder="000.000.000-00"
                            className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dob" className="text-right">Data de Nasc.</Label>
                        <Input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phone" className="text-right">Telefone</Label>
                        <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting || !userProfile}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Paciente
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};

export default function PatientsPage() {
    const router = useRouter();
    const { userProfile, profileLoading } = useAuth();
    const { toast } = useToast();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        const performSearch = async () => {
            if (!userProfile || !userProfile.hospitalId || searchTerm.length < 2) {
                setPatients([]);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const patientList = await searchPatients(searchTerm, userProfile.hospitalId);
                setPatients(patientList);
            } catch (err: any) {
                setError(err.message);
                toast({ title: "Erro na Busca", description: err.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        const debounceTimer = setTimeout(() => {
            performSearch();
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [searchTerm, userProfile, toast]);

    const handlePatientAdded = () => {
        setIsDialogOpen(false);
        setSearchTerm(''); 
        setPatients([]);
    };

    const handleRowClick = (patientId: string) => {
        router.push(`/hospital/patients/${patientId}`);
    };

    if (profileLoading) {
        return <div className="flex h-32 justify-center items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl md:text-3xl font-bold">Gestão de Pacientes</h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4 w-4" />Adicionar Paciente</Button>
                    </DialogTrigger>
                    <AddPatientDialog onPatientAdded={handlePatientAdded} />
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Lista de Pacientes</CardTitle>
                    <CardDescription>Busque por nome ou CPF (mínimo de 2 caracteres).</CardDescription>
                </CardHeader>
                <CardContent>
                    <Input
                        placeholder="Buscar por nome..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="max-w-sm mb-4"
                    />
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>CPF</TableHead>
                                    <TableHead>Data de Nasc.</TableHead>
                                    <TableHead>Contato</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                ) : error ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-red-600"><AlertTriangle className="mx-auto mb-2"/>{error}</TableCell></TableRow>
                                ) : searchTerm.length < 2 ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Digite ao menos 2 caracteres para buscar.</TableCell></TableRow>
                                ) : patients.length === 0 ? (
                                     <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum paciente encontrado.</TableCell></TableRow>
                                ) : (
                                    patients.map(patient => (
                                        <TableRow 
                                            key={patient.id} 
                                            className="cursor-pointer hover:bg-gray-50"
                                            onClick={() => handleRowClick(patient.id)}
                                        >
                                            <TableCell className="font-medium">{patient.name}</TableCell>
                                            <TableCell>{patient.cpf || 'N/A'}</TableCell>
                                            <TableCell>{formatDate(patient.dob)}</TableCell>
                                            <TableCell>{patient.phone || 'N/A'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}