// app/hospital/dashboard/Equipe/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db, functions } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { type UserProfile } from '@/lib/auth-service';

// Componentes da UI
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Loader2, PlusCircle, Users, BadgeCheck, MailWarning, ShieldAlert, KeyRound } from 'lucide-react';

// Componente para o formulário de adição de novo membro (COM A LÓGICA CORRIGIDA)
const AddStaffDialog: React.FC<{ hospitalId: string; onStaffAdded: () => void }> = ({ hospitalId, onStaffAdded }) => {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [userType, setUserType] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!name || !email || !userType) {
            toast({ title: "Campos obrigatórios", description: "Por favor, preencha nome, email e o papel do profissional.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const createStaffUser = httpsCallable(functions, 'createStaffUser');
            const result = await createStaffUser({ hospitalId, name, email, userType });
            
            // Pega a senha temporária retornada pela função de backend
            const temporaryPassword = (result.data as any).temporaryPassword;
            
            toast({
                title: "Profissional Adicionado com Sucesso!",
                description: `A senha temporária para ${name} é: ${temporaryPassword}. Anote e informe ao usuário.`,
                duration: 15000, // Tempo maior para dar tempo de copiar a senha
                className: "bg-green-100 border-green-400"
            });
            onStaffAdded(); // Fecha o modal e atualiza a lista
        } catch (error: any) {
            console.error("Erro ao criar profissional:", error);
            toast({ title: "Erro ao criar profissional", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Adicionar Novo Profissional</DialogTitle>
                <DialogDescription>
                    Crie o cadastro para um membro da equipe. A senha inicial será exibida para você.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-1.5"><Label htmlFor="name">Nome Completo</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="userType">Papel / Função</Label>
                    <Select value={userType} onValueChange={setUserType}>
                        <SelectTrigger><SelectValue placeholder="Selecione um papel..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="receptionist">Recepcionista</SelectItem>
                            <SelectItem value="triage_nurse">Enfermeiro(a) de Triagem</SelectItem>
                            <SelectItem value="caravan_admin">Administrativo do Multirão</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                 <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting ? "Adicionando..." : "Adicionar e Gerar Senha"}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

// Componente Principal da Página de Equipa (COM GESTÃO DE SENHA)
export default function TeamManagementPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [staffList, setStaffList] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        
        const q = query(collection(db, "users"), where("hospitalId", "==", user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile))
                .filter(p => p.userType !== 'hospital' && p.userType !== 'doctor');
            setStaffList(list);
            setIsLoading(false);
        }, (error) => {
            console.error("Erro ao buscar equipe:", error);
            toast({ title: "Erro de Conexão", description: "Não foi possível carregar a lista de equipe em tempo real.", variant: "destructive"});
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);
    
    // Função para resetar a senha de um membro da equipe
    const handleResetPassword = async (staffMember: UserProfile) => {
        if (!confirm(`Tem certeza que deseja resetar a senha de ${staffMember.displayName}? Uma nova senha será gerada e exibida na tela.`)) {
            return;
        }
        try {
            const resetPasswordFunction = httpsCallable(functions, 'resetStaffUserPassword');
            const result = await resetPasswordFunction({ staffUserId: staffMember.uid });
            const newPassword = (result.data as any).newTemporaryPassword;
            toast({
                title: "Senha Resetada com Sucesso!",
                description: `A nova senha para ${staffMember.displayName} é: ${newPassword}`,
                duration: 15000,
                className: "bg-green-100 border-green-400"
            });
        } catch (error: any) {
            toast({ title: "Erro ao Resetar Senha", description: error.message, variant: "destructive" });
        }
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestão de Equipe</h1>
                    <p className="text-muted-foreground">Adicione e gira os profissionais da sua unidade.</p>
                </div>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4 w-4" />Adicionar Membro</Button>
                    </DialogTrigger>
                    {user && <AddStaffDialog hospitalId={user.uid} onStaffAdded={() => setIsModalOpen(false)} />}
                </Dialog>
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
                                <TableHead>Papel</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações de Gestão</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffList.length > 0 ? (
                                staffList.map(staff => (
                                    <TableRow key={staff.uid}>
                                        <TableCell>
                                            <div className="font-medium">{staff.displayName}</div>
                                            <div className="text-xs text-muted-foreground">{staff.email}</div>
                                        </TableCell>
                                        <TableCell className="capitalize">{staff.userType?.replace(/_/g, ' ') || 'N/A'}</TableCell>
                                        <TableCell>
                                            {staff.status === 'ACTIVE' && <Badge variant="default" className="bg-green-100 text-green-800 border-green-200"><BadgeCheck className="mr-1.5 h-3.5 w-3.5"/>Ativo</Badge>}
                                            {staff.status === 'INVITED' && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200"><MailWarning className="mr-1.5 h-3.5 w-3.5"/>Convidado</Badge>}
                                            {staff.status === 'SUSPENDED' && <Badge variant="destructive"><ShieldAlert className="mr-1.5 h-3.5 w-3.5"/>Suspenso</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleResetPassword(staff)}>
                                                <KeyRound className="mr-2 h-4 w-4" />
                                                Resetar Senha
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Nenhum profissional cadastrado ainda.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}