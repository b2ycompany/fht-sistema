// app/dashboard/contracts/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import { FileText, CheckSquare, Edit, AlertTriangle, Loader2, CalendarDays, Clock, MapPinIcon, DollarSign, Briefcase, Info, RotateCcw, ClipboardList, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { getContractsForDoctor, signContractByDoctor, type Contract } from "@/lib/contract-service";
import { cn, formatCurrency } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import Link from "next/link";

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><span className="ml-3 text-sm text-gray-600 mt-3">{message}</span></div> ));
const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: React.ReactNode }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">Nada por aqui ainda!</p><p className="max-w-xs">{message}</p>{actionButton && <div className="mt-4">{actionButton}</div>}</div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="font-semibold text-red-700 mb-1 text-base">Oops!</p><p className="max-w-md text-red-600">{message || "Não foi possível carregar."}</p>{onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente</Button> )}</div> ));

const ContractListItem: React.FC<{ contract: Contract; onSign: (contractId: string) => Promise<void>; }> = ({ contract, onSign }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const displayShiftDates = Array.isArray(contract.shiftDates) ? contract.shiftDates.map((ts: Timestamp) => ts.toDate().toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})).join(', ') : "Datas não disponíveis";
  const handleSign = async () => { setIsSigning(true); try { await onSign(contract.id); } finally { setIsSigning(false); } };
  const getStatusBadgeStyle = (status?: Contract['status']): { variant: BadgeProps["variant"], className: string } => { switch(status) { case 'PENDING_DOCTOR_SIGNATURE': return { variant: 'secondary', className: 'bg-amber-100 text-amber-800 border-amber-300' }; case 'PENDING_HOSPITAL_SIGNATURE': return { variant: 'secondary', className: 'bg-sky-100 text-sky-800 border-sky-300' }; case 'ACTIVE_SIGNED': return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-300' }; default: return { variant: 'outline', className: '' }; } };
  const statusBadgeInfo = getStatusBadgeStyle(contract.status);

  return (
    <Card className="shadow-sm hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3 cursor-pointer flex flex-row justify-between items-start" onClick={() => setIsExpanded(!isExpanded)}>
        <div><CardTitle className="text-md mb-1">Contrato com: {contract.hospitalName}</CardTitle><CardDescription className="text-xs flex items-center"><MapPinIcon className="inline h-3 w-3 mr-1" />{contract.locationCity}, {contract.locationState}</CardDescription></div>
        {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
      </CardHeader>
      <CardContent className="text-sm pt-0 pb-3 border-b">
        <div className="flex items-center mb-1"><CalendarDays className="h-4 w-4 mr-2" /><span>{displayShiftDates}</span></div>
        <div className="flex items-center"><Clock className="h-4 w-4 mr-2" /><span>{contract.startTime} - {contract.endTime}</span></div>
      </CardContent>
      <CardFooter className="flex justify-between items-center border-t pt-4">
        <Badge variant={statusBadgeInfo.variant} className={cn("capitalize", statusBadgeInfo.className)}>{contract.status.replace(/_/g, ' ').toLowerCase()}</Badge>
        {contract.status === 'PENDING_DOCTOR_SIGNATURE' && (
            <AlertDialog>
                <AlertDialogTrigger asChild><Button size="sm" className="bg-green-600 hover:bg-green-700"><Edit className="mr-2 h-4 w-4" /> Rever e Assinar</Button></AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Revisão Final do Contrato</AlertDialogTitle><AlertDialogDescription>Confirme os detalhes abaixo para assinar digitalmente.</AlertDialogDescription></AlertDialogHeader>
                    <div className="text-sm space-y-2 my-4 p-2">
                        <p><strong>Hospital:</strong> {contract.hospitalName}</p>
                        <p><strong>Data:</strong> {displayShiftDates}</p>
                        <p><strong>Valor:</strong> <span className="font-bold">{formatCurrency(contract.contractedRate)}/h</span></p>
                    </div>
                    <AlertDialogFooter><AlertDialogCancel disabled={isSigning}>Voltar</AlertDialogCancel><AlertDialogAction onClick={handleSign} disabled={isSigning}>{isSigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Assinatura"}</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
};

export default function DoctorContractsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending_doctor");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async (tab: string) => {
    setIsLoading(true); setError(null);
    let statusesToFetch: Contract['status'][] = [];
    if (tab === 'pending_doctor') statusesToFetch = ['PENDING_DOCTOR_SIGNATURE'];
    if (tab === 'pending_hospital') statusesToFetch = ['PENDING_HOSPITAL_SIGNATURE'];
    if (tab === 'active') statusesToFetch = ['ACTIVE_SIGNED'];
    try { const data = await getContractsForDoctor(statusesToFetch); setContracts(data); }
    catch (err: any) { setError(err.message || "Falha ao carregar contratos."); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => { fetchContracts(activeTab); }, [activeTab, fetchContracts]);

  const handleSign = async (contractId: string) => {
    try {
      await signContractByDoctor(contractId);
      toast({ title: "Contrato Assinado!", description: "Enviado ao hospital para assinatura final." });
      fetchContracts(activeTab);
    } catch (err: any) {
      toast({ title: "Erro ao Assinar", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Meus Contratos</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending_doctor">Minha Assinatura</TabsTrigger>
          <TabsTrigger value="pending_hospital">Aguardando Hospital</TabsTrigger>
          <TabsTrigger value="active">Contratos Ativos</TabsTrigger>
        </TabsList>
        <div className="mt-4">
            {isLoading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => fetchContracts(activeTab)} /> : contracts.length === 0 ? <EmptyState message="Nenhum contrato nesta categoria." /> : <div className="space-y-4">{contracts.map(c => <ContractListItem key={c.id} contract={c} onSign={handleSign} />)}</div> }
        </div>
      </Tabs>
    </div>
  );
}