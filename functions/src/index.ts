import { onDocumentWritten, onDocumentDeleted, FirestoreEvent } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { Change } from "firebase-functions";
import { DocumentSnapshot, FieldValue, getFirestore, Query } from "firebase-admin/firestore";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getStorage } from "firebase-admin/storage";

if (admin.apps.length === 0) { admin.initializeApp(); }
const db = getFirestore();
const storage = getStorage();

interface ShiftRequirementData {
  hospitalId: string;
  hospitalName?: string;
  dates: admin.firestore.Timestamp[];
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  serviceType: string;
  specialtiesRequired: string[];
  offeredRate: number;
  numberOfVacancies: number;
  status: string;
  notes?: string;
  city: string;
  state: string;
}

interface TimeSlotData {
  doctorId: string;
  doctorName?: string;
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
  notes?: string;
}

interface PotentialMatchInput {
  shiftRequirementId: string;
  hospitalId: string;
  hospitalName: string;
  matchedDate: admin.firestore.Timestamp;
  originalShiftRequirementDates: admin.firestore.Timestamp[];
  shiftRequirementStartTime: string;
  shiftRequirementEndTime: string;
  shiftRequirementIsOvernight: boolean;
  shiftRequirementServiceType: string;
  shiftRequirementSpecialties: string[];
  offeredRateByHospital: number;
  shiftRequirementNotes?: string;
  numberOfVacanciesInRequirement: number;
  timeSlotId: string;
  doctorId: string;
  doctorName: string;
  timeSlotStartTime: string;
  timeSlotEndTime: string;
  timeSlotIsOvernight: boolean;
  doctorTimeSlotNotes?: string;
  doctorDesiredRate: number;
  doctorSpecialties: string[];
  doctorServiceType: string;
  status: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
  shiftCity: string;
  shiftState: string;
}

setGlobalOptions({ region: "southamerica-east1", memory: "256MiB" });

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

export const findMatchesOnShiftRequirementWrite = onDocumentWritten({ document: "shiftRequirements/{requirementId}" }, async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>): Promise<void> => {
    const change = event.data;
    if (!change) return;
    const dataAfter = change.after.data() as ShiftRequirementData | undefined;
    const dataBefore = change.before?.data() as ShiftRequirementData | undefined;
    const isNewRequirement = !dataBefore;
    const statusChangedToOpen = dataBefore?.status !== 'OPEN' && dataAfter?.status === 'OPEN';
    if (!isNewRequirement && !statusChangedToOpen) {
      logger.info(`Gatilho ignorado para Req ${event.params.requirementId} pois não é novo nem teve status alterado para OPEN.`);
      return;
    }
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

export const generateContractPdf = onCall(
  {
    cors: [/fhtgestao\.com\.br$/, "https://fht-sistema.web.app"],
  },
  async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "A função só pode ser chamada por um usuário autenticado.");
    }
    const { contractId } = request.data;
    if (!contractId) {
        throw new HttpsError("invalid-argument", "O ID do contrato é obrigatório.");
    }

    logger.info(`Iniciando geração de PDF para o contrato: ${contractId}`);

    try {
        const contractRef = db.collection("contracts").doc(contractId);
        const contractSnap = await contractRef.get();
        if (!contractSnap.exists) {
            throw new HttpsError("not-found", "Contrato não encontrado.");
        }
        const contractData = contractSnap.data()!;

        const doctorProfileSnap = await db.collection("users").doc(contractData.doctorId).get();
        const hospitalProfileSnap = await db.collection("users").doc(contractData.hospitalId).get();
        const doctorData = doctorProfileSnap.data();
        const hospitalData = hospitalProfileSnap.data();

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 11;
        
        let y = height - 50;

        const drawText = (text: string, size = fontSize, indent = 50) => {
            page.drawText(text, { x: indent, y, size, font, lineHeight: size * 1.5 });
            y -= size * 1.5;
        };

        drawText("CONTRATO DE PRESTAÇÃO DE SERVIÇOS MÉDICOS AUTÔNOMOS", 16, 50);
        y -= 20;

        drawText(`CONTRATANTE: ${contractData.hospitalName || 'Nome não disponível'}`, 12);
        drawText(`CNPJ: ${hospitalData?.companyInfo?.cnpj || 'Não informado'}`, 12);
        y -= 10;
        
        drawText(`CONTRATADO(A): Dr(a). ${contractData.doctorName || 'Nome não disponível'}`, 12);
        drawText(`CRM: ${doctorData?.professionalCrm || 'Não informado'}`, 12);
        y -= 20;

        drawText("CLÁUSULA 1ª - DO OBJETO", 12, 50);
        const shiftDate = contractData.shiftDates[0].toDate().toLocaleDateString('pt-BR');
        drawText(`O objeto do presente contrato é a prestação de serviços médicos pelo(a) CONTRATADO(A) ao CONTRATANTE,`, 11, 50);
        drawText(`na especialidade de ${contractData.specialties.join(', ')}, a ser realizado no dia ${shiftDate}`, 11, 50);
        drawText(`das ${contractData.startTime} às ${contractData.endTime}.`, 11, 50);
        y -= 20;
        
        drawText("CLÁUSULA 2ª - DA REMUNERAÇÃO", 12, 50);
        drawText(`Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO(A) o valor de R$ ${contractData.doctorRate.toFixed(2)} por hora.`, 11, 50);
        y -= 20;

        const pdfBytes = await pdfDoc.save();

        const bucket = storage.bucket();
        const filePath = `contracts/${contractId}.pdf`;
        const file = bucket.file(filePath);

        await file.save(Buffer.from(pdfBytes), {
            metadata: { contentType: "application/pdf" },
        });

        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-09-2491'
        });

        await contractRef.update({ contractPdfUrl: url });

        logger.info(`PDF para o contrato ${contractId} gerado e salvo com sucesso. URL: ${url}`);
        
        return { success: true, pdfUrl: url };

    } catch (error) {
        logger.error(`Falha ao gerar PDF para o contrato ${contractId}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao gerar o contrato.");
    }
});