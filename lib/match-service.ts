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
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { type Contract } from "./contract-service"; // Importa a interface do Contrato atualizada

// A interface PotentialMatch continua igual.
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
  negotiatedRateForDoctor?: number; // Este campo é o que o admin preenche na UI
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
 * ## LÓGICA ATUALIZADA (FASE 1) ##
 * Aprova o match, calcula os valores financeiros e cria um CONTRATO formal 
 * com todos os dados detalhados para as próximas fases.
 */
export const approveMatchAndCreateContract = async (
  matchId: string,
  negotiatedRate: number, // Valor final que o médico irá receber (ex: 100)
  platformMarginPercentage: number, // Margem em % que o admin definiu (ex: 10)
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
    
    // MUDANÇA: Lógica de cálculo financeiro
    const hospitalRate = matchData.offeredRateByHospital; // Valor que o hospital ofertou na demanda. Ex: 150
    const doctorRate = negotiatedRate; // Valor final para o médico, definido pelo admin. Ex: 100
    const platformMarginRate = hospitalRate - doctorRate; // Diferença em R$. Ex: 50

    if (platformMarginRate < 0) {
        throw new Error("O valor proposto ao médico não pode ser maior que o valor pago pelo hospital.");
    }

    // 1. Atualiza o status do Match original
    batch.update(matchDocRef, {
      status: "BACKOFFICE_APPROVED_CONTRACT_CREATED",
      negotiatedRateForDoctor: doctorRate,
      backofficeReviewerId: currentUser.uid,
      backofficeReviewedAt: serverTimestamp(),
      backofficeNotes: backofficeNotes || "",
      updatedAt: serverTimestamp(),
    });

    // 2. Cria o novo CONTRATO na coleção 'contracts'
    const contractRef = doc(collection(db, "contracts"));
    
    // MUDANÇA: Usando a nova estrutura de Contrato
    const newContractData: Omit<Contract, 'id'> = {
        shiftRequirementId: matchData.shiftRequirementId,
        timeSlotId: matchData.timeSlotId,
        doctorId: matchData.doctorId,
        hospitalId: matchData.hospitalId,
        doctorName: matchData.doctorName || 'N/A',
        hospitalName: matchData.hospitalName || 'N/A',
        shiftDates: [matchData.matchedDate],
        startTime: matchData.shiftRequirementStartTime,
        endTime: matchData.shiftRequirementEndTime,
        isOvernight: matchData.shiftRequirementIsOvernight,
        serviceType: matchData.shiftRequirementServiceType,
        specialties: matchData.shiftRequirementSpecialties,
        locationCity: matchData.shiftCity || 'N/A',
        locationState: matchData.shiftState || 'N/A',
        
        // Dados Financeiros Detalhados
        hospitalRate: hospitalRate,
        doctorRate: doctorRate,
        platformMarginRate: platformMarginRate,
        platformMarginPercentage: platformMarginPercentage,
        
        status: 'PENDING_DOCTOR_SIGNATURE',
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
    };
    
    batch.set(contractRef, newContractData);
    batch.update(matchDocRef, { contractId: contractRef.id });
    
    await batch.commit();
    
    console.log(`[MatchService] Match ${matchId} aprovado. CONTRATO ${contractRef.id} criado com dados financeiros.`);

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