// functions/src/index.ts
import { onDocumentWritten, onDocumentDeleted, FirestoreEvent } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { Change } from "firebase-functions";
import { DocumentSnapshot, FieldValue, getFirestore, Query } from "firebase-admin/firestore";

if (admin.apps.length === 0) { admin.initializeApp(); }
const db = getFirestore();

// As interfaces continuam as mesmas
interface ShiftRequirementData { hospitalId: string; hospitalName?: string; dates: admin.firestore.Timestamp[]; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialtiesRequired: string[]; offeredRate: number; numberOfVacancies: number; status: string; notes?: string; city: string; state: string; }
interface TimeSlotData { doctorId: string; doctorName?: string; date: admin.firestore.Timestamp; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialties: string[]; desiredHourlyRate: number; state: string; city: string; status: string; notes?: string; }
interface PotentialMatchInput { shiftRequirementId: string; hospitalId: string; hospitalName: string; matchedDate: admin.firestore.Timestamp; originalShiftRequirementDates: admin.firestore.Timestamp[]; shiftRequirementStartTime: string; shiftRequirementEndTime: string; shiftRequirementIsOvernight: boolean; shiftRequirementServiceType: string; shiftRequirementSpecialties: string[]; offeredRateByHospital: number; shiftRequirementNotes?: string; numberOfVacanciesInRequirement: number; timeSlotId: string; doctorId: string; doctorName: string; timeSlotStartTime: string; timeSlotEndTime: string; timeSlotIsOvernight: boolean; doctorTimeSlotNotes?: string; doctorDesiredRate: number; doctorSpecialties: string[]; doctorServiceType: string; status: string; createdAt: FieldValue; updatedAt: FieldValue; shiftCity: string; shiftState: string; }

setGlobalOptions({ region: "southamerica-east1", memory: "256MiB" });

const timeToMinutes = (timeStr: string): number => { if (!timeStr || !timeStr.includes(":")) { return 0; } const [hours, minutes] = timeStr.split(":").map(Number); return hours * 60 + minutes; };
const doIntervalsOverlap = (startA: number, endA: number, isOvernightA: boolean, startB: number, endB: number, isOvernightB: boolean): boolean => { const effectiveEndA = isOvernightA && endA <= startA ? endA + 1440 : endA; const effectiveEndB = isOvernightB && endB <= startB ? endB + 1440 : endB; return startA < effectiveEndB && startB < effectiveEndA; };

export const findMatchesOnShiftRequirementWrite = onDocumentWritten( { document: "shiftRequirements/{requirementId}" },
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>): Promise<void> => {
    const change = event.data;
    if (!change) return;

    const dataAfter = change.after.data() as ShiftRequirementData | undefined;
    const dataBefore = change.before?.data() as ShiftRequirementData | undefined;

    // MUDANÇA: Cláusula de guarda mais robusta para evitar execuções múltiplas
    const isNewRequirement = !dataBefore;
    const statusChangedToOpen = dataBefore?.status !== 'OPEN' && dataAfter?.status === 'OPEN';

    if (!isNewRequirement && !statusChangedToOpen) {
      logger.info(`Gatilho ignorado para Req ${event.params.requirementId} pois não é novo nem teve status alterado para OPEN.`);
      return;
    }
    
    // Garante que a função só prossiga se o status final for OPEN
    if (dataAfter?.status !== 'OPEN') {
        logger.info(`Gatilho ignorado para Req ${event.params.requirementId} pois o status final não é OPEN.`);
        return;
    }

    const requirement = dataAfter;
    logger.info(`INICIANDO BUSCA DE MATCHES OTIMIZADA para a Demanda OPEN: ${event.params.requirementId}`);

    try {
      let timeSlotsQuery: Query = db.collection("doctorTimeSlots")
        .where("status", "==", "AVAILABLE")
        .where("state", "==", requirement.state)
        .where("city", "==", requirement.city)
        .where("serviceType", "==", requirement.serviceType)
        .where("desiredHourlyRate", "<=", requirement.offeredRate)
        .where("date", "in", requirement.dates);

      if (requirement.specialtiesRequired && requirement.specialtiesRequired.length > 0) {
        timeSlotsQuery = timeSlotsQuery.where('specialties', 'array-contains-any', requirement.specialtiesRequired);
      }
      
      const timeSlotsSnapshot = await timeSlotsQuery.get();
      
      if (timeSlotsSnapshot.empty) {
        logger.info(`Nenhum TimeSlot compatível encontrado para a Req ${event.params.requirementId}.`);
        return;
      }
      logger.info(`[MATCHING] Encontrados ${timeSlotsSnapshot.size} candidatos para a Req ${event.params.requirementId}.`);

      const batch = db.batch();
      let matchesCreatedCount = 0;

      for (const timeSlotDoc of timeSlotsSnapshot.docs) {
        const timeSlot = timeSlotDoc.data() as TimeSlotData;

        if (!doIntervalsOverlap(timeToMinutes(timeSlot.startTime), timeToMinutes(timeSlot.endTime), timeSlot.isOvernight, timeToMinutes(requirement.startTime), timeToMinutes(requirement.endTime), requirement.isOvernight)) {
          continue;
        }
        
        const matchedDate = requirement.dates.find((reqDate) => reqDate.isEqual(timeSlot.date))!;
        const deterministicMatchId = `${event.params.requirementId}_${timeSlotDoc.id}_${matchedDate.seconds}`;
        const matchRef = db.collection("potentialMatches").doc(deterministicMatchId);
        
        const matchSnap = await matchRef.get();
        if (matchSnap.exists) { continue; }

        const newPotentialMatchData: PotentialMatchInput = {
          shiftRequirementId: event.params.requirementId, hospitalId: requirement.hospitalId, hospitalName: requirement.hospitalName || "",
          originalShiftRequirementDates: requirement.dates, matchedDate: matchedDate, shiftRequirementStartTime: requirement.startTime,
          shiftRequirementEndTime: requirement.endTime, shiftRequirementIsOvernight: requirement.isOvernight, shiftRequirementServiceType: requirement.serviceType,
          shiftRequirementSpecialties: requirement.specialtiesRequired || [], offeredRateByHospital: requirement.offeredRate,
          shiftRequirementNotes: requirement.notes || "", numberOfVacanciesInRequirement: requirement.numberOfVacancies,
          timeSlotId: timeSlotDoc.id, doctorId: timeSlot.doctorId,
          // MUDANÇA: Usando '??' para garantir que se o campo for null/undefined, ele vira uma string vazia.
          doctorName: timeSlot.doctorName ?? "", 
          timeSlotStartTime: timeSlot.startTime,
          timeSlotEndTime: timeSlot.endTime, timeSlotIsOvernight: timeSlot.isOvernight, doctorDesiredRate: timeSlot.desiredHourlyRate,
          doctorSpecialties: timeSlot.specialties || [], doctorServiceType: timeSlot.serviceType, 
          doctorTimeSlotNotes: timeSlot.notes || "", status: "PENDING_BACKOFFICE_REVIEW",
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), 
          shiftCity: requirement.city, shiftState: requirement.state,
        };
        batch.set(matchRef, newPotentialMatchData);
        matchesCreatedCount++;
      }

      if (matchesCreatedCount > 0) {
        await batch.commit();
        logger.info(`[SUCESSO] ${matchesCreatedCount} novo(s) PotentialMatch(es) criado(s) para a Req ${event.params.requirementId}.`);
      } else {
        logger.info(`Nenhum novo match foi criado para a Req ${event.params.requirementId}.`);
      }

    } catch (error) {
      logger.error(`ERRO CRÍTICO ao processar matches para a Req ${event.params.requirementId}:`, error);
    }
  }
);

// As funções de delete não precisam de alteração.
// ... (código restante da página sem alterações) ...
export const onShiftRequirementDelete = onDocumentDeleted("shiftRequirements/{requirementId}", async (event) => {
    const { requirementId } = event.params;
    logger.info(`Demanda ${requirementId} deletada. Removendo matches pendentes.`);
    const q = db.collection("potentialMatches").where("shiftRequirementId", "==", requirementId).where("status", "==", "PENDING_BACKOFFICE_REVIEW");
    return deleteQueryBatch(q, `matches para a demanda ${requirementId}`);
});

export const onTimeSlotDelete = onDocumentDeleted("doctorTimeSlots/{timeSlotId}", async (event) => {
    const { timeSlotId } = event.params;
    logger.info(`Disponibilidade ${timeSlotId} deletada. Removendo matches pendentes.`);
    const q = db.collection("potentialMatches").where("timeSlotId", "==", timeSlotId).where("status", "==", "PENDING_BACKOFFICE_REVIEW");
    return deleteQueryBatch(q, `matches para a disponibilidade ${timeSlotId}`);
});

async function deleteQueryBatch(query: Query, context: string) {
    const snapshot = await query.get();
    if (snapshot.size === 0) { return; }
    const batch = db.batch();
    snapshot.docs.forEach((doc) => { batch.delete(doc.ref); });
    await batch.commit();
    logger.info(`Batch delete concluído para: ${context}. ${snapshot.size} documentos removidos.`);
}