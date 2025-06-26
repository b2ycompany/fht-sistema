// lib/checkin-service.ts
"use strict";

import {
  doc,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  orderBy
} from "firebase/firestore";
import { db, auth } from "./firebase";

export interface CheckinRecord {
  id: string; // ID do documento na coleção checkinRecords (será o mesmo que o contractId)
  contractId: string;
  shiftRequirementId: string;
  doctorId: string;
  hospitalId: string;
  hospitalName: string;

  shiftDate: Timestamp;
  expectedStartTime: string;
  expectedEndTime: string;

  checkinAt?: Timestamp;
  checkinLatitude?: number;
  checkinLongitude?: number;
  checkinPhotoUrl?: string;

  checkoutAt?: Timestamp;
  checkoutLatitude?: number;
  checkoutLongitude?: number;
  checkoutPhotoUrl?: string;

  status: 'SCHEDULED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'MISSED' | 'CANCELLED_CONFIRMED_SHIFT'; 
}

/**
 * Busca plantões confirmados do médico e garante que exista um registro de ponto para cada um.
 * Retorna os registros de ponto que ainda precisam de ação (check-in ou check-out).
 */
export const getActiveShiftsForCheckin = async (): Promise<CheckinRecord[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getActiveShiftsForCheckin] Usuário não autenticado.");
    return [];
  }
  const doctorId = currentUser.uid;
  console.log(`[getActiveShiftsForCheckin] Buscando plantões para médico: ${doctorId}`);

  // 1. Encontrar todos os 'contratos' confirmados para o médico.
  // Ajuste "contracts" se o nome da sua coleção for diferente.
  const contractsRef = collection(db, "contracts"); 
  const q = query(
    contractsRef,
    where("doctorId", "==", doctorId),
    where("status", "==", "CONFIRMED")
  );

  const contractSnapshots = await getDocs(q);
  if (contractSnapshots.empty) {
    console.log("[getActiveShiftsForCheckin] Nenhum contrato confirmado encontrado.");
    return [];
  }
  
  const batch = writeBatch(db);
  const recordsToReturn: CheckinRecord[] = [];

  // 2. Para cada contrato, verificar se um 'checkinRecord' correspondente já existe.
  for (const contractDoc of contractSnapshots.docs) {
    const contractData = contractDoc.data();
    const contractId = contractDoc.id;

    // Usamos o ID do contrato como ID do registro de ponto para facilitar a busca.
    const checkinRecordRef = doc(db, "checkinRecords", contractId);
    const checkinRecordSnap = await getDoc(checkinRecordRef);

    if (!checkinRecordSnap.exists()) {
      // 3. Se não existir, criamos um novo 'checkinRecord' com status 'SCHEDULED'.
      console.log(`[getActiveShiftsForCheckin] Criando checkinRecord para contrato: ${contractId}`);

      // Busca o nome do hospital (denormalização)
      const hospitalDoc = await getDoc(doc(db, "hospitals", contractData.hospitalId));
      const hospitalName = hospitalDoc.exists() ? hospitalDoc.data().name : "Hospital Desconhecido";

      const newRecordData = {
        contractId: contractId,
        shiftRequirementId: contractData.shiftRequirementId,
        doctorId: doctorId,
        hospitalId: contractData.hospitalId,
        hospitalName: hospitalName,
        shiftDate: contractData.shiftDate, // Deve ser um Timestamp
        expectedStartTime: contractData.startTime,
        expectedEndTime: contractData.endTime,
        status: 'SCHEDULED',
        createdAt: serverTimestamp()
      };
      
      batch.set(checkinRecordRef, newRecordData);
      
      // Adiciona o novo registro à lista que será retornada para a UI
      recordsToReturn.push({ id: contractId, ...newRecordData } as CheckinRecord);

    } else {
      // 4. Se já existe, apenas o adicionamos à lista de retorno, se o status for relevante.
      const existingRecord = checkinRecordSnap.data();
      if (existingRecord.status === 'SCHEDULED' || existingRecord.status === 'CHECKED_IN') {
        recordsToReturn.push({ id: checkinRecordSnap.id, ...existingRecord } as CheckinRecord);
      }
    }
  }

  // 5. Executa a criação de todos os novos registros de uma vez.
  await batch.commit();
  console.log(`[getActiveShiftsForCheckin] Processo finalizado. Retornando ${recordsToReturn.length} registros.`);
  
  // Ordena por data para exibir na ordem correta na UI
  return recordsToReturn.sort((a, b) => a.shiftDate.toMillis() - b.shiftDate.toMillis());
};


// Função para realizar o check-in
export const performCheckin = async (
  recordId: string,
  latitude: number,
  longitude: number,
  photoUrl?: string 
): Promise<void> => {
  if (!auth.currentUser) throw new Error("Usuário não autenticado.");
  
  console.log(`[performCheckin] Realizando check-in para o registro: ${recordId}`);
  const recordRef = doc(db, "checkinRecords", recordId);

  // TODO: Adicionar validações de segurança no futuro (regras do Firestore)
  await updateDoc(recordRef, {
    status: 'CHECKED_IN',
    checkinAt: serverTimestamp(),
    checkinLatitude: latitude,
    checkinLongitude: longitude,
    ...(photoUrl && { checkinPhotoUrl: photoUrl }),
    updatedAt: serverTimestamp()
  });
  console.log(`[performCheckin] Check-in para ${recordId} concluído.`);
};


// Função para realizar o check-out
export const performCheckout = async (
  recordId: string,
  latitude: number,
  longitude: number,
  photoUrl?: string
): Promise<void> => {
  if (!auth.currentUser) throw new Error("Usuário não autenticado.");

  console.log(`[performCheckout] Realizando check-out para o registro: ${recordId}`);
  const recordRef = doc(db, "checkinRecords", recordId);

  // TODO: Adicionar validações de segurança no futuro (regras do Firestore)
  await updateDoc(recordRef, {
    status: 'CHECKED_OUT',
    checkoutAt: serverTimestamp(),
    checkoutLatitude: latitude,
    checkoutLongitude: longitude,
    ...(photoUrl && { checkoutPhotoUrl: photoUrl }),
    updatedAt: serverTimestamp()
  });
  console.log(`[performCheckout] Check-out para ${recordId} concluído.`);
};