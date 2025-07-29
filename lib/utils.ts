// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Timestamp } from "firebase/firestore";
// ADICIONADO: Importa a interface de uma fonte única para evitar conflitos de tipo
import { type AgendaEntry } from "./agenda-service";

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

export const formatDoc = (value: string | undefined, type: 'cpf' | 'cnpj' | 'phone' | 'cep' | 'rg'): string | undefined => {
    if (!value) return value;
    const digits = value.replace(/[^\dX]/gi, '');

    if (type === 'cpf' && digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (type === 'cnpj' && digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (type === 'phone') {
        return digits.length > 10 ? digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    if (type === 'cep' && digits.length === 8) return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
    if (type === 'rg') {
         if (digits.length === 9) return digits.replace(/(\d{2})(\d{3})(\d{3})([\dX])$/, '$1.$2.$3-$4');
         if (digits.length === 8) return digits.replace(/(\d{1})(\d{3})(\d{3})([\dX])$/, '$1.$2.$3-$4');
         return value;
    }
    return value;
}

// =======================================================================
// FUNÇÃO DE AGRUPAMENTO (AGORA USANDO A INTERFACE IMPORTADA)
// =======================================================================

/**
 * Agrupa uma lista de entradas da agenda por data, com labels amigáveis.
 * @param agenda A lista de consultas a ser agrupada.
 */
export const groupAgendaByDate = (agenda: AgendaEntry[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const grouped = agenda.reduce((acc, item) => {
        const itemDate = item.consultationDate.toDate();
        itemDate.setHours(0, 0, 0, 0);
        const key = itemDate.toISOString().split('T')[0];
        
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(item);
        return acc;
    }, {} as Record<string, AgendaEntry[]>);

    // Adiciona labels amigáveis
    const friendlyGrouped: Record<string, { label: string; items: AgendaEntry[] }> = {};
    for (const key in grouped) {
        const date = new Date(key);
        date.setUTCHours(12); // Ajuste de fuso horário para comparação de datas
        let label = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        
        const diffTime = date.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            label = 'Hoje';
        } else if (diffDays === 1) {
            label = 'Amanhã';
        }
        
        friendlyGrouped[key] = { label, items: grouped[key] };
    }
    return friendlyGrouped;
};