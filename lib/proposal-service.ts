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
  writeBatch,
  getDoc
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
  doctorName?: string;
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
    | 'AWAITING_DOCTOR_ACCEPTANCE'
    | 'DOCTOR_ACCEPTED_PENDING_CONTRACT'
    | 'DOCTOR_REJECTED'
    | 'CONTRACT_SIGNED_BY_HOSPITAL'
    | 'EXPIRED';
  deadlineForDoctorResponse?: Timestamp;
  doctorResponseAt?: Timestamp;
  doctorRejectionReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  contractId?: string;
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

export const acceptProposal = async (proposalId: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Usuário não autenticado.");

    await runTransaction(db, async (transaction) => {
        const proposalRef = doc(db, "shiftProposals", proposalId);
        const proposalDoc = await transaction.get(proposalRef);

        if (!proposalDoc.exists() || proposalDoc.data().status !== 'AWAITING_DOCTOR_ACCEPTANCE') {
            throw new Error("Esta proposta não está mais disponível.");
        }
        
        const timeSlotId = proposalDoc.data().originalTimeSlotId;
        if (!timeSlotId) throw new Error("ID da disponibilidade original não encontrado na proposta.");
        const timeSlotRef = doc(db, "doctorTimeSlots", timeSlotId);
        
        // 1. Atualiza a proposta para o status que o hospital irá buscar
        transaction.update(proposalRef, {
            status: 'DOCTOR_ACCEPTED_PENDING_CONTRACT',
            doctorResponseAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // 2. Bloqueia a disponibilidade original do médico
        transaction.update(timeSlotRef, {
            status: 'BOOKED',
            updatedAt: serverTimestamp()
        });
    });
    console.log(`Proposta ${proposalId} aceite. Aguardando ação do hospital.`);
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

  // Opcional: Devolver o match para a fila do admin
  if (potentialMatchId) {
      const matchRef = doc(db, "potentialMatches", potentialMatchId);
      batch.update(matchRef, {
          status: 'PENDING_BACKOFFICE_REVIEW',
          updatedAt: serverTimestamp(),
      });
  }
  
  await batch.commit();
};