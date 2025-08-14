// lib/protocol-service.ts
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

// Define a estrutura de um protocolo de diagnóstico
export interface DiagnosticProtocol {
    id: string;
    title: string;
    description: string;
    version: string;
    questions: Array<{
        id: string;
        text: string;
        type: 'multiple_choice' | 'text_input';
        options?: string[];
        placeholder?: string;
    }>;
}

/**
 * Busca um protocolo de diagnóstico específico pelo seu ID no Firestore.
 * @param protocolId O ID do documento do protocolo (ex: "ASD_screening_v1").
 * @returns Uma promessa que resolve com o objeto do protocolo ou null se não for encontrado.
 */
export const getProtocolById = async (protocolId: string): Promise<DiagnosticProtocol | null> => {
    try {
        const protocolRef = doc(db, "diagnosticProtocols", protocolId);
        const docSnap = await getDoc(protocolRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as DiagnosticProtocol;
        } else {
            console.warn(`[ProtocolService] Protocolo com ID "${protocolId}" não encontrado.`);
            return null;
        }
    } catch (error) {
        console.error(`[ProtocolService] Erro ao buscar protocolo "${protocolId}":`, error);
        throw new Error("Não foi possível carregar o protocolo de diagnóstico.");
    }
};