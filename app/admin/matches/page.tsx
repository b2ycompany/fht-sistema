// app/admin/matches/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent, FC, SVGProps } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import { 
    CheckCircle, XCircle, Eye, DollarSign, Edit3, MessageSquare, Loader2, RotateCcw, ClipboardList, Users, Briefcase, CalendarDays, Clock, MapPinIcon, ChevronDown, ChevronUp, 
    AlertTriangle as LucideAlertTriangle, ShieldCheck 
} from 'lucide-react';
import {
  getMatchesForBackofficeReview,
  approveMatchAndProposeToDoctor,
  rejectMatchByBackoffice,
  type PotentialMatch
} from "@/lib/match-service"; // VERIFICAR CAMINHO
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";

// --- COMPONENTES DE ESTADO (Loading, Empty, Error) ---
const LoadingState = React.memo(({ message = "Carregando dados..." }: { message?: string }) => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <span className="ml-3 text-sm text-gray-600 mt-3">{message}</span> </div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: React.ReactNode }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full"> <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/> <p className="font-medium text-gray-600 mb-1">Nada por aqui ainda!</p> <p className="max-w-xs">{message}</p> {actionButton && <div className="mt-4">{actionButton}</div>} </div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"> <LucideAlertTriangle className="w-12 h-12 text-red-400 mb-4"/> <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p> <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados."}</p> {onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"> <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente </Button> )} </div> ));
ErrorState.displayName = 'ErrorState';


interface MatchReviewItemProps {
  match: PotentialMatch;
  onApprove: (matchId: string, negotiatedRate: number, notes?: string) => Promise<void>;
  onReject: (matchId: string, notes: string) => Promise<void>;
}

const MatchReviewItem: React.FC<MatchReviewItemProps> = ({ match, onApprove, onReject }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [negotiatedRate, setNegotiatedRate] = useState<string>(String(match.offeredRateByHospital));
  const [adminNotes, setAdminNotes] = useState(match.backofficeNotes || "");
  const [isProcessing, setIsProcessing] = useState(false);

  const displayShiftDates = Array.isArray(match.shiftRequirementDates)
    ? match.shiftRequirementDates.map((ts: Timestamp) => ts.toDate().toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})).join(', ')
    : "N/A";

  const handleApprove = async () => {
    const rate = parseFloat(negotiatedRate);
    if (isNaN(rate) || rate <= 0) { alert("Por favor, insira uma tarifa válida para o médico."); return; }
    setIsProcessing(true);
    if (match.id) await onApprove(match.id, rate, adminNotes);
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (!adminNotes.trim()) { alert("Por favor, forneça uma justificativa para a rejeição."); return; }
    setIsProcessing(true);
    if (match.id) await onReject(match.id, adminNotes);
    setIsProcessing(false);
  };
  
  return (
    <Card className="shadow-md bg-white">
      <CardHeader className="cursor-pointer p-4" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-base font-semibold">Match: {match.hospitalName} & Dr(a). {match.doctorName}</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                    Demanda ID: {match.shiftRequirementId} | Disp. ID: {match.timeSlotId}
                </CardDescription>
            </div>
            {isExpanded ? <ChevronUp size={18} className="text-gray-400"/> : <ChevronDown size={18} className="text-gray-400"/>}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="text-sm pt-2 pb-4 px-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 border-t pt-3">
              <div className="space-y-1">
                  <h4 className="font-medium text-gray-600 text-xs uppercase tracking-wider">Demanda do Hospital</h4>
                  <p className="text-xs flex items-center"><Users size={12} className="mr-1.5"/> {match.numberOfVacanciesInRequirement} vaga(s)</p>
                  <p className="text-xs flex items-center"><CalendarDays size={12} className="mr-1.5"/> {displayShiftDates}</p>
                  <p className="text-xs flex items-center"><Clock size={12} className="mr-1.5"/> {match.shiftRequirementStartTime} - {match.shiftRequirementEndTime} {match.shiftRequirementIsOvernight && "(vira o dia)"}</p>
                  <p className="text-xs flex items-center"><Briefcase size={12} className="mr-1.5"/> {match.shiftRequirementSpecialties.join(', ')}</p>
                  <p className="text-xs flex items-center"><DollarSign size={12} className="mr-1.5"/> Ofertado pelo Hospital: <span className="font-semibold">{formatCurrency(match.offeredRateByHospital)}/hora</span></p>
                  {match.shiftRequirementNotes && <p className="text-xs italic text-gray-500 mt-1">Obs. Hospital: {match.shiftRequirementNotes}</p>}
              </div>
              <div className="space-y-1">
                  <h4 className="font-medium text-gray-600 text-xs uppercase tracking-wider">Disponibilidade do Médico</h4>
                  <p className="text-xs flex items-center"><CalendarDays size={12} className="mr-1.5"/> {match.timeSlotDate.toDate().toLocaleDateString('pt-BR',  { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  <p className="text-xs flex items-center"><Clock size={12} className="mr-1.5"/> {match.timeSlotStartTime} - {match.timeSlotEndTime} {match.timeSlotIsOvernight && "(vira o dia)"}</p>
                  <p className="text-xs flex items-center"><Briefcase size={12} className="mr-1.5"/> {match.doctorSpecialties.join(', ')}</p>
                  <p className="text-xs flex items-center"><DollarSign size={12} className="mr-1.5"/> Desejado pelo Médico: <span className="font-semibold">{formatCurrency(match.doctorDesiredRate)}/hora</span></p>
              </div>
          </div>
            <div className="border-t pt-3 mt-3 space-y-2">
                <div>
                    <Label htmlFor={`negotiatedRate-${match.id}`} className="text-xs font-medium">Tarifa a Propor ao Médico (R$/hora)*</Label>
                    <Input 
                        id={`negotiatedRate-${match.id}`}
                        type="number" 
                        value={negotiatedRate} 
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNegotiatedRate(e.target.value)}
                        className="h-8 text-sm mt-1"
                        min="0"
                        step="0.01"
                        disabled={isProcessing}
                    />
                </div>
                <div>
                    <Label htmlFor={`adminNotes-${match.id}`} className="text-xs font-medium">Notas Internas / Justificativa para Rejeição*</Label>
                    <Textarea 
                        id={`adminNotes-${match.id}`}
                        value={adminNotes} 
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAdminNotes(e.target.value)}
                        placeholder="Notas para aprovação ou motivo obrigatório para rejeição..."
                        className="text-sm min-h-[60px] mt-1"
                        disabled={isProcessing}
                    />
                </div>
            </div>
        </CardContent>
      )}
      <CardFooter className="flex justify-end gap-2 border-t pt-3 pb-3 px-4">
        <Button variant="destructive" size="sm" onClick={handleReject} disabled={isProcessing || !adminNotes.trim()}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <XCircle className="mr-2 h-4 w-4"/> Rejeitar Match
        </Button>
        <Button onClick={handleApprove} size="sm" className="bg-green-600 hover:bg-green-700" disabled={isProcessing || parseFloat(negotiatedRate) <= 0}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle className="mr-2 h-4 w-4"/> Aprovar e Propor ao Médico
        </Button>
      </CardFooter>
    </Card>
  );
};
MatchReviewItem.displayName = "MatchReviewItem";

export default function AdminMatchesPage() {
  const { toast } = useToast();
  const [matches, setMatches] = useState<PotentialMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMatchesForBackofficeReview();
      setMatches(data);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar matches.");
      toast({ title: "Erro ao Carregar Matches", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleApproveMatch = async (matchId: string, negotiatedRate: number, notes?: string) => {
    try {
      await approveMatchAndProposeToDoctor(matchId, negotiatedRate, notes);
      toast({ title: "Match Aprovado!", variant: "default" });
      fetchMatches();
    } catch (err: any) { toast({ title: "Erro ao Aprovar", description: err.message, variant: "destructive" }); }
  };

  const handleRejectMatch = async (matchId: string, adminNotes: string) => {
    try {
      await rejectMatchByBackoffice(matchId, adminNotes);
      toast({ title: "Match Rejeitado", variant: "default" });
      fetchMatches();
    } catch (err: any) { toast({ title: "Erro ao Rejeitar", description: err.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
            <ShieldCheck size={28}/> Revisão de Matches Pendentes
        </h1>
        <Button variant="outline" size="sm" onClick={fetchMatches} disabled={isLoading}>
            <RotateCcw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")}/> Atualizar Lista
        </Button>
      </div>

      {isLoading && <LoadingState message="Buscando matches..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={fetchMatches} />}
      {!isLoading && !error && matches.length === 0 && ( <EmptyState message="Nenhum match aguardando revisão." /> )}
      {!isLoading && !error && matches.length > 0 && (
        <div className="space-y-4">
          {matches.map(match => (
            <MatchReviewItem
              key={match.id}
              match={match}
              onApprove={handleApproveMatch}
              onReject={handleRejectMatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}