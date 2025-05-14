// lib/hospital-shift-service.ts
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  orderBy
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { getCurrentUserData, type HospitalProfile } from "./auth-service";

// --- TIPOS ESSENCIAIS ---

export interface ShiftRequirement {
  id?: string; // Gerado pelo Firestore

  hospitalId: string;
  hospitalName?: string;
  publishedByUID: string;
  publishedByName?: string;

  dates: Timestamp[]; // Array de Timestamps para todas as datas desta demanda/vaga mestra
  startTime: string;
  endTime: string;
  isOvernight: boolean;

  state: string;
  city: string;
  // locationDetails?: string; // Opcional

  serviceType: string;
  specialtiesRequired: string[];
  offeredRate: number;
  numberOfVacancies: number; // Nº de profissionais necessários para CADA data/horário listado em 'dates'
  notes?: string;

  // Status geral desta "Vaga Mestra"
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FULLY_STAFFED' | 'CANCELLED_BY_HOSPITAL' | 'EXPIRED';
  // A contagem de 'vacanciesFilled' se torna mais complexa.
  // Pode ser um map[dateString] -> count, ou um total.
  // Para simplificar o ShiftRequirement principal, omitiremos 'vacanciesFilled' aqui.
  // Ele poderá ser calculado dinamicamente ou gerenciado em uma subcoleção de "alocações".

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Tipos para o Dashboard (placeholders, como você já tem)
export interface HospitalKPIs { openShiftsCount: number | null; pendingActionCount?: number | null; totalDoctorsOnPlatform?: number | null; costLast30Days?: number | null; fillRateLast30Days?: number | null; avgTimeToFillHours?: number | null; topSpecialtyDemand?: string | null; }
export interface MonthlyCostData { name: string; valor: number; }
export interface SpecialtyDemandData { name: string; valor: number; }
export interface DashboardData { kpis: HospitalKPIs | null; monthlyCosts: MonthlyCostData[]; specialtyDemand: SpecialtyDemandData[]; }
export interface PendingMatch { id: string; date: Timestamp; startTime: string; endTime: string; specialty: string; status?: string; offeredRate?: number; doctorName?: string; }
export interface ConfirmedShift { id: string; date: Timestamp; startTime: string; endTime: string; doctorName: string; specialty?: string; }
export interface PastShift { id: string; date: Timestamp; startTime: string; endTime: string; doctorName: string; status: string; cost?: number; }


// Payload que o formulário envia para criar um ShiftRequirement.
// 'dates' já é um Timestamp[] aqui.
export type ShiftFormPayload = Omit<ShiftRequirement,
  "id" |
  "hospitalId" |
  "hospitalName" |
  "status" |
  // "vacanciesFilled" | // Omitido da Vaga Mestra por enquanto
  "createdAt" |
  "updatedAt" |
  "publishedByName" // Pode ser adicionado se o formulário o coletar
>;

export const addShiftRequirement = async (
  shiftPayload: ShiftFormPayload // Payload agora contém dates: Timestamp[]
): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error("[addShiftRequirement] Usuário não autenticado.");
    throw new Error("Usuário não autenticado. Não é possível publicar a demanda.");
  }

  const hospitalProfile = await getCurrentUserData() as HospitalProfile | null;
  if (!hospitalProfile || hospitalProfile.role !== 'hospital') {
    console.error("[addShiftRequirement] Perfil de hospital não encontrado ou inválido para UID:", currentUser.uid);
    throw new Error("Perfil de hospital não encontrado ou inválido para o usuário atual.");
  }

  // Construindo o objeto completo para salvar no Firestore
  const fullShiftData: Omit<ShiftRequirement, "id"> = {
    ...shiftPayload, // Contém: publishedByUID, dates (Timestamp[]), startTime, endTime, etc.
    hospitalId: currentUser.uid,
    hospitalName: hospitalProfile.displayName,
    publishedByName: currentUser.displayName || hospitalProfile.displayName || undefined,
    status: 'OPEN', // Status inicial da "Vaga Mestra"
    // vacanciesFilled: 0, // Omitido por enquanto
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  try {
    const docRef = await addDoc(collection(db, "shiftRequirements"), fullShiftData);
    console.log("[addShiftRequirement] Nova demanda de plantão (Vaga Mestra) adicionada com ID: ", docRef.id, "para hospital:", hospitalProfile.displayName);
    return docRef.id;
  } catch (error) {
    console.error("[addShiftRequirement] Erro ao adicionar demanda ao Firestore: ", error);
    if (error instanceof Error) {
        throw new Error(`Falha ao publicar demanda no banco de dados: ${error.message}`);
    }
    throw new Error("Falha ao publicar demanda no banco de dados. Erro desconhecido.");
  }
};

export const getHospitalShiftRequirements = async (): Promise<ShiftRequirement[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log("[getHospitalShiftRequirements] Nenhum usuário logado, retornando array vazio.");
    return [];
  }

  try {
    console.log("[getHospitalShiftRequirements] Buscando demandas para hospital UID:", currentUser.uid);
    // Ordena pelas mais recentes criadas. A ordenação por data interna ao array 'dates'
    // pode ser feita no cliente se necessário para exibição.
    const q = query(
        collection(db, "shiftRequirements"),
        where("hospitalId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    const shifts: ShiftRequirement[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Assegurando que os tipos estão corretos ao reconstruir o objeto
      shifts.push({
        id: doc.id,
        hospitalId: data.hospitalId,
        hospitalName: data.hospitalName,
        publishedByUID: data.publishedByUID,
        publishedByName: data.publishedByName,
        dates: (data.dates as any[] || []).map(d => d instanceof Timestamp ? d : Timestamp.fromDate(new Date())), // Garante que é array de Timestamps
        startTime: data.startTime,
        endTime: data.endTime,
        isOvernight: data.isOvernight,
        state: data.state,
        city: data.city,
        serviceType: data.serviceType,
        specialtiesRequired: data.specialtiesRequired || [],
        offeredRate: typeof data.offeredRate === 'number' ? data.offeredRate : 0,
        numberOfVacancies: typeof data.numberOfVacancies === 'number' ? data.numberOfVacancies : 1,
        notes: data.notes,
        status: data.status || 'OPEN', // Fallback para status
        // vacanciesFilled: typeof data.vacanciesFilled === 'number' ? data.vacanciesFilled : 0, // Omitido
        createdAt: data.createdAt as Timestamp, // Assegurar que é Timestamp
        updatedAt: data.updatedAt as Timestamp, // Assegurar que é Timestamp
      } as ShiftRequirement); // Fazendo um type assertion mais explícito
    });
    console.log(`[getHospitalShiftRequirements] Encontradas ${shifts.length} demandas para o hospital.`);
    return shifts;
  } catch (error) {
    console.error("[getHospitalShiftRequirements] Erro ao buscar demandas do Firestore:", error);
    if (error instanceof Error && error.message.includes("query requires an index")) {
        const firebaseError = error as any;
        console.error("Erro de índice do Firestore. Link para criar (copie e cole no navegador, pode precisar ajustar a query exata):", firebaseError.details);
        throw new Error(`Falha ao buscar demandas: Índice do Firestore necessário. ${error.message}. Verifique o console para o link do índice.`);
    }
    throw new Error("Não foi possível carregar as demandas publicadas.");
  }
};

export const deleteShiftRequirement = async (shiftId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) { throw new Error("Usuário não autenticado."); }
  try {
    const shiftDocRef = doc(db, "shiftRequirements", shiftId);
    await deleteDoc(shiftDocRef);
    console.log("[deleteShiftRequirement] Demanda deletada com ID:", shiftId);
  } catch (error) {
    console.error("[deleteShiftRequirement] Erro ao deletar demanda:", error);
    throw new Error("Falha ao cancelar a demanda.");
  }
};