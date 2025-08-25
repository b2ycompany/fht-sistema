// lib/document-service.ts
import { functions } from "./firebase";
import { httpsCallable } from "firebase/functions";
import { Timestamp } from "firebase/firestore";

// --- INTERFACES E TIPOS ---

export interface Medication {
  name: string;
  dosage: string;
  instructions: string;
}

export interface PrescriptionPayload {
  consultationId: string;
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  medications: Medication[];
}

export type DocumentType = 'medicalCertificate' | 'attendanceCertificate';

export interface DocumentPayload {
  type: DocumentType;
  consultationId: string;
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  details: {
    daysOff?: number;
    cid?: string;
    consultationPeriod?: string;
  };
}

interface GenerationResponse {
    success: boolean;
    documentId: string;
    pdfUrl: string;
}

// --- FUNÇÕES QUE CHAMAM O BACKEND ---

// FUNÇÃO ADICIONADA: Para gerar receitas
const generatePrescriptionPdfCallable = httpsCallable<PrescriptionPayload, GenerationResponse>(functions, 'generatePrescriptionPdf');

// FUNÇÃO EXISTENTE: Para gerar outros documentos
const generateDocumentPdfCallable = httpsCallable<DocumentPayload, GenerationResponse>(functions, 'generateDocumentPdf');

/**
 * Chama a Cloud Function para gerar um PDF de receita médica.
 */
export const generatePrescription = async (payload: PrescriptionPayload): Promise<GenerationResponse> => {
    try {
        const result = await generatePrescriptionPdfCallable(payload);
        if (!result.data.success) {
            throw new Error("O backend retornou uma falha ao gerar a receita.");
        }
        return result.data;
    } catch (error: any) {
        console.error("Erro ao chamar generatePrescriptionPdf:", error);
        throw new Error(error.message || "Não foi possível gerar a receita.");
    }
};

/**
 * Chama a Cloud Function universal para gerar um PDF de documento (Atestado, Declaração, etc).
 */
export const generateDocument = async (payload: DocumentPayload): Promise<GenerationResponse> => {
    try {
        const result = await generateDocumentPdfCallable(payload);
        if (!result.data.success) {
            throw new Error("A Cloud Function retornou um erro ao gerar o documento.");
        }
        return result.data;
    } catch (error: any) {
        console.error("Erro ao chamar a função generateDocumentPdf:", error);
        throw new Error("Não foi possível gerar o documento em PDF.");
    }
};