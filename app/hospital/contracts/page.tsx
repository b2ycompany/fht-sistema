// app/hospital/contracts/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ClipboardList, AlertTriangle, FileSignature, UserCheck, CalendarDays, Clock, DollarSign, Briefcase } from 'lucide-react';
import { getPendingSignatureContractsForHospital, signContractByHospital, type Contract } from '@/lib/contract-service';
import { formatCurrency } from '@/lib/utils';

const ContractItem: React.FC<{ contract: Contract, onAction: () => void }> = ({ contract, onAction }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleSign = async () => {
        setIsProcessing(true);
        try {
            await signContractByHospital(contract.id);
            toast({ title: "Contrato Assinado!", description: `O(A) Dr(a). ${contract.doctorName} foi adicionado(a) à sua equipe.`});
            onAction();
        } catch (error: any) {
            toast({ title: "Erro ao assinar", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const shiftDate = contract.shiftDates[0]?.toDate()?.toLocaleDateString('pt-BR') || 'Data inválida';

    return (
        <Card className="border-l-4 border-indigo-500 bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
                    <UserCheck size={20} className="text-indigo-600"/> Contratação Pendente: Dr(a). {contract.doctorName || 'N/A'}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                    <Briefcase size={14} />
                    Especialidades: {contract.specialties.join(', ')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-700">
                <p className="flex items-center gap-2"><CalendarDays size={14}/> <strong>Data do Plantão:</strong> {shiftDate}</p>
                <p className="flex items-center gap-2"><Clock size={14}/> <strong>Horário:</strong> {contract.startTime} - {contract.endTime}</p>
                {/* MUDANÇA: Exibindo o valor que o HOSPITAL paga */}
                <p className="flex items-center gap-2 font-semibold text-red-700"><DollarSign size={14}/> <strong>Custo do Plantão:</strong> {formatCurrency(contract.hospitalRate)}/h</p>
                <p className="text-xs text-gray-600 mt-3 pt-3 border-t">O médico aceitou a proposta. A sua assinatura é necessária para formalizar a contratação.</p>
            </CardContent>
            <CardFooter className="flex justify-end bg-gray-50 p-4">
                <Button onClick={handleSign} disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-700">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
                    Visualizar e Assinar Contrato
                </Button>
            </CardFooter>
        </Card>
    );
}

// ... O resto do componente HospitalContractsPage permanece igual ...
export default function HospitalContractsPage() {
    const { user, loading: authLoading } = useAuth();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchContracts = useCallback(async () => {
        if (user) {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getPendingSignatureContractsForHospital();
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
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600"/> <span className="ml-3 text-gray-600">A carregar contratos...</span></div>;
    }

    if (error) {
        return <div className="text-center text-red-500 p-10 bg-red-50 rounded-lg"><AlertTriangle className="mx-auto h-12 w-12 text-red-400"/><p className="mt-4 font-semibold">Falha ao carregar</p><p className="mt-1 text-sm">{error}</p></div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Contratos para Assinatura</h1>
            {contracts.length === 0 ? (
                <div className="text-center text-gray-500 p-10 border-2 border-dashed rounded-lg bg-gray-50">
                    <ClipboardList className="mx-auto h-12 w-12 text-gray-400"/>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum contrato pendente</h3>
                    <p className="mt-1 text-sm text-gray-500">Quando um médico aceitar uma proposta, o contrato para sua assinatura aparecerá aqui.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {contracts.map(c => <ContractItem key={c.id} contract={c} onAction={fetchContracts} />)}
                </div>
            )}
        </div>
    );
}