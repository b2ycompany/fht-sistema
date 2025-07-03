"use client";

import React, { useState, useEffect, useCallback } from 'react';
// REMOVIDO: a importação do useAuth não é necessária aqui, mas não causa problema.
// import { useAuth } from '@/components/auth-provider'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge"; // REMOVIDO: type BadgeProps
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ClipboardList, AlertTriangle, RotateCcw } from 'lucide-react'; // REMOVIDOS: Ícones do ContractItem local
import { getContractsForHospital, signContractByHospital, type Contract } from '@/lib/contract-service';
// REMOVIDO: importações do AlertDialog, Timestamp, cn, formatCurrency, que agora estão dentro do ContractCard
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"; // Mantido para referência, mas não será usado diretamente aqui
import { ContractCard } from '@/components/shared/ContractCard'; // ADICIONADO: A importação do componente correto

// --- Componentes de Estado (Loading, Empty, Error) permanecem os mesmos ---
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => (
    <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-sm text-gray-600">{message}</p>
    </div>
));
LoadingState.displayName = 'LoadingState';

const EmptyState = React.memo(({ message }: { message: string; }) => (
    <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed">
        <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/>
        <p className="font-medium text-gray-600 mb-1">{message}</p>
    </div>
));
EmptyState.displayName = 'EmptyState';

const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4"/>
        <p className="text-base font-semibold text-red-700 mb-1">Oops!</p>
        <p>{message || "Não foi possível carregar."}</p>
        {onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}
    </div>
));
ErrorState.displayName = 'ErrorState';

// REMOVIDO: O componente local "ContractItem" foi completamente removido daqui.
// A lógica agora está centralizada no componente partilhado "ContractCard".

export default function HospitalContractsPage() {
    const [activeTab, setActiveTab] = useState("pending");
    const [pendingContracts, setPendingContracts] = useState<Contract[]>([]);
    const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // REMOVIDO: Os estados selectedContract e isSigning não são mais necessários aqui.
    // const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    // const [isSigning, setIsSigning] = useState(false);

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

    useEffect(() => {
        fetchAllContracts();
    }, [fetchAllContracts]);

    // REMOVIDO: A função handleOpenModal não é mais necessária.

    // ALTERADO: A função de assinatura foi simplificada para corresponder à nova estrutura.
    const handleSignContract = async (contractId: string) => {
        try {
            await signContractByHospital(contractId);
            toast({ title: "Contrato Assinado!", description: "O médico foi notificado e o plantão está confirmado." });
            await fetchAllContracts(); // Recarrega os dados
            setActiveTab('active'); // Muda para a aba de ativos
        } catch (error: any) {
            toast({ title: "Erro ao assinar", description: error.message, variant: "destructive" });
        }
    };
    
    // ALTERADO: A função renderContent agora usa o componente <ContractCard />
    const renderContent = (contracts: Contract[]) => {
        if (isLoading) return <LoadingState />;
        if (error) return <ErrorState message={error || ""} onRetry={fetchAllContracts} />;
        if (contracts.length === 0) return <EmptyState message="Nenhum contrato nesta categoria." />;
        
        return (
            <div className="space-y-4">
                {contracts.map(c => (
                    <ContractCard 
                        key={c.id} 
                        contract={c} 
                        onSign={handleSignContract} 
                        userType="hospital" 
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Contratos</h1>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending">Contratos Pendentes <Badge variant={pendingContracts.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoading ? '...' : pendingContracts.length}</Badge></TabsTrigger>
                    <TabsTrigger value="active">Contratos Ativos <Badge variant="secondary" className="ml-2">{isLoading ? '...' : activeContracts.length}</Badge></TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="mt-4">
                    {renderContent(pendingContracts)}
                </TabsContent>
                <TabsContent value="active" className="mt-4">
                    {renderContent(activeContracts)}
                </TabsContent>
            </Tabs>

            {/* REMOVIDO: O AlertDialog que estava aqui foi removido, pois o ContractCard agora tem o seu próprio. */}
        </div>
    );
}