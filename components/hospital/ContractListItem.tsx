// components/hospital/ContractListItem.tsx
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContractInfo } from '@/lib/hospital-shift-service'; // Ou onde definir ContractInfo

interface ContractListItemProps {
  contract: ContractInfo;
  onViewContract?: (contractId: string) => void;
}

export const ContractListItem: React.FC<ContractListItemProps> = ({ contract, onViewContract }) => {
   const statusVariant = contract.status === 'active' ? 'success' : contract.status.includes('pending') ? 'warning' : 'secondary'; // Exemplo de mapeamento

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col sm:flex-row justify-between items-start gap-3">
       <div className="flex-1 space-y-1">
             <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                 <FileText className="h-4 w-4 text-blue-600"/> Contrato #{contract.id.substring(0, 6)}...
             </p>
             {contract.doctorName && <p className="text-xs text-gray-600 flex items-center gap-1"><User className="h-3 w-3"/> Médico: {contract.doctorName}</p>}
             <Badge variant={statusVariant as any} className="text-xs capitalize">{contract.status.replace('_', ' ')}</Badge>
             {contract.startDate && <p className="text-xs text-gray-500">Início: {contract.startDate.toLocaleDateString('pt-BR')}</p>}
       </div>
        {onViewContract && (
             <div className="flex items-center gap-2 mt-2 sm:mt-0 self-end sm:self-center">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => onViewContract(contract.id)}>Ver Contrato</Button>
             </div>
        )}
    </div>
  );
};