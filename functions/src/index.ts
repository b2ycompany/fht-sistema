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
// --- CORREÇÃO: Removendo 'getDocs' e usando apenas o necessário ---
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

// --- Interfaces (Como no seu arquivo, sem alterações) ---
interface ShiftRequirementData { hospitalId: string; hospitalName?: string; dates: admin.firestore.Timestamp[]; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialtiesRequired: string[]; offeredRate: number; numberOfVacancies: number; status: string; notes?: string; city: string; state: string; }
interface TimeSlotData { doctorId: string; doctorName?: string; date: admin.firestore.Timestamp; startTime: string; endTime: string; isOvernight: boolean; serviceType: string; specialties: string[]; desiredHourlyRate: number; state: string; city: string; status: string; notes?: string; }
interface PotentialMatchInput { shiftRequirementId: string; hospitalId: string; hospitalName?: string; matchedDate: admin.firestore.Timestamp; originalShiftRequirementDates: admin.firestore.Timestamp[]; shiftRequirementStartTime: string; shiftRequirementEndTime: string; shiftRequirementIsOvernight: boolean; shiftRequirementServiceType: string; shiftRequirementSpecialties: string[]; offeredRateByHospital: number; shiftRequirementNotes?: string; numberOfVacanciesInRequirement: number; timeSlotId: string; doctorId: string; doctorName?: string; timeSlotStartTime: string; timeSlotEndTime: string; timeSlotIsOvernight: boolean; doctorDesiredRate: number; doctorSpecialties: string[]; doctorServiceType: string; status: string; createdAt: FieldValue; updatedAt: FieldValue; }

// --- Configurações Globais ---
setGlobalOptions({ region: "southamerica-east1", memory: "256MiB" });

// --- Funções Auxiliares (Melhoradas) ---
const normalizeString = (str: string | undefined): string => {
  if (!str) return "";
  return str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(":")) {
    logger.warn("Formato de hora inválido recebido:", timeStr);
    return 0;
  }
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

const doIntervalsOverlap = (
  startA: number, endA: number, isOvernightA: boolean,
  startB: number, endB: number, isOvernightB: boolean
): boolean => {
  const effectiveEndA = isOvernightA && endA <= startA ? endA + 1440 : endA;
  const effectiveEndB = isOvernightB && endB <= startB ? endB + 1440 : endB;
  return startA < effectiveEndB && startB < effectiveEndA;
};


// --- Cloud Function Principal (Revisada com Sintaxe Correta) ---
export const findMatchesOnShiftRequirementWrite = onDocumentWritten(
  { document: "shiftRequirements/{requirementId}" },
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>): Promise<void> => {
    const { requirementId } = event.params;
    const change = event.data;

    if (!change?.after?.exists) {
      logger.info(`Demanda ${requirementId} deletada. Processo ignorado.`);
      return;
    }

    const requirement = change.after.data() as ShiftRequirementData;
    const oldRequirement = change.before?.exists ? change.before.data() as ShiftRequirementData : null;

    const isNewAndOpen = !oldRequirement && requirement.status === "OPEN";
    const wasUpdatedToOpen = !!(oldRequirement && oldRequirement.status !== "OPEN" && requirement.status === "OPEN");

    if (!isNewAndOpen && !wasUpdatedToOpen) {
      logger.info(`Demanda ${requirementId} não está em estado "OPEN". Status: ${requirement.status}.`);
      return;
    }

    logger.info(`INICIANDO BUSCA DE MATCHES para a Demanda: ${requirementId}`);

    try {
      // --- CORREÇÃO: USANDO A SINTAXE .get() do Admin SDK ---
      const timeSlotsSnapshot = await db.collection("doctorTimeSlots")
        .where("status", "==", "AVAILABLE")
        .get();

      if (timeSlotsSnapshot.empty) {
        logger.info("Nenhum TimeSlot 'AVAILABLE' encontrado.");
        return;
      }

      logger.info(`Encontrados ${timeSlotsSnapshot.docs.length} TimeSlots disponíveis. Iniciando filtros...`);
      const batch = db.batch();
      let matchesCreatedCount = 0;

      const normalizedReqCity = normalizeString(requirement.city);
      const normalizedReqState = normalizeString(requirement.state);
      const normalizedReqServiceType = normalizeString(requirement.serviceType);

      for (const timeSlotDoc of timeSlotsSnapshot.docs) {
        const timeSlotId = timeSlotDoc.id;
        const timeSlot = timeSlotDoc.data() as TimeSlotData;

        // --- FILTROS DE COMPATIBILIDADE ---
        if (normalizeString(timeSlot.state) !== normalizedReqState || normalizeString(timeSlot.city) !== normalizedReqCity) continue;
        if (normalizeString(timeSlot.serviceType) !== normalizedReqServiceType) continue;
        if (timeSlot.desiredHourlyRate > requirement.offeredRate) {
          logger.debug(`Match pulado (Valor): TS ${timeSlotId} deseja R$${timeSlot.desiredHourlyRate}, Req oferece R$${requirement.offeredRate}.`);
          continue;
        }
        const matchedDate = requirement.dates.find((reqDate) => reqDate.isEqual(timeSlot.date));
        if (!matchedDate) continue;
        if (!doIntervalsOverlap(timeToMinutes(timeSlot.startTime), timeToMinutes(timeSlot.endTime), timeSlot.isOvernight, timeToMinutes(requirement.startTime), timeToMinutes(requirement.endTime), requirement.isOvernight)) continue;
        const hasSpecialtyMatch = requirement.specialtiesRequired.length === 0 || requirement.specialtiesRequired.some((reqSpec) => timeSlot.specialties.includes(reqSpec));
        if (!hasSpecialtyMatch) continue;

        logger.info(`-> Match em potencial encontrado! Req: ${requirementId} | TS: ${timeSlotId}. Verificando duplicatas...`);

        // --- CORREÇÃO: USANDO A SINTAXE .get() do Admin SDK ---
        const existingMatchQuery = await db.collection("potentialMatches")
          .where("shiftRequirementId", "==", requirementId)
          .where("timeSlotId", "==", timeSlotId)
          .where("matchedDate", "==", timeSlot.date)
          .limit(1)
          .get();

        if (!existingMatchQuery.empty) {
          logger.info(`--> Match já existente para Req ${requirementId} e TS ${timeSlotId}. Pulando.`);
          continue;
        }

        logger.info(`-----> SUCESSO! CRIANDO NOVO MATCH: Req ${requirementId} | TS: ${timeSlotId}`);

        const newMatchRef = db.collection("potentialMatches").doc();
        const newPotentialMatchData: PotentialMatchInput = {
          shiftRequirementId: requirementId,
          hospitalId: requirement.hospitalId,
          hospitalName: requirement.hospitalName,
          originalShiftRequirementDates: requirement.dates,
          matchedDate: timeSlot.date,
          shiftRequirementStartTime: requirement.startTime,
          shiftRequirementEndTime: requirement.endTime,
          shiftRequirementIsOvernight: requirement.isOvernight,
          shiftRequirementServiceType: requirement.serviceType,
          shiftRequirementSpecialties: requirement.specialtiesRequired,
          offeredRateByHospital: requirement.offeredRate,
          shiftRequirementNotes: requirement.notes,
          numberOfVacanciesInRequirement: requirement.numberOfVacancies,
          timeSlotId: timeSlotId,
          doctorId: timeSlot.doctorId,
          doctorName: timeSlot.doctorName,
          timeSlotStartTime: timeSlot.startTime,
          timeSlotEndTime: timeSlot.endTime,
          timeSlotIsOvernight: timeSlot.isOvernight,
          doctorDesiredRate: timeSlot.desiredHourlyRate,
          doctorSpecialties: timeSlot.specialties,
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
        logger.info(`OPERAÇÃO FINALIZADA: ${matchesCreatedCount} novo(s) potentialMatches foram criados para a Req ${requirementId}.`);
      } else {
        logger.info(`OPERAÇÃO FINALIZADA: Nenhum novo match compatível foi encontrado para a Req ${requirementId} após todos os filtros.`);
      }
    } catch (error) {
      logger.error(`ERRO CRÍTICO no processamento de matches para a Req ${requirementId}:`, error);
    }
  }
);
