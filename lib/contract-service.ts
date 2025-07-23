// lib/contract-service.ts
"use strict";

import { 
    doc, 
    collection, 
    query, 
    where, 
    getDocs, 
    getDoc,
    updateDoc, 
    serverTimestamp, 
    Timestamp, 
    orderBy, 
    runTransaction 
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { db, auth } from "./firebase";
import { type DoctorProfile } from "./auth-service";

export interface Contract {
  id: string;
  shiftRequirementId: string;
  timeSlotId: string;
  doctorId: string;
  hospitalId: string;
  hospitalName: string;
  doctorName: string;
  shiftDates: Timestamp[];
  startTime: string;
  endTime:string;
  isOvernight: boolean;
  serviceType: string;
  specialties: string[];
  locationCity: string;
  locationState: string;
  hospitalRate: number;
  doctorRate: number;
  platformMarginRate: number;
  platformMarginPercentage: number;
  contractDocumentUrl?: string;
  contractTermsPreview?: string;
  contractPdfUrl?: string;
  telemedicineLink?: string; 
  status: 'PENDING_DOCTOR_SIGNATURE' | 'PENDING_HOSPITAL_SIGNATURE' | 'ACTIVE_SIGNED' | 'CANCELLED' | 'COMPLETED' | 'REJECTED' | 'IN_PROGRESS';
  doctorSignature?: { signedAt: Timestamp; ipAddress?: string; };
  hospitalSignature?: { signedAt: Timestamp; signedByUID: string; };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  checkinAt?: Timestamp;
  checkinLocation?: { latitude: number; longitude: number; };
  checkinPhotoUrl?: string;
  checkoutAt?: Timestamp;
  checkoutLocation?: { latitude: number; longitude: number; };
  checkoutPhotoUrl?: string;
  cancellationReason?: string;
}

export const createTelemedicineRoom = async (contractId: string): Promise<string> => {
    const app = getApp();
    const functions = getFunctions(app, 'us-central1');
    const createRoomCallable = httpsCallable(functions, 'createTelemedicineRoom');

    try {
        console.log(`Chamando a Cloud Function 'createTelemedicineRoom' para o contrato: ${contractId}`);
        const result = await createRoomCallable({ contractId });
        const data = result.data as { success: boolean; roomUrl: string };

        if (data.success && data.roomUrl) {
            console.log("Sala de telemedicina criada com sucesso:", data.roomUrl);
            return data.roomUrl;
        } else {
            throw new Error("A Cloud Function não retornou uma URL válida.");
        }
    } catch (error) {
        console.error("Erro ao chamar a função createTelemedicineRoom:", error);
        throw new Error("Não foi possível criar a sala de telemedicina.");
    }
};


export const generateContractAndGetUrl = async (contractId: string): Promise<string> => {
    const app = getApp();
    const functions = getFunctions(app, 'us-central1'); 
    const generatePdf = httpsCallable(functions, 'generateContractPdf');
    
    try {
        const result = await generatePdf({ contractId });
        const data = result.data as { success: boolean; pdfUrl: string };
        if (data.success && data.pdfUrl) {
            return data.pdfUrl;
        } else {
            throw new Error("A Cloud Function não retornou uma URL de PDF válida.");
        }
    } catch (error) {
        console.error("Erro ao chamar a função generateContractPdf:", error);
        throw new Error("Não foi possível gerar o documento do contrato.");
    }
};

export const getContractById = async (contractId: string): Promise<Contract | null> => {
    const contractRef = doc(db, "contracts", contractId);
    try {
        const docSnap = await getDoc(contractRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Contract;
        }
        return null;
    } catch (error) {
        console.error(`[getContractById] Erro ao buscar contrato ${contractId}:`, error);
        throw new Error("Falha ao carregar os detalhes do contrato.");
    }
};


export const getContractsForDoctor = async (statuses: Contract['status'][]): Promise<Contract[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) { return []; }
  if (!statuses || statuses.length === 0) { return []; }
  try {
    const contractsRef = collection(db, "contracts");
    const q = query(contractsRef, where("doctorId", "==", currentUser.uid), where("status", "in", statuses), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Contract));
  } catch(error) {
    console.error("[getContractsForDoctor] Erro:", error);
    throw new Error("Falha ao carregar os contratos do médico.");
  }
};

export const getContractsForHospital = async (statuses: Contract['status'][]): Promise<Contract[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) { return []; }
  if (!statuses || statuses.length === 0) { return []; }
  try {
    const contractsRef = collection(db, "contracts");
    const q = query(contractsRef, where("hospitalId", "==", currentUser.uid), where("status", "in", statuses), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Contract));
  } catch (error) {
    console.error("[getContractsForHospital] Erro:", error);
    throw new Error("Falha ao carregar os contratos do hospital.");
  }
};

export const signContractByDoctor = async (contractId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  const contractRef = doc(db, "contracts", contractId);
  await runTransaction(db, async (transaction) => {
    const contractDoc = await transaction.get(contractRef);
    if (!contractDoc.exists() || contractDoc.data().status !== 'PENDING_DOCTOR_SIGNATURE') {
        throw new Error("Este contrato não está mais disponível para assinatura.");
    }
    const contractData = contractDoc.data() as Contract;
    const timeSlotId = contractData.timeSlotId;
    if (!timeSlotId) throw new Error("ID da disponibilidade original não encontrado no contrato.");
    const timeSlotRef = doc(db, "doctorTimeSlots", timeSlotId);
    const timeSlotDoc = await transaction.get(timeSlotRef);
    if(timeSlotDoc.exists() && timeSlotDoc.data()?.status !== 'AVAILABLE'){
        throw new Error("Esta disponibilidade não está mais livre. A vaga pode ter sido preenchida.");
    }
    transaction.update(contractRef, { status: 'PENDING_HOSPITAL_SIGNATURE', doctorSignature: { signedAt: serverTimestamp() }, updatedAt: serverTimestamp() });
    transaction.update(timeSlotRef, { status: 'BOOKED', relatedContractId: contractId, updatedAt: serverTimestamp() });
  });
};

export const signContractByHospital = async (contractId: string): Promise<void> => {
    const hospitalUser = auth.currentUser;
    if (!hospitalUser) throw new Error("Hospital não autenticado.");
    await runTransaction(db, async (transaction) => {
        const contractRef = doc(db, "contracts", contractId);
        const contractDoc = await transaction.get(contractRef);
        if (!contractDoc.exists() || contractDoc.data().status !== 'PENDING_HOSPITAL_SIGNATURE') { 
            throw new Error("Este contrato não está mais aguardando sua assinatura."); 
        }
        const contractData = contractDoc.data() as Contract;
        const shiftRequirementRef = doc(db, "shiftRequirements", contractData.shiftRequirementId);
        const doctorRef = doc(db, "users", contractData.doctorId);
        const doctorDoc = await transaction.get(doctorRef);
        transaction.update(contractRef, { status: 'ACTIVE_SIGNED', hospitalSignature: { signedAt: serverTimestamp(), signedByUID: hospitalUser.uid }, updatedAt: serverTimestamp() });
        transaction.update(shiftRequirementRef, { status: 'CONFIRMED', updatedAt: serverTimestamp() });
        if (doctorDoc.exists()) {
            const doctorData = doctorDoc.data() as DoctorProfile;
            const hospitalDoctorRef = doc(collection(db, 'users', hospitalUser.uid, 'hospitalDoctors'), contractData.doctorId);
            transaction.set(hospitalDoctorRef, {
                name: doctorData.displayName || 'Nome não informado',
                crm: doctorData.professionalCrm || 'Não informado',
                email: doctorData.email || 'Não informado',
                phone: doctorData.phone || 'Não informado',
                specialties: doctorData.specialties || [],
                status: 'ACTIVE_PLATFORM',
                source: 'PLATFORM',
                addedAt: serverTimestamp()
            }, { merge: true });
        }
    });
};

// ADICIONADO: Nova função para o admin cancelar um contrato
export const cancelContractByAdmin = async (contractId: string, reason: string): Promise<void> => {
    if (!contractId) throw new Error("ID do contrato é obrigatório.");
    if (!reason || reason.trim() === '') throw new Error("O motivo do cancelamento é obrigatório.");
    
    const contractRef = doc(db, "contracts", contractId);
    
    // TODO: Adicionar lógica para reabrir a vaga (ShiftRequirement) e a disponibilidade (TimeSlot) se necessário.
    // Por enquanto, apenas cancelamos o contrato.

    await updateDoc(contractRef, {
        status: 'CANCELLED',
        cancellationReason: reason,
        updatedAt: serverTimestamp()
    });
};