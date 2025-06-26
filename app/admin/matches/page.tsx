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

// --- SEUS COMPONENTES AUXILIARES INTACTOS ---
const LoadingState = React.memo(({ message = "Carregando dados..." }: { message?: string }) => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <span className="ml-3 text-sm text-gray-600 mt-3">{message}</span> </div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: ReactNode }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full"> <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/> <p className="font-medium text-gray-600 mb-1">Nada por aqui ainda!</p> <p className="max-w-xs">{message}</p> {actionButton && <div className="mt-4">{actionButton}</div>} </div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"> <LucideAlertTriangle className="w-12 h-12 text-red-400 mb-4"/> <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p> <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados."}</p> {onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"> <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente </Button> )} </div> ));
ErrorState.displayName = 'ErrorState';

const DOC_LABELS: Record<string, string> = { personalRg: "RG Pessoal", personalCpf: "CPF Pessoal", professionalCrm: "CRM", photo3x4: "Foto 3x4", addressProof: "Compr. Endereço", graduationCertificate: "Cert. Graduação", criminalRecordCert: "Cert. Neg. Criminal", ethicalCert: "Cert. Neg. Ética", debtCert: "Cert. Neg. Débitos CRM", cv: "Currículo Vitae", rqe: "RQE", postGradCert: "Cert. Pós/Residência", specialistTitle: "Título Especialista", recommendationLetter: "Carta Recomendação", socialContract: "Contrato Social", cnpjCard: "Cartão CNPJ", companyAddressProof: "Comprovante Endereço Empresa", repRg: "RG do Responsável", repCpf: "CPF do Responsável", repAddressProof: "Comprovante Endereço Responsável" };
type AllDocKeys = keyof typeof DOC_LABELS;
type ButtonVariant = VariantProps<typeof Button>["variant"];

const getStatusBadgeProps = (status?: ProfileStatus): { variant: BadgeProps["variant"], className?: string } => { /* ... sua função mantida ... */ return { variant: "secondary" }};
const VerificationSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => { /* ... seu componente mantido ... */ return <></>};
const UserVerificationItem: React.FC<{ user: UserProfile; onAction: (userId: string, status: ProfileStatus, notes: string) => Promise<void>; }> = ({ user, onAction }) => { /* ... seu componente completo mantido ... */ return <></>};
UserVerificationItem.displayName = "UserVerificationItem";

// --- CORREÇÃO: Propriedade 'onDoctorDocumentsReviewed' tornada opcional ---
interface MatchReviewItemProps {
  match: PotentialMatch;
  onApproveMatch: (matchId: string, negotiatedRate: number, notes?: string) => Promise<void>;
  onRejectMatch: (matchId: string, notes: string) => Promise<void>;
  onDoctorDocumentsReviewed?: (doctorId: string) => void;
}
const MatchReviewItem: React.FC<MatchReviewItemProps> = ({ match, onApproveMatch, onRejectMatch, onDoctorDocumentsReviewed }) => {
    // ... seu componente completo de 200+ linhas vai aqui ...
    return <Card></Card>; // Placeholder para o seu componente completo
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

    const handleActionComplete = useCallback(() => { /* ... sua função mantida ... */ }, [toast]);
    
    useEffect(() => { /* ... sua lógica de onSnapshot mantida ... */ }, []);

    const handleApproveMatch = async (matchId: string, negotiatedRate: number, notes?: string) => { /* ... sua função mantida ... */ };
    const handleRejectMatch = async (matchId: string, adminNotes: string) => { /* ... sua função mantida ... */ };
    const handleUserVerification = async (userId: string, status: ProfileStatus, notes: string) => { /* ... sua função mantida ... */ };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">{/* ... seu JSX mantido ... */}</div>
  
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">{/* ... seu JSX mantido ... */}</TabsList>
  
          <TabsContent value="verification" className="mt-4">
              <Card>
                  <CardHeader>{/* ... seu JSX mantido ... */}</CardHeader>
                  <CardContent>
                      {isLoadingUsers ? <LoadingState /> :
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
                  <CardHeader><CardTitle>Matches Pendentes</CardTitle><CardDescription>Combinações para sua revisão.</CardDescription></CardHeader>
                  <CardContent>
                      {isLoadingMatches ? <LoadingState /> :
                       matchesError ? <ErrorState message={matchesError} onRetry={handleActionComplete} /> :
                       matches.length === 0 ? <EmptyState message="Nenhum match aguardando revisão." /> :
                       (
                           <div className="space-y-4">
                               {matches.map(match => (
                                   // --- CORREÇÃO: Passando a prop que faltava ---
                                   <MatchReviewItem 
                                       key={match.id} 
                                       match={match} 
                                       onApproveMatch={handleApproveMatch} 
                                       onRejectMatch={handleRejectMatch}
                                       onDoctorDocumentsReviewed={handleActionComplete} // Passando a prop agora
                                   />
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
