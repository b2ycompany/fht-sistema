// lib/contract-service.ts
"use strict";

import {
  doc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
  orderBy,
  runTransaction,
  writeBatch,
  getDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { type ShiftProposal } from "./proposal-service";

export interface Contract {
  id: string;
  proposalId: string;
  shiftRequirementId: string;
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

/**
 * Busca contratos para o médico logado, filtrados por um array de status.
 * (SUA FUNÇÃO ORIGINAL - MANTIDA 100% INTACTA)
 */
export const getContractsForDoctor = async (
  statuses: Contract['status'][]
): Promise<Contract[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getContractsForDoctor] Usuário não autenticado.");
    return [];
  }
  
  if (!statuses || statuses.length === 0) {
    console.warn("[getContractsForDoctor] Nenhum status fornecido para a busca.");
    return [];
  }

  try {
    console.log(`[getContractsForDoctor] Buscando contratos REAIS para médico UID: ${currentUser.uid} com status: ${statuses.join(', ')}`);

    const contractsRef = collection(db, "contracts");
    const q = query(
      contractsRef,
      where("doctorId", "==", currentUser.uid),
      where("status", "in", statuses),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    const contracts: Contract[] = [];
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      contracts.push({ 
        id: docSnap.id, 
        ...data,
        shiftDates: data.shiftDates || [],
        specialties: data.specialties || []
      } as Contract);
    });
    
    console.log(`[getContractsForDoctor] Encontrados ${contracts.length} contratos reais.`);
    return contracts;

  } catch(error) {
    console.error("[getContractsForDoctor] Erro ao buscar contratos no Firestore:", error);
    throw new Error("Falha ao carregar os contratos.");
  }
};

/**
 * Função para o médico assinar um contrato.
 * (SUA FUNÇÃO ORIGINAL - MANTIDA 100% INTACTA)
 */
export const signContractByDoctor = async (contractId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  const contractRef = doc(db, "contracts", contractId);
  try {
    await updateDoc(contractRef, {
      status: 'PENDING_HOSPITAL_SIGNATURE',
      doctorSignature: {
        signedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp()
    });
    console.log(`[signContractByDoctor] Contrato ${contractId} assinado pelo médico.`);
  } catch (error) {
    console.error(`[signContractByDoctor] Erro ao assinar contrato ${contractId}:`, error);
    throw error;
  }
};


// --- FUNÇÕES NOVAS ADICIONADAS PARA O FLUXO DO HOSPITAL ---

/**
 * Busca propostas que foram aceitas por médicos e agora aguardam ação do hospital.
 */
export const getPendingContractsForHospital = async (hospitalId: string): Promise<ShiftProposal[]> => {
  if (!hospitalId) return [];
  
  const proposalsRef = collection(db, "shiftProposals");
  const q = query(
    proposalsRef,
    where("hospitalId", "==", hospitalId),
    where("status", "==", "DOCTOR_ACCEPTED_PENDING_CONTRACT"),
    orderBy("updatedAt", "desc")
  );

  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftProposal));
  } catch (error) {
    console.error("Erro ao buscar contratos pendentes para o hospital:", error);
    throw new Error("Não foi possível carregar os contratos pendentes.");
  }
};

/**
 * O Hospital assina o contrato, finalizando o processo de contratação.
 */
export const signContractByHospital = async (proposalId: string): Promise<void> => {
    const hospitalId = auth.currentUser?.uid;
    if (!hospitalId) throw new Error("Hospital não autenticado.");

    const proposalRef = doc(db, "shiftProposals", proposalId);
    const hospitalRef = doc(db, "users", hospitalId);
    
    try {
        const proposalData = (await getDoc(proposalRef)).data();
        if (!proposalData || proposalData.status !== 'DOCTOR_ACCEPTED_PENDING_CONTRACT') {
            throw new Error("Este contrato não está mais aguardando sua assinatura.");
        }
        
        const doctorId = proposalData.doctorId;
        const batch = writeBatch(db);

        // 1. Atualiza o status da proposta/contrato para um estado final
        batch.update(proposalRef, {
            status: 'CONTRACT_SENT_TO_HOSPITAL', // Ou um status final como 'ACTIVE_SIGNED'
            updatedAt: serverTimestamp()
        });

        // 2. Adiciona o médico à subcoleção 'contractedDoctors' do hospital
        const contractedDoctorRef = doc(collection(hospitalRef, 'contractedDoctors'), doctorId);
        batch.set(contractedDoctorRef, {
            doctorId: doctorId,
            doctorName: proposalData.doctorName || "N/A",
            proposalId: proposalId,
            shiftDate: proposalData.shiftDates[0],
            shiftStartTime: proposalData.startTime,
            shiftEndTime: proposalData.endTime,
            serviceType: proposalData.serviceType,
            specialties: proposalData.specialties,
            contractedAt: serverTimestamp()
        });
        
        await batch.commit();
        console.log(`Contrato ${proposalId} assinado pelo hospital. Médico ${doctorId} agora faz parte da gestão.`);

    } catch (error) {
        console.error("Erro na transação de assinatura do hospital:", error);
        throw error;
    }
};