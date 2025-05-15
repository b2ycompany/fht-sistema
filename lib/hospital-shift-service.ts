// lib/hospital-shift-service.ts
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  orderBy
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { getCurrentUserData, type HospitalProfile } from "./auth-service";

// --- TIPOS ESSENCIAIS ---

export interface ShiftRequirement {
  id?: string;
  hospitalId: string;
  hospitalName?: string;
  publishedByUID: string;
  publishedByName?: string;

  dates: Timestamp[]; // Array de Timestamps para todas as datas desta demanda
  startTime: string;
  endTime: string;
  isOvernight: boolean;

  state: string;
  city: string;

  serviceType: string;
  specialtiesRequired: string[];
  offeredRate: number;
  numberOfVacancies: number;
  notes?: string;

  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FULLY_STAFFED' | 'CANCELLED_BY_HOSPITAL' | 'EXPIRED' | 'PENDING_MATCH_REVIEW' | 'MATCH_REJECTED' | 'PENDING_DOCTOR_ACCEPTANCE' | 'PENDING_CONTRACT_SIGNATURES' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';
  // vacanciesFilled será calculado ou gerenciado separadamente.

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ShiftFormPayload = Omit<ShiftRequirement,
  "id" |
  "hospitalId" |
  "hospitalName" |
  "status" |
  "createdAt" |
  "updatedAt" |
  "publishedByName"
>;

export type ShiftUpdatePayload = Partial<Omit<ShiftRequirement,
  "id" | "hospitalId" | "hospitalName" | "createdAt" | "updatedAt" |
  "publishedByUID" | "publishedByName" | "status" | "dates"
>>;

// --- Tipos para Dashboard e outras listas (Placeholders) ---
export interface HospitalKPIs { openShiftsCount: number | null; pendingActionCount?: number | null; totalDoctorsOnPlatform?: number | null; costLast30Days?: number | null; fillRateLast30Days?: number | null; avgTimeToFillHours?: number | null; topSpecialtyDemand?: string | null; }
export interface MonthlyCostData { name: string; valor: number; }
export interface SpecialtyDemandData { name: string; valor: number; }
export interface DashboardData { kpis: HospitalKPIs | null; monthlyCosts: MonthlyCostData[]; specialtyDemand: SpecialtyDemandData[]; }
export interface PendingMatch { id: string; date: Timestamp; startTime: string; endTime: string; specialty: string; status?: string; offeredRate?: number; doctorName?: string; }
export interface ConfirmedShift { id: string; date: Timestamp; startTime: string; endTime: string; doctorName: string; specialty?: string; }
export interface PastShift { id: string; date: Timestamp; startTime: string; endTime: string; doctorName: string; status: string; cost?: number; }

// --- FUNÇÕES DO SERVIÇO ---
export const addShiftRequirement = async (
  shiftPayload: ShiftFormPayload
): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Usuário não autenticado.");
  }
  const hospitalProfile = await getCurrentUserData() as HospitalProfile | null;
  if (!hospitalProfile || hospitalProfile.role !== 'hospital') {
    throw new Error("Perfil de hospital não encontrado ou inválido.");
  }

  const fullShiftData: Omit<ShiftRequirement, "id"> = {
    ...shiftPayload,
    hospitalId: currentUser.uid,
    hospitalName: hospitalProfile.displayName,
    publishedByUID: currentUser.uid,
    publishedByName: currentUser.displayName || hospitalProfile.displayName || undefined,
    status: 'OPEN',
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  try {
    const docRef = await addDoc(collection(db, "shiftRequirements"), fullShiftData);
    console.log("[addShiftRequirement] Nova Demanda de Plantão adicionada com ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[addShiftRequirement] Erro ao adicionar demanda ao Firestore: ", error);
    if (error instanceof Error) {
        throw new Error(`Falha ao publicar demanda: ${error.message}`);
    }
    throw new Error("Falha ao publicar demanda. Erro desconhecido.");
  }
};

export const updateShiftRequirement = async (
  demandId: string,
  updateData: ShiftUpdatePayload
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Usuário não autenticado.");
  }
  const demandDocRef = doc(db, "shiftRequirements", demandId);
  try {
    // A 'dates' não está no ShiftUpdatePayload, então não será atualizada aqui.
    await updateDoc(demandDocRef, {
      ...updateData,
      updatedAt: serverTimestamp() as Timestamp,
    });
    console.log("[updateShiftRequirement] Demanda ID:", demandId, "atualizada com sucesso.");
  } catch (error) {
    console.error("[updateShiftRequirement] Erro ao atualizar demanda:", error);
    if (error instanceof Error) {
      throw new Error(`Falha ao atualizar demanda: ${error.message}`);
    }
    throw new Error("Falha ao atualizar demanda. Erro desconhecido.");
  }
};

export const getHospitalShiftRequirements = async (): Promise<ShiftRequirement[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getHospitalShiftRequirements] Usuário não autenticado tentando buscar demandas.");
    return [];
  }
  try {
    console.log("[getHospitalShiftRequirements] Buscando demandas para hospital UID:", currentUser.uid);
    const q = query(
        collection(db, "shiftRequirements"),
        where("hospitalId", "==", currentUser.uid),
        orderBy("createdAt", "desc") // Ordena pelas mais recentes para melhor UX na lista
    );
    const querySnapshot = await getDocs(q);
    const shifts: ShiftRequirement[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Validação e transformação de dados
      const datesArray = Array.isArray(data.dates) ? data.dates.map((d: any) => {
        // Se d já for um Timestamp, retorne. Se for um objeto com seconds/nanoseconds, crie um Timestamp.
        if (d instanceof Timestamp) return d;
        if (d && typeof d.seconds === 'number' && typeof d.nanoseconds === 'number') {
          return new Timestamp(d.seconds, d.nanoseconds);
        }
        console.warn(`[getHospitalShiftRequirements] Formato de data inesperado para ${docSnap.id}:`, d);
        return Timestamp.now(); // Fallback, idealmente não deveria acontecer
      }) : [];

      shifts.push({
        id: docSnap.id,
        hospitalId: data.hospitalId || currentUser.uid, // Fallback
        hospitalName: data.hospitalName || "Nome Indisponível",
        publishedByUID: data.publishedByUID || currentUser.uid,
        publishedByName: data.publishedByName,
        dates: datesArray,
        startTime: data.startTime || "00:00",
        endTime: data.endTime || "00:00",
        isOvernight: !!data.isOvernight,
        state: data.state || "",
        city: data.city || "",
        serviceType: data.serviceType || "N/A",
        specialtiesRequired: Array.isArray(data.specialtiesRequired) ? data.specialtiesRequired : [],
        offeredRate: typeof data.offeredRate === 'number' ? data.offeredRate : 0,
        numberOfVacancies: typeof data.numberOfVacancies === 'number' ? data.numberOfVacancies : 1,
        notes: data.notes || "",
        status: data.status || 'OPEN',
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.now(),
      } as ShiftRequirement);
    });
    console.log(`[getHospitalShiftRequirements] Encontradas ${shifts.length} demandas para o hospital.`);
    return shifts;
  } catch (error) {
    console.error("[getHospitalShiftRequirements] Erro crítico ao buscar demandas do Firestore:", error);
    // Propagar o erro para a UI poder tratar
    throw error;
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
    throw error;
  }
};