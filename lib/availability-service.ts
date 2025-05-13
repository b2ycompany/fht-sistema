// lib/availability-service.ts

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  // getDoc, // getDoc not currently used, can remove if not needed elsewhere
  query,
  where,
  serverTimestamp,
  Timestamp,
  orderBy, // Import orderBy for sorting
} from "firebase/firestore";
import { db, auth } from "./firebase";

// --- Interfaces ---
export interface TimeSlot {
  id?: string;        // Firestore document ID
  doctorId: string;   // UID of the doctor
  date: Date;         // JavaScript Date object for use in the frontend
  startTime: string;  // e.g., "08:00"
  endTime: string;    // e.g., "18:00"
  specialties: string[]; // List of specialties for this slot
  serviceType: string; // e.g., 'ambulatorio', 'urgencia_emergencia'
  hourlyRate: number;  // e.g., 180, 250
  city: string;       // << NEW FIELD: City where the service is available
  state: string;      // << NEW FIELD: State (UF) where the service is available
  createdAt?: Date;   // JavaScript Date object (optional)
  updatedAt?: Date;   // JavaScript Date object (optional)
}

// Interface representing the data structure stored in Firestore
interface TimeSlotFirestoreData {
  doctorId: string;
  date: Timestamp;       // Firestore Timestamp object
  startTime: string;
  endTime: string;
  specialties?: string[]; // Optional in Firestore if it can be empty
  serviceType: string;
  hourlyRate: number;
  city: string;          // << NEW FIELD
  state: string;         // << NEW FIELD
  createdAt: Timestamp;  // Firestore Timestamp object
  updatedAt: Timestamp;  // Firestore Timestamp object
}

// --- Constantes ---
// Define Service Types and Rates (Consider fetching from Firestore/Config for scalability)
export const ServiceTypeRates: { [key: string]: number } = {
  'ambulatorio': 180,
  'urgencia_emergencia': 250,
  'teleconsulta': 120,
  'cirurgia_eletiva_auxilio': 300,
  // Add more types and rates here
};

// Define Medical Specialties (Consider fetching from Firestore/Config for scalability)
export const medicalSpecialties: string[] = [
  "Acupuntura", "Alergia e Imunologia", "Anestesiologia", "Angiologia",
  "Cardiologia", "Cirurgia Cardiovascular", "Cirurgia da Mão", "Cirurgia de Cabeça e Pescoço",
  "Cirurgia do Aparelho Digestivo", "Cirurgia Geral", "Cirurgia Oncológica", "Cirurgia Pediátrica",
  "Cirurgia Plástica", "Cirurgia Torácica", "Cirurgia Vascular", "Clínica Médica",
  "Coloproctologia", "Dermatologia", "Endocrinologia e Metabologia", "Endoscopia",
  "Gastroenterologia", "Genética Médica", "Geriatria", "Ginecologia e Obstetrícia",
  "Hematologia e Hemoterapia", "Homeopatia", "Infectologia", "Mastologia",
  "Medicina de Emergência", "Medicina de Família e Comunidade", "Medicina do Trabalho",
  "Medicina do Tráfego", "Medicina Esportiva", "Medicina Física e Reabilitação",
  "Medicina Intensiva", "Medicina Legal e Perícia Médica", "Medicina Nuclear",
  "Medicina Preventiva e Social", "Nefrologia", "Neurocirurgia", "Neurologia",
  "Nutrologia", "Oftalmologia", "Oncologia Clínica", "Ortopedia e Traumatologia",
  "Otorrinolaringologia", "Patologia", "Patologia Clínica/Medicina Laboratorial",
  "Pediatria", "Pneumologia", "Psiquiatria", "Radiologia e Diagnóstico por Imagem",
  "Radioterapia", "Reumatologia", "Urologia",
  // Add more specialties here
];


// --- Funções CRUD ---

/**
 * Adds a new availability time slot to Firestore for the currently authenticated user.
 * Includes service type, hourly rate, city, and state.
 */
export const addTimeSlot = async (
  // Use Omit to specify fields NOT provided by the frontend for creation
  timeSlotInput: Omit<TimeSlot, "id" | "doctorId" | "createdAt" | "updatedAt">,
): Promise<string> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.uid) {
        throw new Error("Usuário não autenticado. Faça login para adicionar disponibilidade.");
    }
    const uid = user.uid;

    // Validate required fields provided by the frontend
    if (!timeSlotInput.date || !timeSlotInput.startTime || !timeSlotInput.endTime) {
        throw new Error("Data, horário de início e término são obrigatórios.");
    }
    if (!timeSlotInput.serviceType || timeSlotInput.hourlyRate == null || timeSlotInput.hourlyRate < 0) {
        throw new Error("Tipo de atendimento e valor hora (válido) são obrigatórios.");
    }
    if (!timeSlotInput.city || !timeSlotInput.state) { // << NEW VALIDATION
        throw new Error("Cidade e Estado são obrigatórios.");
    }

    const dateTimestamp = Timestamp.fromDate(timeSlotInput.date);

    // Prepare the data object matching TimeSlotFirestoreData (excluding Timestamps)
    const docData = {
      doctorId: uid,
      date: dateTimestamp,
      startTime: timeSlotInput.startTime,
      endTime: timeSlotInput.endTime,
      specialties: timeSlotInput.specialties || [], // Ensure specialties is always an array
      serviceType: timeSlotInput.serviceType,
      hourlyRate: timeSlotInput.hourlyRate,
      city: timeSlotInput.city,     // << NEW FIELD
      state: timeSlotInput.state,   // << NEW FIELD
      createdAt: serverTimestamp(), // Set by Firestore server
      updatedAt: serverTimestamp(), // Set by Firestore server
    };

    const docRef = await addDoc(collection(db, "timeSlots"), docData);
    console.log("Time slot added with ID:", docRef.id);
    return docRef.id;

  } catch (error: any) {
    console.error("Error adding time slot to Firestore:", error);
    // Provide more specific error messages if possible
    if (error.code === 'permission-denied') {
        throw new Error("Permissão negada para adicionar disponibilidade. Verifique suas regras do Firestore.");
    }
    // Re-throw the original error message or a generic one
    throw new Error(`Falha ao adicionar disponibilidade: ${error.message || 'Erro desconhecido'}`);
  }
};

/**
 * Updates an existing time slot in Firestore.
 * Can update any field except doctorId, createdAt.
 */
export const updateTimeSlot = async (
    id: string,
    // Allow updating any field except id and doctorId
    timeSlotUpdate: Partial<Omit<TimeSlot, 'id' | 'doctorId' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.uid) {
        throw new Error("Usuário não autenticado. Faça login para atualizar disponibilidade.");
    }
    // Note: Add security rule in Firestore to ensure user can only update their own slots

    const slotRef = doc(db, "timeSlots", id);

    // Prepare the update payload, converting Date to Timestamp if present
    const updatePayload: Record<string, any> = { ...timeSlotUpdate };

    if (timeSlotUpdate.date) {
        if (timeSlotUpdate.date instanceof Date) {
            updatePayload.date = Timestamp.fromDate(timeSlotUpdate.date);
        } else {
            // Handle potential invalid date format if necessary, or remove if not Date
            console.warn("Attempted to update date with non-Date object:", timeSlotUpdate.date);
            delete updatePayload.date; // Avoid sending invalid data
        }
    }

    // Ensure specialties is always an array if provided
    if (timeSlotUpdate.specialties && !Array.isArray(timeSlotUpdate.specialties)) {
        console.warn("Attempted to update specialties with non-array value:", timeSlotUpdate.specialties);
        updatePayload.specialties = []; // Default to empty array or handle as error
    }

    // Validate rate if provided
    if (timeSlotUpdate.hourlyRate != null && timeSlotUpdate.hourlyRate < 0) {
        throw new Error("Valor hora inválido fornecido para atualização.");
    }

    // Add the server timestamp for updatedAt
    updatePayload.updatedAt = serverTimestamp();

    console.log("Updating time slot:", id, "with payload:", updatePayload);
    await updateDoc(slotRef, updatePayload);
    console.log("Time slot updated successfully:", id);

  } catch (error: any) {
    console.error(`Error updating time slot ${id}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error("Permissão negada para atualizar este horário. Verifique as regras do Firestore.");
    }
    throw new Error(`Falha ao atualizar disponibilidade: ${error.message || 'Erro desconhecido'}`);
  }
};

/**
 * Deletes a specific time slot from Firestore.
 */
export const deleteTimeSlot = async (id: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.uid) {
        throw new Error("Usuário não autenticado. Faça login para remover disponibilidade.");
    }
    // Note: Add security rule in Firestore to ensure user can only delete their own slots

    const slotRef = doc(db, "timeSlots", id);
    console.log("Deleting time slot:", id);
    await deleteDoc(slotRef);
    console.log("Time slot deleted successfully:", id);

  } catch (error: any) {
    console.error(`Error deleting time slot ${id}:`, error);
    if (error.code === 'permission-denied') {
      throw new Error("Permissão negada para deletar este horário. Verifique as regras do Firestore.");
    }
    throw new Error(`Falha ao remover disponibilidade: ${error.message || 'Erro desconhecido'}`);
  }
};

/**
 * Fetches all time slots for the currently authenticated user from Firestore.
 * Returns data mapped to the TimeSlot interface (with JavaScript Dates).
 * Includes service type, hourly rate, city, and state.
 */
export const getTimeSlots = async (): Promise<TimeSlot[]> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.uid) {
      console.warn("getTimeSlots chamado sem usuário autenticado.");
      return []; // Return empty array if no user is logged in
    }
    const uid = user.uid;

    // Query to get slots for the current user, ordered by date then start time
    const q = query(
        collection(db, "timeSlots"),
        where("doctorId", "==", uid),
        orderBy("date", "asc"),
        orderBy("startTime", "asc")
    );

    console.log("Fetching time slots for user:", uid);
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.size} time slots for user ${uid}.`);

    const timeSlots: TimeSlot[] = [];
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as Partial<TimeSlotFirestoreData>; // Use Partial for safety checks

      // --- Robust Data Validation ---
      if (
        !data.doctorId ||
        !(data.date instanceof Timestamp) ||
        !data.startTime ||
        !data.endTime ||
        !data.serviceType ||
        data.hourlyRate == null || data.hourlyRate < 0 ||
        !data.city || // << NEW CHECK
        !data.state   // << NEW CHECK
      ) {
        console.warn(`Document ${docSnapshot.id} has incomplete or invalid data, skipping. Data:`, data);
        return; // Skip this document if essential fields are missing or invalid
      }

      // Convert Firestore Timestamps to JavaScript Date objects
      const jsDate = data.date.toDate();
      const createdAtDate = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
      const updatedAtDate = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;

      // Construct the TimeSlot object for the frontend
      timeSlots.push({
        id: docSnapshot.id,
        doctorId: data.doctorId,
        date: jsDate,
        startTime: data.startTime,
        endTime: data.endTime,
        specialties: Array.isArray(data.specialties) ? data.specialties : [], // Ensure it's an array
        serviceType: data.serviceType,
        hourlyRate: data.hourlyRate,
        city: data.city,          // << NEW FIELD
        state: data.state,        // << NEW FIELD
        createdAt: createdAtDate,
        updatedAt: updatedAtDate,
      });
    });

    // Sorting is now handled by Firestore query (orderBy)
    // timeSlots.sort((a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime));

    console.log("Successfully mapped time slots:", timeSlots);
    return timeSlots;

  } catch (error: any) {
    console.error("Error getting time slots from Firestore:", error);
    if (error.code === 'permission-denied') {
      throw new Error("Permissão negada para buscar disponibilidade. Verifique as regras do Firestore e a autenticação.");
    }
    throw new Error(`Falha ao buscar disponibilidade: ${error.message || 'Erro desconhecido'}`);
  }
};

// --- Helper Functions (Optional) ---

/**
 * Example function to fetch service types and rates from Firestore
 * (Replace the hardcoded constant if you move this data to the DB)
 */
// export const getServiceTypesAndRates = async (): Promise<{ [key: string]: number }> => {
//   // Implementation to fetch from a 'serviceTypes' collection in Firestore
//   // ...
//   // return fetchedRates;
//   console.warn("getServiceTypesAndRates not implemented, using hardcoded values.");
//   return ServiceTypeRates; // Placeholder
// };

/**
* Example function to fetch medical specialties from Firestore
* (Replace the hardcoded constant if you move this data to the DB)
*/
// export const getMedicalSpecialties = async (): Promise<string[]> => {
//  // Implementation to fetch from a 'specialties' collection in Firestore
//  // ...
//  // return fetchedSpecialties;
//  console.warn("getMedicalSpecialties not implemented, using hardcoded values.");
//  return medicalSpecialties; // Placeholder
// };