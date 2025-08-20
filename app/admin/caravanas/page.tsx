// app/admin/caravanas/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Importação atualizada para incluir 'functions'
import { db, functions } from '@/lib/firebase'; 
import { httpsCallable } from 'firebase/functions';
import { collection, query, onSnapshot, addDoc, serverTimestamp, Timestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';

// Componentes da UI e Utilitários
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, PlusCircle, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Interfaces
interface CaravanEvent {
    id: string;
    eventName: string;
    startDate: Timestamp;
    endDate: Timestamp;
    location: string;
    status: 'PLANEJAMENTO' | 'ATIVA' | 'CONCLUIDA';
    createdAt: Timestamp;
}


// --- FERRAMENTA TEMPORÁRIA ADICIONADA ---
/**
 * Componente para definir a permissão de administrador para um utilizador.
 * Utiliza uma Firebase Cloud Function ('setAdminClaim') para atribuir a permissão.
 * É uma ferramenta de uso único, ideal para a configuração inicial do sistema.
 */
const AdminClaimSetter = () => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    // Pré-preenchemos com o e-mail de admin padrão para facilitar.
    const [adminEmail, setAdminEmail] = useState("admin@fht.com");

    const setClaim = async () => {
        if (!adminEmail) {
            toast({ title: "Erro", description: "O campo de e-mail não pode estar vazio.", variant: "destructive" });
            return;
        }
        setIsLoading(true);
        try {
            // Prepara a chamada para a Cloud Function 'setAdminClaim'
            const setAdminClaimFunction = httpsCallable(functions, 'setAdminClaim');
            // Executa a função, passando o e-mail como parâmetro
            const result = await setAdminClaimFunction({ email: adminEmail });
            toast({ title: "Sucesso!", description: (result.data as any).message, className: "bg-green-600 text-white" });
        } catch (error: any) {
            toast({ title: "Erro ao definir permissão", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="mb-6 bg-yellow-50 border-yellow-300">
            <CardHeader>
                <CardTitle>Ferramenta de Administrador: Definir Permissão</CardTitle>
                <CardDescription>Use esta ferramenta uma única vez para atribuir a permissão de 'admin' ao seu utilizador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="admin-email">E-mail do Administrador</Label>
                    <Input id="admin-email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                </div>
                <Button onClick={setClaim} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Definir Permissão de Admin
                </Button>
            </CardContent>
        </Card>
    );
};
// --- FIM DA FERRAMENTA TEMPORÁRIA ---


// --- COMPONENTE PRINCIPAL ---
export default function CaravanManagementPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();

    const [events, setEvents] = useState<CaravanEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Estados do formulário de criação
    const [eventName, setEventName] = useState('');
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [location, setLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Efeito para buscar os eventos em tempo real
    useEffect(() => {
        const q = query(collection(db, "caravanEvents"), orderBy("startDate", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as CaravanEvent));
            setEvents(eventList);
            setIsLoading(false);
        }, (error) => {
            console.error("Erro de permissão no snapshot:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleCreateEvent = async () => {
        if (!eventName || !startDate || !endDate || !location) {
            toast({ title: "Campos Incompletos", description: "Todos os campos são obrigatórios.", variant: "destructive" });
            return;
        }
        if (endDate < startDate) {
            toast({ title: "Datas Inválidas", description: "A data final deve ser igual ou posterior à data inicial.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const newEventData = {
                eventName,
                startDate: Timestamp.fromDate(startDate),
                endDate: Timestamp.fromDate(endDate),
                location,
                status: 'PLANEJAMENTO', // Status inicial
                createdAt: serverTimestamp(),
            };
            await addDoc(collection(db, "caravanEvents"), newEventData);
            
            toast({ title: "Sucesso!", description: "O novo evento de multirão foi criado.", className: "bg-green-600 text-white" });
            setIsModalOpen(false);
            // Resetar formulário
            setEventName(''); setStartDate(undefined); setEndDate(undefined); setLocation('');

        } catch (error) {
            console.error("Erro ao criar evento:", error);
            toast({ title: "Erro", description: "Não foi possível criar o evento.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
            {/* O novo componente é adicionado aqui, no topo da página */}
            <AdminClaimSetter />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestão Multirão</h1>
                    <p className="text-muted-foreground">Crie e gerencie os eventos de saúde.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Criar Novo Evento
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Eventos Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome do Evento</TableHead>
                                <TableHead>Período</TableHead>
                                <TableHead>Local</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.length > 0 ? (
                                events.map(event => (
                                    <TableRow key={event.id}>
                                        <TableCell className="font-medium">{event.eventName}</TableCell>
                                        <TableCell>{`${format(event.startDate.toDate(), 'dd/MM/yy')} - ${format(event.endDate.toDate(), 'dd/MM/yy')}`}</TableCell>
                                        <TableCell>{event.location}</TableCell>
                                        <TableCell>
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                {event.status}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="outline" size="sm" onClick={() => router.push(`/admin/caravanas/${event.id}`)}>
                                                Gerenciar <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Nenhum evento de Multirão encontrado.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Modal de Criação de Evento */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Criar Novo Evento de Caravana</DialogTitle>
                        <DialogDescription>Preencha os detalhes abaixo para criar um novo projeto.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="eventName">Nome do Evento</Label>
                            <Input id="eventName" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Ex: Multirão da Saúde - São Paulo" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Data de Início</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                             <div className="space-y-1.5">
                                <Label>Data Final</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="location">Localização</Label>
                            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: São Paulo, SP" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateEvent} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Evento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}