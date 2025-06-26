// lib/proposal-service.ts
"use strict";

import {
  doc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
  orderBy
} from "firebase/firestore";
import { db, auth } from "./firebase";

export interface ShiftProposal {
  id: string;
  originalShiftRequirementId: string;
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string;
  hospitalState: string;
  shiftDates: Timestamp[];
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  serviceType: string;
  specialties: string[];
  offeredRateToDoctor: number;
  notesFromHospital?: string;
  notesFromBackoffice?: string;
  status: 'AWAITING_DOCTOR_ACCEPTANCE' | 'DOCTOR_ACCEPTED' | 'DOCTOR_REJECTED' | 'EXPIRED';
  deadlineForDoctorResponse?: Timestamp;
  doctorResponseAt?: Timestamp;
  doctorRejectionReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Busca propostas pendentes para o médico logado.
 */
export const getPendingProposalsForDoctor = async (): Promise<ShiftProposal[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getPendingProposalsForDoctor] Usuário não autenticado.");
    return [];
  }

  try {
    console.log("[getPendingProposalsForDoctor] Buscando propostas REAIS para médico UID:", currentUser.uid);
    
    // Assumindo que a coleção de propostas se chama "shiftProposals"
    const proposalsRef = collection(db, "shiftProposals"); 
    const q = query(
      proposalsRef,
      where("doctorId", "==", currentUser.uid),
      where("status", "==", "AWAITING_DOCTOR_ACCEPTANCE"),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    const proposals: ShiftProposal[] = [];
    
    querySnapshot.forEach((docSnap) => {
      // Validamos que os dados correspondem minimamente ao tipo esperado
      const data = docSnap.data();
      proposals.push({ 
        id: docSnap.id,
        ...data,
        shiftDates: data.shiftDates || [], // Garante que o array exista
        specialties: data.specialties || []
      } as ShiftProposal);
    });

    console.log(`[getPendingProposalsForDoctor] Encontradas ${proposals.length} propostas reais.`);
    return proposals;

  } catch (error) {
    console.error("[getPendingProposalsForDoctor] Erro ao buscar propostas no Firestore:", error);
    throw new Error("Falha ao carregar as propostas.");
  }
};

/**
 * Função para o médico aceitar uma proposta.
 */
export const acceptProposal = async (proposalId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  const proposalRef = doc(db, "shiftProposals", proposalId);
  try {
    await updateDoc(proposalRef, {
      status: 'DOCTOR_ACCEPTED',
      doctorResponseAt: serverTimestamp()
    });
    console.log(`[acceptProposal] Proposta ${proposalId} aceita.`);
    // TODO: Disparar notificação ou criar um contrato
  } catch (error) {
    console.error(`[acceptProposal] Erro ao aceitar proposta ${proposalId}:`, error);
    throw error;
  }
};

/**
 * Função para o médico recusar uma proposta.
 */
export const rejectProposal = async (proposalId: string, reason?: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  const proposalRef = doc(db, "shiftProposals", proposalId);
  try {
    await updateDoc(proposalRef, {
      status: 'DOCTOR_REJECTED',
      doctorResponseAt: serverTimestamp(),
      doctorRejectionReason: reason || "Não especificado"
    });
    console.log(`[rejectProposal] Proposta ${proposalId} recusada.`);
  } catch (error) {
    console.error(`[rejectProposal] Erro ao recusar proposta ${proposalId}:`, error);
    throw error;
  }
};