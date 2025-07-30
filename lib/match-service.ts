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
  runTransaction,
  type Transaction,
  addDoc,
  onSnapshot,
  type Unsubscribe
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { type Contract } from "./contract-service"; 
import { sendContractReadyForDoctorEmail } from './notification-service';
import { getCurrentUserData } from "./auth-service";

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
  negotiatedRateForHospital?: number;
  contractId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  shiftCity?: string;
  shiftState?: string;
  doctorTimeSlotNotes?: string;
  shiftCities?: string[];
  matchScore?: number; // NOVO: Propriedade adicionada para resolver o erro de tipo.
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

// =======================================================================
// NOVAS FUNÇÕES ADICIONADAS
// =======================================================================
/**
 * Busca os matches que estão em negociação para o médico logado.
 */
export const getMatchesForDoctorInNegotiation = async (): Promise<PotentialMatch[]> => {
    const currentUser = auth.currentUser;
    if (!currentUser) { return []; }
    try {
        const q = query(
            collection(db, "potentialMatches"),
            where("doctorId", "==", currentUser.uid),
            where("status", "==", "PENDING_BACKOFFICE_REVIEW"),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PotentialMatch));
    } catch (error) {
        console.error("[getMatchesForDoctorInNegotiation] Erro:", error);
        throw new Error("Falha ao carregar as propostas em negociação.");
    }
};

/**
 * Busca os matches que estão em negociação para o hospital logado.
 */
export const getMatchesForHospitalInNegotiation = async (): Promise<PotentialMatch[]> => {
    const currentUser = auth.currentUser;
    if (!currentUser) { return []; }
    try {
        const q = query(
            collection(db, "potentialMatches"),
            where("hospitalId", "==", currentUser.uid),
            where("status", "==", "PENDING_BACKOFFICE_REVIEW"),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PotentialMatch));
    } catch (error) {
        console.error("[getMatchesForHospitalInNegotiation] Erro:", error);
        throw new Error("Falha ao carregar as propostas em negociação.");
    }
};


export const approveMatchAndCreateContract = async (
  matchId: string,
  negotiatedDoctorRate: number, 
  negotiatedHospitalRate: number,
  platformMarginPercentage: number,
  backofficeNotes?: string
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Admin não logado.");

  const matchDocRef = doc(db, "potentialMatches", matchId);
  
  let newContractId = '';
  let emailData = { doctorEmail: '', doctorName: '', hospitalName: '' };

  try {
    await runTransaction(db, async (transaction: Transaction) => {
        const matchDocSnap = await transaction.get(matchDocRef);
        if (!matchDocSnap.exists()) { throw new Error("Match não encontrado."); }
        const matchData = matchDocSnap.data() as PotentialMatch;
        
        const doctorDocRef = doc(db, "users", matchData.doctorId);
        const doctorDocSnap = await transaction.get(doctorDocRef);
        
        emailData = {
            doctorEmail: doctorDocSnap.data()?.email,
            doctorName: matchData.doctorName || 'N/A',
            hospitalName: matchData.hospitalName || 'N/A',
        };

        const hospitalRate = negotiatedHospitalRate;
        const doctorRate = negotiatedDoctorRate;
        const platformMarginRate = hospitalRate - doctorRate;

        if (platformMarginRate < 0) { throw new Error("O valor final do médico não pode ser maior que o valor final do hospital."); }

        const contractRef = doc(collection(db, "contracts"));
        newContractId = contractRef.id; 

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
            locationCity: matchData.shiftCities?.[0] || matchData.shiftCity || 'N/A',
            locationState: matchData.shiftState || 'N/A',
            hospitalRate, doctorRate, platformMarginRate, platformMarginPercentage,
            status: 'PENDING_DOCTOR_SIGNATURE',
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
        };
        
        transaction.set(contractRef, newContractData);
        transaction.update(matchDocRef, {
            status: "BACKOFFICE_APPROVED_CONTRACT_CREATED",
            negotiatedRateForDoctor: doctorRate,
            negotiatedRateForHospital: hospitalRate,
            backofficeReviewerId: currentUser.uid,
            backofficeReviewedAt: serverTimestamp(),
            backofficeNotes: backofficeNotes || "",
            updatedAt: serverTimestamp(),
            contractId: newContractId,
        });
    });
    
    if (emailData.doctorEmail && newContractId) {
        sendContractReadyForDoctorEmail(
            emailData.doctorEmail,
            emailData.doctorName,
            emailData.hospitalName,
            newContractId
        );
    }

  } catch (error) {
    console.error(`Falha ao aprovar match:`, error);
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

export type ChatTarget = 'doctor' | 'hospital';

export interface ChatMessage {
    id?: string;
    text: string;
    senderId: string;
    senderName: string;
    senderRole: 'admin' | 'doctor' | 'hospital';
    createdAt: Timestamp;
}

export const sendMessageInMatchChat = async (matchId: string, text: string, target: ChatTarget): Promise<void> => {
    const currentUser = auth.currentUser;
    const userProfile = await getCurrentUserData(); 
    
    if (!currentUser || !userProfile) { throw new Error("Utilizador não autenticado."); }
    if (!text.trim()) { throw new Error("A mensagem não pode estar vazia."); }

    const chatCollectionName = target === 'doctor' ? 'chatWithDoctor' : 'chatWithHospital';
    const chatCollectionRef = collection(db, "potentialMatches", matchId, chatCollectionName);

    await addDoc(chatCollectionRef, {
        text: text.trim(),
        senderId: currentUser.uid,
        senderName: userProfile.displayName || "Utilizador",
        senderRole: userProfile.role,
        createdAt: serverTimestamp()
    });
};

export const getMatchChatMessages = (
    matchId: string, 
    target: ChatTarget,
    callback: (messages: ChatMessage[]) => void
): Unsubscribe => {
    const chatCollectionName = target === 'doctor' ? 'chatWithDoctor' : 'chatWithHospital';
    const chatCollectionRef = collection(db, "potentialMatches", matchId, chatCollectionName);
    const q = query(chatCollectionRef, orderBy("createdAt", "asc"));

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        callback(messages);
    });
};