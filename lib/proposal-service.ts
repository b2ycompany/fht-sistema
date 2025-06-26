// lib/proposal-service.ts
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
  potentialMatchId?: string; // <<< CORREÇÃO: CAMPO ADICIONADO AQUI PARA LIGAR AO MATCH
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string;
  hospitalState: string;
  doctorId: string;
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

// O restante do seu arquivo permanece o mesmo, mas vou incluí-lo para garantir a integridade.

// Função para buscar propostas pendentes para o médico logado
export const getPendingProposalsForDoctor = async (): Promise<ShiftProposal[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getPendingProposalsForDoctor] Usuário não autenticado.");
    return [];
  }

  try {
    const q = query(
      collection(db, "shiftProposals"),
      where("doctorId", "==", currentUser.uid),
      where("status", "==", "AWAITING_DOCTOR_ACCEPTANCE"),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const proposals: ShiftProposal[] = [];
    querySnapshot.forEach((docSnap) => {
      proposals.push({ id: docSnap.id, ...docSnap.data() } as ShiftProposal);
    });
    return proposals;
  } catch (error) {
    console.error("[getPendingProposalsForDoctor] Erro ao buscar propostas:", error);
    throw new Error("Falha ao carregar as propostas.");
  }
};

// Função para o médico aceitar uma proposta
export const acceptProposal = async (proposalId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  const proposalRef = doc(db, "shiftProposals", proposalId);
  try {
    await updateDoc(proposalRef, {
      status: 'DOCTOR_ACCEPTED',
      doctorResponseAt: serverTimestamp()
    });
  } catch (error) {
    console.error(`[acceptProposal] Erro ao aceitar proposta ${proposalId}:`, error);
    throw error;
  }
};

// Função para o médico recusar uma proposta
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
  } catch (error) {
    console.error(`[rejectProposal] Erro ao recusar proposta ${proposalId}:`, error);
    throw error;
  }
};
