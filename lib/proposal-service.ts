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
  runTransaction,
  getDoc,
  writeBatch
} from "firebase/firestore";
import { db, auth } from "./firebase";

export interface ShiftProposal {
  id: string; 
  originalShiftRequirementId: string;
  potentialMatchId?: string;
  originalTimeSlotId?: string;
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string;
  hospitalState: string;
  doctorId: string;
  doctorName?: string; // <<< ALTERAÇÃO: Campo adicionado
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
    | 'CONTRACT_SENT_TO_HOSPITAL' | 'EXPIRED';
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

      transaction.update(proposalRef, {
        status: 'DOCTOR_ACCEPTED_PENDING_CONTRACT',
        doctorResponseAt: serverTimestamp()
      });

      transaction.update(timeSlotRef, {
        status: 'BOOKED',
        updatedAt: serverTimestamp()
      });
    });
    console.log(`Proposta ${proposalId} aceita e disponibilidade ${timeSlotId} reservada.`);
  } catch (error) {
    console.error(`[acceptProposal] Erro na transação para aceitar proposta ${proposalId}:`, error);
    throw error;
  }
};

export const rejectProposal = async (proposalId: string, reason?: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Usuário não autenticado.");

    const proposalRef = doc(db, "shiftProposals", proposalId);
    const batch = writeBatch(db);

    const proposalSnap = await getDoc(proposalRef);
    const potentialMatchId = proposalSnap.data()?.potentialMatchId;

    batch.update(proposalRef, {
      status: 'DOCTOR_REJECTED',
      doctorResponseAt: serverTimestamp(),
      doctorRejectionReason: reason || "Não especificado"
    });

    if (potentialMatchId) {
        const matchRef = doc(db, "potentialMatches", potentialMatchId);
        batch.update(matchRef, {
            status: 'PENDING_BACKOFFICE_REVIEW',
            updatedAt: serverTimestamp(),
        });
    }
    
    await batch.commit();
};