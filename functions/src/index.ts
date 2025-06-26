// functions/src/index.ts
/* eslint-disable import/no-duplicates */
import {
  onDocumentWritten,
  onDocumentDeleted,
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
  Query,
} from "firebase-admin/firestore";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = getFirestore();

interface ShiftRequirementData { hospitalId: string; hospitalName?: string; dates: admin.firestore.Timestamp[]; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialtiesRequired: string[]; offeredRate: number; numberOfVacancies: number; status: string; notes?: string; city: string; state: string; }
interface TimeSlotData { doctorId: string; doctorName?: string; date: admin.firestore.Timestamp; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialties: string[]; desiredHourlyRate: number; state: string; city: string; status: string; notes?: string; }
// A interface foi ajustada para incluir shiftCity e shiftState, compatível com seu `match-types.ts`
interface PotentialMatchInput { shiftRequirementId: string; hospitalId: string; hospitalName: string; matchedDate: admin.firestore.Timestamp; originalShiftRequirementDates: admin.firestore.Timestamp[]; shiftRequirementStartTime: string; shiftRequirementEndTime: string; shiftRequirementIsOvernight: boolean; shiftRequirementServiceType: string; shiftRequirementSpecialties: string[]; offeredRateByHospital: number; shiftRequirementNotes: string; numberOfVacanciesInRequirement: number; timeSlotId: string; doctorId: string; doctorName: string; timeSlotStartTime: string; timeSlotEndTime: string; timeSlotIsOvernight: boolean; doctorDesiredRate: number; doctorSpecialties: string[]; doctorServiceType: string; status: string; createdAt: FieldValue; updatedAt: FieldValue; shiftCity: string; shiftState: string; }

setGlobalOptions({ region: "southamerica-east1", memory: "256MiB" });

const normalizeString = (str: string | undefined): string => str ? str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(":")) { return 0; }
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};
const doIntervalsOverlap = (startA: number, endA: number, isOvernightA: boolean, startB: number, endB: number, isOvernightB: boolean): boolean => {
  const effectiveEndA = isOvernightA && endA <= startA ? endA + 1440 : endA;
  const effectiveEndB = isOvernightB && endB <= startB ? endB + 1440 : endB;
  return startA < effectiveEndB && startB < effectiveEndA;
};

export const findMatchesOnShiftRequirementWrite = onDocumentWritten(
  { document: "shiftRequirements/{requirementId}" },
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>): Promise<void> => {
    const { requirementId } = event.params;
    const change = event.data;

    if (!change?.after?.exists || change.after.data()?.status !== "OPEN") {
      logger.info(`Demanda ${requirementId} não está 'OPEN' ou foi deletada. Ignorando.`);
      return;
    }
    const requirement = change.after.data() as ShiftRequirementData;
    logger.info(`INICIANDO BUSCA DE MATCHES para a Demanda: ${requirementId}`);

    try {
      const timeSlotsSnapshot = await db.collection("doctorTimeSlots").where("status", "==", "AVAILABLE").get();
      if (timeSlotsSnapshot.empty) { logger.info("Nenhum TimeSlot 'AVAILABLE' encontrado."); return; }

      const batch = db.batch();
      for (const timeSlotDoc of timeSlotsSnapshot.docs) {
        const timeSlot = timeSlotDoc.data() as TimeSlotData;

        if (normalizeString(timeSlot.state) !== normalizeString(requirement.state)) continue;
        if (normalizeString(timeSlot.city) !== normalizeString(requirement.city)) continue;
        if (normalizeString(timeSlot.serviceType) !== normalizeString(requirement.serviceType)) continue;
        if (timeSlot.desiredHourlyRate > requirement.offeredRate) continue;
        const matchedDate = requirement.dates.find((reqDate) => reqDate.isEqual(timeSlot.date));
        if (!matchedDate) continue;
        if (!doIntervalsOverlap(timeToMinutes(timeSlot.startTime), timeToMinutes(timeSlot.endTime), timeSlot.isOvernight, timeToMinutes(requirement.startTime), timeToMinutes(requirement.endTime), requirement.isOvernight)) continue;
        const hasSpecialtyMatch = (requirement.specialtiesRequired || []).length === 0 || (requirement.specialtiesRequired || []).some((reqSpec) => (timeSlot.specialties || []).includes(reqSpec));
        if (!hasSpecialtyMatch) continue;

        const deterministicMatchId = `${requirementId}_${timeSlotDoc.id}_${matchedDate.seconds}`;
        const matchRef = db.collection("potentialMatches").doc(deterministicMatchId);
        
        const matchSnap = await matchRef.get();
        if (matchSnap.exists) { continue; }

        logger.info(`-----> SUCESSO! CRIANDO NOVO MATCH: ${deterministicMatchId}`);
        const newPotentialMatchData: PotentialMatchInput = {
          shiftRequirementId: requirementId, hospitalId: requirement.hospitalId, hospitalName: requirement.hospitalName || "",
          originalShiftRequirementDates: requirement.dates, matchedDate: timeSlot.date, shiftRequirementStartTime: requirement.startTime,
          shiftRequirementEndTime: requirement.endTime, shiftRequirementIsOvernight: requirement.isOvernight, shiftRequirementServiceType: requirement.serviceType,
          shiftRequirementSpecialties: requirement.specialtiesRequired || [], offeredRateByHospital: requirement.offeredRate,
          shiftRequirementNotes: requirement.notes || "", numberOfVacanciesInRequirement: requirement.numberOfVacancies,
          timeSlotId: timeSlotDoc.id, doctorId: timeSlot.doctorId, doctorName: timeSlot.doctorName || "", timeSlotStartTime: timeSlot.startTime,
          timeSlotEndTime: timeSlot.endTime, timeSlotIsOvernight: timeSlot.isOvernight, doctorDesiredRate: timeSlot.desiredHourlyRate,
          doctorSpecialties: timeSlot.specialties || [], doctorServiceType: timeSlot.serviceType, status: "PENDING_BACKOFFICE_REVIEW",
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), 
          // --- ÚNICA ALTERAÇÃO NECESSÁRIA ESTÁ AQUI ---
          shiftCity: requirement.city, 
          shiftState: requirement.state,
        };
        batch.set(matchRef, newPotentialMatchData);
      }
      await batch.commit();
    } catch (error) {
      logger.error(`ERRO CRÍTICO ao processar matches para a Req ${requirementId}:`, error);
    }
  }
);

export const onShiftRequirementDelete = onDocumentDeleted("shiftRequirements/{requirementId}", async (event) => {
    const { requirementId } = event.params;
    logger.info(`Demanda ${requirementId} deletada. Removendo matches pendentes associados.`);
    const q = db.collection("potentialMatches").where("shiftRequirementId", "==", requirementId).where("status", "==", "PENDING_BACKOFFICE_REVIEW");
    return deleteQueryBatch(q, `matches para a demanda ${requirementId}`);
});

export const onTimeSlotDelete = onDocumentDeleted("doctorTimeSlots/{timeSlotId}", async (event) => {
    const { timeSlotId } = event.params;
    logger.info(`Disponibilidade ${timeSlotId} deletada. Removendo matches pendentes associados.`);
    const q = db.collection("potentialMatches").where("timeSlotId", "==", timeSlotId).where("status", "==", "PENDING_BACKOFFICE_REVIEW");
    return deleteQueryBatch(q, `matches para a disponibilidade ${timeSlotId}`);
});

async function deleteQueryBatch(query: Query, context: string) {
    const snapshot = await query.get();
    if (snapshot.size === 0) {
        logger.info(`Nenhum documento para deletar para o contexto: ${context}`);
        return;
    }
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        logger.info(`Agendando para deletar o match: ${doc.id}`);
        batch.delete(doc.ref);
    });
    await batch.commit();
    logger.info(`Deletados ${snapshot.size} documentos para o contexto: ${context}`);
}