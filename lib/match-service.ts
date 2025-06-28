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
  getDoc,
  setDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { type Contract } from "./contract-service";

// A sua interface original, mantida aqui
export interface PotentialMatch {
  id: string; shiftRequirementId: string; hospitalId: string; hospitalName?: string; originalShiftRequirementDates: Timestamp[];
  matchedDate: Timestamp; shiftRequirementStartTime: string; shiftRequirementEndTime: string; shiftRequirementIsOvernight: boolean;
  shiftRequirementServiceType: string; shiftRequirementSpecialties: string[]; offeredRateByHospital: number; shiftRequirementNotes?: string;
  numberOfVacanciesInRequirement: number; timeSlotId: string; doctorId: string; doctorName?: string; timeSlotStartTime: string;
  timeSlotEndTime: string; timeSlotIsOvernight: boolean; doctorDesiredRate: number; doctorSpecialties: string[];
  doctorServiceType: string; status: string; backofficeReviewerId?: string; backofficeReviewedAt?: Timestamp;
  backofficeNotes?: string; negotiatedRateForDoctor?: number; doctorResponseAt?: Timestamp; doctorRejectionReason?: string;
  contractId?: string; createdAt: Timestamp; updatedAt: Timestamp; shiftCity?: string; shiftState?: string;
}

export const getMatchesForBackofficeReview = async (): Promise<PotentialMatch[]> => {
  try {
    const q = query( collection(db, "potentialMatches"), where("status", "==", "PENDING_BACKOFFICE_REVIEW"), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PotentialMatch));
  } catch (error) { console.error("[MatchService] Erro ao buscar matches:", error); throw error; }
};

export const approveMatchAndProposeToDoctor = async ( matchId: string, negotiatedRate: number, backofficeNotes?: string ): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Admin não logado.");
  const batch = writeBatch(db);
  const matchDocRef = doc(db, "potentialMatches", matchId);
  try {
    const matchDocSnap = await getDoc(matchDocRef);
    if (!matchDocSnap.exists()) throw new Error("Match não encontrado.");
    const matchData = matchDocSnap.data() as PotentialMatch;
    
    batch.update(matchDocRef, { status: "BACKOFFICE_APPROVED_PROPOSED_TO_DOCTOR", negotiatedRateForDoctor: negotiatedRate, backofficeNotes: backofficeNotes || "", updatedAt: serverTimestamp(), });
    
    const contractRef = doc(collection(db, "contracts"));
    const newContractData: Omit<Contract, 'id'> = {
        proposalId: matchId, shiftRequirementId: matchData.shiftRequirementId, doctorId: matchData.doctorId, hospitalId: matchData.hospitalId,
        hospitalName: matchData.hospitalName || 'N/A', doctorName: matchData.doctorName || 'N/A', shiftDates: [matchData.matchedDate],
        startTime: matchData.shiftRequirementStartTime, endTime: matchData.shiftRequirementEndTime, isOvernight: matchData.shiftRequirementIsOvernight,
        serviceType: matchData.shiftRequirementServiceType, specialties: matchData.shiftRequirementSpecialties,
        locationCity: matchData.shiftCity || 'N/A', locationState: matchData.shiftState || 'N/A', contractedRate: negotiatedRate,
        status: 'PENDING_DOCTOR_SIGNATURE', createdAt: serverTimestamp() as Timestamp, updatedAt: serverTimestamp() as Timestamp,
    };
    batch.set(contractRef, newContractData);
    await batch.commit();
    console.log(`[MatchService] Match ${matchId} aprovado. Novo contrato ${contractRef.id} criado.`);
  } catch (error) { console.error(`Falha ao aprovar match ${matchId}:`, error); throw new Error(`Falha ao aprovar match: ${(error as Error).message}`); }
};

export const rejectMatchByBackoffice = async ( matchId: string, rejectionNotes: string ): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Admin não está logado.");
  if (!rejectionNotes.trim()) throw new Error("Justificativa é obrigatória.");
  const matchDocRef = doc(db, "potentialMatches", matchId);
  try {
    await updateDoc(matchDocRef, { status: "BACKOFFICE_REJECTED", backofficeReviewerId: currentUser.uid, backofficeReviewedAt: serverTimestamp(), backofficeNotes: rejectionNotes, updatedAt: serverTimestamp(), });
    console.log(`[MatchService] Match ${matchId} foi rejeitado.`);
  } catch (error) { console.error(`Falha ao rejeitar match ${matchId}:`, error); throw new Error(`Falha ao rejeitar match: ${(error as Error).message}`); }
};