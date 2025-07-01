// lib/contract-service.ts
"use strict";

import { doc, collection, query, where, getDocs, updateDoc, serverTimestamp, Timestamp, orderBy, runTransaction } from "firebase/firestore";
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
  status: 'PENDING_DOCTOR_SIGNATURE' | 'PENDING_HOSPITAL_SIGNATURE' | 'ACTIVE_SIGNED' | 'CANCELLED' | 'COMPLETED' | 'REJECTED';
  doctorSignature?: { signedAt: Timestamp; ipAddress?: string; };
  hospitalSignature?: { signedAt: Timestamp; signedByUID: string; };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ... as funções getContractsForDoctor e signContractByDoctor não precisam de alteração ...
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
    const timeSlotDoc = await transaction.get(timeSlotRef);

    if(timeSlotDoc.exists() && timeSlotDoc.data()?.status !== 'AVAILABLE'){
        throw new Error("Esta disponibilidade não está mais livre. A vaga pode ter sido preenchida.");
    }

    transaction.update(contractRef, {
      status: 'PENDING_HOSPITAL_SIGNATURE',
      doctorSignature: { signedAt: serverTimestamp() },
      updatedAt: serverTimestamp()
    });

    transaction.update(timeSlotRef, {
        status: 'BOOKED',
        relatedContractId: contractId,
        updatedAt: serverTimestamp()
    });
  });
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

/**
 * ## LÓGICA CORRIGIDA ##
 * Realiza a assinatura final do CONTRATO pelo hospital.
 */
export const signContractByHospital = async (contractId: string): Promise<void> => {
    const hospitalUser = auth.currentUser;
    if (!hospitalUser) throw new Error("Hospital não autenticado.");

    await runTransaction(db, async (transaction) => {
        const contractRef = doc(db, "contracts", contractId);
        const contractDoc = await transaction.get(contractRef); // LEITURA 1

        if (!contractDoc.exists() || contractDoc.data().status !== 'PENDING_HOSPITAL_SIGNATURE') { 
            throw new Error("Este contrato não está mais aguardando sua assinatura."); 
        }
        
        const contractData = contractDoc.data() as Contract;
        const shiftRequirementRef = doc(db, "shiftRequirements", contractData.shiftRequirementId);
        const doctorRef = doc(db, "users", contractData.doctorId);
        
        // MUDANÇA: Todas as leituras (GET) são feitas ANTES de qualquer escrita (UPDATE/SET)
        const doctorDoc = await transaction.get(doctorRef); // LEITURA 2
        
        // Agora começam as escritas...
        transaction.update(contractRef, { 
            status: 'ACTIVE_SIGNED', 
            hospitalSignature: {
                signedAt: serverTimestamp(),
                signedByUID: hospitalUser.uid
            },
            updatedAt: serverTimestamp() 
        });

        transaction.update(shiftRequirementRef, { 
            status: 'CONFIRMED', 
            updatedAt: serverTimestamp() 
        });
        
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