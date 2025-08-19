"use strict";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  Timestamp,
  setDoc,
  orderBy,
  writeBatch,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ServiceQueueEntry } from "./patient-service";
import type { DoctorProfile } from "./auth-service";

export interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  medicalHistorySummary?: string;
  contractId: string | null;
  queueId: string | null;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  serviceType: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: Timestamp;
  triageData?: any;
  clinicalEvolution?: string;
  diagnosticHypothesis?: string;
  prescriptions?: string[];
  documents?: string[];
}

export interface ConsultationDetailsPayload {
  clinicalEvolution: string;
  diagnosticHypothesis: string;
}

export const createConsultationFromQueue = async (queueEntry: ServiceQueueEntry, doctor: Pick<DoctorProfile, 'uid' | 'displayName'>): Promise<string> => {
    const batch = writeBatch(db);
    
    const newConsultationRef = doc(collection(db, "consultations"));
    
    const newConsultationData: Omit<Consultation, 'id' | 'contractId'> = {
        patientId: queueEntry.patientId,
        patientName: queueEntry.patientName,
        chiefComplaint: queueEntry.triageData?.chiefComplaint || 'Não informado',
        queueId: queueEntry.id,
        doctorId: doctor.uid,
        doctorName: doctor.displayName,
        hospitalId: queueEntry.unitId,
        hospitalName: "Nome da Unidade", // Idealmente, este nome deveria ser buscado do perfil do hospital
        serviceType: "Presencial",
        status: 'IN_PROGRESS',
        createdAt: serverTimestamp() as Timestamp,
        triageData: queueEntry.triageData || {},
    };

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

export const getConsultationByContractId = async (contractId: string): Promise<Consultation | null> => {
    if (!contractId) return null;
    const consultsRef = collection(db, "consultations");
    const q = query(consultsRef, where("contractId", "==", contractId), limit(1));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return null;
        }
        const docSnap = querySnapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Consultation;
    } catch (error) {
        throw new Error("Falha ao carregar os dados da consulta.");
    }
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
        throw new Error("Não foi possível salvar os dados do prontuário.");
    }
};