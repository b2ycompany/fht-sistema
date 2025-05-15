// lib/checkin-service.ts
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
  addDoc // Para criar novos registros de check-in se necessário
} from "firebase/firestore";
import { db, auth } from "./firebase";

export interface CheckinRecord {
  id: string; // ID do documento Firestore
  contractId: string; // ID do contrato ou da alocação do plantão
  shiftRequirementId: string; // ID da demanda original do hospital
  doctorId: string;
  hospitalId: string;
  hospitalName: string; // Denormalizado

  shiftDate: Timestamp; // A data específica deste plantão
  expectedStartTime: string; // Ex: "07:00"
  expectedEndTime: string;   // Ex: "19:00"

  checkinAt?: Timestamp;
  checkinLatitude?: number;
  checkinLongitude?: number;
  checkinPhotoUrl?: string; // Para leitura facial no futuro

  checkoutAt?: Timestamp;
  checkoutLatitude?: number;
  checkoutLongitude?: number;
  checkoutPhotoUrl?: string;

  // Status do plantão em relação ao ponto
  status: 'SCHEDULED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'MISSED' | 'CANCELLED_CONFIRMED_SHIFT'; 
  // Outros campos: horas trabalhadas (calculado), etc.
}

// Função para buscar plantões agendados e ativos para check-in/out
export const getActiveShiftsForCheckin = async (): Promise<CheckinRecord[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getActiveShiftsForCheckin] Usuário não autenticado.");
    return [];
  }
  console.log("[getActiveShiftsForCheckin] Buscando plantões para check-in/out para médico UID:", currentUser.uid);

  // SIMULAÇÃO DE DADOS MOCADOS
  await new Promise(resolve => setTimeout(resolve, 800));
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() -1);


  const mockRecords: CheckinRecord[] = [
    {
      id: "checkin001",
      contractId: "contract003", // ID de um contrato ativo
      shiftRequirementId: "reqJKL",
      doctorId: currentUser.uid,
      hospitalId: "hospLMN",
      hospitalName: "Hospital Esperança",
      shiftDate: Timestamp.fromDate(today), // Plantão hoje
      expectedStartTime: "07:00",
      expectedEndTime: "19:00",
      status: 'SCHEDULED', // Ainda não fez check-in
    },
    {
      id: "checkin002",
      contractId: "contract004",
      shiftRequirementId: "reqMNO",
      doctorId: currentUser.uid,
      hospitalId: "hospABC",
      hospitalName: "Pronto Atendimento Veloz",
      shiftDate: Timestamp.fromDate(yesterday), // Plantão de ontem que o médico já fez check-in
      expectedStartTime: "19:00",
      expectedEndTime: "07:00", // Overnight
      checkinAt: Timestamp.fromDate(new Date(yesterday.setHours(18, 55))), // Check-in 5 min antes
      checkinLatitude: -23.5505,
      checkinLongitude: -46.6333,
      status: 'CHECKED_IN', 
    },
    {
      id: "checkin003",
      contractId: "contract005",
      shiftRequirementId: "reqPQR",
      doctorId: currentUser.uid,
      hospitalId: "hospDEF",
      hospitalName: "Hospital Municipal",
      shiftDate: Timestamp.fromDate(tomorrow), // Plantão de amanhã
      expectedStartTime: "13:00",
      expectedEndTime: "19:00",
      status: 'SCHEDULED',
    }
  ];
  
  // Em um sistema real, a query seria algo como:
  // const q = query(
  //   collection(db, "checkinRecords"), // ou "shiftAllocations"
  //   where("doctorId", "==", currentUser.uid),
  //   where("status", "in", ["SCHEDULED", "CHECKED_IN"]), // Plantões que precisam de ação
  //   orderBy("shiftDate", "asc"),
  //   orderBy("expectedStartTime", "asc")
  // );
  // const querySnapshot = await getDocs(q);
  // ... mapear para CheckinRecord[] ...

  return mockRecords.filter(r => r.status === 'SCHEDULED' || r.status === 'CHECKED_IN');
};

// Função para realizar o check-in
export const performCheckin = async (
  recordId: string, // ID do CheckinRecord ou da Alocação
  latitude: number,
  longitude: number,
  photoUrl?: string // Opcional para leitura facial
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  console.log(`[performCheckin] Médico ${currentUser.uid} fazendo check-in para registro ${recordId}`);
  const recordRef = doc(db, "checkinRecords", recordId); // Ajuste a coleção se necessário

  // TODO: Validações (se o registro pertence ao médico, se o status é 'SCHEDULED', se está dentro do horário permitido para check-in)

  try {
    await updateDoc(recordRef, {
      status: 'CHECKED_IN',
      checkinAt: serverTimestamp(),
      checkinLatitude: latitude,
      checkinLongitude: longitude,
      ...(photoUrl && { checkinPhotoUrl: photoUrl }), // Adiciona foto se fornecida
      updatedAt: serverTimestamp()
    });
    console.log(`[performCheckin] Check-in realizado para ${recordId}.`);
  } catch (error) {
    console.error(`[performCheckin] Erro ao realizar check-in para ${recordId}:`, error);
    throw error;
  }
};

// Função para realizar o check-out
export const performCheckout = async (
  recordId: string,
  latitude: number,
  longitude: number,
  photoUrl?: string
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  console.log(`[performCheckout] Médico ${currentUser.uid} fazendo check-out para registro ${recordId}`);
  const recordRef = doc(db, "checkinRecords", recordId); // Ajuste a coleção

  // TODO: Validações (se o status é 'CHECKED_IN', etc.)

  try {
    await updateDoc(recordRef, {
      status: 'CHECKED_OUT',
      checkoutAt: serverTimestamp(),
      checkoutLatitude: latitude,
      checkoutLongitude: longitude,
      ...(photoUrl && { checkoutPhotoUrl: photoUrl }),
      updatedAt: serverTimestamp()
    });
    console.log(`[performCheckout] Check-out realizado para ${recordId}.`);
  } catch (error) {
    console.error(`[performCheckout] Erro ao realizar check-out para ${recordId}:`, error);
    throw error;
  }
};