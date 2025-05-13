// components/hospital/HospitalDoctorListItem.tsx
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
// Ajuste o caminho para importar o tipo correto
import type { DoctorInfoBasic } from '@/lib/hospital-shift-service';

interface HospitalDoctorListItemProps {
  doctor: DoctorInfoBasic;
  onViewProfile?: (doctorId: string) => void;
}

export const HospitalDoctorListItem: React.FC<HospitalDoctorListItemProps> = ({ doctor, onViewProfile }) => {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col sm:flex-row justify-between items-start gap-3 hover:shadow-md transition-shadow">
       <div className="flex-1 space-y-1">
             <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                 <User className="h-4 w-4 text-blue-600"/> {doctor.name}
             </p>
             {doctor.crm && <p className="text-xs text-gray-600">CRM: {doctor.crm}</p>}
             {doctor.phone && <p className="text-xs text-gray-600 flex items-center gap-1"><Phone className="h-3 w-3"/> {doctor.phone}</p>}
             {doctor.specialties && doctor.specialties.length > 0 && (
                 <div className="flex flex-wrap items-center gap-1 pt-1">
                     <Stethoscope className="h-3.5 w-3.5 text-gray-500 mr-1"/>
                     {doctor.specialties.map((s) => (<Badge key={s} variant="secondary" className="text-xs">{s}</Badge>))}
                 </div>
             )}
       </div>
        {onViewProfile && (
             <div className="flex items-center gap-2 mt-2 sm:mt-0 self-end sm:self-center shrink-0">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => onViewProfile(doctor.uid)}>Ver Perfil</Button>
             </div>
        )}
    </div>
  );
};