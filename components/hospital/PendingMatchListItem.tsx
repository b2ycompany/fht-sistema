// components/hospital/PendingMatchListItem.tsx
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, UserCheck, FileSignature } from 'lucide-react'; // Ícones relevantes
import { cn } from '@/lib/utils'; // Se precisar de classes condicionais
// Ajuste o caminho para importar o tipo correto
import type { PendingMatch } from '@/lib/hospital-shift-service';

interface PendingMatchListItemProps {
  match: PendingMatch;
  onApprove?: (matchId: string) => void; // Exemplo de ação
  onReject?: (matchId: string) => void;  // Exemplo de ação
  onViewDetails?: (matchId: string) => void; // Exemplo de ação
}

const statusMap = {
    pending_hospital_approval: { text: 'Aguardando Sua Aprovação', color: 'bg-orange-100 text-orange-800' },
    pending_doctor_acceptance: { text: 'Aguardando Médico', color: 'bg-blue-100 text-blue-800' },
    pending_signatures: { text: 'Aguardando Assinaturas', color: 'bg-purple-100 text-purple-800' },
};

export const PendingMatchListItem: React.FC<PendingMatchListItemProps> = ({ match, onApprove, onReject, onViewDetails }) => {
  const statusInfo = statusMap[match.status] || { text: match.status, color: 'bg-gray-100 text-gray-800' };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col sm:flex-row justify-between items-start gap-3 hover:shadow-md transition-shadow">
      <div className="flex-1 space-y-1">
        <div className='flex justify-between items-center mb-1'>
             <p className="text-sm font-semibold text-gray-800" suppressHydrationWarning>
                 {match.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                 <span className="text-gray-500 font-normal ml-2">({match.startTime} - {match.endTime})</span>
             </p>
             <Badge className={cn('text-xs px-2 py-0.5', statusInfo.color)}>{statusInfo.text}</Badge>
        </div>
        <p className="text-sm text-gray-600">Especialidade: <span className="font-medium">{match.specialty}</span></p>
        {match.doctorName && <p className="text-sm text-gray-600">Médico: <span className="font-medium">{match.doctorName}</span></p>}
        {/* Adicionar mais detalhes se necessário, como valor */}
        {/* <p className="text-sm text-green-700 font-medium">Valor/h: {formatCurrency(match.offeredRate)}</p> */}
      </div>
      <div className="flex items-center gap-2 mt-2 sm:mt-0 self-end sm:self-center shrink-0">
        {onViewDetails && <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => onViewDetails(match.id)}>Detalhes</Button>}
        {/* Exemplo: Botões condicionais (ajuste a lógica conforme necessário) */}
        {match.status === 'pending_doctor_acceptance' && onApprove && <Button size="sm" className="h-8 text-xs px-2 bg-blue-600 hover:bg-blue-700" onClick={() => onApprove(match.id)}>Reenviar Notificação</Button>}
        {match.status === 'pending_signatures' && onViewDetails && <Button size="sm" className="h-8 text-xs px-2" onClick={() => onViewDetails(match.id)}>Ver Contrato</Button>}
      </div>
    </div>
  );
};