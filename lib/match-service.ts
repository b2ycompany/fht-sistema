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
} from "firebase/firestore";
import { db, auth } from "./firebase";

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
  doctorId: string; // <<< ID do médico envolvido no match
  doctorName?: string;
  timeSlotStartTime: string;
  timeSlotEndTime: string;
  timeSlotIsOvernight: boolean;
  doctorDesiredRate: number;
  doctorSpecialties: string[];
  doctorServiceType: string;
  status:
    | "PENDING_BACKOFFICE_REVIEW" | "BACKOFFICE_APPROVED_PENDING_DOCTOR"
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
}

export const getMatchesForBackofficeReview = async (): Promise<PotentialMatch[]> => {
  console.log("[MatchService] Buscando matches reais pendentes (Firestore)...");
  try {
    const matchesCollectionRef = collection(db, "potentialMatches");
    const q = query(
      matchesCollectionRef,
      where("status", "==", "PENDING_BACKOFFICE_REVIEW"),
      orderBy("createdAt", "asc")
    );
    const querySnapshot = await getDocs(q);
    const matches: PotentialMatch[] = [];
    querySnapshot.forEach((docSnap) => {
      matches.push({ id: docSnap.id, ...docSnap.data() } as PotentialMatch);
    });
    console.log(`[MatchService] Encontrados ${matches.length} matches para revisão.`);
    return matches;
  } catch (error) {
    console.error("[MatchService] Erro ao buscar matches:", error);
    // Lançar o erro para que a UI possa tratá-lo
    throw new Error("Falha ao buscar matches do Firestore.");
  }
};

export const approveMatchAndProposeToDoctor = async (
  matchId: string,
  negotiatedRate: number,
  backofficeNotes?: string
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Admin não logado.");
  // TODO: Verificar role do admin
  const matchDocRef = doc(db, "potentialMatches", matchId);
  try {
    await updateDoc(matchDocRef, {
      status: "BACKOFFICE_APPROVED_PENDING_DOCTOR",
      negotiatedRateForDoctor: negotiatedRate,
      backofficeReviewerId: currentUser.uid,
      backofficeReviewedAt: serverTimestamp(),
      backofficeNotes: backofficeNotes || "",
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(`Falha ao aprovar match: ${(error as Error).message}`);
  }
};

export const rejectMatchByBackoffice = async (
  matchId: string,
  rejectionNotes: string
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Admin não logado.");
  // TODO: Verificar role do admin
  if (!rejectionNotes.trim()) throw new Error("Justificativa obrigatória.");
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
    throw new Error(`Falha ao rejeitar match: ${(error as Error).message}`);
  }
};