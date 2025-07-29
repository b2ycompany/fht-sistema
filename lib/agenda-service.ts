// lib/agenda-service.ts
"use strict";

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "./firebase";

// Interface que define os dados que a página da agenda precisa
export interface AgendaEntry {
  id: string; // ID da consulta
  contractId: string;
  patientName: string;
  hospitalName: string;
  serviceType: string;
  consultationDate: Timestamp; // Usaremos a data do plantão para agrupar
  startTime: string;
  endTime: string;
}

/**
 * Busca todas as consultas agendadas para o médico logado.
 */
export const getDoctorAgenda = async (): Promise<AgendaEntry[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];

  try {
    // 1. Buscar todos os contratos ativos do médico para obter as datas dos plantões
    const contractsRef = collection(db, "contracts");
    const contractsQuery = query(
      contractsRef,
      where("doctorId", "==", currentUser.uid),
      where("status", "in", ["ACTIVE_SIGNED", "IN_PROGRESS"])
    );
    const contractsSnapshot = await getDocs(contractsQuery);
    const contractMap = new Map();
    contractsSnapshot.forEach(doc => {
        contractMap.set(doc.id, doc.data());
    });

    if (contractMap.size === 0) return [];

    // 2. Buscar todas as consultas associadas a esses contratos
    const consultsRef = collection(db, "consultations");
    const consultsQuery = query(
      consultsRef,
      where("contractId", "in", Array.from(contractMap.keys()))
    );
    
    const consultsSnapshot = await getDocs(consultsQuery);

    const agendaEntries: AgendaEntry[] = consultsSnapshot.docs.map(doc => {
        const consultation = doc.data();
        const relatedContract = contractMap.get(consultation.contractId);

        return {
            id: doc.id,
            contractId: consultation.contractId,
            patientName: consultation.patientName,
            hospitalName: consultation.hospitalName,
            serviceType: relatedContract.serviceType,
            consultationDate: relatedContract.shiftDates[0], // Assumindo uma data por contrato
            startTime: relatedContract.startTime,
            endTime: relatedContract.endTime,
        };
    });

    // Ordena pela data da consulta
    return agendaEntries.sort((a, b) => a.consultationDate.toMillis() - b.consultationDate.toMillis());

  } catch (error) {
    console.error("Erro ao buscar a agenda do médico:", error);
    throw new Error("Não foi possível carregar a agenda.");
  }
};