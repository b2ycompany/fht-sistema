// components/profile/DocumentStatusField.tsx
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface DocumentStatusFieldProps {
  label: string;
  documentUrl: string | null | undefined; // Espera URL como string
  isOptional?: boolean;
  className?: string; // Permite classes extras
}

export const DocumentStatusField: React.FC<DocumentStatusFieldProps> = ({
  label,
  documentUrl,
  isOptional = false,
  className,
}) => {
  const cleanLabel = label.replace('*','');
  const hasDocument = !!documentUrl;

  return (
    <div className={cn("grid grid-cols-3 gap-2 text-sm py-1.5 border-b border-gray-100 last:border-b-0 items-center", className)}>
      <dt className="font-medium text-gray-600 col-span-1">{cleanLabel}</dt>
      <dd className="text-gray-800 col-span-2 flex items-center flex-wrap gap-x-2 gap-y-1">
        {hasDocument ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 text-xs shrink-0">
               <CheckCircle className="h-3 w-3 mr-1" /> Enviado
            </Badge>
        ) : (
            <Badge variant={isOptional ? 'outline' : 'destructive'} className={cn("text-xs shrink-0", isOptional ? "border-dashed" : "")}>
               {!isOptional && <AlertCircle className="h-3 w-3 mr-1" />}
               {isOptional ? "Opcional" : "Pendente"}
            </Badge>
        )}
        {hasDocument && typeof documentUrl === 'string' ? (
             <a
                 href={documentUrl}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 shrink-0"
                 title={`Abrir ${cleanLabel} em nova aba`}
             >
                 Visualizar <ExternalLink className="h-3 w-3"/>
             </a>
        ) : !hasDocument && !isOptional ? (
             <span className="text-xs text-red-600 italic">(Obrigatório)</span>
        ): null }
      </dd>
    </div>
  );
};