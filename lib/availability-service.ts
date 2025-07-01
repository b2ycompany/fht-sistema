// lib/availability-service.ts
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  orderBy
} from "firebase/firestore";
import { db, auth } from "./firebase";

// As listas de especialidades e tipos de serviço continuam iguais.
export const ServiceTypeRates: { [key: string]: number } = {
  plantao_12h_diurno: 100,
  plantao_12h_noturno: 120,
  plantao_24h: 110,
  consulta_ambulatorial: 80,
  cirurgia_eletiva: 150,
  uti_adulto: 130,
  medico_de_Guarda: 250,
  medico_Diarista_uti: 300,
  coordenador_medico: 200,
  enfermaria: 120,
  telemedicina: 90,
  medico_prescritor: 200,
  intensivista: 125,
  medico_sala_emergencia: 125,
  medico_visitador: 125,
};

export const medicalSpecialties = [
    "Anestesiologia", "Angiologia", "Cardiologia", "Cirurgia Cardiovascular", "Cirurgia da Mão", 
    "Cirurgia de Cabeça e Pescoço", "Cirurgia do Aparelho Digestivo", "Cirurgia Geral", 
    "Cirurgia Oncológica", "Cirurgia Pediátrica", "Cirurgia Plástica", "Cirurgia Torácica", 
    "Cirurgia Vascular", "Clínica Médica", "Coloproctologia", "Dermatologia", 
    "Endocrinologia e Metabologia", "Endoscopia", "Gastroenterologia", "Genética Médica", 
    "Geriatria", "Ginecologia e Obstetrícia", "Hematologia e Hemoterapia", "Homeopatia", 
    "Infectologia", "Mastologia", "Medicina de Emergência", "Medicina de Família e Comunidade", 
    "Medicina do Trabalho", "Medicina Esportiva", "Medicina Física e Reabilitação", 
    "Medicina Intensiva", "Medicina Legal e Perícia Médica", "Medicina Nuclear", 
    "Medicina Preventiva e Social", "Nefrologia", "Neurocirurgia", "Neurologia", 
    "Nutrologia", "Oftalmologia", "Oncologia Clínica", "Ortopedia e Traumatologia", 
    "Otorrinolaringologia", "Patologia", "Patologia Clínica/Medicina Laboratorial", 
    "Pediatria", "Pneumologia", "Psiquiatria", "Radiologia e Diagnóstico por Imagem", 
    "Radioterapia", "Reumatologia", "Urologia"
];

// MUDANÇA: Adicionado o campo 'doctorName' à interface.
export interface TimeSlot {
  id: string;
  doctorId: string;
  doctorName?: string; // Nome do médico que criou a disponibilidade
  date: Timestamp;
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  state: string;
  city: string;
  serviceType: string;
  specialties: string[];
  desiredHourlyRate: number;
  notes?: string;
  status: 'AVAILABLE' | 'BOOKED' | 'COMPLETED';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// O Omit foi atualizado para incluir o novo campo
export type TimeSlotFormPayload = Omit<TimeSlot, "id" | "doctorId" | "doctorName" | "status" | "createdAt" | "updatedAt">;
export type TimeSlotUpdatePayload = Partial<Omit<TimeSlot, "id" | "doctorId" | "doctorName" | "date" | "status" | "createdAt">>;

export const addTimeSlot = async (payload: TimeSlotFormPayload): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  try {
    // MUDANÇA: Adicionado 'doctorName' ao objeto que é salvo no Firestore.
    const docRef = await addDoc(collection(db, "doctorTimeSlots"), {
      ...payload,
      doctorId: currentUser.uid,
      doctorName: currentUser.displayName || 'Nome não informado', // Pega o nome do usuário logado
      status: 'AVAILABLE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log("[addTimeSlot] Nova disponibilidade adicionada com ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Erro ao adicionar disponibilidade:", error);
    throw error;
  }
};

// As funções abaixo não precisam de alteração.
export const getTimeSlots = async (): Promise<TimeSlot[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];
  try {
    const q = query(collection(db, "doctorTimeSlots"), where("doctorId", "==", currentUser.uid), orderBy("date", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeSlot));
  } catch (error) {
    console.error("Erro ao buscar disponibilidades:", error);
    throw new Error("Falha ao carregar suas disponibilidades.");
  }
};

export const updateTimeSlot = async (slotId: string, payload: TimeSlotUpdatePayload): Promise<void> => {
  const slotRef = doc(db, "doctorTimeSlots", slotId);
  try {
    await updateDoc(slotRef, {
      ...payload,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao atualizar disponibilidade:", error);
    throw error;
  }
};

export const deleteTimeSlot = async (slotId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "doctorTimeSlots", slotId));
  } catch (error) {
    console.error("Erro ao deletar disponibilidade:", error);
    throw error;
  }
};