// components/hospital/ShiftListItem.tsx
"use client"; // Adicionado por causa do map e potenciais actions

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils"; // Import formatCurrency
import type { ShiftRequirement } from "@/lib/hospital-shift-service"; // Importe o tipo
import { ServiceTypeRates } from "@/lib/availability-service"; // Para buscar label do tipo de serviço
import type { VariantProps } from "class-variance-authority";
import { CalendarDays, MapPin, Briefcase, DollarSign, Info } from "lucide-react";

// Recriando serviceTypesOptions aqui ou importe de um local compartilhado
const serviceTypesOptions = Object.entries(ServiceTypeRates).map(([v, r]) => ({ value: v, label: v.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ') }));
type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null | undefined;


interface ShiftListItemProps {
  shift: ShiftRequirement; // Usa o tipo importado
  actions?: {
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    variant?: ButtonVariant; // Usa o tipo definido
    className?: string;
  }[];
}

export const ShiftListItem: React.FC<ShiftListItemProps> = ({ shift, actions }) => {
     const serviceTypeLabel = serviceTypesOptions.find(opt => opt.value === shift.serviceType)?.label || shift.serviceType;
    return (
        <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between border rounded-lg p-4 gap-3 transition-opacity duration-300 bg-white shadow-xs hover:shadow-sm")}>
            <div className="flex-1 space-y-1.5 pr-2">
                 {shift.status && shift.status !== 'open' && <Badge variant={shift.status === 'filled' ? 'secondary' : 'destructive'} className="text-xs mb-1 capitalize">{shift.status}</Badge> }
                 <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"> <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" /> <span suppressHydrationWarning>{shift.date ? shift.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Inválida"}</span> <span className="text-gray-500 font-normal">({shift.startTime} - {shift.endTime})</span> </div>
                 <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5 "><MapPin className="h-3.5 w-3.5 shrink-0 text-purple-600" /><span>{shift.city}, {shift.state}</span></div>
                    <div className="flex items-center gap-1.5 "><Briefcase className="h-3.5 w-3.5 shrink-0 text-cyan-600" /><span>{serviceTypeLabel}</span></div>
                    <div className="flex items-center gap-1.5 text-green-700 font-medium col-span-2"><DollarSign className="h-3.5 w-3.5 shrink-0" /><span>{formatCurrency(shift.offeredRate)}/hora</span></div>
                 </div>
                 {shift.specialtiesRequired && shift.specialtiesRequired.length > 0 && ( <div className="flex flex-wrap items-center gap-1 pt-1.5"> <span className="text-xs text-gray-500 mr-1 font-medium">Requer:</span> {shift.specialtiesRequired.map((s) => (<Badge key={s} variant="outline" className="text-gray-700 text-xs px-1.5 py-0.5 font-normal border-blue-200 bg-blue-50">{s}</Badge>))} </div> )}
                 {shift.notes && (<p className="text-xs text-gray-500 pt-1.5 italic"><Info className="inline h-3 w-3 mr-1 align-middle"/>{shift.notes}</p>)}
            </div>
            {actions && actions.length > 0 && (
                 <div className="flex items-center space-x-1 shrink-0 mt-2 sm:mt-0 self-end sm:self-center">
                    {actions.map(action => ( <Button key={action.label} variant={action.variant ?? "ghost"} size="icon" onClick={action.onClick} className={cn("h-8 w-8", action.className)} aria-label={action.label}> <action.icon className="h-4 w-4"/> </Button> ))}
                </div>
            )}
        </div>
    );
}