// app/hospital/contracts/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ClipboardList, AlertTriangle, FileSignature, UserCheck, CalendarDays, Clock, DollarSign, Briefcase, RotateCcw, Edit } from 'lucide-react';
import { getContractsForHospital, signContractByHospital, type Contract } from '@/lib/contract-service';
import { formatCurrency } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ message }: { message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{message}</p></div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="text-base font-semibold text-red-700 mb-1">Oops!</p><p>{message || "Não foi possível carregar."}</p>{onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}</div> ));

const ContractItem: React.FC<{ contract: Contract, onAction: () => void }> = ({ contract, onAction }) => {
    const [isSigning, setIsSigning] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { toast } = useToast();

    const handleConfirmSignature = async () => {
        setIsSigning(true);
        try {
            await signContractByHospital(contract.id);
            toast({ title: "Contrato Assinado!", description: `O(A) Dr(a). ${contract.doctorName} foi adicionado(a) à sua equipe.`});
            setIsModalOpen(false);
            onAction();
        } catch (error: any) {
            toast({ title: "Erro ao assinar", description: error.message, variant: "destructive" });
        } finally {
            setIsSigning(false);
        }
    };

    const shiftDate = contract.shiftDates[0]?.toDate()?.toLocaleDateString('pt-BR') || 'Data inválida';

    return (
        <Card className="border-l-4 border-indigo-500 bg-white shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
                    <UserCheck size={20} className="text-indigo-600"/> Contrato com Dr(a). {contract.doctorName || 'N/A'}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                    <Briefcase size={14} /> Especialidades: {contract.specialties.join(', ')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-700">
                <p><CalendarDays size={14} className="inline mr-2"/><strong>Data:</strong> {shiftDate}</p>
                <p><Clock size={14} className="inline mr-2"/><strong>Horário:</strong> {contract.startTime} - {contract.endTime}</p>
                <p className="font-semibold text-red-700"><DollarSign size={14} className="inline mr-2"/><strong>Seu Custo:</strong> {formatCurrency(contract.hospitalRate)}/h</p>
            </CardContent>
            {contract.status === 'PENDING_HOSPITAL_SIGNATURE' && (
              <CardFooter className="flex justify-end bg-gray-50 p-3">
                  <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setIsModalOpen(true)}>
                          <Edit className="mr-2 h-4 w-4" /> Rever e Assinar Contrato
                      </Button>
                      <AlertDialogContent className="max-w-4xl h-[90vh] flex flex-col">
                          <AlertDialogHeader>
                              <AlertDialogTitle>Revisão e Assinatura do Contrato</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Reveja o documento oficial do contrato. A sua assinatura será registada ao clicar em "Confirmar Assinatura".
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="flex-grow my-4 border rounded-md overflow-hidden bg-gray-200">
                              {contract.contractPdfUrl ? 
                                <iframe src={contract.contractPdfUrl} className="w-full h-full" title="Contrato PDF"/> : 
                                <ErrorState message="URL do documento não encontrada. O médico pode precisar de gerar o documento primeiro."/>
                              }
                          </div>
                          <AlertDialogFooter>
                              <AlertDialogCancel disabled={isSigning}>Voltar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleConfirmSignature} disabled={isSigning || !contract.contractPdfUrl} className="bg-indigo-600 hover:bg-indigo-700">
                                  {isSigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Assinatura"}
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </CardFooter>
            )}
        </Card>
    );
}

export default function HospitalContractsPage() {
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

    useEffect(() => {
        fetchAllContracts();
    }, [fetchAllContracts]);
    
    const renderContent = (contracts: Contract[], type: 'pending' | 'active') => {
        if (isLoading) return <LoadingState />;
        if (error) return <ErrorState message={error || ""} onRetry={fetchAllContracts} />;
        if (contracts.length === 0) return <EmptyState message={`Nenhum contrato ${type === 'pending' ? 'pendente' : 'ativo'}.`} />;
        
        return (
            <div className="space-y-4">
                {contracts.map(c => <ContractItem key={c.id} contract={c} onAction={fetchAllContracts}/>)}
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
                <TabsContent value="pending" className="mt-4">{renderContent(pendingContracts, 'pending')}</TabsContent>
                <TabsContent value="active" className="mt-4">{renderContent(activeContracts, 'active')}</TabsContent>
            </Tabs>
        </div>
    );
}