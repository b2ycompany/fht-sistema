// app/dashboard/proposals/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
// import type { VariantProps } from "class-variance-authority"; // Não usado diretamente aqui
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import {
  AlertTriangle, CheckCircle, XCircle, CalendarDays, Clock, MapPinIcon, DollarSign, Briefcase, Info, ChevronDown, ChevronUp, MessageSquare,
  Loader2,
  ClipboardList,
  AlertCircle, // <<< ADICIONADO
  RotateCcw   // <<< ADICIONADO
} from "lucide-react";
import {
  getPendingProposalsForDoctor,
  acceptProposal,
  rejectProposal,
  type ShiftProposal
} from "@/lib/proposal-service";
import { cn, formatCurrency } from "@/lib/utils";
import {
    AlertDialog,
    // AlertDialogAction, // Não usado diretamente
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// --- COMPONENTES DE ESTADO (Loading, Empty, Error) ---
const LoadingState = React.memo(({ message = "Carregando dados..." }: { message?: string }) => (
    <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-gray-600 mt-3">{message}</span>
    </div>
));
LoadingState.displayName = 'LoadingState';

const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: React.ReactNode }) => (
    <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full">
        <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/>
        <p className="font-medium text-gray-600 mb-1">Nada por aqui ainda!</p>
        <p className="max-w-xs">{message}</p>
        {actionButton && <div className="mt-4">{actionButton}</div>}
    </div>
));
EmptyState.displayName = 'EmptyState';

const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4"/>
        <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p>
        <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados. Por favor, tente novamente."}</p>
        {onRetry && (
            <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4 bg-red-600 hover:bg-red-700 text-white">
                <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente
            </Button>
        )}
    </div>
));
ErrorState.displayName = 'ErrorState';


interface ProposalListItemProps {
  proposal: ShiftProposal;
  onAccept: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string, reason?: string) => Promise<void>;
}

const ProposalListItem: React.FC<ProposalListItemProps> = ({ proposal, onAccept, onReject }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const firstDate = proposal.shiftDates?.[0] instanceof Timestamp ? proposal.shiftDates[0].toDate() : null;
  const displayDates = proposal.shiftDates?.map(ts => ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short'})).join(', ') || "N/A";

  const handleAccept = async () => {
    setIsAccepting(true);
    await onAccept(proposal.id);
    // O estado isAccepting será resetado se o componente for removido da lista após aceitar
    // Se não for removido imediatamente, setar setIsAccepting(false) no final.
    // Como fetchProposals() é chamado, o componente pode re-renderizar ou sumir.
  };

  const handleRejectWithReason = async () => {
    setIsRejecting(true);
    await onReject(proposal.id, rejectionReason);
    // Similar ao handleAccept, o estado pode ser resetado pela re-renderização.
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3 cursor-pointer flex flex-row justify-between items-start" onClick={() => setIsExpanded(!isExpanded)}>
        <div>
          <CardTitle className="text-lg mb-1">{proposal.hospitalName}</CardTitle>
          <CardDescription className="text-xs flex items-center">
            <MapPinIcon className="inline h-3 w-3 mr-1 text-gray-500" />{proposal.hospitalCity}, {proposal.hospitalState}
          </CardDescription>
        </div>
        {isExpanded ? <ChevronUp size={20} className="text-gray-500"/> : <ChevronDown size={20} className="text-gray-500"/>}
      </CardHeader>
      
      <CardContent className="text-sm pt-0 pb-3 border-b">
        <div className="flex items-center mb-1">
            <CalendarDays className="h-4 w-4 mr-2 text-blue-600" />
            <span>{displayDates}</span>
        </div>
        <div className="flex items-center">
            <Clock className="h-4 w-4 mr-2 text-blue-600" />
            <span>{proposal.startTime} - {proposal.endTime}</span>
            {proposal.isOvernight && <Badge variant="outline" className="ml-2 text-xs">Noturno (Vira o dia)</Badge>}
        </div>
      </CardContent>

      {isExpanded && (
        <CardContent className="text-sm pt-3 pb-4 space-y-2">
          <div className="border-t pt-3">
            <div className="flex items-center mb-1"><Briefcase size={14} className="mr-2 text-cyan-600" /><strong>Tipo:</strong><span className="ml-1">{proposal.serviceType.replace(/_/g, ' ')}</span></div>
            <div className="flex items-center mb-1"><DollarSign size={14} className="mr-2 text-green-600" /><strong>Valor Hora Ofertado:</strong><span className="ml-1">{formatCurrency(proposal.offeredRateToDoctor)}</span></div>
            {proposal.specialties && proposal.specialties.length > 0 && (
              <div className="flex items-start mb-1">
                <ClipboardList size={14} className="mr-2 mt-0.5 text-purple-600 shrink-0" />
                <div className="flex-1">
                    <strong>Especialidades:</strong>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                        {proposal.specialties.map(spec => <Badge key={spec} variant="secondary" className="text-xs">{spec}</Badge>)}
                    </div>
                </div>
              </div>
            )}
            {proposal.notesFromHospital && <div className="flex items-start text-xs text-gray-600"><Info size={14} className="mr-2 mt-0.5 text-gray-500 shrink-0"/><div><strong>Obs. Hospital:</strong> {proposal.notesFromHospital}</div></div>}
            {proposal.notesFromBackoffice && <div className="flex items-start text-xs text-gray-600 mt-1"><Info size={14} className="mr-2 mt-0.5 text-gray-500 shrink-0"/><div><strong>Obs. Plataforma:</strong> {proposal.notesFromBackoffice}</div></div>}
            {proposal.deadlineForDoctorResponse && <div className="flex items-start text-xs text-amber-700 mt-1 font-medium"><AlertTriangle size={14} className="mr-2 mt-0.5 text-amber-600 shrink-0"/><div>Responder até: {proposal.deadlineForDoctorResponse.toDate().toLocaleDateString('pt-BR', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}</div></div>}
          </div>
        </CardContent>
      )}
      <CardFooter className="flex justify-end gap-2 pt-4">
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isAccepting || isRejecting}>
                    <XCircle className="mr-2 h-4 w-4" /> Recusar
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Recusa da Proposta?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Por favor, informe o motivo da recusa (opcional). Esta informação nos ajuda a melhorar as sugestões futuras.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                    placeholder="Motivo da recusa (opcional)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="min-h-[80px]"
                />
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isRejecting}>Voltar</AlertDialogCancel>
                    <Button variant="destructive" onClick={handleRejectWithReason} disabled={isRejecting}>
                        {isRejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Recusa
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <Button onClick={handleAccept} size="sm" className="bg-green-600 hover:bg-green-700" disabled={isAccepting || isRejecting}>
          {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <CheckCircle className="mr-2 h-4 w-4" /> Aceitar Proposta
        </Button>
      </CardFooter>
    </Card>
  );
};
ProposalListItem.displayName = "ProposalListItem";


export default function DoctorProposalsPage() {
  const { toast } = useToast();
  const [proposals, setProposals] = useState<ShiftProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getPendingProposalsForDoctor();
      setProposals(data.sort((a,b) => (a.deadlineForDoctorResponse?.toDate().getTime() || Infinity) - (b.deadlineForDoctorResponse?.toDate().getTime() || Infinity) || a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()));
      console.log("[DoctorProposalsPage] Propostas recebidas:", data.length);
    } catch (err: any) {
      console.error("[DoctorProposalsPage] Erro ao buscar propostas:", err);
      setError(err.message || "Falha ao carregar propostas.");
      toast({ title: "Erro ao Carregar Propostas", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleAccept = async (proposalId: string) => {
    try {
      await acceptProposal(proposalId);
      toast({ title: "Proposta Aceita!", description: "O hospital será notificado.", variant: "default" });
      fetchProposals();
    } catch (err: any) {
      toast({ title: "Erro ao Aceitar", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (proposalId: string, reason?: string) => {
    try {
      await rejectProposal(proposalId, reason);
      toast({ title: "Proposta Recusada", variant: "default" });
      fetchProposals();
    } catch (err: any) {
      toast({ title: "Erro ao Recusar", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
            <MessageSquare size={28}/> Propostas Recebidas
        </h1>
      </div>

      {isLoading && <LoadingState message="Buscando propostas para você..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={fetchProposals} />}
      {!isLoading && !error && proposals.length === 0 && (
        <EmptyState message="Você não tem nenhuma proposta pendente no momento." />
      )}
      {!isLoading && !error && proposals.length > 0 && (
        <div className="space-y-4">
          {proposals.map(proposal => (
            <ProposalListItem
              key={proposal.id}
              proposal={proposal}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}