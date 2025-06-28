// app/dashboard/proposals/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import {
    Loader2,
    ClipboardList,
    AlertTriangle as AlertCircle,
    RotateCcw,
    MessageSquare,
    Check,
    X,
    FileSignature,
    Building,
    CalendarDays,
    Clock,
    DollarSign,
    Info,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import {
  getPendingProposalsForDoctor,
  acceptProposal,
  rejectProposal,
  type ShiftProposal
} from "@/lib/proposal-service";
import { formatCurrency } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction, // <<< CORREÇÃO: ADICIONADO AQUI
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
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => (
    <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="ml-3">{message}</p>
    </div>
));
LoadingState.displayName = 'LoadingState';

const EmptyState = React.memo(({ message }: { message: string }) => (
    <div className="text-center text-gray-500 p-10 border-2 border-dashed rounded-lg">
        <ClipboardList className="mx-auto h-12 w-12 text-gray-400"/>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma proposta pendente</h3>
        <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
));
EmptyState.displayName = 'EmptyState';

const ErrorState = React.memo(({ message, onRetry }: { message: string, onRetry?: () => void }) => (
    <div className="text-center text-red-500 p-10">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400"/>
        <p className="mt-4">{message}</p>
        {onRetry && <Button onClick={onRetry} variant="outline" className="mt-2">Tentar Novamente</Button>}
    </div>
));
ErrorState.displayName = 'ErrorState';

const ProposalCard: React.FC<{ proposal: ShiftProposal, onAction: () => void }> = ({ proposal, onAction }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [isRejecting, setIsRejecting] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleAccept = async () => {
        setIsProcessing(true);
        try {
            await acceptProposal(proposal.id);
            toast({ title: "Proposta Aceita!", description: "Sua disponibilidade foi reservada e o hospital notificado." });
            onAction();
            router.push('/dashboard/contracts');
        } catch (error: any) {
            toast({ title: "Erro ao aceitar", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            toast({ title: "Campo obrigatório", description: "Por favor, informe o motivo da rejeição.", variant: "destructive"});
            return;
        }
        setIsProcessing(true);
        try {
            await rejectProposal(proposal.id, rejectionReason);
            toast({ title: "Proposta Rejeitada" });
            onAction();
        } catch (error: any) {
            toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
            setIsRejecting(false);
        }
    };

    const proposalDate = proposal.shiftDates[0].toDate().toLocaleDateString('pt-BR');

    return (
        <Card className="shadow-sm hover:shadow-lg transition-shadow">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">Proposta de Plantão: {proposal.specialties.join(', ')}</CardTitle>
                        <CardDescription>
                            <span className="flex items-center gap-2 mt-1"><Building size={14}/> {proposal.hospitalName}</span>
                        </CardDescription>
                    </div>
                    <Badge variant="outline">Aguardando sua Resposta</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                <p className="flex items-center gap-2 text-sm"><CalendarDays size={14}/> <strong>Data:</strong> {proposalDate}</p>
                <p className="flex items-center gap-2 text-sm"><Clock size={14}/> <strong>Horário:</strong> {proposal.startTime} às {proposal.endTime}</p>
                <p className="flex items-center gap-2 text-sm font-bold text-green-600"><DollarSign size={14}/> <strong>Valor:</strong> {formatCurrency(proposal.offeredRateToDoctor)}/h</p>
                {proposal.notesFromBackoffice && (
                    <div className="text-sm p-3 bg-gray-50 rounded-md mt-2">
                        <p className="font-semibold flex items-center gap-1"><Info size={14}/> Observações do Admin:</p>
                        <p className="text-gray-600 italic pl-5">"{proposal.notesFromBackoffice}"</p>
                    </div>
                )}
                {isRejecting && (
                    <div className="pt-4">
                         <label htmlFor="rejection" className="font-semibold text-sm mb-2 block">Motivo da Rejeição (Obrigatório)</label>
                         <Textarea id="rejection" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Ex: Já tenho outro compromisso nesta data."/>
                         <div className="flex justify-end gap-2 mt-2">
                             <Button variant="ghost" size="sm" onClick={() => setIsRejecting(false)} disabled={isProcessing}>Cancelar</Button>
                             <Button variant="destructive" size="sm" onClick={handleReject} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <X/>} Confirmar Rejeição</Button>
                         </div>
                    </div>
                )}
            </CardContent>
            {!isRejecting && (
                <CardFooter className="flex justify-end gap-3">
                    <Button variant="destructive" onClick={() => setIsRejecting(true)} disabled={isProcessing}>
                        <X className="mr-2 h-4 w-4"/>Rejeitar
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button className="bg-green-600 hover:bg-green-700" disabled={isProcessing}>
                                <Check className="mr-2 h-4 w-4"/> Aceitar Proposta
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Aceite da Proposta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Ao aceitar, a sua disponibilidade para esta data será reservada e um contrato será gerado para a assinatura final do hospital.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isProcessing}>Voltar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleAccept} disabled={isProcessing}>
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : "Sim, aceito a proposta"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            )}
        </Card>
    );
};
ProposalCard.displayName = 'ProposalCard';

export default function DoctorProposalsPage() {
    const { user, loading: authLoading } = useAuth();
    const [proposals, setProposals] = useState<ShiftProposal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProposals = useCallback(async () => {
        if (user) {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getPendingProposalsForDoctor();
                setProposals(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchProposals();
        } else if (!authLoading && !user) {
            setIsLoading(false);
        }
    }, [user, authLoading, fetchProposals]);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold flex items-center gap-2"><MessageSquare />Propostas Recebidas</h1>
            {isLoading ? <LoadingState /> :
             error ? <ErrorState message={error || "Erro desconhecido"} onRetry={fetchProposals}/> :
             proposals.length === 0 ? <EmptyState message="Quando um hospital se interessar por si, a proposta aparecerá aqui." /> :
             <div className="space-y-4">{proposals.map(p => <ProposalCard key={p.id} proposal={p} onAction={fetchProposals} />)}</div>
            }
        </div>
    );
}