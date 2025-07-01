// lib/contract-service.ts
"use strict";

import { doc, collection, query, where, getDocs, updateDoc, serverTimestamp, Timestamp, orderBy, runTransaction } from "firebase/firestore";
import { db, auth } from "./firebase";
// Estas importações deixam de ser necessárias para as funções do hospital
// import { type ShiftProposal } from "./proposal-service"; 
// import { type PotentialMatch } from "./match-service";
import { type DoctorProfile } from "./auth-service";

export interface Contract {
  id: string;
  proposalId: string; // Pode ser mantido por legado ou removido
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
  contractedRate: number; // Valor do médico
  offeredRateByHospital?: number; // Valor pago pelo hospital
  platformMargin?: number; // Margem da plataforma
  contractDocumentUrl?: string;
  contractTermsPreview?: string;
  status: 'PENDING_DOCTOR_SIGNATURE' | 'PENDING_HOSPITAL_SIGNATURE' | 'ACTIVE_SIGNED' | 'CANCELLED' | 'COMPLETED' | 'REJECTED';
  doctorSignature?: { signedAt: Timestamp; ipAddress?: string; };
  hospitalSignature?: { signedAt: Timestamp; signedByUID: string; };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Esta função já estava correta e busca da coleção `contracts`
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

// Esta função já estava correta, apenas precisa que o `timeSlotId` exista no contrato, o que garantimos na criação
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
    // Garante que o timeSlotId está presente
    const timeSlotId = contractData.timeSlotId;
    if (!timeSlotId) throw new Error("ID da disponibilidade original não encontrado no contrato.");

    const timeSlotRef = doc(db, "doctorTimeSlots", timeSlotId);
    const timeSlotDoc = await transaction.get(timeSlotRef);

    // Verifica se a disponibilidade ainda está disponível para evitar double booking
    if(timeSlotDoc.exists() && timeSlotDoc.data()?.status !== 'AVAILABLE'){
        throw new Error("Esta disponibilidade não está mais livre. A vaga pode ter sido preenchida.");
    }

    // Atualiza o Contrato para aguardar o Hospital
    transaction.update(contractRef, {
      status: 'PENDING_HOSPITAL_SIGNATURE',
      doctorSignature: { signedAt: serverTimestamp() },
      updatedAt: serverTimestamp()
    });

    // Atualiza a Disponibilidade do médico para 'BOOKED' (Reservada/Contratada)
    transaction.update(timeSlotRef, {
        status: 'BOOKED',
        relatedContractId: contractId, // Adiciona uma referência ao contrato
        updatedAt: serverTimestamp()
    });
  });
};

/**
 * ## LÓGICA ATUALIZADA E UNIFICADA ##
 * Busca os contratos que estão pendentes de assinatura PELO HOSPITAL.
 * A busca agora é feita diretamente na coleção `contracts`.
 */
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
 * ## LÓGICA ATUALIZADA E UNIFICADA ##
 * Realiza a assinatura final do CONTRATO pelo hospital.
 * Opera diretamente no documento da coleção `contracts`.
 */
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

        // Referência à demanda original para marcá-la como CONFIRMADA
        const shiftRequirementRef = doc(db, "shiftRequirements", contractData.shiftRequirementId);

        // 1. Atualiza o status do contrato para ATIVO
        transaction.update(contractRef, { 
            status: 'ACTIVE_SIGNED', 
            hospitalSignature: {
                signedAt: serverTimestamp(),
                signedByUID: hospitalUser.uid
            },
            updatedAt: serverTimestamp() 
        });

        // 2. Atualiza a demanda original para CONFIRMADA
        transaction.update(shiftRequirementRef, { 
            status: 'CONFIRMED', 
            updatedAt: serverTimestamp() 
        });

        // 3. Adiciona o médico à lista de médicos do hospital (lógica mantida)
        const doctorId = contractData.doctorId;
        const doctorRef = doc(db, "users", doctorId);
        const doctorDoc = await transaction.get(doctorRef);
        
        if (doctorDoc.exists()) {
            const doctorData = doctorDoc.data() as DoctorProfile;
            const hospitalDoctorRef = doc(collection(db, 'users', hospitalUser.uid, 'hospitalDoctors'), doctorId);
            transaction.set(hospitalDoctorRef, {
                name: doctorData.displayName || 'Nome não informado',
                crm: doctorData.professionalCrm || 'Não informado',
                email: doctorData.email || 'Não informado',
                phone: doctorData.phone || 'Não informado',
                specialties: doctorData.specialties || [],
                status: 'ACTIVE_PLATFORM',
                source: 'PLATFORM',
                addedAt: serverTimestamp()
            }, { merge: true }); // Usar merge para não sobrescrever dados existentes
        }
    });
};