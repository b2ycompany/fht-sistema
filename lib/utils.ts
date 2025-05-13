// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Funções de Formatação ---
export const formatCurrency = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return "R$ -";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export const formatPercentage = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return "- %";
    return `${value.toFixed(1)}%`;
}

export const formatHours = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return "- h";
    return `${value.toFixed(1)} h`;
}

// --- Função formatDoc CORRIGIDA E EXPORTADA ---
export const formatDoc = (value: string | undefined, type: 'cpf' | 'cnpj' | 'phone' | 'cep' | 'rg'): string | undefined => {
    if (!value) return value;
    // Remove caracteres não numéricos (exceto X para RG)
    const digits = value.replace(/[^\dX]/gi, '');

    if (type === 'cpf' && digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (type === 'cnpj' && digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (type === 'phone') {
        return digits.length > 10 ? digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    if (type === 'cep' && digits.length === 8) return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
    if (type === 'rg') {
         // Tenta formatar padrões comuns
         if (digits.length === 9) return digits.replace(/(\d{2})(\d{3})(\d{3})([\dX])$/, '$1.$2.$3-$4');
         if (digits.length === 8) return digits.replace(/(\d{1})(\d{3})(\d{3})([\dX])$/, '$1.$2.$3-$4');
         return value; // Retorna original se não bater
    }
    return value;
}