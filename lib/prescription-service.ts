// lib/prescription-service.ts
"use strict";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { Timestamp } from "firebase/firestore";

// Interface para um item de medicamento na receita
export interface Medication {
  name: string;
  dosage: string; // Ex: "1 comprimido"
  instructions: string; // Ex: "a cada 8 horas por 7 dias"
}

// Interface para os dados completos da receita
export interface Prescription {
  id: string;
  consultationId: string;
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  medications: Medication[];
  createdAt: Timestamp;
  pdfUrl: string;
}

// Interface para os dados enviados para a Cloud Function
export interface PrescriptionPayload {
  consultationId: string;
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  medications: Medication[];
}

/**
 * Chama a Cloud Function para gerar o PDF da receita e salvar os dados.
 */
export const generatePrescription = async (payload: PrescriptionPayload): Promise<{success: boolean, prescriptionId: string, pdfUrl: string}> => {
    if (payload.medications.length === 0) {
        throw new Error("A receita deve conter pelo menos um medicamento.");
    }

    const app = getApp();
    const functions = getFunctions(app, 'us-central1');
    const generatePdfCallable = httpsCallable(functions, 'generatePrescriptionPdf');

    try {
        console.log("Chamando a Cloud Function 'generatePrescriptionPdf'...");
        const result = await generatePdfCallable(payload);
        const data = result.data as { success: boolean; prescriptionId: string; pdfUrl: string };

        if (data.success) {
            console.log("Receita gerada com sucesso:", data);
            return data;
        } else {
            throw new Error("A Cloud Function retornou um erro ao gerar a receita.");
        }
    } catch (error) {
        console.error("Erro ao chamar a função generatePrescriptionPdf:", error);
        throw new Error("Não foi possível gerar a receita em PDF.");
    }
};