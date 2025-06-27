// app/admin/matches/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Timestamp, query, collection, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
    CheckCircle, XCircle, Eye, DollarSign, Loader2, RotateCcw, ClipboardList, Users, Briefcase, CalendarDays, Clock, MapPinIcon, Info,
    AlertTriangle as LucideAlertTriangle, ShieldCheck, Download, Building, User
} from 'lucide-react';
import { approveMatchAndProposeToDoctor, rejectMatchByBackoffice, type PotentialMatch } from "@/lib/match-service";
import { updateUserVerificationStatus, type UserProfile, type ProfileStatus } from "@/lib/auth-service";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const UserVerificationCard: React.FC<{ user: UserProfile; onAction: (userId: string, status: ProfileStatus, notes: string, reasons?: Record<string, string>) => Promise<void>; }> = ({ user, onAction }) => {
    const [generalNotes, setGeneralNotes] = useState(user.adminVerificationNotes || "");
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionState, setRejectionState] = useState<Record<string, { selected: boolean; reason: string }>>({});
    const DOC_LABELS: Record<string, string> = { personalRg: "RG Pessoal", personalCpf: "CPF Pessoal", professionalCrm: "CRM", photo3x4: "Foto 3x4", addressProof: "Comprov. Endereço", graduationCertificate: "Cert. Graduação", criminalRecordCert: "Cert. Neg. Criminal", ethicalCert: "Cert. Neg. Ética", debtCert: "Cert. Neg. Débitos CRM", cv: "Currículo Vitae", rqe: "RQE", postGradCert: "Cert. Pós/Residência", specialistTitle: "Título Especialista", recommendationLetter: "Carta Recomendação", socialContract: "Contrato Social", cnpjCard: "Cartão CNPJ", companyAddressProof: "Comprovante Endereço Empresa", repRg: "RG do Responsável", repCpf: "CPF do Responsável", repAddressProof: "Comprovante Endereço Responsável" };
    const allDocuments = user.role === 'doctor' ? { ...(user.documents || {}), ...(user.specialistDocuments || {}) } : user.role === 'hospital' ? { ...(user.hospitalDocs || {}), ...(user.legalRepDocuments || {}) } : {};

    const handleCheckboxChange = (docKey: string, checked: boolean) => {
        setRejectionState(prev => ({ ...prev, [docKey]: { ...prev[docKey], selected: checked } }));
    };

    const handleReasonChange = (docKey: string, reason: string) => {
        setRejectionState(prev => ({ ...prev, [docKey]: { ...prev[docKey], reason: reason } }));
    };

    const handleAction = async (status: ProfileStatus) => {
        setIsProcessing(true);
        let reasonsToSubmit: Record<string, string> = {};
        if (status === 'REJECTED_NEEDS_RESUBMISSION') {
            Object.entries(rejectionState).forEach(([key, value]) => {
                if (value.selected && value.reason?.trim()) { reasonsToSubmit[key] = value.reason.trim(); }
            });
            if (Object.keys(reasonsToSubmit).length === 0) {
                alert("Para solicitar correções, selecione pelo menos um documento e escreva o motivo.");
                setIsProcessing(false);
                return;
            }
        }
        try { await onAction(user.uid, status, generalNotes, reasonsToSubmit); } finally { setIsProcessing(false); }
    };
    
    return (
      <Card className="border-l-4 border-yellow-500">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div><CardTitle className="flex items-center gap-2">{user.role === 'doctor' ? <User size={20}/> : <Building size={20}/>} {user.displayName}</CardTitle><CardDescription>{user.role === 'doctor' ? 'Médico(a)' : 'Hospital'} - {user.email}</CardDescription></div>
            <Badge variant="outline">Pendente de Revisão</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold text-sm mb-2">Selecione os documentos para solicitar correções</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(allDocuments).map(([key, url]) => {
                if (!url) return null;
                const isSelected = rejectionState[key]?.selected;
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center space-x-2"><Checkbox id={key} checked={isSelected} onCheckedChange={(checked: boolean) => handleCheckboxChange(key, checked)} /><a href={url as string} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-2"><Download size={14} /><span>{DOC_LABELS[key] || key}</span></a></div>
                    {isSelected && ( <Textarea placeholder={`Motivo da rejeição para ${DOC_LABELS[key]}...`} value={rejectionState[key]?.reason || ''} onChange={(e) => handleReasonChange(key, e.target.value)} className="h-20"/> )}
                  </div>
                )
              })}
              {Object.keys(allDocuments).length === 0 && <p className="text-sm text-gray-500 col-span-full">Nenhum documento enviado.</p>}
            </div>
          </div>
          <div><label htmlFor={`notes-${user.uid}`} className="font-semibold text-sm mb-2 block">Observações Gerais (Opcional)</label><Textarea id={`notes-${user.uid}`} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Notas gerais sobre o cadastro..." disabled={isProcessing}/></div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3"><Button variant="destructive" onClick={() => handleAction('REJECTED_NEEDS_RESUBMISSION')} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}Pedir Correção</Button><Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction('APPROVED')} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}Aprovar Cadastro</Button></CardFooter>
      </Card>
    );
};

const MatchReviewCard: React.FC<{ match: PotentialMatch; onApproveMatch: (matchId: string, negotiatedRate: number, notes?: string) => Promise<void>; onRejectMatch: (matchId: string, notes: string) => Promise<void>; }> = ({ match, onApproveMatch, onRejectMatch }) => {
    const [notes, setNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [negotiatedRate, setNegotiatedRate] = useState(match.offeredRateByHospital);
    const handleApprove = async () => { setIsProcessing(true); try { await onApproveMatch(match.id, negotiatedRate, notes); } finally { setIsProcessing(false); } };
    const handleReject = async () => { if (!notes.trim()) { alert("Para rejeitar um match, é obrigatório preencher o motivo."); return; } setIsProcessing(true); try { await onRejectMatch(match.id, notes); } finally { setIsProcessing(false); } };
    const matchDate = match.matchedDate instanceof Timestamp ? match.matchedDate.toDate().toLocaleDateString('pt-BR') : 'Data inválida';
    const location = `${(match as any).shiftCity || 'Cidade?'}, ${(match as any).shiftState || 'Estado?'}`;
    const hospitalNotes = (match as any).shiftRequirementNotes;
    const doctorNotes = (match as any).doctorTimeSlotNotes;

    return (
      <Card className="border-l-4 border-blue-500">
        <CardHeader>
            <div className="flex justify-between items-start">
                <div><CardTitle className="text-lg">Match: {match.shiftRequirementSpecialties.join(", ")}</CardTitle><CardDescription>{match.hospitalName} &harr; {match.doctorName}</CardDescription></div>
                <Badge variant="outline">Revisão Pendente</Badge>
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2 p-3 bg-gray-50 rounded-md"><h4 className="font-bold flex items-center gap-2"><Building size={16}/> Demanda do Hospital</h4><p><MapPinIcon size={14} className="inline mr-2"/>{match.shiftRequirementServiceType} - {location}</p><p><CalendarDays size={14} className="inline mr-2"/>{matchDate}</p><p><Clock size={14} className="inline mr-2"/>{match.shiftRequirementStartTime} às {match.shiftRequirementEndTime}</p><p><DollarSign size={14} className="inline mr-2"/>Oferecido: <strong>{formatCurrency(match.offeredRateByHospital)}/h</strong></p></div>
                <div className="space-y-2 p-3 bg-gray-50 rounded-md"><h4 className="font-bold flex items-center gap-2"><User size={16}/> Disponibilidade do Médico</h4><p><MapPinIcon size={14} className="inline mr-2"/>{match.doctorServiceType} - {location}</p><p><CalendarDays size={14} className="inline mr-2"/>{matchDate}</p><p><Clock size={14} className="inline mr-2"/>{match.timeSlotStartTime} às {match.timeSlotEndTime}</p><p><DollarSign size={14} className="inline mr-2"/>Desejado: {formatCurrency(match.doctorDesiredRate)}/h</p></div>
            </div>
            {(hospitalNotes || doctorNotes) && (
              <div className="space-y-2 border-t pt-4">
                  {hospitalNotes && (<div className="text-sm p-2 bg-blue-50 rounded-md"><p className="font-semibold text-blue-800 flex items-center gap-2"><Info size={14}/> Observação do Hospital:</p><p className="text-gray-700 italic pl-6">"{hospitalNotes}"</p></div>)}
                  {doctorNotes && (<div className="text-sm p-2 bg-green-50 rounded-md"><p className="font-semibold text-green-800 flex items-center gap-2"><Info size={14}/> Observação do Médico:</p><p className="text-gray-700 italic pl-6">"{doctorNotes}"</p></div>)}
              </div>
            )}
            <div><label htmlFor={`notes-match-${match.id}`} className="font-semibold text-sm mb-2 block">Observações do Admin (Para o Médico)</label><Textarea id={`notes-match-${match.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Proposta enviada ao médico com ajuste no valor." disabled={isProcessing}/></div>
        </CardContent>
        <CardFooter className="flex justify-end items-center gap-3"><Button variant="destructive" onClick={handleReject} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}Rejeitar Match</Button><Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}Aprovar e Propor ao Médico</Button></CardFooter>
      </Card>
    );
};

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ title, message }: { title: string, message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{message}</p></div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300"><LucideAlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="text-base font-semibold text-red-700 mb-1">Oops!</p><p>{message || "Não foi possível carregar."}</p>{onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}</div> ));

export default function AdminMatchesPage() {
    const { toast } = useToast();
    const [matches, setMatches] = useState<PotentialMatch[]>([]);
    const [isLoadingMatches, setIsLoadingMatches] = useState(true);
    const [matchesError, setMatchesError] = useState<string | null>(null);
    const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("verification");

    useEffect(() => {
        const usersQuery = query(collection(db, "users"), where("documentVerificationStatus", "==", "PENDING_REVIEW"));
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => { setPendingUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))); setIsLoadingUsers(false); }, (error) => { console.error("Erro ao buscar cadastros:", error); setUsersError("Falha ao carregar cadastros."); setIsLoadingUsers(false); });
        const matchesQuery = query(collection(db, "potentialMatches"), where("status", "==", "PENDING_BACKOFFICE_REVIEW"), orderBy("createdAt", "desc"));
        const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => { setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PotentialMatch))); setIsLoadingMatches(false); }, (error) => { console.error("Erro ao buscar matches:", error); setMatchesError("Falha ao carregar matches."); setIsLoadingMatches(false); });
        return () => { unsubscribeUsers(); unsubscribeMatches(); };
    }, []);

    const handleUserVerification = async (userId: string, status: ProfileStatus, notes: string, reasons?: Record<string, string>) => { try { await updateUserVerificationStatus(userId, status, notes, reasons); toast({ title: "Cadastro Atualizado!" }); } catch (error: any) { toast({ title: "Erro ao Atualizar", description: error.message, variant: "destructive" }); }};
    const handleApproveMatch = async (matchId: string, negotiatedRate: number, notes?: string) => { try { await approveMatchAndProposeToDoctor(matchId, negotiatedRate, notes); toast({ title: "Match Aprovado!", description: "Proposta enviada ao médico." }); } catch (err: any) { toast({ title: "Erro ao Aprovar", description: err.message, variant: "destructive" }); }};
    const handleRejectMatch = async (matchId: string, adminNotes: string) => { try { await rejectMatchByBackoffice(matchId, adminNotes); toast({ title: "Match Rejeitado" }); } catch (err: any) { toast({ title: "Erro ao Rejeitar", description: err.message, variant: "destructive" }); }};

    return (
      <div className="space-y-6">
          <div className="flex items-center justify-between"><h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2"><ShieldCheck size={28}/> Painel de Revisão</h1><Button variant="outline" size="sm" disabled><RotateCcw className={cn("mr-2 h-4 w-4", (isLoadingMatches || isLoadingUsers) && "animate-spin")}/>Sincronizado</Button></div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="verification">Verificação de Cadastros<Badge variant={pendingUsers.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoadingUsers ? <Loader2 className="h-3 w-3 animate-spin"/> : pendingUsers.length}</Badge></TabsTrigger>
                <TabsTrigger value="matches">Revisão de Matches<Badge variant={matches.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoadingMatches ? <Loader2 className="h-3 w-3 animate-spin"/> : matches.length}</Badge></TabsTrigger>
            </TabsList>
            <TabsContent value="verification" className="mt-4">
                <Card>
                    <CardHeader><CardTitle>Cadastros Pendentes</CardTitle><CardDescription>Aprove ou solicite correções.</CardDescription></CardHeader>
                    <CardContent>{isLoadingUsers ? <LoadingState /> : usersError ? <ErrorState message={usersError} /> : pendingUsers.length === 0 ? <EmptyState title="Nenhum cadastro para verificar." message="Todos estão em dia." /> : <div className="space-y-4">{pendingUsers.map(user => <UserVerificationCard key={user.uid} user={user} onAction={handleUserVerification} />)}</div>}</CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="matches" className="mt-4">
                <Card>
                    <CardHeader><CardTitle>Matches Pendentes</CardTitle><CardDescription>Combinações para sua revisão.</CardDescription></CardHeader>
                    <CardContent>{isLoadingMatches ? <LoadingState /> : matchesError ? <ErrorState message={matchesError} /> : matches.length === 0 ? <EmptyState title="Nenhum match aguardando." message="Novas combinações aparecerão aqui." /> : <div className="space-y-4">{matches.map(match => <MatchReviewCard key={match.id} match={match} onApproveMatch={handleApproveMatch} onRejectMatch={handleRejectMatch}/>)}</div>}</CardContent>
                </Card>
            </TabsContent>
          </Tabs>
      </div>
    );
}