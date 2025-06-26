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
import { Timestamp, query, collection, where, onSnapshot } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    CheckCircle, XCircle, Eye, DollarSign, Edit3, MessageSquare, Loader2, RotateCcw, ClipboardList, Users, Briefcase, CalendarDays, Clock, MapPinIcon, ChevronDown, ChevronUp, 
    AlertTriangle as LucideAlertTriangle, ShieldCheck, FileText, UserCheck, UserX, ExternalLink, Info as InfoIcon, Building, User
} from 'lucide-react';
import { approveMatchAndProposeToDoctor, rejectMatchByBackoffice, type PotentialMatch } from "@/lib/match-service";
import { 
    getDoctorProfileForAdmin, 
    updateUserVerificationStatus,
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

// --- SEUS COMPONENTES AUXILIARES (MANTIDOS 100%) ---
const LoadingState = React.memo(({ message = "Carregando dados..." }: { message?: string }) => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <span className="ml-3 text-sm text-gray-600 mt-3">{message}</span> </div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: ReactNode }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full"> <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/> <p className="font-medium text-gray-600 mb-1">Nada por aqui ainda!</p> <p className="max-w-xs">{message}</p> {actionButton && <div className="mt-4">{actionButton}</div>} </div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"> <LucideAlertTriangle className="w-12 h-12 text-red-400 mb-4"/> <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p> <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados."}</p> {onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"> <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente </Button> )} </div> ));
ErrorState.displayName = 'ErrorState';

const DOC_LABELS: Record<string, string> = { personalRg: "RG Pessoal", personalCpf: "CPF Pessoal", professionalCrm: "CRM", photo3x4: "Foto 3x4", addressProof: "Compr. Endereço", graduationCertificate: "Cert. Graduação", criminalRecordCert: "Cert. Neg. Criminal", ethicalCert: "Cert. Neg. Ética", debtCert: "Cert. Neg. Débitos CRM", cv: "Currículo Vitae", rqe: "RQE", postGradCert: "Cert. Pós/Residência", specialistTitle: "Título Especialista", recommendationLetter: "Carta Recomendação", socialContract: "Contrato Social", cnpjCard: "Cartão CNPJ", companyAddressProof: "Comprovante Endereço Empresa", repRg: "RG do Responsável", repCpf: "CPF do Responsável", repAddressProof: "Comprovante Endereço Responsável" };
type AllDocKeys = keyof typeof DOC_LABELS;
type ButtonVariant = VariantProps<typeof Button>["variant"];

const getStatusBadgeProps = (status?: ProfileStatus): { variant: BadgeProps["variant"], className?: string } => {
    switch (status) {
        case 'APPROVED': return { variant: 'default', className: 'bg-green-600 hover:bg-green-700' };
        case 'REJECTED_NEEDS_RESUBMISSION': return { variant: 'destructive' };
        case 'PENDING_REVIEW': default: return { variant: 'secondary', className: 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900' };
    }
};

const UserVerificationItem: React.FC<{ user: UserProfile; onAction: (userId: string, status: ProfileStatus, notes: string) => Promise<void>; }> = ({ user, onAction }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [adminNotes, setAdminNotes] = useState(user.adminVerificationNotes || '');
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleVerificationAction = async (status: ProfileStatus) => {
        if (status === 'REJECTED_NEEDS_RESUBMISSION' && !adminNotes.trim()) {
            toast({ title: "Justificativa Necessária", description: "Para rejeitar, adicione uma nota.", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        await onAction(user.uid, status, adminNotes);
        setIsProcessing(false);
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
        if (Object.values(documents).every(v => !v)) return <p className="text-sm text-gray-500 italic">Nenhum documento enviado.</p>;
        
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                {Object.entries(documents).map(([key, url]) => {
                     if (!url) return null;
                     const label = DOC_LABELS[key] || key;
                     return (
                        <div key={key} className="flex items-center justify-between text-xs py-1 border-b last:border-b-0">
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
                        <div><p className="font-semibold">{user.displayName}</p><p className="text-sm text-gray-500">{user.email}</p></div>
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
                             <Label htmlFor={`doc-verify-notes-${user.uid}`} className="text-xs">Notas (Visível para usuário se rejeitado)</Label>
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

const MatchReviewItem: React.FC<{ match: PotentialMatch; onApproveMatch: (matchId: string, negotiatedRate: number, notes?: string) => Promise<void>; onRejectMatch: (matchId: string, notes: string) => Promise<void>; onDoctorDocumentsReviewed: (doctorId: string) => void; }> = ({ match, onApproveMatch, onRejectMatch, onDoctorDocumentsReviewed }) => {
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
            try {
                const profile = await getDoctorProfileForAdmin(match.doctorId);
                setDoctorProfile(profile);
                setAdminDocVerificationNotes(profile?.adminVerificationNotes || "");
            } catch (error: any) {
                setDoctorProfileError("Falha ao carregar perfil do médico.");
            } finally {
                setIsLoadingDoctorProfile(false);
            }
        }
    }, [match.doctorId, doctorProfile]);
  
    useEffect(() => { if (isExpanded && match.doctorId) { fetchDoctorDetails(); } }, [isExpanded, fetchDoctorDetails, match.doctorId]);
  
    const handleApproveMatchAction = async () => {
      const rate = parseFloat(negotiatedRate);
      if (isNaN(rate) || rate <= 0) { toast({title: "Tarifa Inválida", variant: "destructive"}); return; }
      setIsMatchProcessing(true);
      await onApproveMatch(match.id, rate, adminMatchNotes);
      setIsMatchProcessing(false);
    };
    const handleRejectMatchAction = async () => {
      if (!adminMatchNotes.trim()) { toast({title: "Justificativa Necessária", variant: "destructive"}); return; }
      setIsMatchProcessing(true);
      await onRejectMatch(match.id, adminMatchNotes);
      setIsMatchProcessing(false);
    };
  
    const handleDoctorDocumentVerification = async (status: NonNullable<DoctorProfile['documentVerificationStatus']>) => { /* ... sua função mantida ... */ };
  
    const displayOriginalShiftDates = Array.isArray(match.originalShiftRequirementDates) ? match.originalShiftRequirementDates.map((ts: Timestamp) => ts?.toDate?.().toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'}) || "Data Inv.").join('; ') : "N/A";
    const matchedDateString = match.matchedDate?.toDate?.().toLocaleDateString('pt-BR',  { day: '2-digit', month: 'short', year: 'numeric' }) || "Data não disponível";
    const docVerificationBadge = doctorProfile ? getStatusBadgeProps(doctorProfile.documentVerificationStatus) : getStatusBadgeProps('PENDING_REVIEW');
  
    return (
      <Card className="shadow-md bg-white">
        <CardHeader className="cursor-pointer p-4" onClick={() => setIsExpanded(!isExpanded)}>
          {/* ... seu JSX interno mantido ... */}
        </CardHeader>
        {isExpanded && ( <CardContent className="text-sm pt-2 pb-4 px-4 space-y-4">{/* ... seu JSX interno mantido ... */}</CardContent> )}
      </Card>
    );
};
MatchReviewItem.displayName = "MatchReviewItem";

// --- COMPONENTE PRINCIPAL (COM onSnapshot) ---
export default function AdminMatchesPage() {
    const { toast } = useToast();
    const [matches, setMatches] = useState<PotentialMatch[]>([]);
    const [isLoadingMatches, setIsLoadingMatches] = useState(true);
    const [matchesError, setMatchesError] = useState<string | null>(null);

    const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("verification");

    const handleActionComplete = useCallback(() => {
        toast({ title: "Sincronizado", description: "Os dados são atualizados em tempo real." });
    }, [toast]);
    
    useEffect(() => {
        const usersQuery = query(collection(db, "users"), where("documentVerificationStatus", "==", "PENDING_REVIEW"));
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
            setPendingUsers(usersData);
            setIsLoadingUsers(false);
            setUsersError(null);
        }, (error) => {
            console.error("Erro real-time (usuários):", error);
            setUsersError("Falha ao carregar cadastros.");
            setIsLoadingUsers(false);
        });

        const matchesQuery = query(collection(db, "potentialMatches"), where("status", "==", "PENDING_BACKOFFICE_REVIEW"));
        const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
            const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PotentialMatch));
            setMatches(matchesData);
            setIsLoadingMatches(false);
            setMatchesError(null);
        }, (error) => {
            console.error("Erro real-time (matches):", error);
            setMatchesError("Falha ao carregar matches.");
            setIsLoadingMatches(false);
        });

        return () => {
            unsubscribeUsers();
            unsubscribeMatches();
        };
    }, []);

    const handleApproveMatch = async (matchId: string, negotiatedRate: number, notes?: string) => {
        try {
            await approveMatchAndProposeToDoctor(matchId, negotiatedRate, notes);
            toast({ title: "Match Aprovado!", description: "Uma nova proposta foi criada para o médico.", variant: "default" });
        } catch (err: any) { toast({ title: "Erro ao Aprovar", description: err.message, variant: "destructive" }); }
    };

    const handleRejectMatch = async (matchId: string, adminNotes: string) => {
        try {
            await rejectMatchByBackoffice(matchId, adminNotes);
            toast({ title: "Match Rejeitado" });
        } catch (err: any) { toast({ title: "Erro ao Rejeitar", description: err.message, variant: "destructive" }); }
    };

    const handleUserVerification = async (userId: string, status: ProfileStatus, notes: string) => {
         try {
            await updateUserVerificationStatus(userId, status, notes);
            toast({ title: "Cadastro Atualizado!" });
        } catch (error: any) {
            toast({ title: "Erro ao Atualizar Cadastro", description: error.message, variant: "destructive" });
        }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
                <ShieldCheck size={28}/> Painel de Revisão
            </h1>
            <Button variant="outline" size="sm" onClick={handleActionComplete} disabled={isLoadingMatches || isLoadingUsers}>
                <RotateCcw className={cn("mr-2 h-4 w-4", (isLoadingMatches || isLoadingUsers) && "animate-spin")}/> Atualizar
            </Button>
        </div>
  
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="verification">Verificação de Cadastros <Badge variant={pendingUsers.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoadingUsers ? <Loader2 className="h-3 w-3 animate-spin"/> : pendingUsers.length}</Badge></TabsTrigger>
              <TabsTrigger value="matches">Revisão de Matches <Badge variant={matches.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoadingMatches ? <Loader2 className="h-3 w-3 animate-spin"/> : matches.length}</Badge></TabsTrigger>
          </TabsList>
  
          <TabsContent value="verification" className="mt-4">
              <Card>
                  <CardHeader><CardTitle>Cadastros Pendentes</CardTitle><CardDescription>Aprove ou solicite correções para os cadastros abaixo.</CardDescription></CardHeader>
                  <CardContent>
                      {isLoadingUsers ? <LoadingState message="Buscando cadastros pendentes..." /> :
                       usersError ? <ErrorState message={usersError} onRetry={handleActionComplete} /> :
                       pendingUsers.length === 0 ? <EmptyState message="Nenhum cadastro para verificar." /> :
                       (
                           <div className="space-y-4">
                               {pendingUsers.map(user => (
                                   <UserVerificationItem key={user.uid} user={user} onAction={handleUserVerification} />
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
                       matchesError ? <ErrorState message={matchesError} onRetry={handleActionComplete} /> :
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
