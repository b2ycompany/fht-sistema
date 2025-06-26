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

// Interface PotentialMatch (Mantida como no seu arquivo)
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
  status: string;
  backofficeReviewerId?: string;
  backofficeReviewedAt?: Timestamp;
  backofficeNotes?: string;
  negotiatedRateForDoctor?: number;
  doctorResponseAt?: Timestamp;
  doctorRejectionReason?: string;
  contractId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- FUNÇÕES DO SERVIÇO ---
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
      throw new Error("Match não encontrado.");
    }
    const matchData = matchDocSnap.data() as PotentialMatch;
    
    // Etapa 1: Atualiza o match
    batch.update(matchDocRef, {
      status: "BACKOFFICE_APPROVED_PROPOSED_TO_DOCTOR",
      negotiatedRateForDoctor: negotiatedRate,
      backofficeReviewerId: currentUser.uid,
      backofficeReviewedAt: serverTimestamp(),
      backofficeNotes: backofficeNotes || "",
      updatedAt: serverTimestamp(),
    });

    // Etapa 2: Cria a proposta
    const proposalRef = doc(collection(db, "shiftProposals"));
    
    const newProposalData: Omit<ShiftProposal, 'id'> = {
        originalShiftRequirementId: matchData.shiftRequirementId,
        potentialMatchId: matchId,
        hospitalId: matchData.hospitalId,
        hospitalName: matchData.hospitalName || 'N/A',
        hospitalCity: (matchData as any).shiftCity || 'N/A',
        hospitalState: (matchData as any).shiftState || 'N/A',
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
  } catch (error) {
    console.error(`Falha ao rejeitar match ${matchId}:`, error);
    throw new Error(`Falha ao rejeitar match: ${(error as Error).message}`);
  }
};
