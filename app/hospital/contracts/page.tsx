// app/hospital/contracts/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ClipboardList, AlertTriangle, FileSignature, UserCheck, CalendarDays, Clock, DollarSign, Briefcase, RotateCcw, Edit, MessageSquare, Send } from 'lucide-react';
import { getContractsForHospital, signContractByHospital, type Contract } from '@/lib/contract-service';
import { getMatchesForHospitalInNegotiation, sendMessageInMatchChat, getMatchChatMessages, type PotentialMatch, type ChatMessage, type ChatTarget } from '@/lib/match-service';
import { formatCurrency } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ message }: { message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{message}</p></div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="text-base font-semibold text-red-700 mb-1">Oops!</p><p>{message || "Não foi possível carregar."}</p>{onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}</div> ));

const NegotiationChat: React.FC<{ matchId: string, target: ChatTarget }> = ({ matchId, target }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!matchId) return;
        const unsubscribe = getMatchChatMessages(matchId, target, setMessages);
        return () => unsubscribe();
    }, [matchId, target]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;
        setIsSending(true);
        try {
            await sendMessageInMatchChat(matchId, newMessage, target);
            setNewMessage("");
        } catch (error) { console.error(`Erro ao enviar mensagem para ${target}:`, error); }
        finally { setIsSending(false); }
    };

    return (
        <div>
            <div className="border bg-slate-50 rounded-lg p-2 h-56 overflow-y-auto flex flex-col gap-2">
                {messages.map(msg => (
                    <div key={msg.id} className={cn("flex flex-col w-full", msg.senderId === user?.uid ? "items-end" : "items-start")}>
                        <div className={cn( "p-2 rounded-lg max-w-[85%]", msg.senderRole === 'admin' ? "bg-blue-600 text-white" : "bg-indigo-600 text-white" )}>
                            <p className="text-xs font-bold">{msg.senderName}</p>
                            <p className="text-sm break-words">{msg.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2 mt-2">
                <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Sua mensagem..." disabled={isSending} />
                <Button type="submit" disabled={isSending || !newMessage.trim()} size="icon">{isSending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send size={16}/>}</Button>
            </form>
        </div>
    );
};

const NegotiationMatchCard: React.FC<{ match: PotentialMatch }> = ({ match }) => {
    const matchDate = match.matchedDate instanceof Timestamp ? match.matchedDate.toDate().toLocaleDateString('pt-BR') : 'Data inválida';
    return (
        <Card className="border-l-4 border-yellow-500">
            <CardHeader>
                <CardTitle>Proposta para Dr(a). {match.doctorName}</CardTitle>
                <CardDescription>{match.shiftRequirementSpecialties.join(", ")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                 <div className="pt-3 border-t mt-3">
                    <p className="font-semibold text-red-600">Sua Oferta: {formatCurrency(match.offeredRateByHospital)}/h</p>
                    <p className="text-xs text-gray-500 mt-1">O administrador está a mediar esta proposta. Aguarde o contato no chat abaixo para negociar.</p>
                </div>
            </CardContent>
            <Accordion type="single" collapsible className="w-full px-6 pb-4">
                <AccordionItem value="chat">
                    <AccordionTrigger>Conversar com Admin</AccordionTrigger>
                    <AccordionContent className="pt-4">
                        <NegotiationChat matchId={match.id} target="hospital" />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    );
};

const ContractItem: React.FC<{ contract: Contract, onSignClick: () => void }> = ({ contract, onSignClick }) => {
    const shiftDate = contract.shiftDates[0]?.toDate()?.toLocaleDateString('pt-BR') || 'Data inválida';
    const getStatusBadgeStyle = (status?: Contract['status']): { variant: BadgeProps["variant"], className: string } => {
        switch (status) {
            case 'PENDING_HOSPITAL_SIGNATURE': return { variant: 'secondary', className: 'bg-sky-100 text-sky-800 border-sky-300' };
            case 'ACTIVE_SIGNED': return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-300' };
            default: return { variant: 'outline', className: 'bg-gray-100 text-gray-800 border-gray-300' };
        }
    };
    const statusBadgeInfo = getStatusBadgeStyle(contract.status);

    return (
        <Card className="border-l-4 border-indigo-500 bg-white shadow-sm">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
                        <UserCheck size={20} className="text-indigo-600"/> Contrato com Dr(a). {contract.doctorName || 'N/A'}
                    </CardTitle>
                    <Badge variant={statusBadgeInfo.variant} className={cn("capitalize text-xs", statusBadgeInfo.className)}>
                        {contract.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                </div>
                <CardDescription className="flex items-center gap-2 pt-1">
                    <Briefcase size={14} /> Especialidades: {contract.specialties.join(', ')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-700">
                <p><CalendarDays size={14} className="inline mr-2"/><strong>Data:</strong> {shiftDate}</p>
                <p><Clock size={14} className="inline mr-2"/><strong>Horário:</strong> {contract.startTime} - {contract.endTime}</p>
                <p className="font-semibold text-red-700"><DollarSign size={14} className="inline mr-2"/><strong>Seu Custo:</strong> {formatCurrency(contract.hospitalRate)}/h</p>
            </CardContent>
            {contract.status === 'PENDING_HOSPITAL_SIGNATURE' && (
              <CardFooter className="flex justify-end bg-gray-50 p-3">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={onSignClick}>
                      <Edit className="mr-2 h-4 w-4" /> Rever e Assinar Contrato
                  </Button>
              </CardFooter>
            )}
        </Card>
    );
}

export default function HospitalContractsPage() {
    const [activeTab, setActiveTab] = useState("negotiation");
    const [negotiationMatches, setNegotiationMatches] = useState<PotentialMatch[]>([]);
    const [pendingContracts, setPendingContracts] = useState<Contract[]>([]);
    const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [isSigning, setIsSigning] = useState(false);
    const { toast } = useToast();

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [negotiationData, pendingData, activeData] = await Promise.all([
                getMatchesForHospitalInNegotiation(),
                getContractsForHospital(['PENDING_HOSPITAL_SIGNATURE']),
                getContractsForHospital(['ACTIVE_SIGNED', 'COMPLETED'])
            ]);
            setNegotiationMatches(negotiationData);
            setPendingContracts(pendingData);
            setActiveContracts(activeData);
        } catch (err: any) { setError(err.message); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const handleOpenModal = (contract: Contract) => setSelectedContract(contract);
    const handleConfirmSignature = async () => {
        if (!selectedContract) return;
        setIsSigning(true);
        try {
            await signContractByHospital(selectedContract.id);
            toast({ title: "Contrato Assinado!", description: `O(A) Dr(a). ${selectedContract.doctorName} foi adicionado(a) à sua equipe.`});
            setSelectedContract(null);
            await fetchAllData();
            setActiveTab('active');
        } catch (error: any) {
            toast({ title: "Erro ao assinar", description: error.message, variant: "destructive" });
        } finally {
            setIsSigning(false);
        }
    };
    
    const renderNegotiations = (matches: PotentialMatch[]) => {
        if (isLoading) return <LoadingState />;
        if (error) return <ErrorState message={error || ""} onRetry={fetchAllData} />;
        if (matches.length === 0) return <EmptyState message="Nenhuma proposta em negociação." />;
        return (<div className="space-y-4">{matches.map(m => <NegotiationMatchCard key={m.id} match={m} />)}</div>);
    };

    const renderContracts = (contracts: Contract[]) => {
        if (isLoading) return <LoadingState />;
        if (error) return <ErrorState message={error || ""} onRetry={fetchAllData} />;
        if (contracts.length === 0) return <EmptyState message="Nenhum contrato nesta categoria." />;
        return (<div className="space-y-4">{contracts.map(c => <ContractItem key={c.id} contract={c} onSignClick={() => handleOpenModal(c)}/>)}</div>);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Propostas e Contratos</h1>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="negotiation">Em Negociação <Badge variant="destructive" className="ml-2">{isLoading ? '...' : negotiationMatches.length}</Badge></TabsTrigger>
                    <TabsTrigger value="pending">Assinatura Pendente <Badge variant="secondary" className="ml-2">{isLoading ? '...' : pendingContracts.length}</Badge></TabsTrigger>
                    <TabsTrigger value="active">Contratos Ativos <Badge variant="secondary" className="ml-2">{isLoading ? '...' : activeContracts.length}</Badge></TabsTrigger>
                </TabsList>
                <TabsContent value="negotiation" className="mt-4">{renderNegotiations(negotiationMatches)}</TabsContent>
                <TabsContent value="pending" className="mt-4">{renderContracts(pendingContracts)}</TabsContent>
                <TabsContent value="active" className="mt-4">{renderContracts(activeContracts)}</TabsContent>
            </Tabs>

            <AlertDialog open={!!selectedContract} onOpenChange={(isOpen) => { if (!isOpen) setSelectedContract(null); }}>
                {selectedContract && (
                    <AlertDialogContent className="max-w-4xl h-[90vh] flex flex-col">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Revisão e Assinatura do Contrato</AlertDialogTitle>
                            <AlertDialogDescription>
                                Reveja o documento oficial do contrato. A sua assinatura será registada ao clicar em "Confirmar Assinatura".
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex-grow my-4 border rounded-md overflow-hidden bg-gray-200">
                            {selectedContract.contractPdfUrl ? 
                              <iframe src={selectedContract.contractPdfUrl} className="w-full h-full" title="Contrato PDF"/> : 
                              <ErrorState message="URL do documento não encontrada."/>
                            }
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isSigning} onClick={() => setSelectedContract(null)}>Voltar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmSignature} disabled={isSigning || !selectedContract.contractPdfUrl} className="bg-indigo-600 hover:bg-indigo-700">
                                {isSigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Assinatura"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                )}
            </AlertDialog>
        </div>
    );
}