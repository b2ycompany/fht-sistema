// lib/document-service.ts
"use strict";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { Timestamp } from "firebase/firestore";

// Define os tipos de documentos que podemos gerar
export type DocumentType = 'medicalCertificate' | 'attendanceCertificate';

// Interface para os dados do documento no banco de dados
export interface MedicalDocument {
  id: string;
  consultationId: string;
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  type: DocumentType;
  createdAt: Timestamp;
  pdfUrl: string;
  details: any; // Armazena dados específicos como 'daysOff' ou 'cid'
}

// Interface para os dados enviados para a Cloud Function
export interface DocumentPayload {
  type: DocumentType;
  consultationId: string;
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  details: {
    daysOff?: number; // Para Atestado Médico
    cid?: string; // Para Atestado Médico
    consultationPeriod?: string; // Para Declaração de Comparecimento
  };
}

/**
 * Chama a Cloud Function universal para gerar um PDF de documento (Atestado, Declaração, etc).
 */
export const generateDocument = async (payload: DocumentPayload): Promise<{success: boolean, documentId: string, pdfUrl: string}> => {
    const app = getApp();
    const functions = getFunctions(app, 'us-central1');
    const generatePdfCallable = httpsCallable(functions, 'generateDocumentPdf');

    try {
        console.log(`Chamando a Cloud Function 'generateDocumentPdf' para o tipo: ${payload.type}`);
        const result = await generatePdfCallable(payload);
        const data = result.data as { success: boolean; documentId: string; pdfUrl: string };

        if (data.success) {
            console.log("Documento gerado com sucesso:", data);
            return data;
        } else {
            throw new Error("A Cloud Function retornou um erro ao gerar o documento.");
        }
    } catch (error) {
        console.error("Erro ao chamar a função generateDocumentPdf:", error);
        throw new Error("Não foi possível gerar o documento em PDF.");
    }
};