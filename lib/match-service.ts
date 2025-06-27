// lib/match-service.ts
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  orderBy,
  writeBatch,
  getDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { type ShiftProposal } from "./proposal-service";

export interface PotentialMatch {
  id: string;
  shiftRequirementId: string;
  hospitalId: string;
  hospitalName?: string;
  originalShiftRequirementDates: Timestamp[];
  matchedDate: Timestamp;
  shiftRequirementStartTime: string;
  shiftRequirementEndTime: string;
  shiftRequirementIsOvernight: boolean;
  shiftRequirementServiceType: string;
  shiftRequirementSpecialties: string[];
  offeredRateByHospital: number;
  shiftRequirementNotes?: string;
  numberOfVacanciesInRequirement: number;
  timeSlotId: string;
  doctorId: string;
  doctorName?: string;
  timeSlotStartTime: string;
  timeSlotEndTime: string;
  timeSlotIsOvernight: boolean;
  doctorDesiredRate: number;
  doctorSpecialties: string[];
  doctorServiceType: string;
  status:
    | "PENDING_BACKOFFICE_REVIEW" | "BACKOFFICE_APPROVED_PROPOSED_TO_DOCTOR"
    | "BACKOFFICE_REJECTED" | "PROPOSED_TO_DOCTOR"
    | "DOCTOR_ACCEPTED_PENDING_CONTRACT" | "DOCTOR_REJECTED"
    | "CONTRACT_GENERATED_PENDING_SIGNATURES" | "CONTRACT_SIGNED_BY_DOCTOR"
    | "CONTRACT_SIGNED_BY_HOSPITAL" | "CONTRACT_ACTIVE" | "SHIFT_COMPLETED"
    | "PAYMENT_PROCESSED" | "CANCELLED_BY_BACKOFFICE"
    | "CANCELLED_BY_HOSPITAL_POST_MATCH" | "CANCELLED_BY_DOCTOR_POST_ACCEPTANCE";
  backofficeReviewerId?: string;
  backofficeReviewedAt?: Timestamp;
  backofficeNotes?: string;
  negotiatedRateForDoctor?: number;
  doctorResponseAt?: Timestamp;
  doctorRejectionReason?: string;
  contractId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  shiftCity?: string; // Campo que vem do seu backend
  shiftState?: string; // Campo que vem do seu backend
}

export const getMatchesForBackofficeReview = async (): Promise<PotentialMatch[]> => {
  try {
    const q = query(
      collection(db, "potentialMatches"),
      where("status", "==", "PENDING_BACKOFFICE_REVIEW"),
      orderBy("createdAt", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PotentialMatch));
  } catch (error) {
    console.error("[MatchService] Erro ao buscar matches:", error);
    throw error;
  }
};

export const approveMatchAndProposeToDoctor = async (
  matchId: string,
  negotiatedRate: number,
  backofficeNotes?: string
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Admin não logado.");

  const batch = writeBatch(db);
  const matchDocRef = doc(db, "potentialMatches", matchId);
  
  try {
    const matchDocSnap = await getDoc(matchDocRef);
    if (!matchDocSnap.exists()) {
      throw new Error("Match não encontrado. Pode já ter sido processado.");
    }
    const matchData = matchDocSnap.data() as PotentialMatch;
    
    batch.update(matchDocRef, {
      status: "BACKOFFICE_APPROVED_PROPOSED_TO_DOCTOR",
      negotiatedRateForDoctor: negotiatedRate,
      backofficeReviewerId: currentUser.uid,
      backofficeReviewedAt: serverTimestamp(),
      backofficeNotes: backofficeNotes || "",
      updatedAt: serverTimestamp(),
    });

    const proposalRef = doc(collection(db, "shiftProposals"));
    
    const newProposalData: Omit<ShiftProposal, 'id'> = {
        originalShiftRequirementId: matchData.shiftRequirementId,
        potentialMatchId: matchId,
        // --- ALTERAÇÃO APLICADA AQUI ---
        // Adicionando o ID da disponibilidade original para podermos bloqueá-la depois.
        originalTimeSlotId: matchData.timeSlotId, 
        hospitalId: matchData.hospitalId,
        hospitalName: matchData.hospitalName || 'N/A',
        hospitalCity: matchData.shiftCity || 'N/A',
        hospitalState: matchData.shiftState || 'N/A',
        doctorId: matchData.doctorId,
        shiftDates: [matchData.matchedDate],
        startTime: matchData.shiftRequirementStartTime,
        endTime: matchData.shiftRequirementEndTime,
        isOvernight: matchData.shiftRequirementIsOvernight,
        serviceType: matchData.shiftRequirementServiceType,
        specialties: matchData.shiftRequirementSpecialties,
        offeredRateToDoctor: negotiatedRate,
        notesFromBackoffice: backofficeNotes,
        status: 'AWAITING_DOCTOR_ACCEPTANCE',
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
    };
    
    batch.set(proposalRef, newProposalData);
    await batch.commit();
    
    console.log(`[MatchService] Match ${matchId} aprovado. Nova proposta ${proposalRef.id} criada.`);

  } catch (error) {
    console.error(`Falha ao aprovar match ${matchId}:`, error);
    throw new Error(`Falha ao aprovar match: ${(error as Error).message}`);
  }
};

export const rejectMatchByBackoffice = async (
  matchId: string,
  rejectionNotes: string
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Admin não está logado.");
  if (!rejectionNotes.trim()) throw new Error("Justificativa é obrigatória.");
  
  const matchDocRef = doc(db, "potentialMatches", matchId);
  try {
    await updateDoc(matchDocRef, {
      status: "BACKOFFICE_REJECTED",
      backofficeReviewerId: currentUser.uid,
      backofficeReviewedAt: serverTimestamp(),
      backofficeNotes: rejectionNotes,
      updatedAt: serverTimestamp(),
    });
     console.log(`[MatchService] Match ${matchId} foi rejeitado.`);
  } catch (error) {
    console.error(`Falha ao rejeitar match ${matchId}:`, error);
    throw new Error(`Falha ao rejeitar match: ${(error as Error).message}`);
  }
};