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
  updateDoc,
  limit,
  startAt,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { db, auth } from "./firebase";

// --- INTERFACES ALINHADAS COM A ESTRUTURA FHIR (SIMPLIFICADA) ---
export interface PatientName {
  use: 'official' | 'usual' | 'nickname';
  family: string; // Apelido
  given: string[]; // Nomes próprios
}

export interface PatientIdentifier {
  system: string; // Ex: "CPF", "RG"
  value: string;
}

export interface Patient {
  id: string;
  unitId: string;
  name: PatientName[];
  identifier: PatientIdentifier[];
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string; // Formato YYYY-MM-DD
  telecom?: { system: 'phone' | 'email', value: string }[];
  name_lowercase: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface PatientPayload {
  name: PatientName[];
  identifier: PatientIdentifier[];
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;
  telecom?: { system: 'phone' | 'email', value: string }[];
  unitId: string;
  createdBy: string;
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
    unitId: string;
    createdAt: Timestamp;
    triageData?: TriageData;
    nurseId?: string;
    doctorId?: string;
}

/**
 * Função ATUALIZADA para criar um paciente com a nova estrutura de dados.
 */
export const createPatient = async (patientData: PatientPayload): Promise<string> => {
    try {
        const patientsRef = collection(db, "patients");
        const fullName = `${patientData.name[0].given.join(' ')} ${patientData.name[0].family}`;
        
        const docRef = await addDoc(patientsRef, {
            ...patientData,
            name_lowercase: fullName.toLowerCase(),
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
            patientsRef,
            where("unitId", "==", unitId),
            orderBy("name_lowercase"),
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
 * Função ATUALIZADA para lidar com o novo formato de nome do paciente.
 */
export const addPatientToServiceQueue = async (patient: Patient, unitId: string): Promise<string> => {
    try {
        const queueRef = collection(db, "serviceQueue");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayQueueQuery = query(queueRef, where("unitId", "==", unitId), where("createdAt", ">=", today));
        const todayQueueSnapshot = await getDocs(todayQueueQuery);
        const nextTicketNumber = `A${(todayQueueSnapshot.size + 1).toString().padStart(2, '0')}`;

        // Constrói o nome completo a partir da estrutura FHIR para salvar na fila
        const patientFullName = `${patient.name[0].given.join(' ')} ${patient.name[0].family}`;

        const queueEntry = {
            ticketNumber: nextTicketNumber,
            patientName: patientFullName,
            patientId: patient.id,
            status: 'Aguardando Triagem',
            unitId,
            createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(queueRef, queueEntry);
        return docRef.id;
    } catch (error) {
        console.error("Erro ao adicionar paciente à fila:", error);
        throw new Error("Não foi possível adicionar o paciente à fila de atendimento.");
    }
};

export const listenToServiceQueue = (unitId: string, status: ServiceQueueEntry['status'], callback: (entries: ServiceQueueEntry[]) => void): Unsubscribe => {
    const queueRef = collection(db, "serviceQueue");
    const q = query(
        queueRef, 
        where("unitId", "==", unitId), 
        where("status", "==", status),
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

export const startTriage = async (queueId: string, nurseId: string): Promise<void> => {
    try {
        const queueDocRef = doc(db, "serviceQueue", queueId);
        await updateDoc(queueDocRef, {
            status: 'Em Triagem',
            nurseId: nurseId,
        });
    } catch (error) {
        throw new Error("Não foi possível chamar o paciente para a triagem.");
    }
};

export const submitTriage = async (queueId: string, triageData: TriageData): Promise<void> => {
    try {
        const queueDocRef = doc(db, "serviceQueue", queueId);
        await updateDoc(queueDocRef, {
            triageData: triageData,
            status: 'Aguardando Atendimento',
        });
    } catch (error) {
        throw new Error("Não foi possível finalizar a triagem.");
    }
};