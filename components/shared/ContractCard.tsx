// components/shared/ContractCard.tsx
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import { useRouter } from 'next/navigation'; // Importado para redirecionamento
import { Edit, Loader2, CalendarDays, Clock, MapPinIcon, DollarSign, Briefcase, UserCheck, AlertTriangle, ClipboardList, RotateCcw, Video } from 'lucide-react';
import { type Contract, generateContractAndGetUrl, createTelemedicineRoom } from '@/lib/contract-service';
import { formatCurrency } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

// Componentes de estado (mantidos como no seu arquivo original)
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="text-base font-semibold text-red-700 mb-1">Oops!</p><p>{message || "Não foi possível carregar."}</p>{onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}</div> ));


interface ContractCardProps {
  contract: Contract;
  onSign: (contractId: string) => Promise<void>;
  userType: 'doctor' | 'hospital';
}

export const ContractCard: React.FC<ContractCardProps> = ({ contract, onSign, userType }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStartingTelemedicine, setIsStartingTelemedicine] = useState(false); // Novo estado para o botão de telemedicina
  const [pdfUrl, setPdfUrl] = useState(contract.contractPdfUrl || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter(); // Hook para navegação

  const handleTriggerClick = async () => {
    setIsModalOpen(true);
    if (pdfUrl || userType === 'hospital') return;
    
    setIsProcessing(true);
    toast({ title: "A gerar documento...", description: "Por favor, aguarde." });
    try {
      const url = await generateContractAndGetUrl(contract.id);
      setPdfUrl(url);
    } catch (error: any) {
      toast({ title: "Erro ao Gerar Contrato", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmSignature = async () => {
    setIsProcessing(true);
    try {
      await onSign(contract.id);
      setIsModalOpen(false);
    } catch (error: any) {
      toast({ title: "Erro ao Assinar", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // NOVA FUNÇÃO: Lida com o clique para iniciar a telemedicina
  const handleStartTelemedicine = async () => {
    setIsStartingTelemedicine(true);
    toast({ title: "Preparando a sala de atendimento...", description: "Aguarde um momento." });
    try {
      // Se o link já existir, não precisa criar de novo.
      // Se não, chama a função para criar.
      if (!contract.telemedicineLink) {
        await createTelemedicineRoom(contract.id);
      }
      // Redireciona para a página da sala de telemedicina
      router.push(`/telemedicine/${contract.id}`);
    } catch (error: any) {
      toast({ title: "Erro ao Iniciar Atendimento", description: error.message, variant: "destructive" });
      setIsStartingTelemedicine(false);
    }
    // O estado de loading será interrompido pela navegação, mas é bom ter um 'finally' por segurança.
  };


  const displayShiftDates = Array.isArray(contract.shiftDates) ? contract.shiftDates.map((ts: Timestamp) => ts.toDate().toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})).join(', ') : "Datas não disponíveis";
  const getStatusBadgeStyle = (status?: Contract['status']): { variant: BadgeProps["variant"], className: string } => { 
      switch(status) { 
          case 'PENDING_DOCTOR_SIGNATURE': return { variant: 'secondary', className: 'bg-amber-100 text-amber-800 border-amber-300' }; 
          case 'PENDING_HOSPITAL_SIGNATURE': return { variant: 'secondary', className: 'bg-sky-100 text-sky-800 border-sky-300' }; 
          case 'ACTIVE_SIGNED': return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-300' }; 
          case 'COMPLETED': return { variant: 'default', className: 'bg-slate-200 text-slate-800 border-slate-300' };
          case 'CANCELLED': return { variant: 'destructive', className: ''};
          default: return { variant: 'outline', className: '' }; 
      } 
  };
  const statusBadgeInfo = getStatusBadgeStyle(contract.status);

  const valueToShow = userType === 'doctor' ? contract.doctorRate : contract.hospitalRate;
  const valueLabel = userType === 'doctor' ? "Seu Valor:" : "Seu Custo:";
  const valueColor = userType === 'doctor' ? "text-green-700" : "text-red-700";
  const titleText = userType === 'doctor' ? `Contrato com: ${contract.hospitalName}` : `Contrato com Dr(a). ${contract.doctorName}`;
  const showSignButton = (userType === 'doctor' && contract.status === 'PENDING_DOCTOR_SIGNATURE') || (userType === 'hospital' && contract.status === 'PENDING_HOSPITAL_SIGNATURE');
  
  // NOVA CONDIÇÃO: Determina se o botão de telemedicina deve ser mostrado
  const showTelemedicineButton = userType === 'doctor' && contract.status === 'ACTIVE_SIGNED' && contract.serviceType === 'Telemedicina';


  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-300 ease-in-out">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-base mb-1">{titleText}</CardTitle>
                <CardDescription className="text-xs flex items-center"><MapPinIcon className="inline h-3 w-3 mr-1" />{contract.locationCity}, {contract.locationState}</CardDescription>
            </div>
            <Badge variant={statusBadgeInfo.variant} className="capitalize text-xs">{contract.status.replace(/_/g, ' ').toLowerCase()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm pt-2 pb-3 border-y grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="flex items-center"><CalendarDays className="h-4 w-4 mr-2 text-gray-500" /><span className="font-medium">{displayShiftDates}</span></div>
        <div className="flex items-center"><Clock className="h-4 w-4 mr-2 text-gray-500" /><span className="font-medium">{contract.startTime} - {contract.endTime}</span></div>
        <div className={`flex items-center font-semibold ${valueColor}`}><DollarSign className="h-4 w-4 mr-2" /><span className="font-medium">{formatCurrency(valueToShow)}/hora</span></div>
      </CardContent>
      
      {/* LÓGICA DO RODAPÉ ATUALIZADA */}
      {(showSignButton || showTelemedicineButton) && (
        <CardFooter className="flex justify-end items-center pt-3 pb-3">
            
            {/* Botão de Assinatura (lógica existente) */}
            {showSignButton && (
                <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleTriggerClick} disabled={isProcessing}>
                        {isProcessing && !pdfUrl ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Edit className="mr-2 h-4 w-4" />} 
                        Rever e Assinar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-4xl h-[90vh] flex flex-col">
                      <AlertDialogHeader><AlertDialogTitle>Revisão e Assinatura do Contrato</AlertDialogTitle></AlertDialogHeader>
                      <div className="flex-grow my-4 border rounded-md overflow-hidden bg-gray-200">
                          {isProcessing && !pdfUrl ? <LoadingState message="A gerar documento..."/> : 
                           pdfUrl ? <iframe src={pdfUrl} className="w-full h-full" title="Contrato PDF"/> : <ErrorState message="Não foi possível carregar o documento." onRetry={handleTriggerClick}/>
                          }
                      </div>
                      <AlertDialogFooter>
                          <AlertDialogCancel disabled={isProcessing}>Voltar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmSignature} disabled={isProcessing || !pdfUrl} className="bg-green-600 hover:bg-green-700">
                              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Assinatura"}
                          </AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            )}

            {/* NOVO BOTÃO: Iniciar Atendimento de Telemedicina */}
            {showTelemedicineButton && (
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleStartTelemedicine} disabled={isStartingTelemedicine}>
                    {isStartingTelemedicine ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Video className="mr-2 h-4 w-4" />} 
                    Iniciar Atendimento
                </Button>
            )}

        </CardFooter>
      )}
    </Card>
  );
};