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
import { type Contract } from "./contract-service"; // <-- MUDANÇA: Importa a interface do Contrato

// A sua interface PotentialMatch continua igual.
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
  shiftCity?: string;
  shiftState?: string;
  doctorTimeSlotNotes?: string;
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

/**
 * ## LÓGICA ATUALIZADA E UNIFICADA ##
 * Aprova o match e cria um CONTRATO formal diretamente, que será enviado ao médico para assinatura.
 * A coleção 'shiftProposals' deixa de ser usada neste fluxo.
 */
export const approveMatchAndCreateContract = async (
  matchId: string,
  negotiatedRate: number,
  platformMargin: number, // Adicionado para cálculo financeiro
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
    
    // 1. Atualiza o status do Match original
    batch.update(matchDocRef, {
      status: "BACKOFFICE_APPROVED_CONTRACT_CREATED", // Novo status mais claro
      negotiatedRateForDoctor: negotiatedRate,
      backofficeReviewerId: currentUser.uid,
      backofficeReviewedAt: serverTimestamp(),
      backofficeNotes: backofficeNotes || "",
      updatedAt: serverTimestamp(),
    });

    // 2. Cria o novo CONTRATO na coleção 'contracts'
    const contractRef = doc(collection(db, "contracts"));
    
    const newContractData: Omit<Contract, 'id'> = {
        proposalId: 'N/A', // O conceito de proposta separada não existe mais neste fluxo
        shiftRequirementId: matchData.shiftRequirementId,
        timeSlotId: matchData.timeSlotId,
        doctorId: matchData.doctorId,
        hospitalId: matchData.hospitalId,
        doctorName: matchData.doctorName || 'Nome do Médico não disponível',
        hospitalName: matchData.hospitalName || 'Nome do Hospital não disponível',
        shiftDates: [matchData.matchedDate],
        startTime: matchData.shiftRequirementStartTime,
        endTime: matchData.shiftRequirementEndTime,
        isOvernight: matchData.shiftRequirementIsOvernight,
        serviceType: matchData.shiftRequirementServiceType,
        specialties: matchData.shiftRequirementSpecialties,
        locationCity: matchData.shiftCity || 'N/A',
        locationState: matchData.shiftState || 'N/A',
        contractedRate: negotiatedRate, // Valor que o médico recebe
        offeredRateByHospital: matchData.offeredRateByHospital, // Valor que o hospital paga
        platformMargin: platformMargin, // Margem da plataforma
        status: 'PENDING_DOCTOR_SIGNATURE', // Status inicial para o médico assinar
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
    };
    
    batch.set(contractRef, newContractData);

    // 3. (Opcional, mas recomendado) Atualiza o campo contractId no match
    batch.update(matchDocRef, { contractId: contractRef.id });
    
    await batch.commit();
    
    console.log(`[MatchService] Match ${matchId} aprovado. Novo CONTRATO ${contractRef.id} criado para o médico.`);

  } catch (error) {
    console.error(`Falha ao aprovar match e criar contrato para ${matchId}:`, error);
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