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
  orderBy,
  documentId
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { getCurrentUserData, type HospitalProfile, type DoctorProfile } from "./auth-service";

// --- TIPOS ESSENCIAIS PARA PLANTÕES ---
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
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FULLY_STAFFED' | 'CANCELLED_BY_HOSPITAL' | 'EXPIRED' | 
          'PENDING_MATCH_REVIEW' | 'MATCH_REJECTED' | 
          'PENDING_DOCTOR_ACCEPTANCE' | 'PENDING_HOSPITAL_SIGNATURE' | 'PENDING_CONTRACT_SIGNATURES' | 
          'CONFIRMED' | 'ACTIVE_SIGNED' | 
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

// --- Tipos para o Dashboard do Hospital ---
export interface HospitalKPIs {
  openShiftsCount: number;
  pendingActionCount: number;
  totalDoctorsOnPlatform: number;
  costLast30Days: number;
  fillRateLast30Days: number;
  avgTimeToFillHours: number;
  topSpecialtyDemand: string;
}
export interface MonthlyCostData { name: string; valor: number; }
export interface SpecialtyDemandData { name: string; valor: number; }
export interface DashboardData { kpis: HospitalKPIs; monthlyCosts: MonthlyCostData[]; specialtyDemand: SpecialtyDemandData[]; }

// --- FUNÇÕES DE SERVIÇO PARA PLANTÕES ---
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
    console.log("[SERVICE] Nova Demanda de Plantão adicionada com ID: ", docRef.id);
    return docRef.id;
  } catch (error) { console.error("[SERVICE] Erro ao adicionar demanda:", error); throw error; }
};

export const updateShiftRequirement = async ( demandId: string, updateData: ShiftUpdatePayload ): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  const demandDocRef = doc(db, "shiftRequirements", demandId);
  try {
    await updateDoc(demandDocRef, { ...updateData, updatedAt: serverTimestamp() as Timestamp, });
    console.log("[SERVICE] Demanda ID:", demandId, "atualizada.");
  } catch (error) { console.error("[SERVICE] Erro ao atualizar demanda:", error); throw error; }
};

export const getHospitalShiftRequirements = async (): Promise<ShiftRequirement[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];
  try {
    const q = query( collection(db, "shiftRequirements"), where("hospitalId", "==", currentUser.uid), where("status", "==", "OPEN"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const shifts: ShiftRequirement[] = [];
    querySnapshot.forEach((docSnap) => { shifts.push({ id: docSnap.id, ...docSnap.data() } as ShiftRequirement); });
    console.log(`[SERVICE] getHospitalShiftRequirements (OPEN): Encontradas ${shifts.length} demandas.`);
    return shifts;
  } catch (error) { console.error("[SERVICE] Erro getHospitalShiftRequirements:", error); throw error; }
};

export const deleteShiftRequirement = async (shiftId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  try {
    await deleteDoc(doc(db, "shiftRequirements", shiftId));
    console.log("[SERVICE] Demanda deletada ID:", shiftId);
  } catch (error) { console.error("[SERVICE] Erro ao deletar demanda:", error); throw error; }
};

// --- FUNÇÃO DO DASHBOARD COM DADOS REAIS ---
export const getHospitalDashboardData = async (hospitalId: string): Promise<DashboardData> => {
    if (!hospitalId) {
      throw new Error("ID do hospital não fornecido.");
    }
  
    try {
      const shiftsRef = collection(db, "shiftRequirements");
      const q = query(shiftsRef, where("hospitalId", "==", hospitalId));
      const querySnapshot = await getDocs(q);
  
      let openShiftsCount = 0;
      let totalCostLast30Days = 0;
      const specialtyCount: Record<string, number> = {};
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
      querySnapshot.forEach(doc => {
        const shift = doc.data() as ShiftRequirement;
        if (shift.status === 'OPEN') {
          openShiftsCount++;
        }
  
        const shiftDate = shift.dates[0].toDate();
        if (shiftDate > thirtyDaysAgo) {
          const startTime = new Date(shiftDate);
          startTime.setHours(parseInt(shift.startTime.split(':')[0]), parseInt(shift.startTime.split(':')[1]));
          const endTime = new Date(shiftDate);
          endTime.setHours(parseInt(shift.endTime.split(':')[0]), parseInt(shift.endTime.split(':')[1]));
          if (endTime <= startTime) { endTime.setDate(endTime.getDate() + 1); }
          const durationInHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          totalCostLast30Days += shift.offeredRate * (durationInHours > 0 ? durationInHours : 0);
        }
        
        (shift.specialtiesRequired || []).forEach(spec => {
          specialtyCount[spec] = (specialtyCount[spec] || 0) + 1;
        });
      });
  
      const topSpecialtyDemand = Object.entries(specialtyCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Nenhuma';
      const specialtyDemand = Object.entries(specialtyCount).map(([name, value]) => ({ name, valor: value })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  
      // TODO: Estes KPIs precisam de lógicas e coleções adicionais (ex: 'users', 'contracts')
      const pendingActionCount = 0; 
      const totalDoctorsOnPlatform = 0;
      const fillRateLast30Days = 0;
      const avgTimeToFillHours = 0;
      const monthlyCosts: MonthlyCostData[] = []; // <<< CORREÇÃO 1: Adicionado tipo explícito

      const kpis: HospitalKPIs = {
        openShiftsCount,
        pendingActionCount,
        totalDoctorsOnPlatform,
        costLast30Days: totalCostLast30Days, // <<< CORREÇÃO 2: Atribuição explícita
        fillRateLast30Days,
        avgTimeToFillHours,
        topSpecialtyDemand,
      };
  
      return {
        kpis: kpis,
        monthlyCosts: monthlyCosts,
        specialtyDemand: specialtyDemand,
      };
  
    } catch (error) {
      console.error("Erro ao buscar dados do dashboard do hospital:", error);
      throw new Error("Não foi possível carregar os dados do dashboard.");
    }
};

// --- OUTRAS FUNÇÕES DE LISTAGEM ---
export const getPendingActionShifts = async (): Promise<ShiftRequirement[]> => { /* ... */ return []; };
export const getConfirmedShiftsForHospital = async (): Promise<ShiftRequirement[]> => { /* ... */ return []; };
export const getPastShiftsForHospital = async (): Promise<ShiftRequirement[]> => { /* ... */ return []; };

// --- TIPOS E FUNÇÕES PARA GERENCIAMENTO DE MÉDICOS ---
export interface HospitalManagedDoctor {
  id: string; 
  name: string;
  crm?: string;
  specialties: string[];
  email?: string;
  phone?: string;
  status: 'ACTIVE_PLATFORM' | 'ACTIVE_EXTERNAL' | 'INVITED' | 'INACTIVE' | 'PENDING_ASSOCIATION';
  source: 'PLATFORM' | 'EXTERNAL';
}

export const getManagedDoctorsForHospital = async (): Promise<HospitalManagedDoctor[]> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    try {
        const contractsRef = collection(db, "contracts");
        const q = query(contractsRef, where("hospitalId", "==", currentUser.uid), where("status", "==", "ACTIVE_SIGNED"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return [];

        const doctorIds = Array.from(new Set(snapshot.docs.map(doc => doc.data().doctorId)));

        if (doctorIds.length === 0) return [];
        
        const doctorsRef = collection(db, "users");
        const doctorsQuery = query(doctorsRef, where(documentId(), "in", doctorIds));
        const doctorsSnapshot = await getDocs(doctorsQuery);

        return doctorsSnapshot.docs.map(doc => {
            const profile = doc.data() as DoctorProfile;
            return {
                id: profile.uid,
                name: profile.displayName,
                crm: profile.professionalCrm,
                specialties: profile.specialties,
                email: profile.email,
                phone: profile.phone,
                status: 'ACTIVE_PLATFORM',
                source: 'PLATFORM'
            };
        });
    } catch (error) {
        console.error("Erro ao buscar médicos gerenciados:", error);
        return [];
    }
};

export interface AddDoctorToHospitalPayload {
  name: string;
  crm: string;
  email?: string;
  phone?: string;
  specialties: string[];
  source: 'PLATFORM' | 'EXTERNAL';
}

export const addOrInviteDoctorToHospital = async (hospitalId: string, doctorData: AddDoctorToHospitalPayload): Promise<{success: boolean; message: string; doctorId?: string}> => {
  console.log(`[SERVICE] Hospital ${hospitalId} adicionando/convidando médico (MOCK):`, doctorData);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (doctorData.source === 'PLATFORM') {
    console.log(`  Simulando convite/associação para médico da plataforma: ${doctorData.name}`);
    return { success: true, message: `Convite simulado para ${doctorData.name}.`};
  } else { 
    const newExternalDoctorId = `ext_${Date.now()}`;
    console.log(`  Simulando cadastro de médico externo ${doctorData.name} com ID ${newExternalDoctorId}`);
    return { success: true, message: `Médico externo ${doctorData.name} cadastrado (mock).`, doctorId: newExternalDoctorId };
  }
};

export const updateManagedDoctor = async (hospitalId: string, doctorId: string, doctorData: Partial<HospitalManagedDoctor>): Promise<{success: boolean; message: string;}> => {
    console.log(`[SERVICE] Hospital ${hospitalId} atualizando médico ${doctorId} (MOCK):`, doctorData);
    await new Promise(resolve => setTimeout(resolve, 400));
    return { success: true, message: `Dados do médico ${doctorData.name || doctorId} atualizados (mock).`};
};