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
export interface HospitalKPIs { openShiftsCount: number | null; pendingActionCount?: number | null; totalDoctorsOnPlatform?: number | null; costLast30Days?: number | null; fillRateLast30Days?: number | null; avgTimeToFillHours?: number | null; topSpecialtyDemand?: string | null; }
export interface MonthlyCostData { name: string; valor: number; }
export interface SpecialtyDemandData { name: string; valor: number; }
export interface DashboardData { kpis: HospitalKPIs | null; monthlyCosts: MonthlyCostData[]; specialtyDemand: SpecialtyDemandData[]; }

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
  console.log("[SERVICE] getPendingActionShifts (MOCK)...");
  await new Promise(resolve => setTimeout(resolve, 200)); // Reduzido delay
  return [ createMockShiftRequirement("pend1", "PENDING_MATCH_REVIEW", 2), createMockShiftRequirement("pend2", "PENDING_DOCTOR_ACCEPTANCE", 3), ];
};
export const getConfirmedShiftsForHospital = async (): Promise<ShiftRequirement[]> => {
  console.log("[SERVICE] getConfirmedShiftsForHospital (MOCK)...");
  await new Promise(resolve => setTimeout(resolve, 200));
  return [ createMockShiftRequirement("conf1", "CONFIRMED", 5), createMockShiftRequirement("conf2", "ACTIVE_SIGNED", 7), ];
};
export const getPastShiftsForHospital = async (): Promise<ShiftRequirement[]> => {
  console.log("[SERVICE] getPastShiftsForHospital (MOCK)...");
  await new Promise(resolve => setTimeout(resolve, 200));
  return [ createMockShiftRequirement("past1", "COMPLETED", -7), createMockShiftRequirement("past2", "CANCELLED_BY_HOSPITAL", -14), ];
};


// --- ADIÇÃO: TIPOS E FUNÇÕES PARA GERENCIAMENTO DE MÉDICOS PELO HOSPITAL ---

export interface HospitalManagedDoctor {
  id: string; // UID do médico se for da plataforma, ou um ID customizado se externo
  name: string;
  crm?: string;
  specialties: string[];
  email?: string;
  phone?: string;
  status: 'ACTIVE_PLATFORM' | 'ACTIVE_EXTERNAL' | 'INVITED' | 'INACTIVE' | 'PENDING_ASSOCIATION';
  source: 'PLATFORM' | 'EXTERNAL';
  // Adicionar mais campos conforme necessário, como data de associação, último plantão, etc.
  // Para médicos da plataforma, poderíamos ter doctorPlatformUID?: string;
}

// Função mocada para buscar médicos gerenciados pelo hospital
export const getManagedDoctorsForHospital = async (): Promise<HospitalManagedDoctor[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getManagedDoctorsForHospital] Hospital não autenticado.");
    return [];
  }
  console.log("[SERVICE] getManagedDoctorsForHospital: Buscando médicos para hospital UID:", currentUser.uid, "(MOCK)");
  await new Promise(resolve => setTimeout(resolve, 700));

  const mockDoctors: HospitalManagedDoctor[] = [
    {
      id: "doc_uid_abc_platform",
      name: "Dr. Carlos Alberto Nóbrega",
      crm: "123456/SP",
      specialties: ["Cardiologia", "Clínica Médica"],
      email: "carlos.med@email.com",
      phone: "(11) 98888-7777",
      status: 'ACTIVE_PLATFORM',
      source: 'PLATFORM',
    },
    {
      id: "doc_extern_001",
      name: "Dra. Ana Maria Braga",
      crm: "789012/RJ",
      specialties: ["Pediatria"],
      email: "ana.ped@email.com",
      phone: "(21) 97777-6666",
      status: 'ACTIVE_EXTERNAL',
      source: 'EXTERNAL',
    },
    {
      id: "doc_uid_xyz_invited",
      name: "Dr. Fausto Silva",
      crm: "345678/SP",
      specialties: ["Ortopedia"],
      status: 'INVITED', // Médico convidado para a plataforma, aguardando aceite
      source: 'PLATFORM',
    },
     {
      id: "doc_extern_002_inactive",
      name: "Dr. Silvio Santos",
      crm: "901234/BA",
      specialties: ["Cirurgia Geral"],
      status: 'INACTIVE',
      source: 'EXTERNAL',
    },
  ];
  return mockDoctors;
};

// Payload para adicionar/convidar um médico
export interface AddDoctorToHospitalPayload {
  name: string;
  crm: string;
  email?: string;
  phone?: string;
  specialties: string[];
  source: 'PLATFORM' | 'EXTERNAL'; // Se 'PLATFORM', tentará convidar/associar; se 'EXTERNAL', apenas cadastra.
  // Para 'PLATFORM', podemos precisar de um campo para buscar o médico existente (ex: email ou CRM)
  // Para 'EXTERNAL', este é um cadastro novo no contexto do hospital.
}

// Função mocada para adicionar/convidar médico
export const addOrInviteDoctorToHospital = async (
    hospitalId: string, // UID do hospital que está adicionando/convidando
    doctorData: AddDoctorToHospitalPayload
): Promise<{success: boolean; message: string; doctorId?: string}> => {
  console.log(`[SERVICE] Hospital ${hospitalId} adicionando/convidando médico (MOCK):`, doctorData);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (doctorData.source === 'PLATFORM') {
    // Lógica MOCADA: Simular que encontramos um médico ou enviamos um convite
    // TODO: Implementar busca por email/CRM na coleção 'users' com role 'doctor'
    // Se encontrado, associar (pode ser uma subcoleção em hospital ou um campo no perfil do médico)
    // Se não encontrado, poderia disparar um email de convite (requer backend de email)
    console.log(`   Simulando convite/associação para médico da plataforma: ${doctorData.name}`);
    return { success: true, message: `Convite simulado para ${doctorData.name}.`};
  } else { // EXTERNAL
    // Lógica MOCADA: Simular cadastro de médico externo
    // TODO: Implementar criação de um documento em, por exemplo, /hospitals/{hospitalId}/externalDoctors/
    const newExternalDoctorId = `ext_${Date.now()}`;
    console.log(`   Simulando cadastro de médico externo ${doctorData.name} com ID ${newExternalDoctorId}`);
    return { success: true, message: `Médico externo ${doctorData.name} cadastrado (mock).`, doctorId: newExternalDoctorId };
  }
};

// Função mocada para editar um médico gerenciado (principalmente externos)
export const updateManagedDoctor = async (
    hospitalId: string,
    doctorId: string, // Pode ser o UID (plataforma) ou ID customizado (externo)
    doctorData: Partial<HospitalManagedDoctor> // Apenas os campos que podem ser editados
): Promise<{success: boolean; message: string;}> => {
    console.log(`[SERVICE] Hospital ${hospitalId} atualizando médico ${doctorId} (MOCK):`, doctorData);
    await new Promise(resolve => setTimeout(resolve, 400));
    // TODO: Implementar lógica de atualização no Firestore
    return { success: true, message: `Dados do médico ${doctorData.name || doctorId} atualizados (mock).`};
};