// app/admin/matches/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent, ReactNode } from 'react';
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    CheckCircle, XCircle, Eye, DollarSign, Edit3, MessageSquare, Loader2, RotateCcw, ClipboardList, Users, Briefcase, CalendarDays, Clock, MapPinIcon, ChevronDown, ChevronUp, 
    AlertTriangle as LucideAlertTriangle, ShieldCheck, FileText, UserCheck, UserX, ExternalLink, Info as InfoIcon, Building, User
} from 'lucide-react';
import { getMatchesForBackofficeReview, approveMatchAndProposeToDoctor, rejectMatchByBackoffice, type PotentialMatch } from "@/lib/match-service";
import { 
    getDoctorProfileForAdmin, 
    updateUserVerificationStatus,
    getUsersForVerification,
    type UserProfile,
    type DoctorProfile,
    type HospitalProfile,
    type DoctorDocumentsRef,
    type SpecialistDocumentsRef,
    type HospitalDocumentsRef,
    type LegalRepDocumentsRef,
    type ProfileStatus
} from "@/lib/auth-service";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";

// --- COMPONENTES DE ESTADO ---
const LoadingState = React.memo(({ message = "Carregando dados..." }: { message?: string }) => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <span className="ml-3 text-sm text-gray-600 mt-3">{message}</span> </div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: ReactNode }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full"> <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/> <p className="font-medium text-gray-600 mb-1">Nada por aqui ainda!</p> <p className="max-w-xs">{message}</p> {actionButton && <div className="mt-4">{actionButton}</div>} </div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"> <LucideAlertTriangle className="w-12 h-12 text-red-400 mb-4"/> <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p> <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados."}</p> {onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"> <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente </Button> )} </div> ));
ErrorState.displayName = 'ErrorState';

const DOC_LABELS: Record<string, string> = { personalRg: "RG Pessoal", personalCpf: "CPF Pessoal", professionalCrm: "CRM", photo3x4: "Foto 3x4", addressProof: "Compr. Endereço", graduationCertificate: "Cert. Graduação", criminalRecordCert: "Cert. Neg. Criminal", ethicalCert: "Cert. Neg. Ética", debtCert: "Cert. Neg. Débitos CRM", cv: "Currículo Vitae", rqe: "RQE", postGradCert: "Cert. Pós/Residência", specialistTitle: "Título Especialista", recommendationLetter: "Carta Recomendação", socialContract: "Contrato Social", cnpjCard: "Cartão CNPJ", companyAddressProof: "Comprovante Endereço Empresa", repRg: "RG do Responsável", repCpf: "CPF do Responsável", repAddressProof: "Comprovante Endereço Responsável" };
type AllDocKeys = keyof typeof DOC_LABELS;
type ButtonVariant = VariantProps<typeof Button>["variant"];

// --- COMPONENTES FILHOS ---

const getStatusBadgeProps = (status?: ProfileStatus): { variant: BadgeProps["variant"], className?: string } => {
    switch (status) {
        case 'APPROVED': return { variant: 'default', className: 'bg-green-600 hover:bg-green-700' };
        case 'REJECTED_NEEDS_RESUBMISSION': return { variant: 'destructive' };
        case 'PENDING_REVIEW': default: return { variant: 'secondary', className: 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900' };
    }
};

const VerificationSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-2 pt-3 mt-3 border-t">
        <h4 className="font-semibold text-gray-700">{title}</h4>
        {children}
    </div>
);

interface UserVerificationItemProps { user: UserProfile; onAction: () => void; }
const UserVerificationItem: React.FC<UserVerificationItemProps> = ({ user, onAction }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [adminNotes, setAdminNotes] = useState(user.adminVerificationNotes || '');
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleVerificationAction = async (status: ProfileStatus) => {
        if (status === 'REJECTED_NEEDS_RESUBMISSION' && !adminNotes.trim()) {
            toast({ title: "Justificativa Necessária", description: "Para rejeitar um cadastro, adicione uma nota explicativa.", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        try {
            await updateUserVerificationStatus(user.uid, status, adminNotes);
            toast({ title: "Cadastro Atualizado!", description: `O cadastro de ${user.displayName} foi ${status === 'APPROVED' ? 'aprovado' : 'marcado para correção'}.`});
            onAction();
        } catch (error: any) {
            toast({ title: "Erro ao Atualizar", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const renderAllDocuments = (userProfile: UserProfile) => {
        let documents: Record<string, string | undefined> = {};
        if (userProfile.role === 'doctor') {
            const docProfile = userProfile as DoctorProfile;
            documents = { ...(docProfile.documents || {}), ...(docProfile.specialistDocuments || {}) };
        } else if (userProfile.role === 'hospital') {
            const hospProfile = userProfile as HospitalProfile;
            documents = { ...(hospProfile.hospitalDocs || {}), ...(hospProfile.legalRepDocuments || {}) };
        }
        if (Object.values(documents).every(v => !v)) return <p className="text-sm text-gray-500 italic">Nenhum documento foi enviado com o cadastro.</p>;
        
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                {Object.entries(documents).map(([key, url]) => {
                     if (!url) return null;
                     const label = DOC_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                     return (
                        <div key={key} className="flex items-center justify-between text-xs py-1 border-b border-slate-200 last:border-b-0">
                            <span className="truncate pr-2">{label}</span>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 shrink-0">Ver<ExternalLink size={12}/></a>
                        </div>
                    );
                })}
            </div>
        )
    };

    return (
        <Card className="bg-white shadow-sm">
            <CardHeader className="cursor-pointer p-4" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {user.role === 'doctor' ? <User className="h-6 w-6 text-blue-500"/> : <Building className="h-6 w-6 text-green-500"/>}
                        <div>
                            <p className="font-semibold">{user.displayName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        <Badge variant={user.role === 'doctor' ? 'default' : 'secondary'}>{user.role === 'doctor' ? 'Médico' : 'Hospital'}</Badge>
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="text-gray-400"/> : <ChevronDown size={18} className="text-gray-400"/>}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="text-sm pt-2 pb-4 px-4 space-y-4">
                    <div className="p-3 border rounded-md bg-slate-50 space-y-3">
                         <h4 className="font-semibold text-gray-700">Verificação de Documentos</h4>
                         {renderAllDocuments(user)}
                         <div className="space-y-1.5 pt-2">
                             <Label htmlFor={`doc-verify-notes-${user.uid}`} className="text-xs">Notas de Verificação (Visível para o usuário se rejeitado)</Label>
                             <Textarea id={`doc-verify-notes-${user.uid}`} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Se rejeitar, explique aqui o motivo..." className="text-sm min-h-[60px]" disabled={isProcessing}/>
                         </div>
                         <div className="flex gap-2 justify-end pt-2">
                             <Button variant="destructive" size="sm" onClick={() => handleVerificationAction('REJECTED_NEEDS_RESUBMISSION')} disabled={isProcessing}> {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserX className="h-4 w-4"/>} Pedir Correção </Button>
                             <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleVerificationAction('APPROVED')} disabled={isProcessing}> {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserCheck className="h-4 w-4"/>} Aprovar Cadastro </Button>
                         </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
};
UserVerificationItem.displayName = "UserVerificationItem";

interface MatchReviewItemProps {
  match: PotentialMatch;
  onApproveMatch: (matchId: string, negotiatedRate: number, notes?: string) => Promise<void>;
  onRejectMatch: (matchId: string, notes: string) => Promise<void>;
  onDoctorDocumentsReviewed: (doctorId: string) => void; 
}
const MatchReviewItem: React.FC<MatchReviewItemProps> = ({ match, onApproveMatch, onRejectMatch, onDoctorDocumentsReviewed }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [negotiatedRate, setNegotiatedRate] = useState<string>(String(match.offeredRateByHospital || ""));
  const [adminMatchNotes, setAdminMatchNotes] = useState(match.backofficeNotes || "");
  const [isMatchProcessing, setIsMatchProcessing] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [isLoadingDoctorProfile, setIsLoadingDoctorProfile] = useState(false);
  const [doctorProfileError, setDoctorProfileError] = useState<string | null>(null);
  const [adminDocVerificationNotes, setAdminDocVerificationNotes] = useState("");
  const [isDocVerificationProcessing, setIsDocVerificationProcessing] = useState(false);
  const { toast } = useToast();

  const fetchDoctorDetails = useCallback(async () => {
    if (match.doctorId && (!doctorProfile || doctorProfile.uid !== match.doctorId)) {
      setIsLoadingDoctorProfile(true);
      setDoctorProfileError(null);
      try {
        const profile = await getDoctorProfileForAdmin(match.doctorId);
        setDoctorProfile(profile);
        setAdminDocVerificationNotes(profile?.adminVerificationNotes || "");
      } catch (error: any) {
        setDoctorProfileError("Falha ao carregar perfil do médico: " + error.message);
      } finally {
        setIsLoadingDoctorProfile(false);
      }
    }
  }, [match.doctorId, doctorProfile]);

  useEffect(() => {
    if (isExpanded && match.doctorId) {
      fetchDoctorDetails();
    }
  }, [isExpanded, fetchDoctorDetails, match.doctorId]);

  const handleApproveMatchAction = async () => {
    const rate = parseFloat(negotiatedRate);
    if (isNaN(rate) || rate <= 0) { toast({title: "Tarifa Inválida", variant: "destructive"}); return; }
    setIsMatchProcessing(true);
    try {
        if (match.id) await onApproveMatch(match.id, rate, adminMatchNotes);
    } finally {
        setIsMatchProcessing(false);
    }
  };
  const handleRejectMatchAction = async () => {
    if (!adminMatchNotes.trim()) { toast({title: "Justificativa Necessária", variant: "destructive"}); return; }
    setIsMatchProcessing(true);
    try {
        if (match.id) await onRejectMatch(match.id, adminMatchNotes);
    } finally {
        setIsMatchProcessing(false);
    }
  };

  const handleDoctorDocumentVerification = async (
    status: NonNullable<DoctorProfile['documentVerificationStatus']>
  ) => {
    if (!doctorProfile?.uid) return;
    if (status === 'REJECTED_NEEDS_RESUBMISSION' && !adminDocVerificationNotes.trim()) {
        toast({title: "Justificativa Necessária", description: "Adicione uma nota para rejeição/reenvio.", variant: "destructive"});
        return;
    }
    setIsDocVerificationProcessing(true);
    try {
        await updateUserVerificationStatus(doctorProfile.uid, status, adminDocVerificationNotes);
        toast({title: "Status dos Documentos Atualizado!", variant: "default"});
        const updatedProfile = await getDoctorProfileForAdmin(doctorProfile.uid);
        setDoctorProfile(updatedProfile);
        setAdminDocVerificationNotes(updatedProfile?.adminVerificationNotes || "");
        if (onDoctorDocumentsReviewed) onDoctorDocumentsReviewed(doctorProfile.uid);
    } catch (error: any) {
        toast({title: "Erro ao Atualizar Status dos Docs", description: error.message, variant: "destructive"});
    } finally {
        setIsDocVerificationProcessing(false);
    }
  };

  const displayOriginalShiftDates = Array.isArray(match.originalShiftRequirementDates)
    ? match.originalShiftRequirementDates.map((ts: Timestamp) => 
        ts && typeof ts.toDate === 'function' ? 
        ts.toDate().toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'}) : 
        "Data Inv."
      ).join('; ')
    : "N/A";
  
  const matchedDateString = match.matchedDate && typeof match.matchedDate.toDate === 'function'
    ? match.matchedDate.toDate().toLocaleDateString('pt-BR',  { day: '2-digit', month: 'short', year: 'numeric' })
    : "Data não disponível";

  const docVerificationBadge = doctorProfile ? getStatusBadgeProps(doctorProfile.documentVerificationStatus) : getStatusBadgeProps('PENDING_REVIEW');

  return (
    <Card className="shadow-md bg-white">
      <CardHeader className="cursor-pointer p-4" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-base font-semibold">Match: {match.hospitalName || "N/A"} & Dr(a). {match.doctorName || (doctorProfile?.displayName || "N/A")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                    Demanda ID: {match.shiftRequirementId} | Data do Match: {matchedDateString}
                </CardDescription>
            </div>
            {isExpanded ? <ChevronUp size={18} className="text-gray-400"/> : <ChevronDown size={18} className="text-gray-400"/>}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="text-sm pt-2 pb-4 px-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 border-b pb-3">
              <div className="space-y-1">
                  <h4 className="font-medium text-gray-600 text-xs uppercase tracking-wider">Demanda do Hospital</h4>
                  <p className="text-xs flex items-center"><Users size={12} className="mr-1.5"/> {match.numberOfVacanciesInRequirement} vaga(s)</p>
                  <p className="text-xs flex items-center"><CalendarDays size={12} className="mr-1.5"/> Datas da Demanda: {displayOriginalShiftDates}</p>
                  <p className="text-xs flex items-center"><Clock size={12} className="mr-1.5"/> {match.shiftRequirementStartTime} - {match.shiftRequirementEndTime} {match.shiftRequirementIsOvernight && "(vira o dia)"}</p>
                  <p className="text-xs flex items-center"><Briefcase size={12} className="mr-1.5"/> {(match.shiftRequirementSpecialties || []).join(', ')}</p>
                  <p className="text-xs flex items-center"><DollarSign size={12} className="mr-1.5"/> Ofertado: <span className="font-semibold">{formatCurrency(match.offeredRateByHospital)}/hora</span></p>
                  {match.shiftRequirementNotes && <p className="text-xs italic text-gray-500 mt-1">Obs. Hospital: {match.shiftRequirementNotes}</p>}
              </div>
              <div className="space-y-1">
                  <h4 className="font-medium text-gray-600 text-xs uppercase tracking-wider">Disponibilidade do Médico (Data do Match: {matchedDateString})</h4>
                  <p className="text-xs flex items-center"><Clock size={12} className="mr-1.5"/> {match.timeSlotStartTime} - {match.timeSlotEndTime} {match.timeSlotIsOvernight && "(vira o dia)"}</p>
                  <p className="text-xs flex items-center"><Briefcase size={12} className="mr-1.5"/> {(match.doctorSpecialties || []).join(', ')}</p>
                  <p className="text-xs flex items-center"><DollarSign size={12} className="mr-1.5"/> Desejado: <span className="font-semibold">{formatCurrency(match.doctorDesiredRate)}/hora</span></p>
              </div>
          </div>
          
          <div className="border-b pb-3 space-y-2">
            <h4 className="font-semibold text-gray-700">Aprovar/Rejeitar este Match Específico</h4>
            <div><Label htmlFor={`negotiatedRate-${match.id}`} className="text-xs font-medium">Tarifa a Propor ao Médico (R$/hora)*</Label><Input id={`negotiatedRate-${match.id}`} type="number" value={negotiatedRate} onChange={(e: ChangeEvent<HTMLInputElement>) => setNegotiatedRate(e.target.value)} className="h-8 text-sm mt-1" min="0" step="0.01" disabled={isMatchProcessing}/></div>
            <div><Label htmlFor={`adminMatchNotes-${match.id}`} className="text-xs font-medium">Notas Internas do Match</Label><Textarea id={`adminMatchNotes-${match.id}`} value={adminMatchNotes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAdminMatchNotes(e.target.value)} placeholder="Notas sobre a negociação do match..." className="text-sm min-h-[60px] mt-1" disabled={isMatchProcessing}/></div>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="destructive" size="sm" onClick={handleRejectMatchAction} disabled={isMatchProcessing || !adminMatchNotes.trim()}> {isMatchProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} <XCircle className="mr-2 h-4 w-4"/> Rejeitar Match </Button>
                <Button onClick={handleApproveMatchAction} size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={isMatchProcessing || parseFloat(negotiatedRate) <= 0}> {isMatchProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} <CheckCircle className="mr-2 h-4 w-4"/> Aprovar Match e Propor </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700">Documentação do Médico: {doctorProfile?.displayName || match.doctorName || "Carregando..."}</h4>
            {isLoadingDoctorProfile && <LoadingState message="Carregando documentos do médico..." />}
            {doctorProfileError && <ErrorState message={doctorProfileError} onRetry={fetchDoctorDetails} />}
            {doctorProfile && !isLoadingDoctorProfile && (
              <div className="space-y-3 p-3 border rounded-md bg-slate-50">
                <div className="flex items-center gap-2">
                    <p className="text-xs font-medium">Status Verificação Docs:</p>
                    <Badge variant={docVerificationBadge.variant} className={cn(docVerificationBadge.className)}>
                        {(doctorProfile.documentVerificationStatus || 'PENDING_REVIEW').replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    {(Object.keys(DOC_LABELS) as AllDocKeys[]).map((key) => {
                        let docUrl: string | undefined = undefined;
                        if (doctorProfile.documents && key in doctorProfile.documents) {
                            docUrl = (doctorProfile.documents as DoctorDocumentsRef)[key as keyof DoctorDocumentsRef];
                        } else if (doctorProfile.specialistDocuments && key in doctorProfile.specialistDocuments) {
                            docUrl = (doctorProfile.specialistDocuments as SpecialistDocumentsRef)[key as keyof SpecialistDocumentsRef];
                        }
                        
                        if (!docUrl && !DOC_LABELS[key].includes("*") && !(DOC_LABELS[key].includes("(Opcional)"))) return null;

                        return (
                            <div key={key} className="flex items-center justify-between text-xs py-1 border-b border-slate-200 last:border-b-0">
                                <span>{DOC_LABELS[key].replace("*", "")}{DOC_LABELS[key].includes("*") && <span className="text-red-500">*</span>}:</span>
                                {docUrl ? (<Link href={docUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"> Ver <ExternalLink size={12}/></Link>) : 
                                (<span className={DOC_LABELS[key].includes("*") ? "text-red-500" : "text-gray-400 italic"}>Pendente</span>)}
                            </div>
                        );
                    })}
                </div>
                <div className="space-y-1.5 pt-2">
                    <Label htmlFor={`doc-verify-notes-${doctorProfile.uid}`} className="text-xs">Notas de Verificação (Admin):</Label>
                    <Textarea id={`doc-verify-notes-${doctorProfile.uid}`} value={adminDocVerificationNotes} onChange={(e) => setAdminDocVerificationNotes(e.target.value)} placeholder="Notas sobre os docs, ou motivo para rejeição/reenvio..." className="text-sm min-h-[50px]" disabled={isDocVerificationProcessing}/>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" size="sm" onClick={() => handleDoctorDocumentVerification('REJECTED_NEEDS_RESUBMISSION')} disabled={isDocVerificationProcessing || doctorProfile.documentVerificationStatus === 'APPROVED'}> {isDocVerificationProcessing && doctorProfile.documentVerificationStatus !== 'APPROVED' && doctorProfile.documentVerificationStatus !== 'REJECTED_NEEDS_RESUBMISSION' ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserX className="h-4 w-4"/>} Pedir Correção </Button>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDoctorDocumentVerification('APPROVED')} disabled={isDocVerificationProcessing || doctorProfile.documentVerificationStatus === 'APPROVED'}> {isDocVerificationProcessing && doctorProfile.documentVerificationStatus !== 'APPROVED' ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserCheck className="h-4 w-4"/>} Aprovar Documentos </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
MatchReviewItem.displayName = "MatchReviewItem";

export default function AdminMatchesPage() {
    const { toast } = useToast();
    const [matches, setMatches] = useState<PotentialMatch[]>([]);
    const [isLoadingMatches, setIsLoadingMatches] = useState(true);
    const [matchesError, setMatchesError] = useState<string | null>(null);

    const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("verification");

    const fetchMatches = useCallback(async () => {
        setIsLoadingMatches(true);
        setMatchesError(null);
        try {
            const data = await getMatchesForBackofficeReview();
            setMatches(data);
        } catch (err: any) {
            setMatchesError(err.message || "Falha ao carregar matches.");
        } finally {
            setIsLoadingMatches(false);
        }
    }, []);

    const fetchPendingUsers = useCallback(async () => {
        setIsLoadingUsers(true);
        setUsersError(null);
        try {
            const users = await getUsersForVerification();
            setPendingUsers(users);
        } catch (err: any) {
            setUsersError(err.message || "Falha ao carregar usuários pendentes.");
        } finally {
            setIsLoadingUsers(false);
        }
    }, []);
    
    const handleActionComplete = useCallback(() => {
        fetchMatches();
        fetchPendingUsers();
    }, [fetchMatches, fetchPendingUsers]);
    
    useEffect(() => {
        if (activeTab === 'matches') {
            fetchMatches();
        } else if (activeTab === 'verification') {
            fetchPendingUsers();
        }
    }, [activeTab, fetchMatches, fetchPendingUsers]);

    const handleApproveMatch = async (matchId: string, negotiatedRate: number, notes?: string) => {
        try {
            await approveMatchAndProposeToDoctor(matchId, negotiatedRate, notes);
            toast({ title: "Match Aprovado!", variant: "default" });
            fetchMatches();
        } catch (err: any) { toast({ title: "Erro ao Aprovar Match", description: err.message, variant: "destructive" }); }
    };

    const handleRejectMatch = async (matchId: string, adminNotes: string) => {
        try {
            await rejectMatchByBackoffice(matchId, adminNotes);
            toast({ title: "Match Rejeitado", variant: "default" });
            fetchMatches();
        } catch (err: any) { toast({ title: "Erro ao Rejeitar Match", description: err.message, variant: "destructive" }); }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
                <ShieldCheck size={28}/> Painel de Revisão
            </h1>
            <Button variant="outline" size="sm" onClick={handleActionComplete} disabled={isLoadingMatches || isLoadingUsers}>
                <RotateCcw className={cn("mr-2 h-4 w-4", (isLoadingMatches || isLoadingUsers) && "animate-spin")}/> Atualizar Tudo
            </Button>
        </div>
  
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="verification">Verificação de Cadastros <Badge className="ml-2">{pendingUsers.length}</Badge></TabsTrigger>
              <TabsTrigger value="matches">Revisão de Matches <Badge className="ml-2">{matches.length}</Badge></TabsTrigger>
          </TabsList>
  
          <TabsContent value="verification" className="mt-4">
              <Card>
                  <CardHeader><CardTitle>Cadastros Pendentes</CardTitle><CardDescription>Aprove ou solicite correções para os cadastros abaixo.</CardDescription></CardHeader>
                  <CardContent>
                      {isLoadingUsers ? <LoadingState message="Buscando cadastros pendentes..." /> :
                       usersError ? <ErrorState message={usersError} onRetry={fetchPendingUsers} /> :
                       pendingUsers.length === 0 ? <EmptyState message="Nenhum cadastro para verificar no momento." /> :
                       (
                           <div className="space-y-4">
                               {pendingUsers.map(user => (
                                   <UserVerificationItem key={user.uid} user={user} onAction={handleActionComplete} />
                               ))}
                           </div>
                       )}
                  </CardContent>
              </Card>
          </TabsContent>
  
          <TabsContent value="matches" className="mt-4">
              <Card>
                  <CardHeader><CardTitle>Matches Pendentes</CardTitle><CardDescription>Combinações entre demandas e disponibilidades para sua revisão.</CardDescription></CardHeader>
                  <CardContent>
                      {isLoadingMatches ? <LoadingState message="Buscando matches..." /> :
                       matchesError ? <ErrorState message={matchesError} onRetry={fetchMatches} /> :
                       matches.length === 0 ? <EmptyState message="Nenhum match aguardando revisão." /> :
                       (
                           <div className="space-y-4">
                               {matches.map(match => (
                                   <MatchReviewItem key={match.id} match={match} onApproveMatch={handleApproveMatch} onRejectMatch={handleRejectMatch} onDoctorDocumentsReviewed={handleActionComplete} />
                               ))}
                           </div>
                       )}
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
}