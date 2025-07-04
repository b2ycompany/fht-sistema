// app/admin/matches/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    ColumnDef, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable
} from "@tanstack/react-table";
import {
    ChevronDown, MoreHorizontal, ArrowUpDown, FileText, DollarSign, TrendingUp, CheckCircle, Clock, XCircle, Loader2, RotateCcw, ClipboardList, Users, Briefcase, CalendarDays, MapPinIcon, Info, Building, User, ShieldCheck,
    // ADICIONADO: Ícones para o chat e negociação
    MessageSquare, Send, AlertTriangle
} from 'lucide-react';
import { Timestamp, query, collection, where, onSnapshot, orderBy, type Unsubscribe } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
// ADICIONADO: useAuth para o chat
import { useAuth } from '@/components/auth-provider';

// Componentes da UI
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// ADICIONADO: Componente Accordion para o chat expansível
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Serviços e Tipos
// ADICIONADO: Importações das novas funções de chat
import { approveMatchAndCreateContract, rejectMatchByBackoffice, type PotentialMatch, sendMessageInMatchChat, getMatchChatMessages, type ChatMessage } from "@/lib/match-service";
import { updateUserVerificationStatus, type UserProfile, type ProfileStatus } from "@/lib/auth-service";
import { type Contract } from "@/lib/contract-service";


const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ title, message }: { title: string, message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{message}</p></div> ));

const UserVerificationCard: React.FC<{ user: UserProfile; onAction: (userId: string, status: ProfileStatus, notes: string, reasons?: Record<string, string>) => Promise<void>; }> = ({ user, onAction }) => {
    const [generalNotes, setGeneralNotes] = useState(user.adminVerificationNotes || "");
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionState, setRejectionState] = useState<Record<string, { selected: boolean; reason: string }>>({});
    const DOC_LABELS: Record<string, string> = { personalRg: "RG Pessoal", personalCpf: "CPF Pessoal", professionalCrm: "CRM", photo3x4: "Foto 3x4", addressProof: "Comprov. Endereço", graduationCertificate: "Cert. Graduação", criminalRecordCert: "Cert. Neg. Criminal", ethicalCert: "Cert. Neg. Ética", debtCert: "Cert. Neg. Débitos CRM", cv: "Currículo Vitae", rqe: "RQE", postGradCert: "Cert. Pós/Residência", specialistTitle: "Título Especialista", recommendationLetter: "Carta Recomendação", socialContract: "Contrato Social", cnpjCard: "Cartão CNPJ", companyAddressProof: "Comprovante Endereço Empresa", repRg: "RG do Responsável", repCpf: "CPF do Responsável", repAddressProof: "Comprovante Endereço Responsável" };
    const allDocuments = user.role === 'doctor' ? { ...(user.documents || {}), ...(user.specialistDocuments || {}) } : user.role === 'hospital' ? { ...(user.hospitalDocs || {}), ...(user.legalRepDocuments || {}) } : {};
    const handleCheckboxChange = (docKey: string, checked: boolean) => { setRejectionState(prev => ({ ...prev, [docKey]: { ...prev[docKey], selected: checked } })); };
    const handleReasonChange = (docKey: string, reason: string) => { setRejectionState(prev => ({ ...prev, [docKey]: { ...prev[docKey], reason: reason } })); };
    const handleAction = async (status: ProfileStatus) => {
        setIsProcessing(true);
        let reasonsToSubmit: Record<string, string> = {};
        if (status === 'REJECTED_NEEDS_RESUBMISSION') {
            Object.entries(rejectionState).forEach(([key, value]) => { if (value.selected && value.reason?.trim()) { reasonsToSubmit[key] = value.reason.trim(); } });
            if (Object.keys(reasonsToSubmit).length === 0) { alert("Para solicitar correções, selecione pelo menos um documento e escreva o motivo."); setIsProcessing(false); return; }
        }
        try { await onAction(user.uid, status, generalNotes, reasonsToSubmit); } finally { setIsProcessing(false); }
    };
    return (
      <Card className="border-l-4 border-yellow-500"><CardHeader><div className="flex justify-between items-start"><div><CardTitle className="flex items-center gap-2">{user.role === 'doctor' ? <User size={20}/> : <Building size={20}/>} {user.displayName}</CardTitle><CardDescription>{user.role === 'doctor' ? 'Médico(a)' : 'Hospital'} - {user.email}</CardDescription></div><Badge variant="outline">Pendente de Revisão</Badge></div></CardHeader><CardContent className="space-y-6"><div><h4 className="font-semibold text-sm mb-2">Selecione os docs para correções</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">{Object.entries(allDocuments).map(([key, url]) => {if (!url) return null;const isSelected = rejectionState[key]?.selected;return (<div key={key} className="space-y-2"><div className="flex items-center space-x-2"><Checkbox id={key} checked={isSelected} onCheckedChange={(checked: boolean) => handleCheckboxChange(key, checked)} /><a href={url as string} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-2">{DOC_LABELS[key] || key}</a></div>{isSelected && ( <Textarea placeholder={`Motivo...`} value={rejectionState[key]?.reason || ''} onChange={(e) => handleReasonChange(key, e.target.value)} className="h-20"/> )}</div>)})}</div></div><div><Label htmlFor={`notes-${user.uid}`}>Observações Gerais</Label><Textarea id={`notes-${user.uid}`} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} disabled={isProcessing}/></div></CardContent><CardFooter className="flex justify-end gap-3"><Button variant="destructive" onClick={() => handleAction('REJECTED_NEEDS_RESUBMISSION')} disabled={isProcessing}>{isProcessing?<Loader2 className="animate-spin"/>:<XCircle/>}Pedir Correção</Button><Button onClick={() => handleAction('APPROVED')} disabled={isProcessing}>{isProcessing?<Loader2 className="animate-spin"/>:<CheckCircle/>}Aprovar Cadastro</Button></CardFooter></Card>
    );
};

// =================================================================================================
// NOVO COMPONENTE DE CHAT
// =================================================================================================
const NegotiationChat: React.FC<{ matchId: string }> = ({ matchId }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const chatEndRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!matchId) return;
        const unsubscribe = getMatchChatMessages(matchId, setMessages);
        return () => unsubscribe();
    }, [matchId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;
        setIsSending(true);
        try {
            await sendMessageInMatchChat(matchId, newMessage);
            setNewMessage("");
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="border-t mt-4 pt-4">
            <h4 className="font-semibold mb-2 text-sm flex items-center gap-2"><MessageSquare size={16} /> Chat de Negociação</h4>
            <div className="border bg-slate-50 rounded-lg p-2 h-56 overflow-y-auto flex flex-col gap-2">
                {messages.length === 0 && <p className="text-center text-xs text-gray-500 p-4">Nenhuma mensagem ainda. Inicie a conversa.</p>}
                {messages.map(msg => (
                    <div key={msg.id} className={cn("flex flex-col w-full", msg.senderId === user?.uid ? "items-end" : "items-start")}>
                        <div className={cn( "p-2 rounded-lg max-w-[85%]", msg.senderRole === 'admin' ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800" )}>
                            <p className="text-xs font-bold">{msg.senderName} ({msg.senderRole})</p>
                            <p className="text-sm break-words">{msg.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2 mt-2">
                <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Digite sua mensagem..." disabled={isSending} />
                <Button type="submit" disabled={isSending || !newMessage.trim()} size="icon">{isSending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send size={16}/>}</Button>
            </form>
        </div>
    );
};


// CARD DE MATCH ATUALIZADO COM CHAT E INDICADOR VISUAL
const MatchReviewCard: React.FC<{ match: PotentialMatch; onApproveMatch: (matchId: string, negotiatedRate: number, platformMargin: number, notes?: string) => Promise<void>; onRejectMatch: (matchId: string, notes: string) => Promise<void>; }> = ({ match, onApproveMatch, onRejectMatch }) => {
    const [notes, setNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [negotiatedRate, setNegotiatedRate] = useState(match.doctorDesiredRate);
    
    useEffect(() => {
        if (match.offeredRateByHospital >= match.doctorDesiredRate) {
            setNegotiatedRate(match.doctorDesiredRate);
        } else {
            setNegotiatedRate(match.doctorDesiredRate);
        }
    }, [match.offeredRateByHospital, match.doctorDesiredRate]);

    const handleApprove = async () => { setIsProcessing(true); try { await onApproveMatch(match.id, negotiatedRate, 10, notes); } finally { setIsProcessing(false); } };
    const handleReject = async () => { if (!notes.trim()) { alert("Para rejeitar, é obrigatório preencher o motivo."); return; } setIsProcessing(true); try { await onRejectMatch(match.id, notes); } finally { setIsProcessing(false); } };
    
    const matchDate = match.matchedDate instanceof Timestamp ? match.matchedDate.toDate().toLocaleDateString('pt-BR') : 'Data inválida';
    const location = `${(match as any).shiftCity || match.shiftCities?.join(', ') || 'Cidade?'}, ${(match as any).shiftState || 'Estado?'}`;
    const needsNegotiation = match.doctorDesiredRate > match.offeredRateByHospital;

    return (
      <Card className={cn("border-l-4", needsNegotiation ? "border-red-500" : "border-blue-500")}>
        <CardHeader>
            <div className="flex justify-between items-start flex-wrap gap-y-2">
                <div>
                    <CardTitle className="text-lg">Match: {match.shiftRequirementSpecialties.join(", ")}</CardTitle>
                    <CardDescription>{match.hospitalName} &harr; {match.doctorName}</CardDescription>
                </div>
                {needsNegotiation && (<Badge variant="destructive" className="flex items-center gap-1.5"><AlertTriangle size={14}/>Negociação Recomendada</Badge>)}
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2 p-3 bg-gray-50 rounded-md"><h4 className="font-bold">Demanda do Hospital</h4><p>Oferecido: <strong>{formatCurrency(match.offeredRateByHospital)}/h</strong></p></div>
                <div className="space-y-2 p-3 bg-gray-50 rounded-md"><h4 className="font-bold">Disponibilidade do Médico</h4><p>Desejado: <strong>{formatCurrency(match.doctorDesiredRate)}/h</strong></p></div>
            </div>
        </CardContent>

        <Accordion type="single" collapsible className="w-full px-6">
            <AccordionItem value="negotiation-tools">
                <AccordionTrigger>Abrir Ferramentas de Gestão e Chat</AccordionTrigger>
                <AccordionContent className="pt-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><Label>Valor/Hora a Propor ao Médico (R$)</Label><Input type="number" value={negotiatedRate} onChange={(e) => setNegotiatedRate(Number(e.target.value))} /></div>
                        <div><Label>Margem da Plataforma (%)</Label><Input type="number" defaultValue={10} disabled /></div>
                    </div>
                    <div><Label>Observações / Motivo da Rejeição</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para o médico ou motivo da rejeição..." /></div>
                    <NegotiationChat matchId={match.id} />
                </AccordionContent>
            </AccordionItem>
        </Accordion>

        <CardFooter className="flex justify-end items-center gap-3 pt-6">
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin"/> : <XCircle/>} Rejeitar Match</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin"/> : <CheckCircle/>} Aprovar Match</Button>
        </CardFooter>
      </Card>
    );
};

// COMPONENTE PRINCIPAL DA PÁGINA
export default function AdminUnifiedPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("matches");
    const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
    const [matches, setMatches] = useState<PotentialMatch[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isLoadingMatches, setIsLoadingMatches] = useState(true);
    const [isLoadingContracts, setIsLoadingContracts] = useState(true);

    useEffect(() => {
        const unsubUsers = onSnapshot(query(collection(db, "users"), where("documentVerificationStatus", "==", "PENDING_REVIEW")), (snapshot) => { setPendingUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))); setIsLoadingUsers(false); });
        const unsubMatches = onSnapshot(query(collection(db, "potentialMatches"), where("status", "==", "PENDING_BACKOFFICE_REVIEW"), orderBy("createdAt", "desc")), (snapshot) => { setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PotentialMatch))); setIsLoadingMatches(false); });
        const unsubContracts = onSnapshot(query(collection(db, "contracts"), orderBy("createdAt", "desc")), (snapshot) => { setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract))); setIsLoadingContracts(false); });
        return () => { unsubUsers(); unsubMatches(); unsubContracts(); };
    }, []);

    const handleUserVerification = async (userId: string, status: ProfileStatus, notes: string, reasons?: Record<string, string>) => { try { await updateUserVerificationStatus(userId, status, notes, reasons); toast({ title: "Cadastro Atualizado!" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};
    const handleApproveMatch = async (matchId: string, negotiatedRate: number, platformMargin: number, notes?: string) => { try { await approveMatchAndCreateContract(matchId, negotiatedRate, platformMargin, notes); toast({ title: "Match Aprovado!", description: "Contrato enviado ao médico." }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};
    const handleRejectMatch = async (matchId: string, adminNotes: string) => { try { await rejectMatchByBackoffice(matchId, adminNotes); toast({ title: "Match Rejeitado" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};
    
    const isLoadingAnything = isLoadingUsers || isLoadingMatches || isLoadingContracts;

    return (
      <div className="space-y-6">
          <div className="flex items-center justify-between"><h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2"><ShieldCheck size={28}/> Painel de Controlo</h1><Button variant="outline" size="sm" disabled><RotateCcw className={cn("mr-2 h-4 w-4", isLoadingAnything && "animate-spin")}/>Sincronizado</Button></div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="verification">Verificações<Badge variant="destructive" className="ml-2">{pendingUsers.length}</Badge></TabsTrigger>
                <TabsTrigger value="matches">Revisão de Matches<Badge variant="destructive" className="ml-2">{matches.length}</Badge></TabsTrigger>
                <TabsTrigger value="contracts">Gestão de Contratos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="verification" className="mt-4">
                <Card><CardHeader><CardTitle>Cadastros Pendentes</CardTitle><CardDescription>Aprove ou solicite correções nos cadastros de médicos e hospitais.</CardDescription></CardHeader><CardContent className="pt-4">{isLoadingUsers ? <LoadingState /> : pendingUsers.length === 0 ? <EmptyState title="Nenhum cadastro para verificar" message="Todos estão em dia." /> : <div className="space-y-4">{pendingUsers.map(user => <UserVerificationCard key={user.uid} user={user} onAction={handleUserVerification} />)}</div>}</CardContent></Card>
            </TabsContent>

            <TabsContent value="matches" className="mt-4">
                <Card>
                    <CardHeader><CardTitle>Matches Pendentes para Revisão</CardTitle><CardDescription>Aprove, negocie ou rejeite as combinações pendentes.</CardDescription></CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        {isLoadingMatches ? <LoadingState /> : matches.length === 0 ? <EmptyState title="Nenhum match aguardando" message="Novas combinações aparecerão aqui."/> : 
                         matches.map(m => <MatchReviewCard key={m.id} match={m} onApproveMatch={handleApproveMatch} onRejectMatch={handleRejectMatch} />)}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="contracts" className="mt-4">
                <p>A gestão de contratos aparecerá aqui.</p>
            </TabsContent>
          </Tabs>
      </div>
    );
}