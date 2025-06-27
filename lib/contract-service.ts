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
import { type PotentialMatch } from "./match-service";

// --- ATUALIZAÇÃO: Interface do Contrato Final ---
// Este será o documento final, guardado numa nova coleção 'contracts'
export interface Contract {
  id: string;
  proposalId: string;
  shiftRequirementId: string;
  timeSlotId: string;
  doctorId: string;
  hospitalId: string;
  
  // Detalhes do Plantão
  shiftDetails: {
    hospitalName: string;
    doctorName: string;
    shiftDate: Timestamp;
    startTime: string;
    endTime: string;
    isOvernight: boolean;
    serviceType: string;
    specialties: string[];
    locationCity: string;
    locationState: string;
  };

  // --- NOVIDADE: Gestão Financeira ---
  financials: {
    ratePaidByHospital: number;     // Valor que o hospital paga (Ex: R$ 120)
    rateReceivedByDoctor: number;   // Valor que o médico recebe (Ex: R$ 100)
    platformMargin: number;         // Diferença para a plataforma (Ex: R$ 20)
  };

  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  signedByDoctorAt: Timestamp; // Virá da proposta
  signedByHospitalAt: Timestamp; // Definido no momento da assinatura
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Sua função original, mantida intacta para outras partes do sistema
export const getContractsForDoctor = async (statuses: string[]): Promise<any[]> => { /* ... seu código original ... */ return []; };
export const signContractByDoctor = async (contractId: string): Promise<void> => { /* ... seu código original ... */ };


// --- FUNÇÕES NOVAS ATUALIZADAS PARA O FLUXO DO HOSPITAL ---

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
    throw new Error("Não foi possível carregar os contratos pendentes. Verifique se o índice do Firestore foi criado.");
  }
};

// --- LÓGICA ATUALIZADA E COMPLETA PARA A AÇÃO DO HOSPITAL ---
export const signContractByHospital = async (proposalId: string): Promise<void> => {
    const hospitalId = auth.currentUser?.uid;
    if (!hospitalId) throw new Error("Hospital não autenticado.");

    try {
        await runTransaction(db, async (transaction) => {
            const proposalRef = doc(db, "shiftProposals", proposalId);
            const proposalDoc = await transaction.get(proposalRef);

            if (!proposalDoc.exists() || proposalDoc.data().status !== 'DOCTOR_ACCEPTED_PENDING_CONTRACT') {
                throw new Error("Este contrato não está mais aguardando sua assinatura.");
            }
            const proposalData = proposalDoc.data() as ShiftProposal;
            const matchId = proposalData.potentialMatchId;
            if (!matchId) throw new Error("ID do Match original não encontrado na proposta.");

            // Pega os dados financeiros do match original
            const matchRef = doc(db, "potentialMatches", matchId);
            const matchDoc = await transaction.get(matchRef);
            if (!matchDoc.exists()) throw new Error("Match original não encontrado.");
            const matchData = matchDoc.data() as PotentialMatch;

            // 1. Cria o documento final na coleção 'contracts'
            const newContractRef = doc(collection(db, "contracts"));
            const finalContractData: Omit<Contract, 'id'> = {
                proposalId: proposalId,
                shiftRequirementId: proposalData.originalShiftRequirementId,
                timeSlotId: proposalData.originalTimeSlotId || 'N/A',
                doctorId: proposalData.doctorId,
                hospitalId: proposalData.hospitalId,
                shiftDetails: {
                    hospitalName: proposalData.hospitalName,
                    doctorName: proposalData.doctorName || 'N/A',
                    shiftDate: proposalData.shiftDates[0],
                    startTime: proposalData.startTime,
                    endTime: proposalData.endTime,
                    isOvernight: proposalData.isOvernight,
                    serviceType: proposalData.serviceType,
                    specialties: proposalData.specialties,
                    locationCity: proposalData.hospitalCity,
                    locationState: proposalData.hospitalState,
                },
                financials: {
                    ratePaidByHospital: matchData.offeredRateByHospital,
                    rateReceivedByDoctor: proposalData.offeredRateToDoctor,
                    platformMargin: matchData.offeredRateByHospital - proposalData.offeredRateToDoctor,
                },
                status: 'ACTIVE',
                signedByDoctorAt: proposalData.doctorResponseAt || Timestamp.now(),
                signedByHospitalAt: serverTimestamp() as Timestamp,
                createdAt: serverTimestamp() as Timestamp,
                updatedAt: serverTimestamp() as Timestamp,
            };
            transaction.set(newContractRef, finalContractData);

            // 2. Atualiza a proposta original para um estado final
            transaction.update(proposalRef, {
                status: 'CONTRACT_SENT_TO_HOSPITAL', // ou 'COMPLETED'
                contractId: newContractRef.id,
                updatedAt: serverTimestamp()
            });

            // 3. Adiciona o médico à gestão do hospital
            const hospitalRef = doc(db, "users", hospitalId);
            const contractedDoctorRef = doc(collection(hospitalRef, 'contractedDoctors'), proposalData.doctorId);
            transaction.set(contractedDoctorRef, {
                doctorId: proposalData.doctorId,
                doctorName: proposalData.doctorName || "N/A",
                contractId: newContractRef.id,
                shiftDate: proposalData.shiftDates[0],
                joinedAt: serverTimestamp()
            });
        });

    } catch (error) {
        console.error("Erro na transação de assinatura do hospital:", error);
        throw error;
    }
};