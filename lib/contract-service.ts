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

export const getContractsForDoctor = async (statuses: Contract['status'][]): Promise<Contract[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) { console.warn("[getContractsForDoctor] Usuário não autenticado."); return []; }
  if (!statuses || statuses.length === 0) { console.warn("[getContractsForDoctor] Nenhum status fornecido."); return []; }
  try {
    const contractsRef = collection(db, "contracts");
    const q = query(contractsRef, where("doctorId", "==", currentUser.uid), where("status", "in", statuses), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const contracts: Contract[] = [];
    querySnapshot.forEach((docSnap) => { contracts.push({ id: docSnap.id, ...docSnap.data() } as Contract); });
    return contracts;
  } catch(error) {
    console.error("[getContractsForDoctor] Erro:", error);
    throw new Error("Falha ao carregar os contratos.");
  }
};

export const signContractByDoctor = async (contractId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  const contractRef = doc(db, "contracts", contractId);
  try {
    await updateDoc(contractRef, { status: 'PENDING_HOSPITAL_SIGNATURE', doctorSignature: { signedAt: serverTimestamp() }, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error(`[signContractByDoctor] Erro ao assinar ${contractId}:`, error);
    throw error;
  }
};

export const getPendingContractsForHospital = async (hospitalId: string): Promise<ShiftProposal[]> => {
  if (!hospitalId) return [];
  const proposalsRef = collection(db, "shiftProposals");
  const q = query(proposalsRef, where("hospitalId", "==", hospitalId), where("status", "==", "DOCTOR_ACCEPTED_PENDING_CONTRACT"), orderBy("updatedAt", "desc"));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftProposal));
  } catch (error) {
    console.error("Erro ao buscar contratos pendentes:", error);
    throw new Error("Não foi possível carregar os contratos pendentes.");
  }
};

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

            transaction.update(proposalRef, { status: 'CONTRACT_SIGNED_BY_HOSPITAL', updatedAt: serverTimestamp() });
            
            transaction.update(shiftRequirementRef, { status: 'CONFIRMED', updatedAt: serverTimestamp() });

            const hospitalDoctorRef = doc(collection(db, 'users', hospitalId, 'hospitalDoctors'), doctorId);
            transaction.set(hospitalDoctorRef, {
                name: doctorData.displayName,
                crm: doctorData.professionalCrm,
                email: doctorData.email,
                phone: doctorData.phone,
                specialties: doctorData.specialties,
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