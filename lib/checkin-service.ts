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
  orderBy
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { type Contract } from "./contract-service";

export interface CheckinRecord {
  id: string;
  hospitalName: string;
  locationCity: string;
  locationState: string;
  shiftDate: Timestamp;
  expectedStartTime: string;
  expectedEndTime: string;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'MISSED' | 'CANCELLED';
  checkinAt?: Timestamp;
  checkoutAt?: Timestamp;
}

export const getActiveShiftsForCheckin = async (): Promise<CheckinRecord[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Utilizador não autenticado.");

  console.log(`[getActiveShiftsForCheckin] Buscando plantões para médico: ${currentUser.uid}`);

  const contractsRef = collection(db, "contracts");
  const q = query(
    contractsRef,
    where("doctorId", "==", currentUser.uid),
    where("status", "in", ["ACTIVE_SIGNED", "IN_PROGRESS"])
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    console.log("[getActiveShiftsForCheckin] Nenhum contrato ativo encontrado.");
    return [];
  }

  const records = snapshot.docs.map(doc => {
    const contract = doc.data() as Contract;
    
    let currentStatus: CheckinRecord['status'] = 'SCHEDULED';
    if (contract.status === 'IN_PROGRESS') {
        currentStatus = 'CHECKED_IN';
    } else if (contract.status === 'COMPLETED') {
        currentStatus = 'CHECKED_OUT';
    } else if (contract.status === 'CANCELLED') {
        currentStatus = 'CANCELLED';
    }

    return {
      id: doc.id,
      hospitalName: contract.hospitalName,
      locationCity: contract.locationCity,
      locationState: contract.locationState,
      shiftDate: contract.shiftDates[0],
      expectedStartTime: contract.startTime,
      expectedEndTime: contract.endTime,
      status: currentStatus,
      checkinAt: contract.checkinAt,
      checkoutAt: contract.checkoutAt,
    };
  });
  
  return records.sort((a, b) => a.shiftDate.toMillis() - b.shiftDate.toMillis());
};

export const performCheckin = async (contractId: string, latitude: number, longitude: number): Promise<void> => {
    const contractRef = doc(db, "contracts", contractId);
    await updateDoc(contractRef, {
        checkinAt: serverTimestamp(),
        checkinLocation: { latitude, longitude },
        status: 'IN_PROGRESS',
        updatedAt: serverTimestamp()
    });
};

export const performCheckout = async (contractId: string, latitude: number, longitude: number): Promise<void> => {
    const contractRef = doc(db, "contracts", contractId);
    await updateDoc(contractRef, {
        checkoutAt: serverTimestamp(),
        checkoutLocation: { latitude, longitude },
        status: 'COMPLETED',
        updatedAt: serverTimestamp()
    });
};