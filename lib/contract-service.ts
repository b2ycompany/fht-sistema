"use strict";

import { doc, collection, query, where, getDocs, updateDoc, serverTimestamp, Timestamp, orderBy, runTransaction } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
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
  status: 'PENDING_DOCTOR_SIGNATURE' | 'PENDING_HOSPITAL_SIGNATURE' | 'ACTIVE_SIGNED' | 'CANCELLED' | 'COMPLETED' | 'REJECTED';
  doctorSignature?: { signedAt: Timestamp; ipAddress?: string; };
  hospitalSignature?: { signedAt: Timestamp; signedByUID: string; };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const generateContractAndGetUrl = async (contractId: string): Promise<string> => {
    const functions = getFunctions();
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

export const getPendingSignatureContractsForHospital = async (): Promise<Contract[]> => {
  const hospitalId = auth.currentUser?.uid;
  if (!hospitalId) return [];
  const contractsRef = collection(db, "contracts");
  const q = query(
    contractsRef, 
    where("hospitalId", "==", hospitalId), 
    where("status", "==", "PENDING_HOSPITAL_SIGNATURE"), 
    orderBy("updatedAt", "desc")
  );
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract));
  } catch (error) {
    console.error("Erro ao buscar contratos pendentes para o hospital:", error);
    throw new Error("Não foi possível carregar os contratos pendentes.");
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