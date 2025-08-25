// lib/patient-service.ts
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  limit,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

// --- INTERFACES E TIPOS ---
export interface PatientPayload {
  name: string;
  cpf?: string;
  dob?: string;
  phone?: string;
  unitId: string;
  createdBy: string;
}

export interface Patient extends PatientPayload {
  id: string;
  name_lowercase: string;
  createdAt: Timestamp;
}

export interface TriageData {
    chiefComplaint: string;
    bloodPressure: string;
    temperature: string;
    heartRate: string;
    respiratoryRate: string;
    oxygenSaturation: string;
    notes?: string;
}

export interface ServiceQueueEntry {
    id: string;
    ticketNumber: string;
    patientName: string;
    patientId: string;
    status: 'Aguardando Triagem' | 'Em Triagem' | 'Aguardando Atendimento' | 'Em Atendimento' | 'Finalizado';
    type: 'Presencial' | 'Telemedicina';
    unitId: string;
    hospitalName: string; // <<< CAMPO ADICIONADO
    createdAt: Timestamp;
    triageData?: TriageData;
    nurseId?: string;
    doctorId?: string;
}

// ... createPatient e searchPatients permanecem iguais ...
export const createPatient = async (patientData: PatientPayload): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, "patients"), {
            ...patientData,
            name_lowercase: patientData.name.toLowerCase(),
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Erro ao cadastrar paciente:", error);
        throw new Error("Não foi possível cadastrar o novo paciente.");
    }
};
export const searchPatients = async (searchTerm: string, unitId: string): Promise<Patient[]> => {
    if (searchTerm.length < 2) return [];
    try {
        const patientsRef = collection(db, "patients");
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const q = query(
            patientsRef, where("unitId", "==", unitId), orderBy("name_lowercase"),
            where("name_lowercase", ">=", lowerCaseSearchTerm),
            where("name_lowercase", "<=", lowerCaseSearchTerm + '\uf8ff'),
            limit(10)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
    } catch (error) {
        console.error("Erro na busca por pacientes:", error);
        throw new Error("Não foi possível realizar a busca por pacientes.");
    }
};


/**
 * Adiciona um paciente à fila de atendimento.
 * ATUALIZADO: Agora também salva o nome da unidade de saúde.
 */
export const addPatientToServiceQueue = async (
    patient: Pick<Patient, 'id' | 'name'>, 
    unitId: string,
    hospitalName: string, // <<< NOVO PARÂMETRO
    attendanceType: 'Presencial' | 'Telemedicina'
): Promise<string> => {
    try {
        const queueRef = collection(db, "serviceQueue");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayQueueQuery = query(queueRef, where("unitId", "==", unitId), where("createdAt", ">=", today));
        const todayQueueSnapshot = await getDocs(todayQueueQuery);
        const nextTicketNumber = `${attendanceType === 'Telemedicina' ? 'T' : 'A'}${(todayQueueSnapshot.size + 1).toString().padStart(3, '0')}`;

        const queueEntry = {
            ticketNumber: nextTicketNumber,
            patientName: patient.name,
            patientId: patient.id,
            status: 'Aguardando Triagem' as const,
            unitId,
            hospitalName, // <<< VALOR GUARDADO
            type: attendanceType,
            createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(queueRef, queueEntry);
        return docRef.id;
    } catch (error) {
        console.error("Erro ao adicionar paciente à fila:", error);
        throw new Error("Não foi possível adicionar o paciente à fila de atendimento.");
    }
};

/**
 * Escuta em tempo real as mudanças na fila de atendimento.
 * ATUALIZADO: Agora também filtra por tipo de atendimento.
 */
export const listenToServiceQueue = (
    unitId: string, 
    status: ServiceQueueEntry['status'], 
    attendanceType: ServiceQueueEntry['type'], // <<< NOVO PARÂMETRO
    callback: (entries: ServiceQueueEntry[]) => void
): Unsubscribe => {
    const q = query(
        collection(db, "serviceQueue"), 
        where("unitId", "==", unitId), 
        where("status", "==", status),
        where("type", "==", attendanceType), // <<< NOVO FILTRO
        orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceQueueEntry));
        callback(entries);
    }, (error) => {
        console.error("[PatientService] Erro ao escutar a fila de atendimento:", error);
        callback([]);
    });

    return unsubscribe;
};

// ... (as outras funções startTriage, etc. permanecem iguais) ...
export const startTriage = async (queueId: string, nurseId: string): Promise<void> => {
    try {
        await updateDoc(doc(db, "serviceQueue", queueId), { status: 'Em Triagem', nurseId: nurseId });
    } catch (error) { throw new Error("Não foi possível chamar o paciente para a triagem."); }
};
export const submitTriage = async (queueId: string, triageData: TriageData): Promise<void> => {
    try {
        await updateDoc(doc(db, "serviceQueue", queueId), { triageData: triageData, status: 'Aguardando Atendimento' });
    } catch (error) { throw new Error("Não foi possível finalizar a triagem."); }
};
export const getPatientById = async (patientId: string): Promise<Patient | null> => {
    if (!patientId) return null;
    const docSnap = await getDoc(doc(db, "patients", patientId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Patient : null;
};