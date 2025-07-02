"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getContractsForHospital, signContractByHospital, type Contract } from '@/lib/contract-service';
import { ContractCard } from "@/components/shared/ContractCard";
import { AlertTriangle, ClipboardList, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ message }: { message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{message}</p></div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="text-base font-semibold text-red-700 mb-1">Oops!</p><p>{message || "Não foi possível carregar."}</p>{onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}</div> ));


export default function HospitalContractsPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("pending");
    const [pendingContracts, setPendingContracts] = useState<Contract[]>([]);
    const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAllContracts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [pendingData, activeData] = await Promise.all([
                getContractsForHospital(['PENDING_HOSPITAL_SIGNATURE']),
                getContractsForHospital(['ACTIVE_SIGNED', 'COMPLETED'])
            ]);
            setPendingContracts(pendingData);
            setActiveContracts(activeData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchAllContracts(); }, [fetchAllContracts]);

    const handleSignContract = async (contractId: string) => {
        try {
            await signContractByHospital(contractId);
            toast({ title: "Contrato Assinado!", description: "O contrato foi finalizado com sucesso."});
            fetchAllContracts();
            setActiveTab('active');
        } catch (error: any) {
            toast({ title: "Erro ao assinar", description: error.message, variant: "destructive" });
        }
    };
    
    const renderContent = (contracts: Contract[]) => {
        if (isLoading) return <LoadingState />;
        if (error) return <ErrorState message={error || ""} onRetry={fetchAllContracts} />;
        if (contracts.length === 0) return <EmptyState message="Nenhum contrato nesta categoria." />;
        
        return (
            <div className="space-y-4">
                {contracts.map(c => <ContractCard key={c.id} contract={c} onSign={handleSignContract} userType="hospital" />)}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Contratos</h1>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending">Contratos Pendentes <Badge variant="destructive" className="ml-2">{pendingContracts.length}</Badge></TabsTrigger>
                    <TabsTrigger value="active">Contratos Ativos <Badge className="ml-2">{activeContracts.length}</Badge></TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="mt-4">{renderContent(pendingContracts)}</TabsContent>
                <TabsContent value="active" className="mt-4">{renderContent(activeContracts)}</TabsContent>
            </Tabs>
        </div>
    );
}