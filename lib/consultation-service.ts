// lib/consultation-service.ts
import { doc, getDoc, collection, query, where, getDocs, limit, Timestamp, writeBatch, serverTimestamp, updateDoc, orderBy, } from "firebase/firestore";
import { db, functions } from "./firebase";
import { httpsCallable } from "firebase/functions";
import type { ServiceQueueEntry } from "./patient-service";
import type { DoctorProfile } from "./auth-service";

export interface GeneratedDocument {
    id: string;
    name: string;
    type: 'prescription' | 'medicalCertificate' | 'attendanceCertificate';
    url: string;
    createdAt: Timestamp;
}

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

export interface ConsultationDetailsPayload {
  clinicalEvolution: string;
  diagnosticHypothesis: string;
}

const createTelemedicineRoomCallable = httpsCallable<{ consultationId: string }, { success: boolean, roomUrl: string }>(functions, 'createConsultationRoom');

export const createConsultationFromQueue = async (queueEntry: ServiceQueueEntry, doctor: Pick<DoctorProfile, 'uid' | 'displayName'>, hospitalName: string): Promise<string> => {
    const batch = writeBatch(db);
    const newConsultationRef = doc(collection(db, "consultations"));
    
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

    if (queueEntry.type === 'Telemedicina') {
        try {
            const result = await createTelemedicineRoomCallable({ consultationId: newConsultationRef.id });
            if (result.data.success) {
                newConsultationData.telemedicineLink = result.data.roomUrl;
            }
        } catch (error) {
            console.error("Falha ao criar a sala de telemedicina:", error);
        }
    }

    batch.set(newConsultationRef, newConsultationData);

    const queueDocRef = doc(db, "serviceQueue", queueEntry.id);
    batch.update(queueDocRef, {
        status: 'Em Atendimento',
        doctorId: doctor.uid,
    });

    await batch.commit();
    return newConsultationRef.id;
};

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