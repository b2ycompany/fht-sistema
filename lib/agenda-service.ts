// lib/agenda-service.ts
"use strict";

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
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
  // Adiciona uma verificação robusta para o caso do utilizador não estar logado
  if (!currentUser) {
    console.log("Nenhum utilizador autenticado para buscar agenda.");
    return [];
  }

  try {
    // 1. Buscar todos os contratos ativos do médico. Esta consulta está correta.
    const contractsRef = collection(db, "contracts");
    const contractsQuery = query(
      contractsRef,
      where("doctorId", "==", currentUser.uid),
      where("status", "in", ["ACTIVE_SIGNED", "IN_PROGRESS"])
    );
    const contractsSnapshot = await getDocs(contractsQuery);
    
    // Se o médico não tiver contratos, não há necessidade de prosseguir.
    if (contractsSnapshot.empty) {
        return [];
    }

    const contractMap = new Map();
    const contractIds = contractsSnapshot.docs.map(doc => {
        contractMap.set(doc.id, doc.data());
        return doc.id;
    });


    // 2. Buscar todas as consultas associadas a esses contratos
    const consultsRef = collection(db, "consultations");

    // ============================================================================
    // <<< CORREÇÃO PRINCIPAL AQUI >>>
    // Adicionamos 'where("doctorId", "==", currentUser.uid)' a esta consulta.
    // Agora, a consulta é segura e cumpre as regras do Firestore,
    // garantindo que o médico só possa listar as SUAS PRÓPRIAS consultas.
    // ============================================================================
    const consultsQuery = query(
      consultsRef,
      where("contractId", "in", contractIds),
      where("doctorId", "==", currentUser.uid) // <-- ESTA LINHA RESOLVE O ERRO
    );
    
    const consultsSnapshot = await getDocs(consultsQuery);

    const agendaEntries: AgendaEntry[] = consultsSnapshot.docs.map(doc => {
        const consultation = doc.data();
        const relatedContract = contractMap.get(consultation.contractId);

        // Verificação para evitar erros caso um contrato seja removido
        if (!relatedContract) {
            return null;
        }

        return {
            id: doc.id,
            contractId: consultation.contractId,
            patientName: consultation.patientName,
            hospitalName: consultation.hospitalName,
            serviceType: relatedContract.serviceType,
            // Melhoria: Usar a data da consulta se existir, senão a do contrato
            consultationDate: consultation.createdAt || relatedContract.shiftDates?.[0], 
            startTime: relatedContract.startTime,
            endTime: relatedContract.endTime,
        };
    }).filter((entry): entry is AgendaEntry => entry !== null); // Filtra quaisquer entradas nulas

    // Ordena pela data da consulta
    return agendaEntries.sort((a, b) => a.consultationDate.toMillis() - b.consultationDate.toMillis());

  } catch (error) {
    console.error("Erro ao buscar a agenda do médico:", error);
    // Lança o erro para que a UI possa tratá-lo adequadamente
    throw new Error("Não foi possível carregar a agenda.");
  }
};