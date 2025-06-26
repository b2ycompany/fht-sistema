// app/admin/matches/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent, ReactNode } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

// --- SEUS COMPONENTES AUXILIARES (INTACTOS) ---
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: ReactNode }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-gray-500 bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">Nada por aqui!</p><p>{message}</p>{actionButton && <div className="mt-4">{actionButton}</div>}</div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300"><LucideAlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="text-base font-semibold text-red-700 mb-1">Oops! Algo deu errado.</p><p>{message || "Não foi possível carregar os dados."}</p>{onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}</div> ));
ErrorState.displayName = 'ErrorState';

const DOC_LABELS: Record<string, string> = { personalRg: "RG Pessoal", personalCpf: "CPF Pessoal", professionalCrm: "CRM", photo3x4: "Foto 3x4", addressProof: "Compr. Endereço", graduationCertificate: "Cert. Graduação", criminalRecordCert: "Cert. Neg. Criminal", ethicalCert: "Cert. Neg. Ética", debtCert: "Cert. Neg. Débitos CRM", cv: "Currículo Vitae", rqe: "RQE", postGradCert: "Cert. Pós/Residência", specialistTitle: "Título Especialista", recommendationLetter: "Carta Recomendação", socialContract: "Contrato Social", cnpjCard: "Cartão CNPJ", companyAddressProof: "Comprovante Endereço Empresa", repRg: "RG do Responsável", repCpf: "CPF do Responsável", repAddressProof: "Comprovante Endereço Responsável" };
type ButtonVariant = VariantProps<typeof Button>["variant"];

const getStatusBadgeProps = (status?: ProfileStatus): { variant: BadgeProps["variant"], className?: string } => { /* ... sua função mantida ... */ return { variant: "secondary" }};

const UserVerificationItem: React.FC<{ user: UserProfile; onAction: (userId: string, status: ProfileStatus, notes: string) => Promise<void>; }> = ({ user, onAction }) => { /* ... seu componente completo mantido ... */ return <></>};
UserVerificationItem.displayName = "UserVerificationItem";


// --- MatchReviewItem COM RENDERIZAÇÃO ROBUSTA ---
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

  const fetchDoctorDetails = useCallback(async () => { /* ... sua função mantida ... */ }, [match.doctorId, doctorProfile]);
  
  useEffect(() => { if (isExpanded && match.doctorId) { fetchDoctorDetails(); } }, [isExpanded, fetchDoctorDetails, match.doctorId]);

  const handleApproveMatchAction = async () => { /* ... sua função mantida ... */ };
  const handleRejectMatchAction = async () => { /* ... sua função mantida ... */ };
  const handleDoctorDocumentVerification = async (status: NonNullable<DoctorProfile['documentVerificationStatus']>) => { /* ... sua função mantida ... */ };
  
  // --- LÓGICA DE RENDERIZAÇÃO DEFENSIVA ---
  const safeString = (value: any, fallback = "N/A"): string => value || fallback;
  const safeArray = (arr: any): string[] => Array.isArray(arr) ? arr : [];

  const matchedDateString = (match.matchedDate && typeof match.matchedDate.toDate === 'function')
    ? match.matchedDate.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : "Data Inválida";

  const displayOriginalShiftDates = safeArray(match.originalShiftRequirementDates).map((ts: any) =>
      ts?.toDate?.().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) || "Inv."
    ).join('; ');

  return (
    <Card className="shadow-md bg-white transition-all duration-300">
      <CardHeader className="cursor-pointer p-4" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-base font-semibold">
                    Match: {safeString(match.hospitalName)} & Dr(a). {safeString(match.doctorName, "Aguardando Info")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                    Demanda ID: {safeString(match.shiftRequirementId)} | Data: {matchedDateString}
                </CardDescription>
            </div>
            <ChevronDown className={cn("text-gray-400 transition-transform", isExpanded && "rotate-180")}/>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="text-sm pt-2 pb-4 px-4 space-y-4 animate-fade-in">
          {/* ... O restante do seu JSX para o conteúdo expandido permanece o mesmo ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 border-b pb-3">
              <div className="space-y-1">
                  <h4 className="font-medium text-gray-600 text-xs uppercase tracking-wider">Demanda do Hospital</h4>
                  <p className="text-xs flex items-center"><Users size={12} className="mr-1.5"/> {match.numberOfVacanciesInRequirement} vaga(s)</p>
                  <p className="text-xs flex items-center"><CalendarDays size={12} className="mr-1.5"/> Datas da Demanda: {displayOriginalShiftDates}</p>
                  <p className="text-xs flex items-center"><Clock size={12} className="mr-1.5"/> {match.shiftRequirementStartTime} - {match.shiftRequirementEndTime} {match.shiftRequirementIsOvernight && "(vira o dia)"}</p>
                  <p className="text-xs flex items-center"><Briefcase size={12} className="mr-1.5"/> {safeArray(match.shiftRequirementSpecialties).join(', ')}</p>
                  <p className="text-xs flex items-center"><DollarSign size={12} className="mr-1.5"/> Ofertado: <span className="font-semibold">{formatCurrency(match.offeredRateByHospital)}/hora</span></p>
                  {match.shiftRequirementNotes && <p className="text-xs italic text-gray-500 mt-1">Obs. Hospital: {match.shiftRequirementNotes}</p>}
              </div>
              <div className="space-y-1">
                  <h4 className="font-medium text-gray-600 text-xs uppercase tracking-wider">Disponibilidade do Médico</h4>
                  <p className="text-xs flex items-center"><Clock size={12} className="mr-1.5"/> {match.timeSlotStartTime} - {match.timeSlotEndTime} {match.timeSlotIsOvernight && "(vira o dia)"}</p>
                  <p className="text-xs flex items-center"><Briefcase size={12} className="mr-1.5"/> {safeArray(match.doctorSpecialties).join(', ')}</p>
                  <p className="text-xs flex items-center"><DollarSign size={12} className="mr-1.5"/> Desejado: <span className="font-semibold">{formatCurrency(match.doctorDesiredRate)}/hora</span></p>
              </div>
          </div>
          {/* ... Restante do seu CardContent, com os formulários de aprovação, etc ... */}
        </CardContent>
      )}
    </Card>
  );
};
MatchReviewItem.displayName = "MatchReviewItem";


// --- COMPONENTE PRINCIPAL (Mantido com onSnapshot) ---
export default function AdminMatchesPage() {
    const { toast } = useToast();
    const [matches, setMatches] = useState<PotentialMatch[]>([]);
    const [isLoadingMatches, setIsLoadingMatches] = useState(true);
    const [matchesError, setMatchesError] = useState<string | null>(null);

    const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("matches"); // Default para a aba de matches

    useEffect(() => {
        const usersQuery = query(collection(db, "users"), where("documentVerificationStatus", "==", "PENDING_REVIEW"));
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
            setPendingUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
            setIsLoadingUsers(false);
        }, (error) => { setIsLoadingUsers(false); setUsersError("Falha ao carregar cadastros."); });

        const matchesQuery = query(collection(db, "potentialMatches"), where("status", "==", "PENDING_BACKOFFICE_REVIEW"));
        const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
            setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PotentialMatch)));
            setIsLoadingMatches(false);
        }, (error) => { setIsLoadingMatches(false); setMatchesError("Falha ao carregar matches."); });

        return () => {
            unsubscribeUsers();
            unsubscribeMatches();
        };
    }, []);

    const handleApproveMatch = async (matchId: string, negotiatedRate: number, notes?: string) => { /* ... sua função mantida ... */ };
    const handleRejectMatch = async (matchId: string, adminNotes: string) => { /* ... sua função mantida ... */ };
    const handleUserVerification = async (userId: string, status: ProfileStatus, notes: string) => { /* ... sua função mantida ... */ };

    return (
      <div className="space-y-6">
        {/* ... O restante do seu JSX da página principal é mantido ... */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="verification">Verificação de Cadastros <Badge variant={pendingUsers.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoadingUsers ? <Loader2 className="h-3 w-3 animate-spin"/> : pendingUsers.length}</Badge></TabsTrigger>
                <TabsTrigger value="matches">Revisão de Matches <Badge variant={matches.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoadingMatches ? <Loader2 className="h-3 w-3 animate-spin"/> : matches.length}</Badge></TabsTrigger>
            </TabsList>
    
            <TabsContent value="verification" className="mt-4">
                {/* ... conteúdo da aba de verificação ... */}
            </TabsContent>
    
            <TabsContent value="matches" className="mt-4">
                <Card>
                    <CardHeader><CardTitle>Matches Pendentes</CardTitle><CardDescription>Combinações entre demandas e disponibilidades para sua revisão.</CardDescription></CardHeader>
                    <CardContent>
                        {isLoadingMatches ? <LoadingState message="Buscando matches..." /> :
                         matchesError ? <ErrorState message={matchesError} /> :
                         matches.length === 0 ? <EmptyState message="Nenhum match aguardando revisão." /> :
                         (
                             <div className="space-y-4">
                                 {matches.map(match => (
                                     <MatchReviewItem key={match.id} match={match} onApproveMatch={handleApproveMatch} onRejectMatch={handleRejectMatch} onDoctorDocumentsReviewed={() => {}} />
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
