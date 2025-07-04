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
  // ADICIONADO: Importações para o chat
  addDoc,
  onSnapshot,
  type Unsubscribe
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { type Contract } from "./contract-service"; 
import { sendContractReadyForDoctorEmail } from './notification-service';
// ADICIONADO: Importação para buscar dados do perfil do utilizador logado
import { getCurrentUserData } from "./auth-service";

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
  negotiatedRateForDoctor?: number; 
  contractId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  shiftCity?: string; // Será substituído por shiftCities
  shiftState?: string;
  doctorTimeSlotNotes?: string;
  shiftCities?: string[]; // Suporte para multi-cidade
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

export const approveMatchAndCreateContract = async (
  matchId: string,
  negotiatedRate: number, 
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
        if (!matchDocSnap.exists()) {
          throw new Error("Match não encontrado. Pode já ter sido processado.");
        }
        const matchData = matchDocSnap.data() as PotentialMatch;
        
        const doctorDocRef = doc(db, "users", matchData.doctorId);
        const doctorDocSnap = await transaction.get(doctorDocRef);
        
        emailData = {
            doctorEmail: doctorDocSnap.data()?.email,
            doctorName: matchData.doctorName || 'N/A',
            hospitalName: matchData.hospitalName || 'N/A',
        };

        const hospitalRate = matchData.offeredRateByHospital;
        const doctorRate = negotiatedRate;
        const platformMarginRate = hospitalRate - doctorRate;

        if (platformMarginRate < 0) {
            throw new Error("O valor proposto ao médico não pode ser maior que o valor pago pelo hospital.");
        }

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
            locationCity: matchData.shiftCities?.[0] || matchData.shiftCity || 'N/A', // Usando a primeira cidade da lista
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
            backofficeReviewerId: currentUser.uid,
            backofficeReviewedAt: serverTimestamp(),
            backofficeNotes: backofficeNotes || "",
            updatedAt: serverTimestamp(),
            contractId: newContractId,
        });
    });
    
    console.log(`[MatchService] Match ${matchId} aprovado. CONTRATO ${newContractId} criado.`);
    
    if (emailData.doctorEmail && newContractId) {
        console.log(`[MatchService] A acionar notificação por email para ${emailData.doctorEmail}`);
        sendContractReadyForDoctorEmail(
            emailData.doctorEmail,
            emailData.doctorName,
            emailData.hospitalName,
            newContractId
        );
    } else {
        console.warn(`[MatchService] Email do médico não encontrado para o contrato ${newContractId}. Notificação não enviada.`);
    }

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

// =======================================================================
// NOVO CÓDIGO PARA O CHAT DE NEGOCIAÇÃO
// =======================================================================

// Interface para uma mensagem de chat
export interface ChatMessage {
    id?: string;
    text: string;
    senderId: string;
    senderName: string;
    senderRole: 'admin' | 'doctor' | 'hospital';
    createdAt: Timestamp;
}

/**
 * Envia uma nova mensagem para o chat de um match específico.
 */
export const sendMessageInMatchChat = async (matchId: string, text: string): Promise<void> => {
    const currentUser = auth.currentUser;
    const userProfile = await getCurrentUserData(); 
    
    if (!currentUser || !userProfile) {
        throw new Error("Utilizador não autenticado ou perfil não encontrado.");
    }
    if (!text.trim()) {
        throw new Error("A mensagem não pode estar vazia.");
    }

    const chatCollectionRef = collection(db, "potentialMatches", matchId, "chat");

    const messageData = {
        text: text.trim(),
        senderId: currentUser.uid,
        senderName: userProfile.displayName || "Admin",
        senderRole: userProfile.role,
        createdAt: serverTimestamp()
    };

    await addDoc(chatCollectionRef, messageData);
};

/**
 * Escuta em tempo real as mensagens de um chat de um match.
 * @returns Uma função para cancelar a subscrição (unsubscribe).
 */
export const getMatchChatMessages = (
    matchId: string, 
    callback: (messages: ChatMessage[]) => void
): Unsubscribe => {
    const chatCollectionRef = collection(db, "potentialMatches", matchId, "chat");
    const q = query(chatCollectionRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ChatMessage));
        callback(messages);
    });

    return unsubscribe;
};