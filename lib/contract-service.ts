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
  orderBy
} from "firebase/firestore";
import { db, auth } from "./firebase";

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
      where("status", "in", statuses), // A query 'in' busca por qualquer valor no array
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
 */
export const signContractByDoctor = async (contractId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  const contractRef = doc(db, "contracts", contractId);
  try {
    await updateDoc(contractRef, {
      status: 'PENDING_HOSPITAL_SIGNATURE', // Próximo status
      doctorSignature: {
        signedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp()
    });
    console.log(`[signContractByDoctor] Contrato ${contractId} assinado pelo médico.`);
    // TODO: Notificar o hospital
  } catch (error) {
    console.error(`[signContractByDoctor] Erro ao assinar contrato ${contractId}:`, error);
    throw error;
  }
};