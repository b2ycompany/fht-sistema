// lib/contract-service.ts
"use strict";

import { doc, collection, query, where, getDocs, updateDoc, serverTimestamp, Timestamp, orderBy, runTransaction, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import { type DoctorProfile } from "./auth-service";

export interface Contract {
  id: string;
  proposalId: string;
  shiftRequirementId: string;
  timeSlotId: string; // Adicionado para bloquear a disponibilidade correta
  doctorId: string;
  hospitalId: string;
  hospitalName: string;
  doctorName: string;
  shiftDates: Timestamp[];
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  serviceType: string;
  specialties: string[];
  locationCity: string;
  locationState: string;
  contractedRate: number;
  contractDocumentUrl?: string;
  contractTermsPreview?: string;
  status: 'PENDING_DOCTOR_SIGNATURE' | 'PENDING_HOSPITAL_SIGNATURE' | 'ACTIVE_SIGNED' | 'CANCELLED' | 'COMPLETED' | 'REJECTED';
  doctorSignature?: { signedAt: Timestamp; ipAddress?: string; };
  hospitalSignature?: { signedAt: Timestamp; signedByUID: string; };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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
    throw new Error("Falha ao carregar os contratos.");
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

    // 1. Atualiza o status do contrato
    transaction.update(contractRef, {
      status: 'PENDING_HOSPITAL_SIGNATURE',
      doctorSignature: { signedAt: serverTimestamp() },
      updatedAt: serverTimestamp()
    });

    // 2. Bloqueia a disponibilidade
    transaction.update(timeSlotRef, {
        status: 'BOOKED',
        updatedAt: serverTimestamp()
    });
  });
};

export const getPendingContractsForHospital = async (hospitalId: string): Promise<Contract[]> => {
  if (!hospitalId) return [];
  const contractsRef = collection(db, "contracts");
  const q = query(contractsRef, where("hospitalId", "==", hospitalId), where("status", "==", "PENDING_HOSPITAL_SIGNATURE"), orderBy("updatedAt", "desc"));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract));
  } catch (error) {
    console.error("Erro ao buscar contratos pendentes para o hospital:", error);
    throw new Error("Não foi possível carregar os contratos pendentes.");
  }
};

export const signContractByHospital = async (contractId: string): Promise<void> => {
    const hospitalId = auth.currentUser?.uid;
    if (!hospitalId) throw new Error("Hospital não autenticado.");

    await runTransaction(db, async (transaction) => {
        const contractRef = doc(db, "contracts", contractId);
        const contractDoc = await transaction.get(contractRef);

        if (!contractDoc.exists() || contractDoc.data().status !== 'PENDING_HOSPITAL_SIGNATURE') {
            throw new Error("Este contrato não está mais aguardando sua assinatura.");
        }
        const contractData = contractDoc.data() as Contract;
        const doctorId = contractData.doctorId;
        
        const doctorRef = doc(db, "users", doctorId);
        const doctorDoc = await transaction.get(doctorRef);
        if (!doctorDoc.exists()) throw new Error("Perfil do médico não encontrado.");
        const doctorData = doctorDoc.data() as DoctorProfile;
        
        const shiftRequirementRef = doc(db, "shiftRequirements", contractData.shiftRequirementId);

        transaction.update(contractRef, { status: 'ACTIVE_SIGNED', hospitalSignature: { signedAt: serverTimestamp(), signedByUID: hospitalId }, updatedAt: serverTimestamp() });
        transaction.update(shiftRequirementRef, { status: 'CONFIRMED', updatedAt: serverTimestamp() });

        const hospitalDoctorRef = doc(collection(db, 'users', hospitalId, 'hospitalDoctors'), doctorId);
        transaction.set(hospitalDoctorRef, {
            name: doctorData.displayName || 'Nome não informado',
            crm: doctorData.professionalCrm || 'Não informado',
            email: doctorData.email || 'Não informado',
            phone: doctorData.phone || 'Não informado',
            specialties: doctorData.specialties || [],
            status: 'ACTIVE_PLATFORM',
            source: 'PLATFORM',
            addedAt: serverTimestamp()
        });
    });
};