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
  dates: Timestamp[];
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
  // CORRIGIDO: Adicionado 'ACTIVE_SIGNED' e outros status do fluxo de contrato.
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FULLY_STAFFED' | 'CANCELLED_BY_HOSPITAL' | 'EXPIRED' | 
          'PENDING_MATCH_REVIEW' | 'MATCH_REJECTED' | 
          'PENDING_DOCTOR_ACCEPTANCE' | 'PENDING_HOSPITAL_SIGNATURE' | 'PENDING_CONTRACT_SIGNATURES' | 
          'CONFIRMED' | 'ACTIVE_SIGNED' | // <<< 'ACTIVE_SIGNED' ADICIONADO
          'IN_PROGRESS' | 'COMPLETED';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ShiftFormPayload = Omit<ShiftRequirement,
  "id" | "hospitalId" | "hospitalName" | "status" |
  "createdAt" | "updatedAt" | "publishedByName"
>;

export type ShiftUpdatePayload = Partial<Omit<ShiftRequirement,
  "id" | "hospitalId" | "hospitalName" | "createdAt" | "updatedAt" |
  "publishedByUID" | "publishedByName" | "status" | "dates"
>>;

// Tipos para o Dashboard
export interface HospitalKPIs { openShiftsCount: number | null; pendingActionCount?: number | null; totalDoctorsOnPlatform?: number | null; costLast30Days?: number | null; fillRateLast30Days?: number | null; avgTimeToFillHours?: number | null; topSpecialtyDemand?: string | null; }
export interface MonthlyCostData { name: string; valor: number; }
export interface SpecialtyDemandData { name: string; valor: number; }
export interface DashboardData { kpis: HospitalKPIs | null; monthlyCosts: MonthlyCostData[]; specialtyDemand: SpecialtyDemandData[]; }

// Tipos para listas (usarão ShiftRequirement agora, mas mantidos para referência se precisar de tipos diferentes)
export interface PendingMatch { /* ... */ } // Pode ser substituído por ShiftRequirement com status específico
export interface ConfirmedShift { /* ... */ } // Pode ser substituído por ShiftRequirement com status específico
export interface PastShift { /* ... */ }      // Pode ser substituído por ShiftRequirement com status específico


// --- FUNÇÕES DO SERVIÇO ---
export const addShiftRequirement = async ( shiftPayload: ShiftFormPayload ): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  const hospitalProfile = await getCurrentUserData() as HospitalProfile | null;
  if (!hospitalProfile || hospitalProfile.role !== 'hospital') throw new Error("Perfil de hospital não encontrado ou inválido.");
  
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
    return docRef.id;
  } catch (error) {
    console.error("[addShiftRequirement] Erro:", error);
    throw error;
  }
};

export const updateShiftRequirement = async ( demandId: string, updateData: ShiftUpdatePayload ): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  const demandDocRef = doc(db, "shiftRequirements", demandId);
  try {
    await updateDoc(demandDocRef, { ...updateData, updatedAt: serverTimestamp() as Timestamp, });
  } catch (error) { console.error("[updateShiftRequirement] Erro:", error); throw error; }
};

export const getHospitalShiftRequirements = async (): Promise<ShiftRequirement[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];
  try {
    const q = query( collection(db, "shiftRequirements"), where("hospitalId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const shifts: ShiftRequirement[] = [];
    querySnapshot.forEach((docSnap) => { shifts.push({ id: docSnap.id, ...docSnap.data() } as ShiftRequirement); });
    return shifts;
  } catch (error) { console.error("[getHospitalShiftRequirements] Erro:", error); throw error; }
};

export const deleteShiftRequirement = async (shiftId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  try {
    await deleteDoc(doc(db, "shiftRequirements", shiftId));
  } catch (error) { console.error("[deleteShiftRequirement] Erro:", error); throw error; }
};


// --- FUNÇÕES MOCADAS PARA ABAS (RETORNANDO ShiftRequirement[]) ---
const createMockShiftRequirement = (idSuffix: string, status: ShiftRequirement['status'], daysOffset: number = 0): ShiftRequirement => {
  const currentUser = auth.currentUser;
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return {
    id: `sr_mock_${idSuffix}_${Date.now()}`,
    hospitalId: currentUser?.uid || "mockHospitalId",
    hospitalName: "Hospital Mock Exemplo",
    publishedByUID: currentUser?.uid || "mockPublisherUID",
    dates: [Timestamp.fromDate(date)],
    startTime: "08:00", endTime: "14:00", isOvernight: false,
    state: "SP", city: "São Paulo",
    serviceType: "consulta_ambulatorial", specialtiesRequired: ["Clínica Médica"],
    offeredRate: 100, numberOfVacancies: 1,
    status: status,
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  };
};

export const getPendingActionShifts = async (): Promise<ShiftRequirement[]> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  return [ createMockShiftRequirement("pend1", "PENDING_MATCH_REVIEW", 2), createMockShiftRequirement("pend2", "PENDING_DOCTOR_ACCEPTANCE", 3), ];
};
export const getConfirmedShiftsForHospital = async (): Promise<ShiftRequirement[]> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  return [ createMockShiftRequirement("conf1", "CONFIRMED", 5), createMockShiftRequirement("conf2", "ACTIVE_SIGNED", 7), ]; // <<< 'ACTIVE_SIGNED' agora é válido
};
export const getPastShiftsForHospital = async (): Promise<ShiftRequirement[]> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return [ createMockShiftRequirement("past1", "COMPLETED", -7), createMockShiftRequirement("past2", "CANCELLED_BY_HOSPITAL", -14), ];
};