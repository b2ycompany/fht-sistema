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
  orderBy,
  runTransaction, // <<< IMPORTANTE: Adicionado para transações
  getDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";

export interface ShiftProposal {
  id: string; 
  originalShiftRequirementId: string;
  potentialMatchId?: string;
  originalTimeSlotId?: string; // <<< ALTERAÇÃO: Campo adicionado
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
  status: 
    | 'AWAITING_DOCTOR_ACCEPTANCE' | 'DOCTOR_ACCEPTED_PENDING_CONTRACT' | 'DOCTOR_REJECTED' 
    | 'CONTRACT_SENT_TO_HOSPITAL' | 'EXPIRED'; // <<< ALTERAÇÃO: Status mais descritivo
  deadlineForDoctorResponse?: Timestamp;
  doctorResponseAt?: Timestamp;
  doctorRejectionReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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

// --- LÓGICA ATUALIZADA ---
// Função para o médico aceitar uma proposta usando uma transação
export const acceptProposal = async (proposalId: string, timeSlotId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  if (!timeSlotId) throw new Error("ID da disponibilidade original não fornecido.");

  const proposalRef = doc(db, "shiftProposals", proposalId);
  const timeSlotRef = doc(db, "doctorTimeSlots", timeSlotId);

  try {
    await runTransaction(db, async (transaction) => {
      const proposalDoc = await transaction.get(proposalRef);
      if (!proposalDoc.exists() || proposalDoc.data().status !== 'AWAITING_DOCTOR_ACCEPTANCE') {
        throw new Error("Esta proposta não está mais disponível.");
      }

      // 1. Atualiza o status da Proposta
      transaction.update(proposalRef, {
        status: 'DOCTOR_ACCEPTED_PENDING_CONTRACT',
        doctorResponseAt: serverTimestamp()
      });

      // 2. Atualiza a Disponibilidade original do Médico para "BOOKED"
      transaction.update(timeSlotRef, {
        status: 'BOOKED',
        updatedAt: serverTimestamp()
      });

      // PONTO DE INTEGRAÇÃO FUTURO:
      // Aqui você chamaria a API do serviço de assinatura de contrato
      // Ex: await Clicksign.createContract(proposalDoc.data());
    });
    console.log(`Proposta ${proposalId} aceita e disponibilidade ${timeSlotId} reservada.`);
  } catch (error) {
    console.error(`[acceptProposal] Erro na transação para aceitar proposta ${proposalId}:`, error);
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