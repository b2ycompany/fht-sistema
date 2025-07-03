"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  getContractsForHospital,
  signContractByHospital,
  type Contract,
} from "@/lib/contract-service";
import { Badge } from "@/components/ui/badge";
import { ContractCard } from "@/components/shared/ContractCard";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const LoadingState = React.memo(
  ({ message = "Carregando..." }: { message?: string }) => (
    <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <span className="text-sm text-gray-600 mt-2">{message}</span>
    </div>
  )
);

const EmptyState = React.memo(({ message }: { message: string }) => (
  <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed">
    <ClipboardList className="w-12 h-12 text-gray-400 mb-4" />
    <p className="font-medium text-gray-600 mb-1">{message}</p>
  </div>
));

const ErrorState = React.memo(
  ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry?: () => void;
  }) => (
    <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full">
      <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
      <p className="font-semibold text-red-700 mb-1 text-base">Oops!</p>
      <p className="max-w-md text-red-600">
        {message || "Não foi possível carregar."}
      </p>
      {onRetry && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onRetry}
          className="mt-4"
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente
        </Button>
      )}
    </div>
  )
);

export default function HospitalContractsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending_hospital");
  const [pendingHospital, setPendingHospital] = useState<Contract[]>([]);
  const [signedContracts, setSignedContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllContracts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [phData, acData] = await Promise.all([
        getContractsForHospital(["PENDING_HOSPITAL_SIGNATURE"]),
        getContractsForHospital(["ACTIVE_SIGNED", "COMPLETED", "CANCELLED"]),
      ]);
      setPendingHospital(phData);
      setSignedContracts(acData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllContracts();
  }, [fetchAllContracts]);

  const handleSignContract = async (contractId: string) => {
    try {
      await signContractByHospital(contractId);
      toast({
        title: "Contrato assinado com sucesso!",
        description: "Contrato finalizado e ativo.",
      });
      fetchAllContracts();
      setActiveTab("signed");
    } catch (err: any) {
      toast({
        title: "Erro ao assinar",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const renderContent = (contracts: Contract[]) => {
    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message={error || ""} onRetry={fetchAllContracts} />;
    if (contracts.length === 0)
      return <EmptyState message="Nenhum contrato nesta categoria." />;
    return (
      <div className="space-y-4">
        {contracts.map((c) => (
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
      <h1 className="text-2xl md:text-3xl font-bold">Contratos Hospital</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending_hospital">
            Pendentes <Badge className="ml-2">{pendingHospital.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="signed">
            Assinados <Badge className="ml-2">{signedContracts.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="pending_hospital">
            {renderContent(pendingHospital)}
          </TabsContent>
          <TabsContent value="signed">
            {renderContent(signedContracts)}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
