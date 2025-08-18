// lib/appointment-service.ts
import { db, functions } from "./firebase";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  orderBy,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

// Interface atualizada para ser mais genérica
export interface Appointment {
  id: string;
  patientName: string;
  patientId?: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  type: 'Telemedicina' | 'Presencial'; // Novo campo para o tipo de agendamento
  appointmentDate: Timestamp;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "IN_PROGRESS";
  telemedicineRoomUrl: string | null; // Pode ser nulo para consultas presenciais
  createdAt: Timestamp;
  createdBy: string;
  clinicalEvolution?: string;
  diagnosticHypothesis?: string;
  aiAnalysisReport?: string;
  autismProtocolAnswers?: Record<string, any>;
  documents?: Array<{ type: string; url: string; createdAt: Timestamp }>;
}

// Payload de criação atualizado para incluir o tipo
interface CreateAppointmentPayload {
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  appointmentDate: string;
  type: 'Telemedicina' | 'Presencial';
}

// Referência à nova Cloud Function 'createAppointment'
const createAppointmentFunction = httpsCallable<CreateAppointmentPayload, { success: boolean, appointmentId: string }>(functions, 'createAppointment');

/**
 * Função de serviço RENOMEADA E ATUALIZADA para criar qualquer tipo de agendamento.
 * @param data - Os dados do agendamento, incluindo o novo campo 'type'.
 * @returns O ID do agendamento criado.
 */
export const createAppointment = async (data: Omit<CreateAppointmentPayload, 'appointmentDate'> & { appointmentDate: Date }): Promise<string> => {
  try {
    const payload: CreateAppointmentPayload = {
        ...data,
        appointmentDate: data.appointmentDate.toISOString(),
    };
    const result = await createAppointmentFunction(payload);
    if (!result.data.success || !result.data.appointmentId) {
        throw new Error("A Cloud Function não retornou um resultado de sucesso.");
    }
    return result.data.appointmentId;
  } catch (error) {
    const message = (error as any).message || "Não foi possível concluir o agendamento.";
    throw new Error(message);
  }
};

/**
 * Busca os agendamentos de um médico na nova coleção 'appointments'.
 * @param doctorId - O UID do médico.
 * @returns Uma lista de agendamentos.
 */
export const getAppointmentsForDoctor = async (doctorId: string): Promise<Appointment[]> => {
  try {
    // ATUALIZAÇÃO: Apontando para a nova coleção "appointments"
    const appointmentsCollection = collection(db, "appointments");
    const q = query(
      appointmentsCollection,
      where("doctorId", "==", doctorId),
      where("status", "in", ["SCHEDULED", "IN_PROGRESS"]),
      orderBy("appointmentDate", "asc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), } as Appointment));
  } catch (error) {
    throw new Error("Falha ao carregar a agenda.");
  }
};

/**
 * Busca um agendamento específico pelo ID na nova coleção 'appointments'.
 * @param appointmentId - O ID do agendamento.
 * @returns O agendamento encontrado ou nulo.
 */
export const getAppointmentById = async (appointmentId: string): Promise<Appointment | null> => {
  try {
    // ATUALIZAÇÃO: Apontando para a nova coleção "appointments"
    const docRef = doc(db, "appointments", appointmentId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Appointment;
    }
    return null;
  } catch (error) {
    throw new Error("Falha ao carregar os dados do agendamento.");
  }
};

/**
 * Salva detalhes do prontuário em um agendamento na coleção 'appointments'.
 * @param appointmentId - O ID do agendamento.
 * @param details - Os detalhes a serem salvos.
 */
export const saveAppointmentDetails = async (
  appointmentId: string,
  details: { clinicalEvolution: string; diagnosticHypothesis: string }
): Promise<void> => {
  try {
    // ATUALIZAÇÃO: Apontando para a nova coleção "appointments"
    const appointmentRef = doc(db, "appointments", appointmentId);
    await updateDoc(appointmentRef, {
      clinicalEvolution: details.clinicalEvolution,
      diagnosticHypothesis: details.diagnosticHypothesis,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error("Não foi possível salvar as anotações do prontuário.");
  }
};

/**
 * Salva as respostas de um protocolo em um agendamento na coleção 'appointments'.
 * @param appointmentId - O ID do agendamento.
 * @param answers - As respostas do protocolo.
 */
export const saveAppointmentProtocolAnswers = async (
    appointmentId: string,
    answers: Record<string, any>
): Promise<void> => {
    try {
        // ATUALIZAÇÃO: Apontando para a nova coleção "appointments"
        const appointmentRef = doc(db, "appointments", appointmentId);
        await updateDoc(appointmentRef, {
            autismProtocolAnswers: answers,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        throw new Error("Não foi possível salvar as respostas do protocolo.");
    }
};

/**
 * Salva o relatório da IA em um agendamento na coleção 'appointments'.
 * @param appointmentId - O ID do agendamento.
 * @param report - O relatório a ser salvo.
 */
export const saveAppointmentAIReport = async (
    appointmentId: string,
    report: string
): Promise<void> => {
    try {
        // ATUALIZAÇÃO: Apontando para a nova coleção "appointments"
        const appointmentRef = doc(db, "appointments", appointmentId);
        await updateDoc(appointmentRef, {
            aiAnalysisReport: report,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        throw new Error("Não foi possível salvar o relatório da IA.");
    }
};