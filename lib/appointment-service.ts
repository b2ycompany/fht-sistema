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

export interface TelemedicineAppointment {
  id: string;
  patientName: string;
  patientId?: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  appointmentDate: Timestamp;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "IN_PROGRESS";
  telemedicineRoomUrl: string;
  createdAt: Timestamp;
  createdBy: string;
  clinicalEvolution?: string;
  diagnosticHypothesis?: string;
  aiAnalysisReport?: string;
  autismProtocolAnswers?: Record<string, any>;
  documents?: Array<{ type: string; url: string; createdAt: Timestamp }>;
}

interface CreateAppointmentPayload {
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  appointmentDate: string;
}

const createTelemedicineAppointmentFunction = httpsCallable<CreateAppointmentPayload, { success: boolean, appointmentId: string }>(functions, 'createTelemedicineAppointment');

export const createTelemedicineAppointment = async (data: Omit<CreateAppointmentPayload, 'appointmentDate'> & { appointmentDate: Date }): Promise<string> => {
  try {
    const payload: CreateAppointmentPayload = {
        ...data,
        appointmentDate: data.appointmentDate.toISOString(),
    };
    const result = await createTelemedicineAppointmentFunction(payload);
    if (!result.data.success || !result.data.appointmentId) {
        throw new Error("A Cloud Function não retornou um resultado de sucesso.");
    }
    return result.data.appointmentId;
  } catch (error) {
    const message = (error as any).message || "Não foi possível concluir o agendamento.";
    throw new Error(message);
  }
};

export const getAppointmentsForDoctor = async (doctorId: string): Promise<TelemedicineAppointment[]> => {
  try {
    const appointmentsCollection = collection(db, "telemedicineAppointments");
    const q = query(
      appointmentsCollection,
      where("doctorId", "==", doctorId),
      where("status", "in", ["SCHEDULED", "IN_PROGRESS"]),
      orderBy("appointmentDate", "asc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), } as TelemedicineAppointment));
  } catch (error) {
    throw new Error("Falha ao carregar a agenda.");
  }
};

export const getAppointmentById = async (appointmentId: string): Promise<TelemedicineAppointment | null> => {
  try {
    const docRef = doc(db, "telemedicineAppointments", appointmentId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as TelemedicineAppointment;
    }
    return null;
  } catch (error) {
    throw new Error("Falha ao carregar os dados do agendamento.");
  }
};

export const saveAppointmentDetails = async (
  appointmentId: string,
  details: { clinicalEvolution: string; diagnosticHypothesis: string }
): Promise<void> => {
  try {
    const appointmentRef = doc(db, "telemedicineAppointments", appointmentId);
    await updateDoc(appointmentRef, {
      clinicalEvolution: details.clinicalEvolution,
      diagnosticHypothesis: details.diagnosticHypothesis,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error("Não foi possível salvar as anotações do prontuário.");
  }
};

export const saveAppointmentProtocolAnswers = async (
    appointmentId: string,
    answers: Record<string, any>
): Promise<void> => {
    try {
        const appointmentRef = doc(db, "telemedicineAppointments", appointmentId);
        await updateDoc(appointmentRef, {
            autismProtocolAnswers: answers,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        throw new Error("Não foi possível salvar as respostas do protocolo.");
    }
};

export const saveAppointmentAIReport = async (
    appointmentId: string,
    report: string
): Promise<void> => {
    try {
        const appointmentRef = doc(db, "telemedicineAppointments", appointmentId);
        await updateDoc(appointmentRef, {
            aiAnalysisReport: report,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        throw new Error("Não foi possível salvar o relatório da IA.");
    }
};