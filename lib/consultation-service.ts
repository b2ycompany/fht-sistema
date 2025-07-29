// lib/consultation-service.ts
"use strict";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  Timestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

// Interface para os dados completos de uma consulta
export interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  medicalHistorySummary?: string;
  contractId: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  serviceType: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: Timestamp;
  clinicalEvolution?: string;
  diagnosticHypothesis?: string;
  prescriptions?: string[];
  documents?: string[];
}

// Interface para os dados que o médico irá salvar
export interface ConsultationDetailsPayload {
  clinicalEvolution: string;
  diagnosticHypothesis: string;
}

/**
 * Busca os detalhes de uma consulta pelo seu ID.
 */
export const getConsultationById = async (consultationId: string): Promise<Consultation | null> => {
    if (!consultationId) return null;
    
    const consultRef = doc(db, "consultations", consultationId);
    
    try {
        const docSnap = await getDoc(consultRef);
        if (!docSnap.exists()) {
            console.warn(`[getConsultationById] Nenhuma consulta encontrada com o ID: ${consultationId}`);
            return null;
        }
        return { id: docSnap.id, ...docSnap.data() } as Consultation;
    } catch (error) {
        console.error("[getConsultationById] Erro ao buscar consulta:", error);
        throw new Error("Falha ao carregar os dados da consulta.");
    }
};

/**
 * Salva ou atualiza os detalhes do prontuário de uma consulta.
 */
export const saveConsultationDetails = async (consultationId: string, payload: ConsultationDetailsPayload): Promise<void> => {
    if (!consultationId) throw new Error("ID da consulta é obrigatório.");

    const consultRef = doc(db, "consultations", consultationId);
    
    try {
        await setDoc(consultRef, {
            clinicalEvolution: payload.clinicalEvolution,
            diagnosticHypothesis: payload.diagnosticHypothesis,
            status: 'IN_PROGRESS'
        }, { merge: true });
    } catch (error) {
        console.error("[saveConsultationDetails] Erro ao salvar detalhes da consulta:", error);
        throw new Error("Não foi possível salvar os dados do prontuário.");
    }
};