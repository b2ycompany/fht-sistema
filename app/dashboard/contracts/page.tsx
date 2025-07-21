// app/doctor/contracts/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getContractsForDoctor, signContractByDoctor, type Contract } from "@/lib/contract-service";
// ADICIONADO: Importações para a nova funcionalidade de negociação
import { getMatchesForDoctorInNegotiation, sendMessageInMatchChat, getMatchChatMessages, type PotentialMatch, type ChatMessage, type ChatTarget } from "@/lib/match-service";
import { Badge } from "@/components/ui/badge";
import { ContractCard } from "@/components/shared/ContractCard"; 
import { AlertTriangle, ClipboardList, Loader2, RotateCcw, MessageSquare, Send, CalendarDays, Clock, MapPinIcon, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";

// Componentes de estado (Loading, Empty, Error) - sem alteração
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><span className="text-sm text-gray-600 mt-2">{message}</span></div> ));
const EmptyState = React.memo(({ message }: { message: string }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{message}</p></div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="font-semibold text-red-700 mb-1 text-base">Oops!</p><p className="max-w-md text-red-600">{message || "Não foi possível carregar."}</p>{onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente</Button> )}</div> ));


// =======================================================================
// NOVO COMPONENTE: CHAT DE NEGOCIAÇÃO
// =======================================================================
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
                {messages.length === 0 && <p className="text-center text-xs text-gray-500 p-4">Nenhuma mensagem. Envie uma proposta ou aguarde o contato do admin.</p>}
                {messages.map(msg => (
                    <div key={msg.id} className={cn("flex flex-col w-full", msg.senderId === user?.uid ? "items-end" : "items-start")}>
                        <div className={cn( "p-2 rounded-lg max-w-[85%]", msg.senderRole === 'admin' ? "bg-blue-600 text-white" : "bg-green-600 text-white" )}>
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


// =======================================================================
// NOVO COMPONENTE: CARD PARA MATCHES EM NEGOCIAÇÃO
// =======================================================================
const NegotiationMatchCard: React.FC<{ match: PotentialMatch }> = ({ match }) => {
    const matchDate = match.matchedDate instanceof Timestamp ? match.matchedDate.toDate().toLocaleDateString('pt-BR') : 'Data inválida';
    const location = `${match.shiftCities?.join(', ') || 'N/A'}, ${match.shiftState || 'N/A'}`;
    const needsNegotiation = match.doctorDesiredRate > match.offeredRateByHospital;

    return (
        <Card className={cn("border-l-4", needsNegotiation ? "border-red-500" : "border-yellow-500")}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle>Proposta de {match.hospitalName}</CardTitle>
                    <Badge variant="secondary">Em Negociação</Badge>
                </div>
                <CardDescription>{match.shiftRequirementSpecialties.join(", ")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2"><CalendarDays size={14}/> <strong>Data:</strong> {matchDate}</div>
                <div className="flex items-center gap-2"><Clock size={14}/> <strong>Horário:</strong> {match.shiftRequirementStartTime} - {match.shiftRequirementEndTime}</div>
                <div className="flex items-center gap-2"><MapPinIcon size={14}/> <strong>Local:</strong> {location}</div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <p className="font-semibold text-red-600">Oferta do Hospital: <br/>{formatCurrency(match.offeredRateByHospital)}/h</p>
                    <p className="font-semibold text-green-600">Seu Valor Desejado: <br/>{formatCurrency(match.doctorDesiredRate)}/h</p>
                </div>
            </CardContent>
            <Accordion type="single" collapsible className="w-full px-6">
                <AccordionItem value="chat">
                    <AccordionTrigger>Conversar com Admin</AccordionTrigger>
                    <AccordionContent className="pt-4">
                        <NegotiationChat matchId={match.id} target="doctor" />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    );
};


export default function DoctorContractsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("negotiation");
  // ADICIONADO: Estado para os matches em negociação
  const [negotiationMatches, setNegotiationMatches] = useState<PotentialMatch[]>([]);
  const [pendingDoctor, setPendingDoctor] = useState<Contract[]>([]);
  const [pendingHospital, setPendingHospital] = useState<Contract[]>([]);
  const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nmData, pdData, phData, acData] = await Promise.all([
        // ADICIONADO: Busca pelos matches em negociação
        getMatchesForDoctorInNegotiation(),
        getContractsForDoctor(['PENDING_DOCTOR_SIGNATURE']),
        getContractsForDoctor(['PENDING_HOSPITAL_SIGNATURE']),
        getContractsForDoctor(['ACTIVE_SIGNED', 'COMPLETED', 'CANCELLED'])
      ]);
      setNegotiationMatches(nmData);
      setPendingDoctor(pdData);
      setPendingHospital(phData);
      setActiveContracts(acData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const handleSignContract = async (contractId: string) => {
    try {
      await signContractByDoctor(contractId);
      toast({ title: "Contrato Assinado!", description: "Enviado ao hospital para assinatura final." });
      fetchAllData();
      setActiveTab('pending_hospital');
    } catch (err: any) {
      toast({ title: "Erro ao Assinar", description: err.message, variant: "destructive" });
    }
  };
  
  const renderContracts = (contracts: Contract[]) => {
    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message={error || ""} onRetry={fetchAllData} />;
    if (contracts.length === 0) return <EmptyState message="Nenhum contrato nesta categoria." />;
    return (<div className="space-y-4">{contracts.map(c => <ContractCard key={c.id} contract={c} onSign={handleSignContract} userType="doctor" />)}</div>);
  };

  const renderNegotiations = (matches: PotentialMatch[]) => {
    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message={error || ""} onRetry={fetchAllData} />;
    if (matches.length === 0) return <EmptyState message="Nenhuma proposta em negociação no momento." />;
    return (<div className="space-y-4">{matches.map(m => <NegotiationMatchCard key={m.id} match={m} />)}</div>);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Minhas Propostas e Contratos</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {/* ADICIONADO: Nova aba de negociação */}
          <TabsTrigger value="negotiation">Em Negociação <Badge variant="destructive" className="ml-2">{negotiationMatches.length}</Badge></TabsTrigger>
          <TabsTrigger value="pending_doctor">Minha Assinatura <Badge variant="secondary" className="ml-2">{pendingDoctor.length}</Badge></TabsTrigger>
          <TabsTrigger value="pending_hospital">Aguardando Hospital <Badge className="ml-2">{pendingHospital.length}</Badge></TabsTrigger>
          <TabsTrigger value="active">Histórico <Badge className="ml-2">{activeContracts.length}</Badge></TabsTrigger>
        </TabsList>
        <div className="mt-4">
          {/* ADICIONADO: Conteúdo da nova aba */}
          <TabsContent value="negotiation">{renderNegotiations(negotiationMatches)}</TabsContent>
          <TabsContent value="pending_doctor">{renderContracts(pendingDoctor)}</TabsContent>
          <TabsContent value="pending_hospital">{renderContracts(pendingHospital)}</TabsContent>
          <TabsContent value="active">{renderContracts(activeContracts)}</TabsContent>
        </div>
      </Tabs>
    </div>
  );
}