// lib/patient-service.ts
"use strict";

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
  setDoc, // Adicionado para a função de salvar
  limit, // Adicionado para a busca de consulta
} from "firebase/firestore";
import { db, auth } from "./firebase";

// Interface para os dados do formulário de salvamento do prontuário
export interface ConsultationDetailsPayload {
  clinicalEvolution: string;
  diagnosticHypothesis: string;
}

// Interface completa para os dados de uma consulta
export interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  medicalHistorySummary?: string;
  contractId: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  serviceType: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: Timestamp;
  clinicalEvolution?: string;
  diagnosticHypothesis?: string; // Campo que faltava
  prescriptions?: string[];
}

// Interface para os dados de um paciente
export interface Patient {
  id: string;
  hospitalId: string;
  name: string;
  cpf?: string;
  dateOfBirth?: Timestamp;
  phone?: string;
  email?: string;
  createdAt: Timestamp;
}

// Interface para os dados do formulário de criação de paciente
export interface PatientPayload {
  name: string;
  cpf?: string;
  dateOfBirth?: Date;
  phone?: string;
  email?: string;
}

/**
 * Adiciona um novo paciente ao banco de dados.
 */
export const addPatient = async (payload: PatientPayload): Promise<string> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  if (!payload.name) throw new Error("O nome do paciente é obrigatório.");

  const patientsRef = collection(db, "patients");
  
  const newPatientData = {
    ...payload,
    hospitalId: currentUser.uid,
    dateOfBirth: payload.dateOfBirth ? Timestamp.fromDate(payload.dateOfBirth) : undefined,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(patientsRef, newPatientData);
  return docRef.id;
};

/**
 * Busca a lista de pacientes de um hospital.
 */
export const getPatientsByHospital = async (): Promise<Patient[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];

  const patientsRef = collection(db, "patients");
  const q = query(
    patientsRef,
    where("hospitalId", "==", currentUser.uid),
    orderBy("name", "asc")
  );

  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
  } catch (error) {
    console.error("Erro ao buscar pacientes:", error);
    throw new Error("Não foi possível carregar a lista de pacientes.");
  }
};

/**
 * Busca um único paciente pelo seu ID.
 */
export const getPatientById = async (patientId: string): Promise<Patient | null> => {
    const patientRef = doc(db, "patients", patientId);
    const docSnap = await getDoc(patientRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Patient;
    }
    return null;
};

/**
 * Busca o histórico de consultas de um paciente específico.
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
 * Busca os detalhes de uma consulta com base no ID do contrato.
 */
export const getConsultationByContractId = async (contractId: string): Promise<Consultation | null> => {
    if (!contractId) return null;
    
    const consultsRef = collection(db, "consultations");
    const q = query(consultsRef, where("contractId", "==", contractId), limit(1));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.warn(`[getConsultationByContractId] Nenhuma consulta encontrada para o contractId: ${contractId}`);
            return null;
        }
        const docSnap = querySnapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Consultation;
    } catch (error) {
        console.error("[getConsultationByContractId] Erro ao buscar consulta:", error);
        throw new Error("Falha ao carregar os dados da consulta.");
    }
};

/**
 * Salva ou atualiza os detalhes do prontuário de uma consulta.
 */
export const saveConsultationDetails = async (consultationId: string, payload: ConsultationDetailsPayload): Promise<void> => {
    if (!consultationId) throw new Error("ID da consulta é obrigatório.");

    const consultRef = doc(db, "consultations", consultationId);
    
    try {
        await setDoc(consultRef, {
            clinicalEvolution: payload.clinicalEvolution,
            diagnosticHypothesis: payload.diagnosticHypothesis,
            status: 'IN_PROGRESS'
        }, { merge: true });
    } catch (error) {
        console.error("[saveConsultationDetails] Erro ao salvar detalhes da consulta:", error);
        throw new Error("Não foi possível salvar os dados do prontuário.");
    }
};