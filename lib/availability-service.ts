// lib/availability-service.ts
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

// --- TIPOS E CONSTANTES ---
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

export const medicalSpecialties = [ "Anestesiologia", "Angiologia", "Cardiologia", "Cirurgia Cardiovascular", "Cirurgia da Mão", "Cirurgia de Cabeça e Pescoço", "Cirurgia do Aparelho Digestivo", "Cirurgia Geral", "Cirurgia Oncológica", "Cirurgia Pediátrica", "Cirurgia Plástica", "Cirurgia Torácica", "Cirurgia Vascular", "Clínica Médica", "Coloproctologia", "Dermatologia", "Endocrinologia e Metabologia", "Endoscopia", "Gastroenterologia", "Genética Médica", "Geriatria", "Ginecologia e Obstetrícia", "Hematologia e Hemoterapia", "Homeopatia", "Infectologia", "Mastologia", "Medicina de Emergência", "Medicina de Família e Comunidade", "Medicina do Trabalho", "Medicina Esportiva", "Medicina Física e Reabilitação", "Medicina Intensiva", "Medicina Legal e Perícia Médica", "Medicina Nuclear", "Medicina Preventiva e Social", "Nefrologia", "Neurocirurgia", "Neurologia", "Nutrologia", "Oftalmologia", "Oncologia Clínica", "Ortopedia e Traumatologia", "Otorrinolaringologia", "Patologia", "Patologia Clínica/Medicina Laboratorial", "Pediatria", "Pneumologia", "Psiquiatria", "Radiologia e Diagnóstico por Imagem", "Radioterapia", "Reumatologia", "Urologia" ];

export interface TimeSlot {
  id?: string;
  doctorId: string;
  doctorName?: string; // <<< ESTE CAMPO SERÁ PREENCHIDO AGORA
  date: Timestamp;
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  state: string;
  city: string;
  serviceType: string;
  specialties: string[];
  desiredHourlyRate: number; // Renomeado de hourlyRate para desiredHourlyRate
  status: 'AVAILABLE' | 'RESERVED_FOR_MATCH' | 'BOOKED' | 'COMPLETED' | 'CANCELLED_BY_DOCTOR';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TimeSlotFormPayload = Omit<TimeSlot, "id" | "doctorId" | "doctorName" | "status" | "createdAt" | "updatedAt">;

// --- FUNÇÕES DO SERVIÇO ---

/**
 * --- LÓGICA CORRIGIDA ---
 * Adiciona o nome do médico (displayName) ao criar a disponibilidade.
 */
export const addTimeSlot = async (
  timeSlotPayload: TimeSlotFormPayload
): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Médico não autenticado.");
  }

  const fullTimeSlotData: Omit<TimeSlot, "id"> = {
    ...timeSlotPayload,
    doctorId: currentUser.uid,
    doctorName: currentUser.displayName || "Médico sem nome", // <<< CORREÇÃO APLICADA AQUI
    status: 'AVAILABLE',
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  try {
    const docRef = await addDoc(collection(db, "doctorTimeSlots"), fullTimeSlotData);
    console.log("[addTimeSlot] Nova disponibilidade adicionada com ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[addTimeSlot] Erro ao adicionar disponibilidade:", error);
    throw new Error("Falha ao salvar disponibilidade.");
  }
};

export const getTimeSlots = async (): Promise<TimeSlot[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];
  try {
    const q = query(
        collection(db, "doctorTimeSlots"),
        where("doctorId", "==", currentUser.uid),
        orderBy("date", "asc"),
        orderBy("startTime", "asc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }) as TimeSlot);
  } catch (error) {
    console.error("[getTimeSlots] Erro ao buscar disponibilidades:", error);
    throw error;
  }
};

export const deleteTimeSlot = async (timeSlotId: string): Promise<void> => {
  if (!auth.currentUser) throw new Error("Usuário não autenticado.");
  const timeSlotDocRef = doc(db, "doctorTimeSlots", timeSlotId);
  try {
    await deleteDoc(timeSlotDocRef);
  } catch (error) {
    console.error("[deleteTimeSlot] Erro ao deletar disponibilidade:", error);
    throw error;
  }
};

