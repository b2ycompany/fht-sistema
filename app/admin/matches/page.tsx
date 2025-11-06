// app/admin/matches/page.tsx (Código Completo e Corrigido)
"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronDown, MoreHorizontal, ArrowUpDown, FileText, DollarSign, TrendingUp, CheckCircle, Clock, XCircle, Loader2, RotateCcw, ClipboardList, Users, Briefcase, CalendarDays, MapPinIcon, Info, Building, User, ShieldCheck,
    MessageSquare, Send, AlertTriangle, Star, ExternalLink
} from 'lucide-react';
import { Timestamp, query, collection, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Serviços e Tipos
import { approveMatchAndCreateContract, rejectMatchByBackoffice, type PotentialMatch, sendMessageInMatchChat, getMatchChatMessages, type ChatMessage, type ChatTarget } from "@/lib/match-service";
import { updateUserVerificationStatus, type UserProfile, type ProfileStatus } from "@/lib/auth-service";
import { type Contract } from "@/lib/contract-service";


// --- Componentes de estado (Loading, Empty) ---
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ title, message }: { title: string, message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{message}</p></div> ));

// --- UserVerificationCard CORRIGIDO ---
const UserVerificationCard: React.FC<{ user: UserProfile; onAction: (userId: string, status: ProfileStatus, notes: string, reasons?: Record<string, string>) => Promise<void>; }> = ({ user, onAction }) => {
    const [generalNotes, setGeneralNotes] = useState(user.adminVerificationNotes || "");
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionState, setRejectionState] = useState<Record<string, { selected: boolean; reason: string }>>({});

    const DOC_LABELS: Record<string, string> = { 
        personalRg: "RG Pessoal", personalCpf: "CPF Pessoal", professionalCrm: "CRM", photo3x4: "Foto 3x4", addressProof: "Comprov. Endereço", graduationCertificate: "Cert. Graduação", criminalRecordCert: "Cert. Neg. Criminal", ethicalCert: "Cert. Neg. Ética", debtCert: "Cert. Neg. Débitos CRM", cv: "Currículo Vitae", rqe: "RQE", postGradCert: "Cert. Pós/Residência", specialistTitle: "Título Especialista", recommendationLetter: "Carta Recomendação", 
        socialContract: "Contrato Social", cnpjCard: "Cartão CNPJ", companyAddressProof: "Comprovante Endereço Empresa", 
        repRg: "RG do Responsável", repCpf: "CPF do Responsável", repAddressProof: "Comprovante Endereço Responsável" 
    };

    const handleCheckboxChange = (docKey: string, checked: boolean) => { setRejectionState(prev => ({ ...prev, [docKey]: { ...prev[docKey], selected: checked } })); };
    const handleReasonChange = (docKey: string, reason: string) => { setRejectionState(prev => ({ ...prev, [docKey]: { ...prev[docKey], reason: reason } })); };
    
    const handleAction = async (status: ProfileStatus) => {
        setIsProcessing(true);
        let reasonsToSubmit: Record<string, string> = {};
        if (status === 'REJECTED_NEEDS_RESUBMISSION') {
            Object.entries(rejectionState).forEach(([key, value]) => { if (value.selected && value.reason?.trim()) { reasonsToSubmit[key] = value.reason.trim(); } });
            if (Object.keys(reasonsToSubmit).length === 0) {
                alert("Para solicitar correções, selecione pelo menos um documento e escreva o motivo.");
                setIsProcessing(false);
                return;
            }
        }
        try { 
            await onAction(user.uid, status, generalNotes, reasonsToSubmit); 
        } finally { 
            setIsProcessing(false); 
        }
    };

    const DocumentReviewRow = ({ docKey, url }: { docKey: string, url?: string }) => {
        if (!url) return null;
        const isSelected = rejectionState[docKey]?.selected;
        return (
            <div className="space-y-2 p-2 bg-slate-50 rounded-md border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Checkbox id={docKey} checked={isSelected} onCheckedChange={(checked: boolean) => handleCheckboxChange(docKey, checked)} />
                        <Label htmlFor={docKey} className="text-sm font-normal">{DOC_LABELS[docKey] || docKey}</Label>
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium text-xs flex items-center gap-1">
                        Ver Documento <ExternalLink size={12} />
                    </a>
                </div>
                {isSelected && (
                    <Textarea 
                        placeholder={`Motivo da correção para ${DOC_LABELS[docKey] || docKey}...`}
                        value={rejectionState[docKey]?.reason || ''}
                        onChange={(e) => handleReasonChange(docKey, e.target.value)}
                        className="h-20 mt-2"
                    />
                )}
            </div>
        );
    };

    const isHospital = user.userType === 'hospital';
    
    // <<< CORREÇÃO: Lê o status correto para exibir o Badge >>>
    const currentStatus = (user as any).documentVerificationStatus || user.status; 

    return (
      <Card className={cn("border-l-4", 
        currentStatus === 'PENDING_REVIEW' && "border-yellow-500",
        currentStatus === 'REJECTED_NEEDS_RESUBMISSION' && "border-red-500"
      )}>
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="flex items-center gap-2">{isHospital ? <Building size={20}/> : <User size={20}/>} {user.displayName}</CardTitle>
                    <CardDescription>{isHospital ? 'Hospital/Empresa' : 'Médico(a)'} - {user.email}</CardDescription>
                </div>
                {/* <<< CORREÇÃO: Badge dinâmico baseado no status >>> */}
                <Badge variant="outline" className={cn(
                    currentStatus === 'PENDING_REVIEW' && "text-yellow-700 border-yellow-500",
                    currentStatus === 'REJECTED_NEEDS_RESUBMISSION' && "text-red-700 border-red-500"
                )}>
                    {currentStatus === 'REJECTED_NEEDS_RESUBMISSION' ? 'Correção Pendente' : 'Pendente de Revisão'}
                </Badge>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="documents">
                    <AccordionTrigger className="text-base font-semibold">Visualizar e Selecionar Documentos para Correção</AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                        {isHospital && ( // Se for hospital, agora o TypeScript entende que user é HospitalProfile
                            <>
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm text-gray-800">Documentos da Empresa</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {Object.entries(user.hospitalDocs || {}).map(([key, url]) => (
                                            <DocumentReviewRow key={key} docKey={key} url={url as string} />
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm text-gray-800">Documentos do Responsável Legal</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {Object.entries(user.legalRepDocuments || {}).map(([key, url]) => (
                                            <DocumentReviewRow key={key} docKey={key} url={url as string} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                         {user.userType === 'doctor' && ( // Se for médico, o TypeScript entende que user é DoctorProfile
                             <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Documentos do Médico</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {Object.entries({ ...(user.documents || {}), ...(user.specialistDocuments || {}) }).map(([key, url]) => (
                                        <DocumentReviewRow key={key} docKey={key} url={url as string} />
                                    ))}
                                </div>
                            </div>
                         )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            
            <div>
                <Label htmlFor={`notes-${user.uid}`}>Observações Gerais</Label>
                <Textarea id={`notes-${user.uid}`} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} disabled={isProcessing} placeholder="Adicione observações gerais sobre a aprovação ou motivo da rejeição..." />
            </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
            <Button variant="destructive" onClick={() => handleAction('REJECTED_NEEDS_RESUBMISSION')} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin"/> : <XCircle/>}
                Pedir Correção
            </Button>
            <Button onClick={() => handleAction('APPROVED')} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin"/> : <CheckCircle/>}
                Aprovar Cadastro
            </Button>
        </CardFooter>
      </Card>
    );
};


// --- NegotiationChat (sem alterações) ---
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
        } catch (error) {
            console.error(`Erro ao enviar mensagem para ${target}:`, error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div>
            <div className="border bg-slate-50 rounded-lg p-2 h-56 overflow-y-auto flex flex-col gap-2">
                {messages.length === 0 && <p className="text-center text-xs text-gray-500 p-4">Nenhuma mensagem neste canal.</p>}
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


// --- MatchReviewCard (sem alterações) ---
const MatchReviewCard: React.FC<{ match: PotentialMatch; onApproveMatch: (matchId: string, doctorRate: number, hospitalRate: number, margin: number, notes?: string) => Promise<void>; onRejectMatch: (matchId: string, notes: string) => Promise<void>; }> = ({ match, onApproveMatch, onRejectMatch }) => {
    const [notes, setNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [negotiatedDoctorRate, setNegotiatedDoctorRate] = useState(String(match.doctorDesiredRate));
    const [negotiatedHospitalRate, setNegotiatedHospitalRate] = useState(String(match.offeredRateByHospital));
    
    const handleApprove = async () => {
        setIsProcessing(true);
        try {
            const finalDoctorRate = parseFloat(negotiatedDoctorRate);
            const finalHospitalRate = parseFloat(negotiatedHospitalRate);
            await onApproveMatch(match.id, finalDoctorRate, finalHospitalRate, 10, notes);
        } finally {
            setIsProcessing(false);
        }
    };
    const handleReject = async () => { if (!notes.trim()) { alert("Para rejeitar, preencha as observações como motivo."); return; } setIsProcessing(true); try { await onRejectMatch(match.id, notes); } finally { setIsProcessing(false); } };
    
    const matchDate = match.matchedDate instanceof Timestamp ? match.matchedDate.toDate().toLocaleDateString('pt-BR') : 'Data inválida';
    const location = `${match.shiftCities?.join(', ') || 'Cidade?'}, ${match.shiftState || 'Estado?'}`;
    const needsNegotiation = match.doctorDesiredRate > match.offeredRateByHospital;
    
    const getScoreVariantClass = (score: number): string => {
        if (score >= 10) return "border-green-500";
        if (score >= 6) return "border-blue-500";
        return "border-gray-300";
    };

    const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
        if (score >= 10) return "default";
        if (score >= 6) return "secondary";
        return "destructive";
    }

    const cardBorderColor = needsNegotiation ? "border-red-500" : getScoreVariantClass(match.matchScore ?? 0);

    return (
      <Card className={cn("border-l-4 transition-all duration-300", cardBorderColor)}>
        <CardHeader>
            <div className="flex justify-between items-start flex-wrap gap-y-2">
              <div>
                <CardTitle className="text-lg">Match: {match.shiftRequirementSpecialties.join(", ")}</CardTitle>
                <CardDescription>{match.hospitalName} &harr; {match.doctorName}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getScoreBadgeVariant(match.matchScore ?? 0)} className="flex items-center gap-1.5 text-sm py-1 px-3">
                    <Star size={14} />
                    <span>Score: {match.matchScore ?? 0}</span>
                </Badge>
                {needsNegotiation && (<Badge variant="destructive" className="flex items-center gap-1.5"><AlertTriangle size={14}/>Negociação Recomendada</Badge>)}
              </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2 p-3 bg-gray-50 rounded-md"><h4 className="font-bold">Demanda do Hospital</h4><p>Local: {location}</p><p>Data: {matchDate}</p><p>Oferecido: <strong>{formatCurrency(match.offeredRateByHospital)}/h</strong></p></div>
                <div className="space-y-2 p-3 bg-gray-50 rounded-md"><h4 className="font-bold">Disponibilidade do Médico</h4><p>Local: {location}</p><p>Data: {matchDate}</p><p>Desejado: <strong>{formatCurrency(match.doctorDesiredRate)}/h</strong></p></div>
            </div>
        </CardContent>

        <Accordion type="single" collapsible className="w-full px-6">
            <AccordionItem value="negotiation-tools">
                <AccordionTrigger>Abrir Ferramentas de Gestão e Chat</AccordionTrigger>
                <AccordionContent className="pt-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Valor Final / Hora (Hospital)</Label>
                            <Input type="number" value={negotiatedHospitalRate} onChange={e => setNegotiatedHospitalRate(e.target.value)} />
                        </div>
                        <div>
                            <Label>Valor Final / Hora (Médico)</Label>
                            <Input type="number" value={negotiatedDoctorRate} onChange={e => setNegotiatedDoctorRate(e.target.value)} />
                        </div>
                    </div>
                    <div><Label>Observações / Motivo da Rejeição</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                    <div className="border-t mt-4 pt-4">
                        <h4 className="font-semibold mb-2 text-sm">Canais de Negociação</h4>
                        <Tabs defaultValue="doctor">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="doctor">Chat com Médico</TabsTrigger>
                                <TabsTrigger value="hospital">Chat com Hospital</TabsTrigger>
                            </TabsList>
                            <TabsContent value="doctor" className="mt-2"><NegotiationChat matchId={match.id} target="doctor" /></TabsContent>
                            <TabsContent value="hospital" className="mt-2"><NegotiationChat matchId={match.id} target="hospital" /></TabsContent>
                        </Tabs>
                    </div>
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


// --- Componente Principal da Página (AdminUnifiedPage) ---
export default function AdminUnifiedPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("verification");
    const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
    const [matches, setMatches] = useState<PotentialMatch[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isLoadingMatches, setIsLoadingMatches] = useState(true);
    const [isLoadingContracts, setIsLoadingContracts] = useState(true);

    useEffect(() => {
        // ============================================================================
        // 🔹 CORREÇÃO DE FLUXO (Query) 🔹
        // Agora procura por AMBOS os status pendentes.
        // ============================================================================
        const unsubUsers = onSnapshot(query(
            collection(db, "users"), 
            where("documentVerificationStatus", "in", ["PENDING_REVIEW", "REJECTED_NEEDS_RESUBMISSION"])
        ), (snapshot) => { 
            setPendingUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))); 
            setIsLoadingUsers(false); 
        }, (error) => {
            console.error("Erro ao buscar usuários pendentes (verifique o índice do Firestore):", error);
            toast({
                title: "Erro de Consulta de Usuários",
                description: "Pode ser necessário criar um índice para 'documentVerificationStatus'. Verifique o console.",
                variant: "destructive",
                duration: 10000,
            });
            setIsLoadingUsers(false);
        });
        
        const matchesQuery = query(
            collection(db, "potentialMatches"), 
            where("status", "==", "PENDING_BACKOFFICE_REVIEW"), 
            orderBy("matchScore", "desc"),
            orderBy("createdAt", "desc")
        );
        const unsubMatches = onSnapshot(matchesQuery, (snapshot) => { 
            setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PotentialMatch))); 
            setIsLoadingMatches(false); 
        }, (error) => {
            console.error("Erro ao buscar matches (verifique o índice do Firestore):", error);
            toast({
                title: "Erro de Consulta de Matches",
                description: "Falha ao buscar matches. Pode ser necessário criar um índice no Firestore. Verifique o console para o link.",
                variant: "destructive",
                duration: 10000,
            });
            setIsLoadingMatches(false);
        });

        const unsubContracts = onSnapshot(query(collection(db, "contracts"), orderBy("createdAt", "desc")), (snapshot) => { setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract))); setIsLoadingContracts(false); });
        
        return () => { unsubUsers(); unsubMatches(); unsubContracts(); };
    }, [toast]);

    const handleUserVerification = async (userId: string, status: ProfileStatus, notes: string, reasons?: Record<string, string>) => { try { await updateUserVerificationStatus(userId, status, notes, reasons); toast({ title: "Cadastro Atualizado!" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};
    const handleApproveMatch = async (matchId: string, doctorRate: number, hospitalRate: number, platformMargin: number, notes?: string) => {
        try {
            await approveMatchAndCreateContract(matchId, doctorRate, hospitalRate, platformMargin, notes);
            toast({ title: "Match Aprovado!", description: "Contrato enviado ao médico." });
        } catch (e: any) {
            toast({ title: "Erro ao Aprovar Match", description: e.message, variant: "destructive" });
        }
    };
    const handleRejectMatch = async (matchId: string, adminNotes: string) => { try { await rejectMatchByBackoffice(matchId, adminNotes); toast({ title: "Match Rejeitado" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};
    
    const isLoadingAnything = isLoadingUsers || isLoadingMatches || isLoadingContracts;

    return (
      <div className="space-y-6 p-4 md:p-6">
          <div className="flex items-center justify-between"><h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2"><ShieldCheck size={28}/> Painel de Controlo</h1><Button variant="outline" size="sm" disabled><RotateCcw className={cn("mr-2 h-4 w-4", isLoadingAnything && "animate-spin")}/>Sincronizado</Button></div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="verification">Verificações<Badge variant={pendingUsers.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoadingUsers ? "..." : pendingUsers.length}</Badge></TabsTrigger>
                <TabsTrigger value="matches">Revisão de Matches<Badge variant={matches.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoadingMatches ? "..." : matches.length}</Badge></TabsTrigger>
                <TabsTrigger value="contracts">Gestão de Contratos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="verification" className="mt-4">
                <Card><CardHeader><CardTitle>Cadastros Pendentes</CardTitle><CardDescription>Aprove ou solicite correções nos cadastros abaixo.</CardDescription></CardHeader><CardContent className="pt-4">{isLoadingUsers ? <LoadingState /> : pendingUsers.length === 0 ? <EmptyState title="Nenhum cadastro para verificar" message="Todos estão em dia." /> : <div className="space-y-4">{pendingUsers.map(user => <UserVerificationCard key={user.uid} user={user} onAction={handleUserVerification} />)}</div>}</CardContent></Card>
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
                <Card>
                    <CardHeader><CardTitle>Gestão de Contratos</CardTitle><CardDescription>Esta área mostrará o histórico de todos os contratos gerados.</CardDescription></CardHeader>
                    <CardContent><EmptyState title="A ser implementado" message="A funcionalidade de gestão de contratos estará disponível em breve." /></CardContent>
                </Card>
            </TabsContent>
          </Tabs>
      </div>
    );
}