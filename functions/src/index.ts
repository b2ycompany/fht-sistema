// functions/src/index.ts
/* eslint-disable import/no-duplicates */
import {
  onDocumentWritten,
  FirestoreEvent,
} from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
/* eslint-enable import/no-duplicates */
import { Change } from "firebase-functions";
import {
  DocumentSnapshot,
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

// --- Inicialização do Admin ---
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = getFirestore();

// --- Interfaces ---
interface ShiftRequirementData { hospitalId: string; hospitalName?: string; dates: admin.firestore.Timestamp[]; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialtiesRequired: string[]; offeredRate: number; numberOfVacancies: number; status: string; notes?: string; city: string; state: string; }
interface TimeSlotData { doctorId: string; doctorName?: string; date: admin.firestore.Timestamp; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialties: string[]; desiredHourlyRate: number; state: string; city: string; status: string; notes?: string; }
interface PotentialMatchInput { shiftRequirementId: string; hospitalId: string; hospitalName: string; matchedDate: admin.firestore.Timestamp; originalShiftRequirementDates: admin.firestore.Timestamp[]; shiftRequirementStartTime: string; shiftRequirementEndTime: string; shiftRequirementIsOvernight: boolean; shiftRequirementServiceType: string; shiftRequirementSpecialties: string[]; offeredRateByHospital: number; shiftRequirementNotes: string; numberOfVacanciesInRequirement: number; timeSlotId: string; doctorId: string; doctorName: string; timeSlotStartTime: string; timeSlotEndTime: string; timeSlotIsOvernight: boolean; doctorDesiredRate: number; doctorSpecialties: string[]; doctorServiceType: string; status: string; createdAt: FieldValue; updatedAt: FieldValue; }

// --- Configurações Globais ---
setGlobalOptions({ region: "southamerica-east1", memory: "256MiB" });

// --- Funções Auxiliares ---
const normalizeString = (str: string | undefined): string => {
  if (!str) return "";
  return str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(":")) { logger.warn("Formato de hora inválido:", timeStr); return 0; }
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};
const doIntervalsOverlap = (startA: number, endA: number, isOvernightA: boolean, startB: number, endB: number, isOvernightB: boolean): boolean => {
  const effectiveEndA = isOvernightA && endA <= startA ? endA + 1440 : endA;
  const effectiveEndB = isOvernightB && endB <= startB ? endB + 1440 : endB;
  return startA < effectiveEndB && startB < effectiveEndA;
};

// --- Cloud Function Principal ---
export const findMatchesOnShiftRequirementWrite = onDocumentWritten(
  { document: "shiftRequirements/{requirementId}" },
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>): Promise<void> => {
    const change = event.data;
    if (!change?.after?.exists) {
      logger.info(`Demanda ${event.params.requirementId} deletada.`);
      return;
    }

    const requirement = change.after.data() as ShiftRequirementData;
    if (requirement.status !== "OPEN") {
      logger.info(`Demanda ${event.params.requirementId} não está 'OPEN'.`);
      return;
    }

    logger.info(`INICIANDO BUSCA DE MATCHES para a Demanda: ${event.params.requirementId}`);

    try {
      const timeSlotsSnapshot = await db.collection("doctorTimeSlots").where("status", "==", "AVAILABLE").get();
      if (timeSlotsSnapshot.empty) {
        logger.info("Nenhum TimeSlot 'AVAILABLE' encontrado.");
        return;
      }

      logger.info(`Encontrados ${timeSlotsSnapshot.docs.length} TimeSlots disponíveis. Iniciando filtros...`);
      const batch = db.batch();
      let matchesCreatedCount = 0;

      for (const timeSlotDoc of timeSlotsSnapshot.docs) {
        const timeSlot = timeSlotDoc.data() as TimeSlotData;

        // FILTROS (comparações normalizadas e robustas)
        if (normalizeString(timeSlot.state) !== normalizeString(requirement.state)) continue;
        if (normalizeString(timeSlot.city) !== normalizeString(requirement.city)) continue;
        if (normalizeString(timeSlot.serviceType) !== normalizeString(requirement.serviceType)) continue;
        if (timeSlot.desiredHourlyRate > requirement.offeredRate) continue;
        
        const matchedDate = requirement.dates.find((reqDate) => reqDate.isEqual(timeSlot.date));
        if (!matchedDate) continue;

        if (!doIntervalsOverlap(timeToMinutes(timeSlot.startTime), timeToMinutes(timeSlot.endTime), timeSlot.isOvernight, timeToMinutes(requirement.startTime), timeToMinutes(requirement.endTime), requirement.isOvernight)) continue;
        
        const hasSpecialtyMatch = requirement.specialtiesRequired.length === 0 || requirement.specialtiesRequired.some((reqSpec) => (timeSlot.specialties || []).includes(reqSpec));
        if (!hasSpecialtyMatch) continue;

        // Prevenção de duplicatas
        const existingMatchQuery = await db.collection("potentialMatches").where("shiftRequirementId", "==", event.params.requirementId).where("timeSlotId", "==", timeSlotDoc.id).where("matchedDate", "==", timeSlot.date).limit(1).get();
        if (!existingMatchQuery.empty) continue;

        logger.info(`-----> SUCESSO! CRIANDO NOVO MATCH: Req ${event.params.requirementId} | TS ${timeSlotDoc.id}`);

        const newMatchRef = db.collection("potentialMatches").doc();
        
        // --- CORREÇÃO: Garantindo que nenhum campo seja undefined ---
        const newPotentialMatchData: PotentialMatchInput = {
          shiftRequirementId: event.params.requirementId,
          hospitalId: requirement.hospitalId,
          hospitalName: requirement.hospitalName || "", // Default para string vazia
          originalShiftRequirementDates: requirement.dates,
          matchedDate: timeSlot.date,
          shiftRequirementStartTime: requirement.startTime,
          shiftRequirementEndTime: requirement.endTime,
          shiftRequirementIsOvernight: requirement.isOvernight,
          shiftRequirementServiceType: requirement.serviceType,
          shiftRequirementSpecialties: requirement.specialtiesRequired || [],
          offeredRateByHospital: requirement.offeredRate,
          shiftRequirementNotes: requirement.notes || "", // Default para string vazia
          numberOfVacanciesInRequirement: requirement.numberOfVacancies,
          timeSlotId: timeSlotDoc.id,
          doctorId: timeSlot.doctorId,
          doctorName: timeSlot.doctorName || "", // Default para string vazia
          timeSlotStartTime: timeSlot.startTime,
          timeSlotEndTime: timeSlot.endTime,
          timeSlotIsOvernight: timeSlot.isOvernight,
          doctorDesiredRate: timeSlot.desiredHourlyRate,
          doctorSpecialties: timeSlot.specialties || [],
          doctorServiceType: timeSlot.serviceType,
          status: "PENDING_BACKOFFICE_REVIEW",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        batch.set(newMatchRef, newPotentialMatchData);
        matchesCreatedCount++;
      }

      if (matchesCreatedCount > 0) {
        await batch.commit();
        logger.info(`OPERAÇÃO FINALIZADA: ${matchesCreatedCount} novo(s) potentialMatches foram criados.`);
      } else {
        logger.info(`OPERAÇÃO FINALIZADA: Nenhum novo match compatível encontrado.`);
      }
    } catch (error) {
      logger.error(`ERRO CRÍTICO no processamento de matches para a Req ${event.params.requirementId}:`, error);
    }
  }
);
