// app/admin/caravanas/[eventId]/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, getDocs, collection, updateDoc, FieldValue, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { type UserProfile, UserType } from '@/lib/auth-service';

// Componentes da UI
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Info, UserPlus, Trash2 } from 'lucide-react';
import Link from 'next/link';

export interface CaravanEvent {
    id: string;
    eventName: string;
    startDate: Timestamp;
    endDate: Timestamp;
    location: string;
    status: 'PLANEJAMENTO' | 'ATIVA' | 'CONCLUIDA';
    createdAt: Timestamp;
    enrolledStaff?: {
        uid: string;
        displayName: string;
        userType: string;
    }[];
}

// --- SUBCOMPONENTE: Formulário para CRIAR nova Equipa ---
const NewStaffForm: React.FC<{ onStaffCreated: (user: UserProfile) => void, onCancel: () => void }> = ({ onStaffCreated, onCancel }) => {
    const { toast } = useToast();
    const params = useParams(); // Pega os parâmetros do URL
    const eventId = params.eventId as string; // Captura o eventId aqui

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [userType, setUserType] = useState<UserType | ''>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!name || !email || !userType) {
            toast({ title: "Campos obrigatórios", description: "Por favor, preencha todos os campos.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const createStaffUser = httpsCallable(functions, 'createStaffUser');
            // Envia o eventId como o hospitalId para a função de backend
            const result = await createStaffUser({ name, email, userType, hospitalId: eventId });
            
            const newUserData = (result.data as any).user;

            toast({ title: "Sucesso!", description: `${name} foi criado(a) e adicionado(a) ao sistema.`, className: "bg-green-600 text-white" });
            
            onStaffCreated({
                uid: newUserData.uid,
                displayName: newUserData.displayName,
                email: newUserData.email,
                userType: newUserData.userType,
            } as UserProfile);

        } catch (error: any) {
            toast({ title: "Erro ao criar profissional", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Cadastrar Novo Profissional</DialogTitle>
                <DialogDescription>Crie uma conta para um novo membro da Equipe. Ele será adicionado automaticamente a este evento.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                 <div className="space-y-1.5"><Label htmlFor="name-new">Nome Completo</Label><Input id="name-new" value={name} onChange={(e) => setName(e.target.value)} /></div>
                 <div className="space-y-1.5"><Label htmlFor="email-new">Email</Label><Input id="email-new" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                 <div className="space-y-1.5"><Label htmlFor="userType-new">Papel / Função</Label><Select value={userType} onValueChange={(value) => setUserType(value as UserType)}><SelectTrigger id="userType-new"><SelectValue placeholder="Selecione um papel..." /></SelectTrigger><SelectContent><SelectItem value="receptionist">Recepcionista</SelectItem><SelectItem value="triage_nurse">Enfermeiro(a) de Triagem</SelectItem><SelectItem value="caravan_admin">Administrativo</SelectItem><SelectItem value="doctor">Médico(a)</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar e Adicionar ao Projeto
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

// --- COMPONENTE PARA ADICIONAR MEMBROS DA Equipa (FLUXO COMPLETO) ---
const AddStaffModal: React.FC<{
    allUsers: UserProfile[];
    enrolledStaffIds: string[];
    onAddStaff: (user: UserProfile) => Promise<void>;
    onClose: () => void;
}> = ({ allUsers, enrolledStaffIds, onAddStaff, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddingId, setIsAddingId] = useState<string | null>(null);
    const [isNewStaffModalOpen, setIsNewStaffModalOpen] = useState(false);

    const availableUsers = useMemo(() => {
        return allUsers
            .filter(user => !enrolledStaffIds.includes(user.uid))
            .filter(user => (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }, [allUsers, enrolledStaffIds, searchTerm]);
    
    const handleAddClick = async (user: UserProfile) => {
        setIsAddingId(user.uid);
        await onAddStaff(user);
        setIsAddingId(null);
    };
    
    const handleStaffCreated = (newUser: UserProfile) => {
        setIsNewStaffModalOpen(false);
        onAddStaff(newUser);
        onClose(); // Fecha o modal principal após a criação e adição
    };

    return (
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Adicionar Profissional ao Evento</DialogTitle>
                <DialogDescription>Busque profissionais existentes ou cadastre um novo para este evento.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <div className="flex gap-4 mb-4">
                    <Input placeholder="Buscar profissional por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <Dialog open={isNewStaffModalOpen} onOpenChange={setIsNewStaffModalOpen}>
                        <Button variant="secondary" onClick={() => setIsNewStaffModalOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" /> Cadastrar Novo
                        </Button>
                        <NewStaffForm onStaffCreated={handleStaffCreated} onCancel={() => setIsNewStaffModalOpen(false)} />
                    </Dialog>
                </div>
                <div className="border rounded-md max-h-80 overflow-y-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Papel</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {availableUsers.length > 0 ? (
                                availableUsers.map(user => (
                                    <TableRow key={user.uid}>
                                        <TableCell className="font-medium">{user.displayName || '(Nome não definido)'}</TableCell>
                                        <TableCell className="capitalize">{user.userType?.replace('_', ' ')}</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" onClick={() => handleAddClick(user)} disabled={isAddingId === user.uid}>
                                                {isAddingId === user.uid ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Adicionar'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="h-24 text-center">Nenhum profissional disponível encontrado.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </DialogContent>
    );
};


// --- COMPONENTE PRINCIPAL DA PÁGINA DE DETALHES ---
export default function CaravanEventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const eventId = params.eventId as string;

    const [event, setEvent] = useState<CaravanEvent | null>(null);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!eventId) return;
        const eventRef = doc(db, "caravanEvents", eventId);
        const unsubscribeEvent = onSnapshot(eventRef, (docSnap) => {
            if (docSnap.exists()) {
                setEvent({ id: docSnap.id, ...docSnap.data() } as CaravanEvent);
            } else {
                toast({ title: "Erro", description: "Evento não encontrado.", variant: "destructive" });
                router.push("/admin/caravanas");
            }
            setIsLoading(false);
        });

        const usersRef = collection(db, "users");
        const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
            const usersList = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
            setAllUsers(usersList);
        });

        return () => {
            unsubscribeEvent();
            unsubscribeUsers();
        };
    }, [eventId, router, toast]);

    const handleAddStaff = async (user: UserProfile) => {
        const eventRef = doc(db, "caravanEvents", eventId);
        try {
            await updateDoc(eventRef, {
                enrolledStaff: arrayUnion({
                    uid: user.uid,
                    displayName: user.displayName,
                    userType: user.userType,
                })
            });
            toast({ title: "Sucesso!", description: `${user.displayName} foi adicionado(a) à Equipe.`, className: "bg-green-600 text-white" });
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível adicionar o membro.", variant: "destructive" });
        }
    };

    const handleRemoveStaff = async (staffMember: { uid: string, displayName: string, userType: string }) => {
        const eventRef = doc(db, "caravanEvents", eventId);
        try {
            await updateDoc(eventRef, {
                enrolledStaff: arrayRemove(staffMember)
            });
            toast({ title: "Removido", description: `${staffMember.displayName} foi removido(a) da Equipe.` });
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível remover o membro.", variant: "destructive" });
        }
    };

    if (isLoading || !event) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    }

    const enrolledStaffIds = event.enrolledStaff?.map((s: any) => s.uid) || [];

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
            <div>
                <Link href="/admin/caravanas" className="text-sm text-blue-600 hover:underline">‹ Voltar para todos os eventos</Link>
                <h1 className="text-3xl font-bold tracking-tight mt-2">{event.eventName}</h1>
                <p className="text-muted-foreground">{event.location}</p>
            </div>
            
            <Tabs defaultValue="Equipa">
                <TabsList>
                    <TabsTrigger value="detalhes"><Info className="mr-2 h-4 w-4" /> Detalhes</TabsTrigger>
                    <TabsTrigger value="Equipa"><Users className="mr-2 h-4 w-4" /> Equipa do Evento</TabsTrigger>
                </TabsList>
                
                <TabsContent value="detalhes" className="mt-4">
                    <Card><CardContent className="p-6">Detalhes e configurações do evento aparecerão aqui.</CardContent></Card>
                </TabsContent>
                
                <TabsContent value="Equipa" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Equipa Alocada</CardTitle>
                                <CardDescription>Profissionais que terão acesso ao portal deste evento.</CardDescription>
                            </div>
                            <Button onClick={() => setIsModalOpen(true)}><UserPlus className="mr-2 h-4 w-4" /> Adicionar Membro</Button>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Papel</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {event.enrolledStaff && event.enrolledStaff.length > 0 ? (
                                        event.enrolledStaff.map((staff: any) => (
                                            <TableRow key={staff.uid}>
                                                <TableCell className="font-medium">{staff.displayName}</TableCell>
                                                <TableCell className="capitalize">{staff.userType?.replace('_', ' ')}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveStaff(staff)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={3} className="h-24 text-center">Nenhum profissional alocado neste evento ainda.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <AddStaffModal allUsers={allUsers} enrolledStaffIds={enrolledStaffIds} onAddStaff={handleAddStaff} onClose={() => setIsModalOpen(false)} />
            </Dialog>
        </div>
    );
}