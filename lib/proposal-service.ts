// lib/proposal-service.ts
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db, auth } from "./firebase";

export interface ShiftProposal {
  id: string; // ID do documento da proposta (ex: ID do potentialMatch ou de um novo doc de proposta)
  originalShiftRequirementId: string; // ID da Demanda Mestra do Hospital
  hospitalId: string;
  hospitalName: string;
  hospitalCity: string;
  hospitalState: string;

  // As datas e horários específicos que foram oferecidos ao médico para ESTA proposta
  // Pode ser um subconjunto das datas da Demanda Mestra original
  shiftDates: Timestamp[];
  startTime: string;
  endTime: string;
  isOvernight: boolean;

  serviceType: string;
  specialties: string[]; // Especialidades relevantes para esta proposta
  offeredRateToDoctor: number; // Valor/hora que o médico receberá (definido pelo backoffice)
  notesFromHospital?: string; // Observações do hospital para esta demanda
  notesFromBackoffice?: string; // Observações do backoffice para o médico sobre esta proposta

  status: 'AWAITING_DOCTOR_ACCEPTANCE' | 'DOCTOR_ACCEPTED' | 'DOCTOR_REJECTED' | 'EXPIRED';
  // Adicionar mais status conforme o fluxo evolui (ex: PENDING_CONTRACT, CONFIRMED)

  deadlineForDoctorResponse?: Timestamp;
  doctorResponseAt?: Timestamp;
  doctorRejectionReason?: string;

  createdAt: Timestamp; // Quando a proposta foi feita ao médico
  updatedAt: Timestamp;
}

// Função para buscar propostas pendentes para o médico logado
export const getPendingProposalsForDoctor = async (): Promise<ShiftProposal[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getPendingProposalsForDoctor] Usuário não autenticado.");
    return [];
  }

  console.log("[getPendingProposalsForDoctor] Buscando propostas para médico UID:", currentUser.uid);
  // Simulação de dados mocados por enquanto
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simula delay da API

  // TODO: Substituir por uma query real ao Firestore
  // Exemplo de query:
  // const q = query(
  //   collection(db, "shiftProposals"), // Ou "potentialMatches"
  //   where("doctorId", "==", currentUser.uid),
  //   where("status", "==", "AWAITING_DOCTOR_ACCEPTANCE"),
  //   orderBy("createdAt", "desc")
  // );
  // const querySnapshot = await getDocs(q);
  // const proposals: ShiftProposal[] = [];
  // querySnapshot.forEach((docSnap) => {
  //   proposals.push({ id: docSnap.id, ...docSnap.data() } as ShiftProposal);
  // });
  // return proposals;

  // Dados mocados para UI:
  const mockProposals: ShiftProposal[] = [
    {
      id: "prop123",
      originalShiftRequirementId: "reqABC",
      hospitalId: "hospXYZ",
      hospitalName: "Hospital Central da Cidade",
      hospitalCity: "São Paulo",
      hospitalState: "SP",
      shiftDates: [Timestamp.fromDate(new Date(2025, 5, 20)), Timestamp.fromDate(new Date(2025, 5, 21))], // Ex: 20 e 21 de Junho de 2025
      startTime: "07:00",
      endTime: "19:00",
      isOvernight: false,
      serviceType: "plantao_12h_diurno",
      specialties: ["Clínica Médica"],
      offeredRateToDoctor: 110,
      notesFromHospital: "Plantão com boa movimentação, equipe de apoio completa.",
      status: 'AWAITING_DOCTOR_ACCEPTANCE',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      id: "prop456",
      originalShiftRequirementId: "reqDEF",
      hospitalId: "hospQRS",
      hospitalName: "Clínica Saúde & Bem Estar",
      hospitalCity: "Campinas",
      hospitalState: "SP",
      shiftDates: [Timestamp.fromDate(new Date(2025, 5, 25))], // Ex: 25 de Junho de 2025
      startTime: "19:00",
      endTime: "07:00",
      isOvernight: true,
      serviceType: "plantao_12h_noturno",
      specialties: ["Pediatria", "Neonatologia"],
      offeredRateToDoctor: 135,
      notesFromBackoffice: "Excelente oportunidade em unidade de referência.",
      status: 'AWAITING_DOCTOR_ACCEPTANCE',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 86400000)), // Ontem
      updatedAt: Timestamp.fromDate(new Date(Date.now() - 86400000)),
      deadlineForDoctorResponse: Timestamp.fromDate(new Date(Date.now() + 3 * 86400000)) // Daqui a 3 dias
    }
  ];
  return mockProposals;
};

// Função para o médico aceitar uma proposta
export const acceptProposal = async (proposalId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  console.log(`[acceptProposal] Médico ${currentUser.uid} aceitando proposta ${proposalId}`);
  const proposalRef = doc(db, "shiftProposals", proposalId); // Ajuste a coleção se necessário
  
  // TODO: Adicionar validação para garantir que o médico só aceite suas próprias propostas
  // e que o status permita aceitação.

  try {
    await updateDoc(proposalRef, {
      status: 'DOCTOR_ACCEPTED',
      doctorResponseAt: serverTimestamp()
    });
    console.log(`[acceptProposal] Proposta ${proposalId} aceita.`);
    // TODO: Aqui você pode disparar uma notificação para o hospital/backoffice
    // ou criar/atualizar um documento de "Contrato"
  } catch (error) {
    console.error(`[acceptProposal] Erro ao aceitar proposta ${proposalId}:`, error);
    throw error;
  }
};

// Função para o médico recusar uma proposta
export const rejectProposal = async (proposalId: string, reason?: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  console.log(`[rejectProposal] Médico ${currentUser.uid} recusando proposta ${proposalId} com motivo: ${reason}`);
  const proposalRef = doc(db, "shiftProposals", proposalId); // Ajuste a coleção
  
  // TODO: Validações
  
  try {
    await updateDoc(proposalRef, {
      status: 'DOCTOR_REJECTED',
      doctorResponseAt: serverTimestamp(),
      doctorRejectionReason: reason || "Não especificado"
    });
    console.log(`[rejectProposal] Proposta ${proposalId} recusada.`);
  } catch (error) {
    console.error(`[rejectProposal] Erro ao recusar proposta ${proposalId}:`, error);
    throw error;
  }
};