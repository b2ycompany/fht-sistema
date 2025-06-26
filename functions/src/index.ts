// functions/src/index.ts
/* eslint-disable import/no-duplicates */
import { onDocumentWritten, FirestoreEvent } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
/* eslint-enable import/no-duplicates */
import { Change } from "firebase-functions";
import { DocumentSnapshot, FieldValue } from "firebase-admin/firestore";

// --- Inicialização do Admin ---
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- Interfaces (Como no seu arquivo) ---
interface ShiftRequirementData { hospitalId: string; hospitalName?: string; dates: admin.firestore.Timestamp[]; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialtiesRequired: string[]; offeredRate: number; numberOfVacancies: number; status: string; notes?: string; city: string; state: string; }
interface TimeSlotData { doctorId: string; doctorName?: string; date: admin.firestore.Timestamp; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialties: string[]; desiredHourlyRate: number; state: string; city: string; status: string; notes?: string; }
interface PotentialMatchInput { shiftRequirementId: string; hospitalId: string; hospitalName?: string; matchedDate: admin.firestore.Timestamp; originalShiftRequirementDates: admin.firestore.Timestamp[]; shiftRequirementStartTime: string; shiftRequirementEndTime: string; shiftRequirementIsOvernight: boolean; shiftRequirementServiceType: string; shiftRequirementSpecialties: string[]; offeredRateByHospital: number; shiftRequirementNotes?: string; numberOfVacanciesInRequirement: number; timeSlotId: string; doctorId: string; doctorName?: string; timeSlotStartTime: string; timeSlotEndTime: string; timeSlotIsOvernight: boolean; doctorDesiredRate: number; doctorSpecialties: string[]; doctorServiceType: string; status: string; createdAt: FieldValue; updatedAt: FieldValue; }

// --- Configurações Globais ---
setGlobalOptions({ region: "southamerica-east1", memory: "256MiB" });

// --- Funções Auxiliares ---
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

/**
 * --- LÓGICA DE SOBREPOSIÇÃO CORRIGIDA ---
 * Verifica se dois intervalos de tempo se sobrepõem.
 * A sobreposição ocorre se o início de um for antes do fim do outro, E vice-versa.
 */
const doIntervalsOverlap = (
  startA: number, endA: number, isOvernightA: boolean,
  startB: number, endB: number, isOvernightB: boolean,
): boolean => {
  // Converte para um sistema de 24h*60m = 1440 minutos
  const effectiveEndA = isOvernightA && endA <= startA ? endA + 1440 : endA;
  const effectiveEndB = isOvernightB && endB <= startB ? endB + 1440 : endB;

  // A condição clássica de sobreposição de intervalos [startA, endA] e [startB, endB]
  const overlap = startA < effectiveEndB && startB < effectiveEndA;

  logger.debug("Verificando sobreposição de horários:", {
    availability: { start: startA, end: effectiveEndA },
    requirement: { start: startB, end: effectiveEndB },
    isOverlapping: overlap,
  });

  return overlap;
};

// --- Cloud Function Principal ---
export const findMatchesOnShiftRequirementWrite = onDocumentWritten(
  { document: "shiftRequirements/{requirementId}", timeoutSeconds: 120 },
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>): Promise<void> => {
    const { requirementId } = event.params;
    const change = event.data;

    if (!change?.after?.exists) {
      logger.info(`Demanda ${requirementId} deletada ou evento inválido.`);
      return;
    }

    const newData = change.after.data() as ShiftRequirementData;
    const oldData = change.before?.exists ? change.before.data() as ShiftRequirementData : null;

    logger.info(`Processando Req ${requirementId}. Novo Status: ${newData.status}.` + (oldData ? ` Status Antigo: ${oldData.status}` : " (Nova Demanda)"));

    const isNewAndOpen = !oldData && newData.status === "OPEN";
    const wasUpdatedToOpen = !!(oldData && oldData.status !== "OPEN" && newData.status === "OPEN");

    if (!isNewAndOpen && !wasUpdatedToOpen) {
      logger.info(`Demanda ${requirementId} não está em um estado "OPEN" relevante para matching. Status: ${newData.status}.`);
      return;
    }
    
    logger.info(`Iniciando busca de matches para Req ${requirementId}.`);

    try {
      const timeSlotsQuery = db.collection("doctorTimeSlots")
        .where("status", "==", "AVAILABLE")
        .where("state", "==", newData.state)
        .where("city", "==", newData.city)
        .where("serviceType", "==", newData.serviceType);
        
      const timeSlotsSnapshot = await timeSlotsQuery.get();

      if (timeSlotsSnapshot.empty) {
        logger.info(`Nenhum TimeSlot compatível encontrado para ${requirementId} (filtros iniciais).`);
        return;
      }
      logger.info(`Encontrados ${timeSlotsSnapshot.docs.length} TimeSlots preliminares para ${requirementId}.`);

      const batch = db.batch();
      let matchesCreatedCount = 0;

      for (const timeSlotDoc of timeSlotsSnapshot.docs) {
        const timeSlotId = timeSlotDoc.id;
        const timeSlotData = timeSlotDoc.data() as TimeSlotData;

        // Verifica se a data da disponibilidade está na lista de datas da demanda
        const matchedReqDate = newData.dates.find((reqDate) => reqDate.isEqual(timeSlotData.date));
        if (!matchedReqDate) {
          continue; // Pula se as datas não baterem
        }

        // --- USA A LÓGICA DE SOBREPOSIÇÃO CORRIGIDA ---
        if (!doIntervalsOverlap(
          timeToMinutes(timeSlotData.startTime),
          timeToMinutes(timeSlotData.endTime),
          timeSlotData.isOvernight,
          timeToMinutes(newData.startTime),
          timeToMinutes(newData.endTime),
          newData.isOvernight
        )) {
          continue; // Pula se os horários não se sobrepõem
        }

        // Verifica compatibilidade de especialidades
        const hasSpecialtyMatch = newData.specialtiesRequired.length === 0 ||
          newData.specialtiesRequired.some((reqSpec) => timeSlotData.specialties.includes(reqSpec));
        if (!hasSpecialtyMatch) {
          continue; // Pula se as especialidades não baterem
        }

        // Previne criação de matches duplicados
        const existingMatchQuery = await db.collection("potentialMatches")
          .where("shiftRequirementId", "==", requirementId)
          .where("timeSlotId", "==", timeSlotId)
          .where("matchedDate", "==", timeSlotData.date)
          .limit(1)
          .get();

        if (!existingMatchQuery.empty) {
          logger.info(`Match já existente para Req ${requirementId} e TS ${timeSlotId}. Pulando.`);
          continue;
        }

        logger.info(`CRIANDO Match: Req ${requirementId} com TS ${timeSlotId}.`);
        const newMatchRef = db.collection("potentialMatches").doc();
        
        const newPotentialMatchDataObject: PotentialMatchInput = {
          shiftRequirementId: requirementId,
          hospitalId: newData.hospitalId,
          hospitalName: newData.hospitalName || "",
          originalShiftRequirementDates: newData.dates,
          matchedDate: timeSlotData.date,
          shiftRequirementStartTime: newData.startTime,
          shiftRequirementEndTime: newData.endTime,
          shiftRequirementIsOvernight: newData.isOvernight,
          shiftRequirementServiceType: newData.serviceType,
          shiftRequirementSpecialties: newData.specialtiesRequired,
          offeredRateByHospital: newData.offeredRate,
          shiftRequirementNotes: newData.notes || "",
          numberOfVacanciesInRequirement: newData.numberOfVacancies,
          timeSlotId: timeSlotId,
          doctorId: timeSlotData.doctorId,
          doctorName: timeSlotData.doctorName || "",
          timeSlotStartTime: timeSlotData.startTime,
          timeSlotEndTime: timeSlotData.endTime,
          timeSlotIsOvernight: timeSlotData.isOvernight,
          doctorDesiredRate: timeSlotData.desiredHourlyRate,
          doctorSpecialties: timeSlotData.specialties,
          doctorServiceType: timeSlotData.serviceType,
          status: "PENDING_BACKOFFICE_REVIEW",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        batch.set(newMatchRef, newPotentialMatchDataObject);
        matchesCreatedCount++;
      }

      if (matchesCreatedCount > 0) {
        await batch.commit();
        logger.info(`SUCESSO: Criados ${matchesCreatedCount} potentialMatches para Req ${requirementId}.`);
      } else {
        logger.info(`Nenhum novo match criado para Req ${requirementId} após todas as verificações.`);
      }
    } catch (error) {
      logger.error(`ERRO CRÍTICO ao processar matches para Req ${requirementId}:`, error);
    }
  }
);