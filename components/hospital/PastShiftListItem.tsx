// components/hospital/PastShiftListItem.tsx
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, CalendarDays, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils'; // Import formatCurrency
 // Ajuste o caminho para importar o tipo correto
import type { PastShift } from '@/lib/hospital-shift-service';

interface PastShiftListItemProps {
  shift: PastShift;
  onViewDetails?: (shiftId: string) => void;
}

export const PastShiftListItem: React.FC<PastShiftListItemProps> = ({ shift, onViewDetails }) => {
  const isCompleted = shift.status === 'Concluído';
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col sm:flex-row justify-between items-start gap-3 opacity-90 hover:opacity-100 transition-opacity">
       <div className="flex-1 space-y-1">
             <p className="text-sm font-semibold text-gray-700 flex items-center gap-2" suppressHydrationWarning>
                 <CalendarDays className="h-4 w-4 text-gray-500"/>
                 {shift.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                 <span className="text-gray-500 font-normal ml-1">({shift.startTime} - {shift.endTime})</span>
             </p>
             <p className="text-sm text-gray-600 flex items-center gap-1.5"><User className="h-4 w-4 text-gray-500"/> Médico: <span className="font-medium">{shift.doctorName}</span></p>
             <div className='flex items-center gap-2'>
                 <Badge variant={isCompleted ? 'secondary' : 'destructive'} className={`text-xs ${isCompleted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                     {isCompleted ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1"/>}
                     {shift.status}
                 </Badge>
                 {isCompleted && shift.cost != null && (
                     <span className='text-xs text-gray-500 flex items-center gap-1'><DollarSign className='h-3 w-3'/> Custo: {formatCurrency(shift.cost)}</span>
                 )}
             </div>
       </div>
       {onViewDetails && (
             <div className="flex items-center gap-2 mt-2 sm:mt-0 self-end sm:self-center shrink-0">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => onViewDetails(shift.id)}>Ver Detalhes</Button>
             </div>
       )}
    </div>
  );
};