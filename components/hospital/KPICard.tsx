// components/hospital/KPICard.tsx
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils"; // Certifique-se de importar cn

interface KPICardProps {
  title: string;
  value: string | number; // Valor já formatado (string) ou número
  description?: string;
  icon: React.ElementType;
  isLoading: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, description, icon: Icon, isLoading }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-8 flex items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          // --- CORREÇÃO APLICADA: Fonte Responsiva sem Truncate ---
          <div
            className={cn(
              "font-bold text-gray-900", // Sem 'truncate'
              // Tamanho da fonte mais granular e responsivo:
              "text-lg md:text-xl lg:text-2xl" // Começa maior (lg), aumenta em md e lg+
              // Se ainda quebrar, pode tentar começar menor: "text-base sm:text-lg md:text-xl lg:text-2xl"
            )}
             // Não precisa mais do title aqui, pois o texto não será cortado
          >
            {value} {/* Exibe o valor completo */}
          </div>
          // --- FIM DA CORREÇÃO ---
        )}
        {description && !isLoading && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      </CardContent>
    </Card>
  );
};