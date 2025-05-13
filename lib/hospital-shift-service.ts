// lib/hospital-shift-service.ts

import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc,
  query, where, serverTimestamp, Timestamp, orderBy, limit,
} from "firebase/firestore";
import { db, auth } from "./firebase";

// --- Interfaces ---

export interface ShiftRequirement {
  id?: string; // Opcional na criação, obrigatório na leitura
  hospitalId: string;
  hospitalName?: string;
  date: Date; // Usar Date no frontend
  startTime: string;
  endTime: string;
  city: string;
  state: string;
  serviceType: string;
  specialtiesRequired: string[];
  offeredRate: number;
  // --- CORRIGIDO: Adicionado 'filled' ---
  status: 'open' | 'pending_doctor_acceptance' | 'pending_signatures' | 'filled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  createdAt?: Date; // Objeto Date no frontend
  updatedAt?: Date; // Objeto Date no frontend
  doctorId?: string;
  doctorName?: string;
  contractId?: string;
  cost?: number;
}

// Interface para dados no Firestore (uso interno no serviço)
interface ShiftRequirementFirestoreData {
  hospitalId: string; hospitalName?: string; date: Timestamp; startTime: string;
  endTime: string; city: string; state: string; serviceType: string;
  specialtiesRequired: string[]; offeredRate: number; status: string; notes?: string;
  createdAt: Timestamp; updatedAt: Timestamp; doctorId?: string; doctorName?: string;
  contractId?: string; cost?: number;
}

// Tipos para outras funções (placeholders)
export interface HospitalKPIs { openShiftsCount: number | null; pendingActionCount?: number | null; totalDoctorsOnPlatform?: number | null; costLast30Days?: number | null; fillRateLast30Days?: number | null; avgTimeToFillHours?: number | null; topSpecialtyDemand?: string | null; }
export interface MonthlyCostData { name: string; valor: number; }
export interface SpecialtyDemandData { name: string; valor: number; }
export interface PendingMatch { id: string; date: Date; startTime: string; endTime: string; doctorName?: string; specialty: string; status: 'pending_hospital_approval' | 'pending_doctor_acceptance' | 'pending_signatures'; offeredRate: number; }
export interface ConfirmedShift { id: string; date: Date; startTime: string; endTime: string; doctorName: string; specialty?: string; }
export interface PastShift { id: string; date: Date; startTime: string; endTime: string; doctorName: string; status: 'Concluído' | 'Cancelado'; cost?: number; }
export interface DoctorInfoBasic { uid: string; name: string; specialties?: string[]; crm?: string; phone?: string; }
export interface ContractInfo { id: string; doctorId: string; doctorName?: string; hospitalId: string; status: string; startDate?: Date; endDate?: Date; }
export interface DashboardData { kpis: HospitalKPIs | null; monthlyCosts: MonthlyCostData[]; specialtyDemand: SpecialtyDemandData[]; }


// --- Funções CRUD (Implementadas e Placeholders) ---

export const addShiftRequirement = async ( shiftInput: Omit<ShiftRequirement, "id" | "hospitalId" | "status" | "createdAt" | "updatedAt"> ): Promise<string> => {
  try { const user = auth.currentUser; if (!user) throw new Error("Auth required"); const dataToSave = { ...shiftInput, hospitalId: user.uid, status: 'open', date: Timestamp.fromDate(shiftInput.date), createdAt: serverTimestamp(), updatedAt: serverTimestamp()}; const docRef = await addDoc(collection(db, "shiftRequirements"), dataToSave); return docRef.id; } catch(e: any) { console.error("Error adding shift:", e); throw new Error(`Falha ao adicionar vaga: ${e.message || 'Erro'}`); }
};

export const getHospitalShiftRequirements = async (): Promise<ShiftRequirement[]> => {
  try { const user = auth.currentUser; if (!user) return []; const q = query(collection(db, "shiftRequirements"), where("hospitalId", "==", user.uid), where("status", "==", "open"), orderBy("date", "asc")); const snapshot = await getDocs(q); const shifts: ShiftRequirement[] = []; snapshot.forEach(doc => { const data = doc.data(); if (data.date && data.date.toDate) { shifts.push({ id: doc.id, ...data, date: data.date.toDate(), createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate() } as ShiftRequirement);} else { console.warn(`Invalid data in doc ${doc.id}`); }}); return shifts; } catch(e: any) { console.error("Error get open shifts:", e); if (e.message && e.message.includes("query requires an index")) { throw new Error(`Índice do Firestore necessário. Detalhe: ${e.message}`); } throw e; }
};

export const deleteShiftRequirement = async (id: string): Promise<void> => {
  try { const user = auth.currentUser; if (!user) throw new Error("Auth required"); /* TODO: Add security rule check */ await deleteDoc(doc(db, "shiftRequirements", id)); } catch(e: any) { console.error(`Error deleting shift ${id}:`, e); throw new Error(`Falha ao remover vaga: ${e.message || 'Erro'}`); }
};


// --- NOVAS FUNÇÕES DE BUSCA (Placeholders - Implementar Lógica do Firestore) ---

export const getHospitalDashboardData = async (): Promise<DashboardData> => {
  console.warn("getHospitalDashboardData: NECESSITA IMPLEMENTAÇÃO REAL NO SERVIÇO!");
  // >> IMPLEMENTAR LÓGICA DE CONSULTA E AGREGAÇÃO AQUI (Firestore / Cloud Function) <<
  await new Promise(res => setTimeout(res, 600)); // Simulação
  const kpis: HospitalKPIs = { openShiftsCount: 7, pendingActionCount: 5, totalDoctorsOnPlatform: 152, costLast30Days: 25780.50, fillRateLast30Days: 85.7, avgTimeToFillHours: 4.2, topSpecialtyDemand: 'Clínica Médica' };
  const costs: MonthlyCostData[] = [ { name: 'Jan', valor: 18000 }, { name: 'Fev', valor: 21500 }, { name: 'Mar', valor: 25780.50 }, { name: 'Abr', valor: 15300 } ];
  const demand: SpecialtyDemandData[] = [ { name: 'Cl. Médica', valor: 8 }, { name: 'Cardio', valor: 5 }, { name: 'Pediatria', valor: 4 }, { name: 'Orto', valor: 3 }, { name: 'G.O.', valor: 2 }];
  return { kpis, monthlyCosts: costs, specialtyDemand: demand };
};

export const getPendingMatches = async (): Promise<PendingMatch[]> => {
  console.warn("getPendingMatches: NECESSITA IMPLEMENTAÇÃO REAL NO SERVIÇO!");
  // >> IMPLEMENTAR LÓGICA (Query 'shiftRequirements' ou 'matches' com status pendentes) <<
  await new Promise(res => setTimeout(res, 900)); // Simulação
  const matches: PendingMatch[] = [ { id: 'm1', date: new Date(2025, 4, 20), startTime: '07:00', endTime: '19:00', specialty: 'Pediatria', status: 'pending_doctor_acceptance', offeredRate: 160, doctorName: 'Dr. Aguardando A.' }, { id: 'm2', date: new Date(2025, 4, 21), startTime: '19:00', endTime: '07:00', specialty: 'Clínica Médica', status: 'pending_signatures', offeredRate: 150, doctorName: 'Dra. Assinando B.' }, ];
  return matches.map(m => ({...m, date: new Date(m.date)}));
};

export const getConfirmedShifts = async (): Promise<ConfirmedShift[]> => {
  console.warn("getConfirmedShifts: NECESSITA IMPLEMENTAÇÃO REAL NO SERVIÇO!");
  // >> IMPLEMENTAR LÓGICA (Query 'shiftRequirements' ou 'confirmedShifts' com status 'confirmed'/'filled' e data futura) <<
  await new Promise(res => setTimeout(res, 800)); // Simulação
  const shifts: ConfirmedShift[] = [ { id: 'up1', date: new Date(2025, 4, 15), startTime: '07:00', endTime: '19:00', doctorName: 'Dr. Exemplo Silva', specialty: 'Cardiologia' }, { id: 'up2', date: new Date(2025, 4, 18), startTime: '19:00', endTime: '07:00', doctorName: 'Dra. Demonstracao Souza', specialty: 'Clínica Médica' }, ];
  return shifts.map(s => ({...s, date: new Date(s.date)}));
};

export const getPastShifts = async (maxResults = 50): Promise<PastShift[]> => {
  console.warn("getPastShifts: NECESSITA IMPLEMENTAÇÃO REAL NO SERVIÇO!");
  // >> IMPLEMENTAR LÓGICA (Query 'shiftRequirements' ou 'pastShifts' com status 'completed'/'cancelled' ou data passada) <<
  await new Promise(res => setTimeout(res, 1000)); // Simulação
  const shifts: PastShift[] = [ { id: 'p1', date: new Date(2025, 3, 1), startTime: '07:00', endTime: '19:00', doctorName: 'Dr. Fulano Teste', status: 'Concluído', cost: 1800 }, { id: 'p2', date: new Date(2025, 2, 28), startTime: '19:00', endTime: '07:00', doctorName: 'Dra. Ciclana Demo', status: 'Concluído', cost: 2100 }, { id: 'p3', date: new Date(2025, 2, 25), startTime: '07:00', endTime: '19:00', doctorName: 'Dr. Beltrano', status: 'Cancelado' }, ];
  return shifts.map(s => ({...s, date: new Date(s.date)}));
};

export const getHospitalDoctors = async (): Promise<DoctorInfoBasic[]> => {
  console.warn("getHospitalDoctors: NECESSITA IMPLEMENTAÇÃO REAL NO SERVIÇO!");
  // >> IMPLEMENTAR LÓGICA (Buscar médicos associados/contratados) <<
  await new Promise(res => setTimeout(res, 500)); // Simulação
  const doctors: DoctorInfoBasic[] = [ { uid: 'doc1', name: 'Dr. Fulano Teste', specialties: ['Clínica Médica'], crm: '12345SP' }, { uid: 'doc2', name: 'Dra. Ciclana Demo', specialties: ['Cardiologia', 'Clínica Médica'], crm: '67890RJ' } ];
  return doctors;
};

export const getHospitalContracts = async (): Promise<ContractInfo[]> => {
  console.warn("getHospitalContracts: NECESSITA IMPLEMENTAÇÃO REAL NO SERVIÇO!");
  // >> IMPLEMENTAR LÓGICA (Query 'contracts' where hospitalId) <<
  await new Promise(res => setTimeout(res, 600)); // Simulação
  const contracts: ContractInfo[] = [ { id: 'cont1', doctorId: 'doc1', doctorName: 'Dr. Fulano Teste', hospitalId: 'HOSP_ID_AQUI', status: 'active', startDate: new Date(2025, 0, 1) }, { id: 'cont2', doctorId: 'doc2', doctorName: 'Dra. Ciclana Demo', hospitalId: 'HOSP_ID_AQUI', status: 'pending_signature', startDate: new Date(2025, 4, 1) } ];
  return contracts.map(c => ({...c, startDate: c.startDate ? new Date(c.startDate) : undefined, endDate: c.endDate ? new Date(c.endDate) : undefined }));
};