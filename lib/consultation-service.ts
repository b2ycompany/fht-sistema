// lib/consultation-service.ts
"use strict";

import { 
    doc, 
    collection, 
    query, 
    where, 
    getDocs, 
    updateDoc, 
    setDoc,
    limit,
    Timestamp 
} from "firebase/firestore";
import { db } from "./firebase";

// Interface para os dados da consulta no banco de dados
export interface Consultation {
  id: string;
  patientName: string;
  patientId?: string;
  chiefComplaint: string;
  medicalHistorySummary?: string;
  contractId: string;
  doctorId: string;
  hospitalId: string;
  hospitalName: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: Timestamp;

  // Campos do prontuário que o médico irá preencher
  clinicalEvolution?: string;
  diagnosticHypothesis?: string;
}

// Interface para os dados que o médico irá salvar
export interface ConsultationDetailsPayload {
  clinicalEvolution: string;
  diagnosticHypothesis: string;
}

/**
 * Busca os detalhes de uma consulta com base no ID do contrato.
 */
export const getConsultationByContractId = async (contractId: string): Promise<Consultation | null> => {
    if (!contractId) return null;
    
    const consultsRef = collection(db, "consultations");
    const q = query(consultsRef, where("contractId", "==", contractId), limit(1));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.warn(`[getConsultationByContractId] Nenhuma consulta encontrada para o contractId: ${contractId}`);
            return null;
        }
        const docSnap = querySnapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Consultation;
    } catch (error) {
        console.error("[getConsultationByContractId] Erro ao buscar consulta:", error);
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
        // Usamos setDoc com merge: true para criar ou atualizar o documento sem sobrescrever outros campos.
        await setDoc(consultRef, {
            clinicalEvolution: payload.clinicalEvolution,
            diagnosticHypothesis: payload.diagnosticHypothesis,
            status: 'IN_PROGRESS' // Atualiza o status para indicar que o atendimento começou
        }, { merge: true });
    } catch (error) {
        console.error("[saveConsultationDetails] Erro ao salvar detalhes da consulta:", error);
        throw new Error("Não foi possível salvar os dados do prontuário.");
    }
};