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

export const medicalSpecialties = [ "Cardiologia", "Dermatologia", "Ginecologia", "Pediatria", "Ortopedia", "Oftalmologia", "Psiquiatria", "Neurologia", "Endocrinologia", "Gastroenterologia", "Urologia", "Otorrinolaringologia", "Pneumologia", "Nefrologia", "Reumatologia", "Infectologia", "Oncologia", "Hematologia", "Alergologia", "Angiologia" ];
export const ServiceTypeRates = { consulta_ambulatorial: 100, plantao_12h: 1200, plantao_24h: 2400, procedimento_especifico: 300, telemedicina: 80 };

export interface TimeSlot {
  id: string;
  doctorId: string;
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

export type TimeSlotFormPayload = Omit<TimeSlot, "id" | "doctorId" | "status" | "createdAt" | "updatedAt">;
export type TimeSlotUpdatePayload = Partial<Omit<TimeSlot, "id" | "doctorId" | "date" | "status" | "createdAt">>;

export const addTimeSlot = async (payload: TimeSlotFormPayload): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  try {
    const docRef = await addDoc(collection(db, "doctorTimeSlots"), {
      ...payload,
      doctorId: currentUser.uid,
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

// --- FUNÇÃO ADICIONADA ---
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