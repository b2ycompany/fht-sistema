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
// Importar DoctorProfile se for usar doctorName denormalizado
// import { type DoctorProfile } from "./auth-service";

// --- TIPOS E CONSTANTES ---
export const ServiceTypeRates: { [key: string]: number } = {
  plantao_12h_diurno: 100,
  plantao_12h_noturno: 120,
  plantao_24h: 110,
  consulta_ambulatorial: 80,
  cirurgia_eletiva: 150,
  uti_adulto: 130,
  // Adicione outros tipos de serviço conforme necessário
};

export const medicalSpecialties = [
  "Anestesiologia", "Angiologia", "Cardiologia", "Cirurgia Cardiovascular",
  "Cirurgia da Mão", "Cirurgia de Cabeça e Pescoço", "Cirurgia do Aparelho Digestivo",
  "Cirurgia Geral", "Cirurgia Oncológica", "Cirurgia Pediátrica", "Cirurgia Plástica",
  "Cirurgia Torácica", "Cirurgia Vascular", "Clínica Médica", "Coloproctologia",
  "Dermatologia", "Endocrinologia e Metabologia", "Endoscopia", "Gastroenterologia",
  "Genética Médica", "Geriatria", "Ginecologia e Obstetrícia", "Hematologia e Hemoterapia",
  "Homeopatia", "Infectologia", "Mastologia", "Medicina de Emergência",
  "Medicina de Família e Comunidade", "Medicina do Trabalho", "Medicina Esportiva",
  "Medicina Física e Reabilitação", "Medicina Intensiva", "Medicina Legal e Perícia Médica",
  "Medicina Nuclear", "Medicina Preventiva e Social", "Nefrologia", "Neurocirurgia",
  "Neurologia", "Nutrologia", "Oftalmologia", "Oncologia Clínica", "Ortopedia e Traumatologia",
  "Otorrinolaringologia", "Patologia", "Patologia Clínica/Medicina Laboratorial",
  "Pediatria", "Pneumologia", "Psiquiatria", "Radiologia e Diagnóstico por Imagem",
  "Radioterapia", "Reumatologia", "Urologia"
];


export interface TimeSlot {
  id?: string;
  doctorId: string;
  // doctorName?: string; // Opcional para denormalização

  date: Timestamp; // Data específica desta disponibilidade
  startTime: string;
  endTime: string;
  isOvernight: boolean;

  state: string;
  city: string;

  serviceType: string;
  specialties: string[]; // Especialidades que o médico pode atender
  desiredHourlyRate: number;

  status: 'AVAILABLE' | 'RESERVED_FOR_MATCH' | 'BOOKED' | 'COMPLETED' | 'CANCELLED_BY_DOCTOR';
  notes?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Payload para CRIAR um novo TimeSlot (um para cada data selecionada no formulário)
export type TimeSlotFormPayload = Omit<TimeSlot,
  "id" |
  "doctorId" |
  "status" |
  "createdAt" |
  "updatedAt"
  // "doctorName" // Opcional
>;

// Payload para ATUALIZAR um TimeSlot existente
// 'date' é omitido aqui porque decidimos não permitir edição de data por enquanto
export type TimeSlotUpdatePayload = Partial<Omit<TimeSlot,
  "id" | "doctorId" | "createdAt" | "updatedAt" | "status" | "date"
  // "doctorName"
>>;


// --- FUNÇÕES DO SERVIÇO ---

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
    status: 'AVAILABLE',
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  try {
    const docRef = await addDoc(collection(db, "doctorTimeSlots"), fullTimeSlotData);
    console.log("[addTimeSlot] Nova disponibilidade adicionada com ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[addTimeSlot] Erro ao adicionar disponibilidade ao Firestore: ", error);
    if (error instanceof Error) {
        throw new Error(`Falha ao salvar disponibilidade: ${error.message}`);
    }
    throw new Error("Falha ao salvar disponibilidade. Erro desconhecido.");
  }
};

export const getTimeSlots = async (): Promise<TimeSlot[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getTimeSlots] Usuário não autenticado tentando buscar disponibilidades.");
    return [];
  }
  try {
    console.log("[getTimeSlots] Buscando disponibilidades para médico UID:", currentUser.uid);
    const q = query(
        collection(db, "doctorTimeSlots"),
        where("doctorId", "==", currentUser.uid),
        orderBy("date", "asc"),
        orderBy("startTime", "asc")
    );
    const querySnapshot = await getDocs(q);
    const timeSlots: TimeSlot[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      timeSlots.push({
        id: docSnap.id,
        // Espalha os dados e garante que os Timestamps sejam tratados corretamente
        ...data,
        date: data.date as Timestamp, // Assegura que 'date' é tratado como Timestamp
        createdAt: data.createdAt as Timestamp,
        updatedAt: data.updatedAt as Timestamp,
      } as TimeSlot); // Type assertion para garantir que o objeto corresponde
    });
    console.log(`[getTimeSlots] Encontradas ${timeSlots.length} disponibilidades.`);
    return timeSlots;
  } catch (error) {
    console.error("[getTimeSlots] Erro ao buscar disponibilidades:", error);
     if (error instanceof Error && error.message.includes("query requires an index")) {
        const firebaseError = error as any;
        console.error("Erro de índice do Firestore para doctorTimeSlots. Link para criar:", firebaseError.details);
    }
    throw error;
  }
};

export const updateTimeSlot = async (
  timeSlotId: string,
  updateData: TimeSlotUpdatePayload
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Usuário não autenticado.");
  }
  const timeSlotDocRef = doc(db, "doctorTimeSlots", timeSlotId);
  // TODO: Validar se o timeSlot pertence ao currentUser.uid antes de atualizar
  try {
    await updateDoc(timeSlotDocRef, {
      ...updateData,
      updatedAt: serverTimestamp() as Timestamp,
    });
    console.log("[updateTimeSlot] Disponibilidade ID:", timeSlotId, "atualizada.");
  } catch (error) {
    console.error("[updateTimeSlot] Erro ao atualizar disponibilidade:", error);
    throw error;
  }
};

export const deleteTimeSlot = async (timeSlotId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Usuário não autenticado.");
  }
  const timeSlotDocRef = doc(db, "doctorTimeSlots", timeSlotId);
  // TODO: Validar propriedade
  try {
    await deleteDoc(timeSlotDocRef);
    console.log("[deleteTimeSlot] Disponibilidade deletada ID:", timeSlotId);
  } catch (error) {
    console.error("[deleteTimeSlot] Erro ao deletar disponibilidade:", error);
    throw error;
  }
};