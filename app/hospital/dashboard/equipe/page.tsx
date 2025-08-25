// app/hospital/dashboard/Equipe/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db, functions } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';

// Tipos
import { type UserProfile, type UserType, type StaffStatus } from '@/lib/auth-service';

// Componentes da UI
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge'; // <<< IMPORTAÇÃO ADICIONADA
import { Loader2, PlusCircle, UserPlus, Users, BadgeCheck, MailWarning, ShieldAlert } from 'lucide-react'; // <<< ÍCONES ADICIONADOS

// Componente para o formulário de adição de novo membro (sem alterações)
const NewStaffForm: React.FC<{ hospitalId: string; onStaffAdded: () => void }> = ({ hospitalId, onStaffAdded }) => {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [userType, setUserType] = useState<UserType | ''>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!name || !email || !userType) {
            toast({ title: "Campos obrigatórios", description: "Por favor, preencha nome, email e o papel do profissional.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const createStaffUser = httpsCallable(functions, 'createStaffUser');
            await createStaffUser({ hospitalId, name, email, userType });
            toast({ title: "Sucesso!", description: `Um convite foi enviado para ${name}.`, className: "bg-green-600 text-white" });
            onStaffAdded();
        } catch (error: any) {
            console.error("Erro ao criar profissional:", error);
            toast({ title: "Erro ao criar profissional", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label htmlFor="name">Nome Completo</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="userType">Papel / Função</Label>
                <Select value={userType} onValueChange={(value) => setUserType(value as UserType)}>
                    <SelectTrigger><SelectValue placeholder="Selecione um papel..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="receptionist">Recepcionista</SelectItem>
                        <SelectItem value="triage_nurse">Enfermeiro(a) de Triagem</SelectItem>
                        <SelectItem value="caravan_admin">Administrativo do Multirão</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Adicionar e Enviar Convite
                </Button>
            </DialogFooter>
        </div>
    );
};


// Componente Principal da Página de Equipa
export default function TeamManagementPage() {
    const { user } = useAuth();
    const [staffList, setStaffList] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!user) return;
        
        const q = query(collection(db, "users"), where("hospitalId", "==", user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    uid: doc.id,
                    displayName: data.displayName || 'Nome não informado',
                    email: data.email || 'Email não informado',
                    userType: data.userType || 'Não definido',
                    status: data.status || 'INVITED', // <<< CAMPO STATUS ADICIONADO
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    hospitalId: data.hospitalId,
                } as UserProfile;
            });
            setStaffList(list);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestão de Equipa</h1>
                    <p className="text-muted-foreground">Adicione e gira os profissionais da sua unidade.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Membro da Equipa
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users /> Profissionais Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Papel</TableHead>
                                {/* --- COLUNA DE STATUS ADICIONADA --- */}
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffList.length > 0 ? (
                                staffList.map(staff => (
                                    <TableRow key={staff.uid}>
                                        <TableCell className="font-medium">{staff.displayName}</TableCell>
                                        <TableCell>{staff.email}</TableCell>
                                        <TableCell className="capitalize">{staff.userType?.replace(/_/g, ' ') || 'N/A'}</TableCell>
                                        {/* --- CÉLULA DE STATUS COM BADGE CONDICIONAL --- */}
                                        <TableCell>
                                            {staff.status === 'ACTIVE' && <Badge variant="default" className="bg-green-100 text-green-800 border-green-200"><BadgeCheck className="mr-1.5 h-3.5 w-3.5"/>Ativo</Badge>}
                                            {staff.status === 'INVITED' && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200"><MailWarning className="mr-1.5 h-3.5 w-3.5"/>Convidado</Badge>}
                                            {staff.status === 'SUSPENDED' && <Badge variant="destructive"><ShieldAlert className="mr-1.5 h-3.5 w-3.5"/>Suspenso</Badge>}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    {/* --- COLSPAN ATUALIZADO DE 3 PARA 4 --- */}
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Nenhum profissional cadastrado ainda.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar Novo Profissional</DialogTitle>
                        <DialogDescription>
                            Um convite por e-mail será enviado para que o profissional defina sua senha e acesse a plataforma.
                        </DialogDescription>
                    </DialogHeader>
                    {user && <NewStaffForm hospitalId={user.uid} onStaffAdded={() => setIsModalOpen(false)} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}