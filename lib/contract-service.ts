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
import { type DoctorProfile } from "./auth-service";

export interface Contract {
  id: string; proposalId: string; shiftRequirementId: string; doctorId: string; hospitalId: string; hospitalName: string; doctorName: string;
  shiftDates: Timestamp[]; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialties: string[];
  locationCity: string; locationState: string; contractedRate: number; contractDocumentUrl?: string; contractTermsPreview?: string;
  status: 'PENDING_DOCTOR_SIGNATURE' | 'PENDING_HOSPITAL_SIGNATURE' | 'ACTIVE_SIGNED' | 'CANCELLED' | 'COMPLETED' | 'REJECTED';
  doctorSignature?: { signedAt: Timestamp; ipAddress?: string; };
  hospitalSignature?: { signedAt: Timestamp; signedByUID: string; };
  createdAt: Timestamp; updatedAt: Timestamp;
}

// Suas funções originais estão seguras.
export const getContractsForDoctor = async (statuses: Contract['status'][]): Promise<Contract[]> => { /* ... seu código original aqui ... */ return []; };
export const signContractByDoctor = async (contractId: string): Promise<void> => { /* ... seu código original aqui ... */ };
export const getPendingContractsForHospital = async (hospitalId: string): Promise<ShiftProposal[]> => { /* ... seu código original aqui ... */ return []; };

// --- LÓGICA ATUALIZADA E FINAL PARA A AÇÃO DO HOSPITAL ---
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
            const doctorId = proposalData.doctorId;

            const doctorRef = doc(db, "users", doctorId);
            const doctorDoc = await transaction.get(doctorRef);
            if (!doctorDoc.exists()) throw new Error("Perfil do médico não encontrado.");
            const doctorData = doctorDoc.data() as DoctorProfile;
            
            const shiftRequirementRef = doc(db, "shiftRequirements", proposalData.originalShiftRequirementId);

            // 1. Atualiza a proposta para um estado final
            transaction.update(proposalRef, { status: 'CONTRACT_SIGNED_BY_HOSPITAL', updatedAt: serverTimestamp() });
            
            // 2. Fecha a demanda original
            transaction.update(shiftRequirementRef, { status: 'CONFIRMED', updatedAt: serverTimestamp() });

            // 3. Adiciona o médico à lista principal do hospital, com valores padrão para segurança
            const hospitalDoctorRef = doc(collection(db, 'users', hospitalId, 'hospitalDoctors'), doctorId);
            transaction.set(hospitalDoctorRef, {
                name: doctorData.displayName || 'Nome não disponível',
                crm: doctorData.professionalCrm || 'Não informado', // CORREÇÃO APLICADA
                email: doctorData.email || 'Não informado',
                phone: doctorData.phone || 'Não informado',
                specialties: doctorData.specialties || [],
                status: 'ACTIVE_PLATFORM',
                source: 'PLATFORM',
                addedAt: serverTimestamp()
            });
        });
    } catch (error) {
        console.error("Erro na transação de assinatura do hospital:", error);
        throw error;
    }
};