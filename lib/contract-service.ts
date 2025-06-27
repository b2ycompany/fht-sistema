// lib/contract-service.ts
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
  Timestamp,
  orderBy,
  runTransaction
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { type ShiftProposal } from "./proposal-service"; // Importando o tipo

// Interface do Contrato (se você quiser ter uma coleção separada para contratos finalizados)
export interface Contract {
  id: string; // ID do documento do contrato
  proposalId: string; // ID da proposta que originou este contrato
  shiftRequirementId: string; // ID da demanda original
  hospitalId: string;
  doctorId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  signedByDoctorAt: Timestamp;
  signedByHospitalAt: Timestamp;
  createdAt: Timestamp;
  // ... outros detalhes do contrato
}

// --- FUNÇÕES ADICIONADAS PARA O FLUXO DO HOSPITAL ---

/**
 * Busca propostas que foram aceitas por médicos e agora aguardam ação do hospital.
 */
export const getPendingContractsForHospital = async (hospitalId: string): Promise<ShiftProposal[]> => {
  if (!hospitalId) return [];
  
  const proposalsRef = collection(db, "shiftProposals");
  // O status buscado agora é o que definimos quando o médico aceita
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
        await runTransaction(db, async (transaction) => {
            const proposalDoc = await transaction.get(proposalRef);
            if (!proposalDoc.exists() || proposalDoc.data().status !== 'DOCTOR_ACCEPTED_PENDING_CONTRACT') {
                throw new Error("Este contrato não está mais aguardando sua assinatura.");
            }
            const proposalData = proposalDoc.data();
            const doctorId = proposalData.doctorId;

            // 1. Atualiza o status da proposta/contrato para um estado final
            transaction.update(proposalRef, {
                status: 'CONTRACT_SENT_TO_HOSPITAL', // Status que indica que o fluxo foi completado pelo hospital
                updatedAt: serverTimestamp()
            });

            // 2. Adiciona o médico à subcoleção 'contractedDoctors' do hospital
            const contractedDoctorRef = doc(collection(hospitalRef, 'contractedDoctors'), doctorId);
            transaction.set(contractedDoctorRef, {
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
        });
        const proposalData = (await getDoc(proposalRef)).data();
        console.log(`Contrato ${proposalId} assinado pelo hospital. Médico ${proposalData?.doctorId} agora faz parte da gestão.`);
    } catch (error) {
        console.error("Erro na transação de assinatura do hospital:", error);
        throw error;
    }
};