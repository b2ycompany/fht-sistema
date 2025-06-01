// functions/src/index.ts
/* eslint-disable import/no-duplicates */
import {
  onDocumentWritten,
  FirestoreEvent,
} from "firebase-functions/v2/firestore";
import {setGlobalOptions} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
/* eslint-enable import/no-duplicates */
import {Change} from "firebase-functions";
import {DocumentSnapshot, FieldValue} from "firebase-admin/firestore";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- INTERFACES ---
interface ShiftRequirementData {
  hospitalId: string;
  hospitalName?: string; // Opcional
  dates: admin.firestore.Timestamp[];
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  serviceType: string;
  specialtiesRequired: string[];
  offeredRate: number;
  numberOfVacancies: number;
  status: string;
  notes?: string; // Opcional
  city: string;
  state: string;
}

interface TimeSlotData {
  doctorId: string;
  doctorName?: string; // Opcional
  date: admin.firestore.Timestamp;
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  serviceType: string;
  specialties: string[];
  desiredHourlyRate: number;
  state: string;
  city: string;
  status: string;
  notes?: string; // Opcional
}

interface PotentialMatchInput {
  shiftRequirementId: string;
  hospitalId: string;
  hospitalName?: string; // Opcional
  matchedDate: admin.firestore.Timestamp;
  originalShiftRequirementDates: admin.firestore.Timestamp[];
  shiftRequirementStartTime: string;
  shiftRequirementEndTime: string;
  shiftRequirementIsOvernight: boolean;
  shiftRequirementServiceType: string;
  shiftRequirementSpecialties: string[];
  offeredRateByHospital: number;
  shiftRequirementNotes?: string; // Opcional
  numberOfVacanciesInRequirement: number;
  timeSlotId: string;
  doctorId: string;
  doctorName?: string; // Opcional
  timeSlotStartTime: string;
  timeSlotEndTime: string;
  timeSlotIsOvernight: boolean;
  doctorDesiredRate: number;
  doctorSpecialties: string[];
  doctorServiceType: string;
  status: string;
  createdAt: FieldValue; // Usando FieldValue importado
  updatedAt: FieldValue; // Usando FieldValue importado
  // ... outros campos opcionais da sua interface PotentialMatch
}
// --- FIM DAS INTERFACES ---

setGlobalOptions({region: "southamerica-east1", memory: "256MiB"});

const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

const doIntervalsOverlap = (
  startA: number, endA: number, isOvernightA: boolean,
  startB: number, endB: number, isOvernightB: boolean,
): boolean => {
  const effectiveEndA = isOvernightA && endA < startA ? endA + 1440 : endA;
  const effectiveEndB = isOvernightB && endB < startB ? endB + 1440 : endB;
  const slotContainedInDemand = startA >= startB && effectiveEndA <= effectiveEndB;
  const demandContainedInSlot = startB >= startA && effectiveEndB <= effectiveEndA;
  logger.debug("Intervalos:", {
    dem: {s: startB, e: effectiveEndB, o: isOvernightB},
    disp: {s: startA, e: effectiveEndA, o: isOvernightA},
    match: slotContainedInDemand || demandContainedInSlot,
  });
  return slotContainedInDemand || demandContainedInSlot;
};

export const findMatchesOnShiftRequirementWrite = onDocumentWritten(
  { document: "shiftRequirements/{requirementId}", timeoutSeconds: 120 },
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined,
  {requirementId: string}>): Promise<void> => {
    const {requirementId} = event.params;
    const change = event.data;

    if (!change || !change.after?.exists) {
      logger.info(`Evento inválido ou demanda ${requirementId} deletada.`);
      return;
    }

    const newData = change.after.data() as ShiftRequirementData;
    const oldData = change.before?.exists ?
      change.before.data() as ShiftRequirementData : null;

    logger.info(
      `Processando Req ${requirementId}. Novo Status: ${newData.status}.` +
      (oldData ? ` Status Antigo: ${oldData.status}` : " (Nova Demanda)")
    );

    const isNewAndOpen = !change.before?.exists && newData.status === "OPEN";
    const wasUpdatedToOpen = !!(oldData && oldData.status !== "OPEN" &&
      newData.status === "OPEN");

    if (
      (!isNewAndOpen && !wasUpdatedToOpen) ||
      newData.numberOfVacancies <= 0
    ) {
      logger.info(
        `Demanda ${requirementId} não relevante (Status: ${newData.status}, ` +
        `Vagas: ${newData.numberOfVacancies}).`
      );
      return;
    }
    logger.info(`Buscando matches para Req ${requirementId}.`);

    try {
      let timeSlotsQuery = db.collection("doctorTimeSlots")
        .where("serviceType", "==", newData.serviceType)
        .where("status", "==", "AVAILABLE")
        .where("state", "==", newData.state)
        .where("city", "==", newData.city);

      const timeSlotsSnapshot = await timeSlotsQuery.get();
      if (timeSlotsSnapshot.empty) {
        logger.info(`Nenhum TimeSlot compatível (filtros iniciais) para ${requirementId}.`);
        return;
      }
      logger.info(`Encontrados ${timeSlotsSnapshot.docs.length} TimeSlots preliminares.`);

      const batch = db.batch();
      let matchesCreatedCount = 0;

      for (const timeSlotDoc of timeSlotsSnapshot.docs) {
        const timeSlotId = timeSlotDoc.id;
        const timeSlotData = timeSlotDoc.data() as TimeSlotData;

        const matchedReqDate = newData.dates.find((reqDate) =>
          reqDate.isEqual(timeSlotData.date));
        if (!matchedReqDate) continue;

        if (!doIntervalsOverlap(
          timeToMinutes(timeSlotData.startTime),
          timeToMinutes(timeSlotData.endTime),
          timeSlotData.isOvernight,
          timeToMinutes(newData.startTime),
          timeToMinutes(newData.endTime),
          newData.isOvernight,
        )) {
          continue;
        }

        const hasSpecialtyMatch = newData.specialtiesRequired.length === 0 ||
          newData.specialtiesRequired.some((reqSpec) =>
            timeSlotData.specialties.includes(reqSpec));
        if (!hasSpecialtyMatch) continue;

        const existingMatchQuery = await db.collection("potentialMatches")
          .where("shiftRequirementId", "==", requirementId)
          .where("timeSlotId", "==", timeSlotId)
          .where("matchedDate", "==", timeSlotData.date)
          .where("status", "in", [
            "PENDING_BACKOFFICE_REVIEW", "PROPOSED_TO_DOCTOR",
            "DOCTOR_ACCEPTED_PENDING_CONTRACT", "CONTRACT_ACTIVE",
          ])
          .limit(1)
          .get();

        if (!existingMatchQuery.empty) {
          logger.info(`Match já existente para Req ${requirementId}, TS ${timeSlotId}.`);
          continue;
        }

        logger.info(`CRIANDO Match: Req ${requirementId} com TS ${timeSlotId}.`);
        const newMatchRef = db.collection("potentialMatches").doc();
        
        // Construindo o objeto, omitindo campos se forem undefined
        const newPotentialMatchDataObject: any = { // Usar 'any' temporariamente para flexibilidade
          shiftRequirementId: requirementId,
          hospitalId: newData.hospitalId,
          originalShiftRequirementDates: newData.dates,
          matchedDate: timeSlotData.date,
          shiftRequirementStartTime: newData.startTime,
          shiftRequirementEndTime: newData.endTime,
          shiftRequirementIsOvernight: newData.isOvernight,
          shiftRequirementServiceType: newData.serviceType,
          shiftRequirementSpecialties: newData.specialtiesRequired,
          offeredRateByHospital: newData.offeredRate,
          numberOfVacanciesInRequirement: newData.numberOfVacancies,
          timeSlotId: timeSlotId,
          doctorId: timeSlotData.doctorId,
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
        // Adicionar campos opcionais somente se tiverem valor
        if (newData.hospitalName) newPotentialMatchDataObject.hospitalName = newData.hospitalName;
        if (newData.notes) newPotentialMatchDataObject.shiftRequirementNotes = newData.notes;
        if (timeSlotData.doctorName) newPotentialMatchDataObject.doctorName = timeSlotData.doctorName;

        batch.set(newMatchRef, newPotentialMatchDataObject as PotentialMatchInput);
        matchesCreatedCount++;
      }

      if (matchesCreatedCount > 0) {
        await batch.commit();
        logger.info(`Criados ${matchesCreatedCount} matches para Req ${requirementId}.`);
      } else {
        logger.info(`Nenhum novo match criado para Req ${requirementId}.`);
      }
    } catch (error) {
      logger.error(
        `Erro CRÍTICO ao processar Req ${requirementId}:`, error,
      );
    }
    return;
  },
);

// Linha em branco final