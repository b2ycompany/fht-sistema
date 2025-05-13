// components/ui/state-indicators.tsx
import React from "react";
import { Button } from "@/components/ui/button"; // Import Button se ErrorState o usa
import { Loader2, ClipboardList, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils"; // Import cn se necessário para estilização extra

export const LoadingState = ({ message = "Carregando..." }: { message?: string }) => (
    <div className="flex justify-center items-center py-10 min-h-[150px]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-gray-600">{message}</span>
    </div>
);

export const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/80 rounded-md border border-dashed">
        <ClipboardList className="w-10 h-10 text-gray-400 mb-3"/>
        {message}
    </div>
);

export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50 rounded-md border border-red-200">
        <AlertCircle className="w-10 h-10 text-red-500 mb-3"/>
        <p className="font-medium mb-1">Ocorreu um erro</p>
        <p className="mb-3 px-4">{message || "Não foi possível carregar os dados."}</p> {/* Mensagem padrão */}
        {onRetry && (
            <Button variant="destructive" size="sm" onClick={onRetry}>
                Tentar Novamente
            </Button>
        )}
    </div>
);