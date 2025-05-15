// lib/contract-service.ts
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

export interface Contract {
  id: string;
  proposalId: string;
  shiftRequirementId: string;
  doctorId: string;
  hospitalId: string;

  hospitalName: string;
  doctorName: string; // Pode ser o displayName do médico

  shiftDates: Timestamp[];
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  serviceType: string;
  specialties: string[];
  locationCity: string;
  locationState: string;

  contractedRate: number; // Valor/hora final

  contractDocumentUrl?: string; // Link para um PDF, por exemplo
  contractTermsPreview?: string; // Um resumo dos termos

  status: 'PENDING_DOCTOR_SIGNATURE' | 'PENDING_HOSPITAL_SIGNATURE' | 'ACTIVE_SIGNED' | 'CANCELLED' | 'COMPLETED' | 'REJECTED';
  
  doctorSignature?: {
    signedAt: Timestamp;
    ipAddress?: string;
    userAgent?: string;
  };
  hospitalSignature?: {
    signedAt: Timestamp;
    signedByUID: string;
    signedByName?: string;
    ipAddress?: string;
    userAgent?: string;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Função para buscar contratos para o médico logado, filtrados por status
export const getContractsForDoctor = async (
  statuses: Contract['status'][]
): Promise<Contract[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getContractsForDoctor] Usuário não autenticado.");
    return [];
  }

  console.log(`[getContractsForDoctor] Buscando contratos para médico UID: ${currentUser.uid} com status: ${statuses.join(', ')}`);
  
  // SIMULAÇÃO DE DADOS MOCADOS POR ENQUANTO
  await new Promise(resolve => setTimeout(resolve, 700));

  const allMockContracts: Contract[] = [
    {
      id: "contract001",
      proposalId: "prop123",
      shiftRequirementId: "reqABC",
      doctorId: currentUser.uid, // Associa ao usuário logado para teste
      hospitalId: "hospXYZ",
      hospitalName: "Hospital Central da Cidade",
      doctorName: currentUser.displayName || "Dr. Médico Teste",
      shiftDates: [Timestamp.fromDate(new Date(2025, 6, 10)), Timestamp.fromDate(new Date(2025, 6, 11))], // Julho
      startTime: "07:00",
      endTime: "19:00",
      isOvernight: false,
      serviceType: "plantao_12h_diurno",
      specialties: ["Clínica Médica"],
      locationCity: "São Paulo",
      locationState: "SP",
      contractedRate: 115,
      contractDocumentUrl: "/docs/modelo_contrato.pdf", // Exemplo
      contractTermsPreview: "Contrato de prestação de serviços para plantão diurno nos dias X e Y...",
      status: 'PENDING_DOCTOR_SIGNATURE',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 2 * 86400000)), // 2 dias atrás
      updatedAt: Timestamp.fromDate(new Date(Date.now() - 2 * 86400000)),
    },
    {
      id: "contract002",
      proposalId: "prop789",
      shiftRequirementId: "reqGHI",
      doctorId: currentUser.uid,
      hospitalId: "hospQRS",
      hospitalName: "Clínica Vida Longa",
      doctorName: currentUser.displayName || "Dr. Médico Teste",
      shiftDates: [Timestamp.fromDate(new Date(2025, 6, 15))],
      startTime: "19:00",
      endTime: "07:00",
      isOvernight: true,
      serviceType: "plantao_12h_noturno",
      specialties: ["Pediatria"],
      locationCity: "Campinas",
      locationState: "SP",
      contractedRate: 140,
      status: 'PENDING_HOSPITAL_SIGNATURE', // Médico já assinou, aguardando hospital
      doctorSignature: { signedAt: Timestamp.fromDate(new Date(Date.now() - 86400000)) },
      createdAt: Timestamp.fromDate(new Date(Date.now() - 3 * 86400000)),
      updatedAt: Timestamp.fromDate(new Date(Date.now() - 1 * 86400000)),
    },
    {
      id: "contract003",
      proposalId: "propABC",
      shiftRequirementId: "reqJKL",
      doctorId: currentUser.uid,
      hospitalId: "hospLMN",
      hospitalName: "Hospital Esperança",
      doctorName: currentUser.displayName || "Dr. Médico Teste",
      shiftDates: [Timestamp.fromDate(new Date(2025, 5, 5)), Timestamp.fromDate(new Date(2025, 5, 6))], // Junho
      startTime: "08:00",
      endTime: "17:00",
      isOvernight: false,
      serviceType: "consulta_ambulatorial",
      specialties: ["Cardiologia"],
      locationCity: "São Paulo",
      locationState: "SP",
      contractedRate: 90,
      status: 'ACTIVE_SIGNED',
      doctorSignature: { signedAt: Timestamp.fromDate(new Date(Date.now() - 5 * 86400000)) },
      hospitalSignature: { signedAt: Timestamp.fromDate(new Date(Date.now() - 4 * 86400000)), signedByUID: "adminHospLMN" },
      createdAt: Timestamp.fromDate(new Date(Date.now() - 7 * 86400000)),
      updatedAt: Timestamp.fromDate(new Date(Date.now() - 4 * 86400000)),
    }
  ];

  // Filtra os mocks baseados nos status solicitados
  const filteredMocks = allMockContracts.filter(contract => statuses.includes(contract.status));
  console.log(`[getContractsForDoctor] Retornando ${filteredMocks.length} contratos mocados.`);
  return filteredMocks;

  // TODO: Substituir por uma query real ao Firestore
  // Exemplo de query:
  // const q = query(
  //   collection(db, "contracts"),
  //   where("doctorId", "==", currentUser.uid),
  //   where("status", "in", statuses), // Firestore 'in' query
  //   orderBy("createdAt", "desc")
  // );
  // const querySnapshot = await getDocs(q);
  // const contracts: Contract[] = [];
  // querySnapshot.forEach((docSnap) => {
  //   contracts.push({ id: docSnap.id, ...docSnap.data() } as Contract);
  // });
  // return contracts;
};

// Função para o médico assinar um contrato
export const signContractByDoctor = async (contractId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  console.log(`[signContractByDoctor] Médico ${currentUser.uid} assinando contrato ${contractId}`);
  const contractRef = doc(db, "contracts", contractId);

  // TODO: Validações (se o contrato é do médico, se o status é PENDING_DOCTOR_SIGNATURE)

  try {
    await updateDoc(contractRef, {
      status: 'PENDING_HOSPITAL_SIGNATURE', // Próximo status após assinatura do médico
      doctorSignature: {
        signedAt: serverTimestamp(),
        // Poderia adicionar IP, User Agent, etc., se coletado
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