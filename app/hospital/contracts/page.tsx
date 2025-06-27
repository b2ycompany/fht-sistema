// app/hospital/contracts/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
// --- CORREÇÃO FINAL DE CAMINHO ---
// O caminho foi ajustado para refletir a estrutura da sua pasta de componentes.
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ClipboardList, AlertTriangle, FileSignature, UserCheck, CalendarDays, Clock, DollarSign, User } from 'lucide-react';
import { getPendingContractsForHospital, signContractByHospital } from '@/lib/contract-service';
import type { ShiftProposal } from '@/lib/proposal-service';
import { formatCurrency } from '@/lib/utils';

const ContractItem: React.FC<{ proposal: ShiftProposal, onAction: () => void }> = ({ proposal, onAction }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleSign = async () => {
        setIsProcessing(true);
        try {
            await signContractByHospital(proposal.id);
            toast({ title: "Contrato Assinado!", description: `O(A) Dr(a). ${proposal.doctorName} foi adicionado(a) à sua equipe para este plantão.`});
            onAction();
        } catch (error: any) {
            toast({ title: "Erro ao assinar", description: error.message, variant: "destructive" });
            setIsProcessing(false);
        }
    };

    return (
        <Card className="border-l-4 border-indigo-500">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserCheck size={20}/> Contratação Pendente: Dr(a). {proposal.doctorName || 'N/A'}</CardTitle>
                <CardDescription>Especialidades: {proposal.specialties.join(', ')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><CalendarDays size={14}/> <strong>Data do Plantão:</strong> {proposal.shiftDates[0].toDate().toLocaleDateString('pt-BR')}</p>
                <p className="flex items-center gap-2"><Clock size={14}/> <strong>Horário:</strong> {proposal.startTime} - {proposal.endTime}</p>
                <p className="flex items-center gap-2"><DollarSign size={14}/> <strong>Valor Acordado:</strong> {formatCurrency(proposal.offeredRateToDoctor)}/h</p>
                <p className="text-xs text-gray-600 mt-3 pt-3 border-t">O médico aceitou a proposta. A sua assinatura é necessária para visualizar o contrato e formalizar a contratação para este plantão.</p>
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button onClick={handleSign} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
                    Visualizar e Assinar Contrato
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function HospitalContractsPage() {
    const { user, loading: authLoading } = useAuth();
    const [contracts, setContracts] = useState<ShiftProposal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchContracts = useCallback(async () => {
        if (user) {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getPendingContractsForHospital(user.uid);
                setContracts(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchContracts();
        }
    }, [user, authLoading, fetchContracts]);
    
    if (authLoading || isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>;
    }

    if (error) {
        return <div className="text-center text-red-500 p-10"><AlertTriangle className="mx-auto h-12 w-12 text-red-400"/><p className="mt-4">{error}</p></div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Contratos para Assinatura</h1>
            {contracts.length === 0 ? (
                <div className="text-center text-gray-500 p-10 border-2 border-dashed rounded-lg">
                    <ClipboardList className="mx-auto h-12 w-12 text-gray-400"/>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum contrato pendente</h3>
                    <p className="mt-1 text-sm text-gray-500">Quando um médico aceitar uma proposta, o contrato para sua assinatura aparecerá aqui.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {contracts.map(c => <ContractItem key={c.id} proposal={c} onAction={fetchContracts} />)}
                </div>
            )}
        </div>
    );
}