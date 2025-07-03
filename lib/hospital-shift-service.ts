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
  documentId,
  setDoc,
  getDoc,
  runTransaction // Adicionado para a nova função
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { getCurrentUserData, type HospitalProfile, type DoctorProfile } from "./auth-service";

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

export const getHospitalDashboardData = async (hospitalId: string): Promise<DashboardData> => {
    // ... (código existente, sem alterações)
    if (!hospitalId) throw new Error("ID do hospital não fornecido.");
    // ... o resto da sua função
    return { kpis: {} as HospitalKPIs, monthlyCosts: [], specialtyDemand: [] }; // Retorno de exemplo
};

export const getPendingActionShifts = async (): Promise<ShiftRequirement[]> => { return []; };
export const getConfirmedShiftsForHospital = async (): Promise<ShiftRequirement[]> => { return []; };
export const getPastShiftsForHospital = async (): Promise<ShiftRequirement[]> => { return []; };

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

export const getHospitalDoctors = async (): Promise<HospitalManagedDoctor[]> => {
    // ... (código existente, sem alterações)
    const currentUser = auth.currentUser;
    if (!currentUser) return [];
    try {
        const doctorsRef = collection(db, "users", currentUser.uid, "hospitalDoctors");
        const q = query(doctorsRef, orderBy("name", "asc"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HospitalManagedDoctor));
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


// =======================================================================
// FUNÇÃO ATUALIZADA E ROBUSTA
// =======================================================================
export const addOrInviteDoctorToHospital = async (hospitalId: string, payload: AddDoctorToHospitalPayload): Promise<void> => {
    if (!hospitalId || !payload.crm || !payload.name) {
        throw new Error("Dados insuficientes para cadastrar o médico (Nome e CRM são obrigatórios).");
    }

    const usersRef = collection(db, "users");

    await runTransaction(db, async (transaction) => {
        // Passo 1: Verificar se o médico já existe (por email ou CRM)
        if (payload.email) {
            const emailQuery = query(usersRef, where("email", "==", payload.email));
            const emailSnapshot = await getDocs(emailQuery);
            if (!emailSnapshot.empty) {
                throw new Error(`O email ${payload.email} já está cadastrado na plataforma.`);
            }
        }

        const crmQuery = query(usersRef, where("professionalCrm", "==", payload.crm));
        const crmSnapshot = await getDocs(crmQuery);
        if (!crmSnapshot.empty) {
            throw new Error(`O CRM ${payload.crm} já está cadastrado na plataforma.`);
        }

        // Passo 2: Criar o novo documento do médico na coleção 'users'
        const newDoctorRef = doc(collection(db, "users")); 
        transaction.set(newDoctorRef, {
            displayName: payload.name,
            email: payload.email || "",
            professionalCrm: payload.crm,
            phone: payload.phone || "",
            specialties: payload.specialties || [],
            role: 'doctor',
            documentVerificationStatus: 'PENDING_DOCUMENTS',
            onboardingMethod: 'EXTERNAL_HOSPITAL_INVITE',
            onboardedByHospitalId: hospitalId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // Passo 3: Adicionar este médico à subcoleção 'hospitalDoctors' do hospital
        const hospitalDoctorRef = doc(collection(db, 'users', hospitalId, 'hospitalDoctors'), newDoctorRef.id);
        transaction.set(hospitalDoctorRef, {
            id: newDoctorRef.id,
            name: payload.name,
            crm: payload.crm,
            email: payload.email || "",
            phone: payload.phone || "",
            specialties: payload.specialties || [],
            status: 'ACTIVE_EXTERNAL',
            source: 'EXTERNAL',
            addedAt: serverTimestamp()
        });
    });
};


export const updateManagedDoctor = async (hospitalId: string, doctorId: string, doctorData: Partial<HospitalManagedDoctor>): Promise<{success: boolean; message: string;}> => {
    // ... (código existente, sem alterações)
    console.log(`[SERVICE] Hospital ${hospitalId} atualizando médico ${doctorId} (MOCK):`, doctorData);
    await new Promise(resolve => setTimeout(resolve, 400));
    return { success: true, message: `Dados do médico ${doctorData.name || doctorId} atualizados (mock).`};
};