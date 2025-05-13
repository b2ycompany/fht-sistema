// components/hospital/ConfirmedShiftListItem.tsx
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, CalendarDays, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
// Ajuste o caminho para importar o tipo correto
import type { ConfirmedShift } from '@/lib/hospital-shift-service';

interface ConfirmedShiftListItemProps {
  shift: ConfirmedShift;
  onViewDetails?: (shiftId: string) => void;
}

export const ConfirmedShiftListItem: React.FC<ConfirmedShiftListItemProps> = ({ shift, onViewDetails }) => {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col sm:flex-row justify-between items-start gap-3 hover:shadow-md transition-shadow">
       <div className="flex-1 space-y-1">
            <div className='flex justify-between items-center mb-1'>
                 <p className="text-sm font-semibold text-gray-800 flex items-center gap-2" suppressHydrationWarning>
                     <CalendarDays className="h-4 w-4 text-blue-600"/>
                     {shift.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                     <span className="text-gray-500 font-normal ml-1">({shift.startTime} - {shift.endTime})</span>
                 </p>
                 <Badge variant="secondary" className='bg-green-100 text-green-800 text-xs'><CheckCircle className='h-3 w-3 mr-1'/>Confirmado</Badge>
            </div>
            <p className="text-sm text-gray-600 flex items-center gap-1.5"><User className="h-4 w-4 text-gray-500"/> Médico: <span className="font-medium">{shift.doctorName}</span></p>
            {shift.specialty && <p className="text-sm text-gray-600">Especialidade: <span className="font-medium">{shift.specialty}</span></p>}
       </div>
        {onViewDetails && (
             <div className="flex items-center gap-2 mt-2 sm:mt-0 self-end sm:self-center shrink-0">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => onViewDetails(shift.id)}>Ver Detalhes</Button>
             </div>
        )}
    </div>
  );
};