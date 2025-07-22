// lib/checkin-service.ts
"use strict";

import {
  doc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { type Contract } from "./contract-service";

// --- INTERFACE ATUALIZADA ---
// Adicionados campos opcionais para os dados do paciente
export interface CheckinRecord {
  id: string;
  contractId: string;
  serviceType: string;
  hospitalName: string;
  locationCity: string;
  locationState: string;
  shiftDate: Timestamp;
  expectedStartTime: string;
  expectedEndTime: string;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'MISSED' | 'CANCELLED';
  checkinAt?: Timestamp;
  checkoutAt?: Timestamp;
  checkinLocation?: { latitude: number; longitude: number; };
  checkoutLocation?: { latitude: number; longitude: number; };
  
  // Dados do paciente agendado
  patientName?: string;
  chiefComplaint?: string;
}

export const getActiveShiftsForCheckin = async (): Promise<CheckinRecord[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Utilizador não autenticado.");

  const contractsRef = collection(db, "contracts");
  const q = query(
    contractsRef,
    where("doctorId", "==", currentUser.uid),
    where("status", "in", ["ACTIVE_SIGNED", "IN_PROGRESS"])
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return [];
  }

  // --- MAPEAMENTO DE DADOS ATUALIZADO ---
  // Agora a função também busca por uma consulta agendada para cada plantão
  const recordsPromises = snapshot.docs.map(async (doc) => {
    const contract = doc.data() as Contract;
    
    let currentStatus: CheckinRecord['status'] = 'SCHEDULED';
    if (contract.status === 'IN_PROGRESS') {
        currentStatus = 'CHECKED_IN';
    }

    const record: CheckinRecord = {
      id: doc.id,
      contractId: doc.id,
      serviceType: contract.serviceType,
      hospitalName: contract.hospitalName,
      locationCity: contract.locationCity,
      locationState: contract.locationState,
      shiftDate: contract.shiftDates[0],
      expectedStartTime: contract.startTime,
      expectedEndTime: contract.endTime,
      status: currentStatus,
      checkinAt: contract.checkinAt,
      checkoutAt: contract.checkoutAt,
      checkinLocation: contract.checkinLocation,
      checkoutLocation: contract.checkoutLocation,
    };

    // Se for telemedicina, verifica se há um paciente agendado
    if (contract.serviceType === 'Telemedicina') {
        const consultQuery = query(
            collection(db, "consultations"),
            where("contractId", "==", doc.id),
            limit(1)
        );
        const consultSnapshot = await getDocs(consultQuery);
        if (!consultSnapshot.empty) {
            const consultationData = consultSnapshot.docs[0].data();
            record.patientName = consultationData.patientName;
            record.chiefComplaint = consultationData.chiefComplaint;
        }
    }
    return record;
  });
  
  const records = await Promise.all(recordsPromises);
  return records.sort((a, b) => a.shiftDate.toMillis() - b.shiftDate.toMillis());
};

export const performCheckin = async (
  contractId: string, 
  latitude: number, 
  longitude: number,
  photoUrl: string
): Promise<void> => {
    if (!photoUrl) {
      throw new Error("A foto de verificação é obrigatória para o check-in.");
    }
    const contractRef = doc(db, "contracts", contractId);
    await updateDoc(contractRef, {
        checkinAt: serverTimestamp(),
        checkinLocation: { latitude, longitude },
        checkinPhotoUrl: photoUrl,
        status: 'IN_PROGRESS',
        updatedAt: serverTimestamp()
    });
};

export const performCheckout = async (
  contractId: string, 
  latitude: number, 
  longitude: number,
): Promise<void> => {
    const contractRef = doc(db, "contracts", contractId);
    await updateDoc(contractRef, {
        checkoutAt: serverTimestamp(),
        checkoutLocation: { latitude, longitude },
        status: 'COMPLETED',
        updatedAt: serverTimestamp()
    });
};