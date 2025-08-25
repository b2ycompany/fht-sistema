// lib/consultation-service.ts
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  Timestamp,
  writeBatch,
  serverTimestamp,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import { db, functions } from "./firebase";
import { httpsCallable } from "firebase/functions";
import type { ServiceQueueEntry } from "./patient-service";
import type { DoctorProfile } from "./auth-service";

// Interface para um documento gerado (receita, atestado, etc.)
export interface GeneratedDocument {
    id: string; // ID do documento na coleção 'prescriptions' ou 'documents'
    name: string; // Ex: "Receita Médica", "Atestado"
    type: 'prescription' | 'medicalCertificate' | 'attendanceCertificate';
    url: string; // URL para o PDF
    createdAt: Timestamp;
}

// Interface principal da Consulta, agora com os campos para telemedicina
export interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  queueId: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  type: 'Presencial' | 'Telemedicina';
  createdAt: Timestamp;
  triageData?: any;
  clinicalEvolution?: string;
  diagnosticHypothesis?: string;
  generatedDocuments?: GeneratedDocument[];
  telemedicineLink?: string;
}

// Interface para a atualização do prontuário
export interface ConsultationDetailsPayload {
  clinicalEvolution: string;
  diagnosticHypothesis: string;
}

// Prepara a chamada para a Cloud Function que cria a sala de vídeo
const createTelemedicineRoomCallable = httpsCallable<{ consultationId: string }, { success: boolean, roomUrl: string }>(functions, 'createConsultationRoom');

/**
 * Cria um novo registo de consulta a partir de uma entrada na fila de atendimento.
 */
export const createConsultationFromQueue = async (queueEntry: ServiceQueueEntry, doctor: Pick<DoctorProfile, 'uid' | 'displayName'>): Promise<string> => {
    const batch = writeBatch(db);
    const newConsultationRef = doc(collection(db, "consultations"));
    
    // Constrói o objeto da nova consulta com todos os dados necessários
    const newConsultationData: Omit<Consultation, 'id'> = {
        patientId: queueEntry.patientId,
        patientName: queueEntry.patientName,
        queueId: queueEntry.id,
        doctorId: doctor.uid,
        doctorName: doctor.displayName,
        hospitalId: queueEntry.unitId,
        hospitalName: queueEntry.hospitalName,
        status: 'IN_PROGRESS',
        type: queueEntry.type,
        createdAt: serverTimestamp() as Timestamp,
        triageData: queueEntry.triageData || {},
        generatedDocuments: [],
    };

    // LÓGICA DE TELEMEDICINA:
    // Se o atendimento for por telemedicina, esta função agora também cria a sala de vídeo.
    if (queueEntry.type === 'Telemedicina') {
        try {
            const result = await createTelemedicineRoomCallable({ consultationId: newConsultationRef.id });
            if (result.data.success) {
                newConsultationData.telemedicineLink = result.data.roomUrl;
            }
        } catch (error) {
            console.error("Falha ao criar a sala de telemedicina:", error);
            // Continua mesmo se a sala falhar, para não bloquear o atendimento. O link ficará vazio.
        }
    }

    // Adiciona a criação da consulta ao batch
    batch.set(newConsultationRef, newConsultationData);

    // Atualiza a entrada na fila para indicar que o atendimento começou
    const queueDocRef = doc(db, "serviceQueue", queueEntry.id);
    batch.update(queueDocRef, {
        status: 'Em Atendimento',
        doctorId: doctor.uid,
    });

    // Executa todas as operações de uma só vez
    await batch.commit();
    return newConsultationRef.id;
};

/**
 * Finaliza uma consulta, atualizando o status na consulta e na fila.
 */
export const completeConsultation = async (consultation: Consultation): Promise<void> => {
    const batch = writeBatch(db);
    
    const consultationRef = doc(db, "consultations", consultation.id);
    batch.update(consultationRef, { status: 'COMPLETED' });

    if (consultation.queueId) {
        const queueRef = doc(db, "serviceQueue", consultation.queueId);
        batch.update(queueRef, { status: 'Finalizado' });
    }

    await batch.commit();
};

/**
 * Busca uma consulta específica pelo seu ID.
 */
export const getConsultationById = async (consultationId: string): Promise<Consultation | null> => {
    if (!consultationId) return null;
    const consultRef = doc(db, "consultations", consultationId);
    try {
        const docSnap = await getDoc(consultRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Consultation : null;
    } catch (error) {
        console.error("Falha ao carregar dados da consulta:", error);
        throw new Error("Falha ao carregar os dados da consulta.");
    }
};

/**
 * Busca o histórico de consultas de um paciente.
 */
export const getConsultationsForPatient = async (patientId: string): Promise<Consultation[]> => {
    const consultsRef = collection(db, "consultations");
    const q = query(
        consultsRef,
        where("patientId", "==", patientId),
        orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consultation));
};

/**
 * Salva as anotações do prontuário (evolução e hipótese).
 */
export const saveConsultationDetails = async (consultationId: string, payload: ConsultationDetailsPayload): Promise<void> => {
    if (!consultationId) throw new Error("ID da consulta é obrigatório.");
    const consultRef = doc(db, "consultations", consultationId);
    try {
        await updateDoc(consultRef, {
            clinicalEvolution: payload.clinicalEvolution,
            diagnosticHypothesis: payload.diagnosticHypothesis,
        });
    } catch (error) {
        console.error("Erro ao salvar dados do prontuário:", error);
        throw new Error("Não foi possível salvar os dados do prontuário.");
    }
};