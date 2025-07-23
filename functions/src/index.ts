// functions/src/index.ts
import { onDocumentWritten, onDocumentDeleted, FirestoreEvent } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, CallableRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { Change } from "firebase-functions";
import { DocumentSnapshot, FieldValue, getFirestore, Query } from "firebase-admin/firestore";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getStorage } from "firebase-admin/storage";
import fetch from "node-fetch";

if (admin.apps.length === 0) { admin.initializeApp(); }
const db = getFirestore();
const storage = getStorage();

// Interfaces
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
  cities: string[];
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
  cities: string[];
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
  shiftCities: string[];
  shiftState: string;
}

setGlobalOptions({ region: "us-central1", memory: "256MiB" });

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

export const findMatchesOnShiftRequirementWrite = onDocumentWritten({ document: "shiftRequirements/{requirementId}" },
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>): Promise<void> => {
    const change = event.data;
    if (!change) return;
    const dataAfter = change.after.data() as ShiftRequirementData | undefined;
    const dataBefore = change.before?.data() as ShiftRequirementData | undefined;
    const isNewRequirement = !dataBefore;
    const statusChangedToOpen = dataBefore?.status !== 'OPEN' && dataAfter?.status === 'OPEN';
    if (!isNewRequirement && !statusChangedToOpen) {
      logger.info(`Gatilho ignorado para Req ${event.params.requirementId}: não é novo nem reaberto.`);
      return;
    }
    if (dataAfter?.status !== 'OPEN') {
        logger.info(`Gatilho ignorado para Req ${event.params.requirementId}: status final não é OPEN.`);
        return;
    }
    const requirement = dataAfter;
    logger.info(`INICIANDO BUSCA DE MATCHES para a Demanda: ${event.params.requirementId}`);
    
    try {
      let timeSlotsQuery: Query = db.collection("doctorTimeSlots")
        .where("status", "==", "AVAILABLE")
        .where("state", "==", requirement.state)
        .where("serviceType", "==", requirement.serviceType)
        .where("date", "in", requirement.dates);

      if (requirement.cities && requirement.cities.length > 0) {
        timeSlotsQuery = timeSlotsQuery.where('cities', 'array-contains-any', requirement.cities);
      }
      
      const timeSlotsSnapshot = await timeSlotsQuery.get();
      
      if (timeSlotsSnapshot.empty) {
        logger.info(`Nenhum TimeSlot encontrado para os critérios básicos (local, data, etc).`);
        return;
      }
      
      const specialtiesRequired = requirement.specialtiesRequired;
      const finalCandidates = timeSlotsSnapshot.docs.filter(doc => {
        if (!specialtiesRequired || specialtiesRequired.length === 0) {
            return true;
        }
        const timeSlotSpecialties = doc.data().specialties as string[] | undefined;
        if (!timeSlotSpecialties || timeSlotSpecialties.length === 0) {
            return false;
        }
        return timeSlotSpecialties.some(s => specialtiesRequired.includes(s));
      });

      if (finalCandidates.length === 0) {
        logger.info(`Nenhum candidato final após o filtro de especialidades.`);
        return;
      }
      
      logger.info(`[MATCHING] Encontrados ${finalCandidates.length} candidatos finais para a Req ${event.params.requirementId}.`);
      
      const batch = db.batch();
      let matchesCreatedCount = 0;
      
      for (const timeSlotDoc of finalCandidates) {
        const timeSlot = timeSlotDoc.data() as TimeSlotData;

        if (!doIntervalsOverlap(timeToMinutes(timeSlot.startTime), timeToMinutes(timeSlot.endTime), timeSlot.isOvernight, timeToMinutes(requirement.startTime), timeToMinutes(requirement.endTime), requirement.isOvernight)) {
          continue;
        }
        
        const matchedDate = requirement.dates.find((reqDate) => reqDate.isEqual(timeSlot.date))!;
        if (!matchedDate) continue;

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
          timeSlotStartTime: timeSlot.startTime, timeSlotEndTime: timeSlot.endTime, timeSlotIsOvernight: timeSlot.isOvernight,
          doctorTimeSlotNotes: timeSlot.notes || "", doctorDesiredRate: timeSlot.desiredHourlyRate, doctorSpecialties: timeSlot.specialties || [],
          doctorServiceType: timeSlot.serviceType, status: "PENDING_BACKOFFICE_REVIEW",
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
          shiftCities: requirement.cities,
          shiftState: requirement.state,
        };
        batch.set(matchRef, newPotentialMatchData);
        matchesCreatedCount++;
      }
      
      if (matchesCreatedCount > 0) {
        await batch.commit();
        logger.info(`[SUCESSO] ${matchesCreatedCount} novo(s) PotentialMatch(es) criado(s).`);
      } else {
        logger.info(`Nenhum novo match foi criado após todos os filtros.`);
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

export const generateContractPdf = onCall({ cors: [/fhtgestao\.com\.br$/, "https://fht-sistema.web.app"] }, async (request: CallableRequest) => {
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
        drawText(`CONTRATANTE: ${contractData.hospitalName ?? 'Nome não disponível'}`, 12);
        drawText(`CNPJ: ${hospitalData?.companyInfo?.cnpj ?? 'Não informado'}`, 12);
        y -= 10;
        drawText(`CONTRATADO(A): Dr(a). ${contractData.doctorName ?? 'Nome não disponível'}`, 12);
        drawText(`CRM: ${doctorData?.professionalCrm ?? 'Não informado'}`, 12);
        y -= 20;
        drawText("CLÁUSULA 1ª - DO OBJETO", 12, 50);
        const shiftDate = contractData.shiftDates?.[0]?.toDate()?.toLocaleDateString('pt-BR') ?? 'Data não informada';
        drawText(`O objeto do presente contrato é a prestação de serviços médicos pelo(a) CONTRATADO(A) ao CONTRATANTE,`, 11, 50);
        drawText(`na especialidade de ${(contractData.specialties ?? []).join(', ')}, a ser realizado no dia ${shiftDate}`, 11, 50);
        drawText(`das ${contractData.startTime ?? ''} às ${contractData.endTime ?? ''}.`, 11, 50);
        y -= 20;
        drawText("CLÁUSULA 2ª - DA REMUNERAÇÃO", 12, 50);
        drawText(`Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO(A) o valor de R$ ${(contractData.doctorRate ?? 0).toFixed(2)} por hora.`, 11, 50);
        y -= 20;

        const pdfBytes = await pdfDoc.save();
        const bucket = storage.bucket();
        const filePath = `contracts/${contractId}.pdf`;
        const file = bucket.file(filePath);
        await file.save(Buffer.from(pdfBytes), { metadata: { contentType: "application/pdf" }, });
        const [url] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });
        await contractRef.update({ contractPdfUrl: url });
        logger.info(`PDF para o contrato ${contractId} gerado e salvo com sucesso. URL: ${url}`);
        return { success: true, pdfUrl: url };

    } catch (error) {
        logger.error(`Falha ao gerar PDF para o contrato ${contractId}:`, error);
        if (error instanceof HttpsError) { throw error; }
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao gerar o contrato.");
    }
});

export const createTelemedicineRoom = onCall(
    { 
        cors: true,
        secrets: ["DAILY_APIKEY"] 
    }, 
    async (request: CallableRequest) => {
      // Forçando o redeploy para atualizar permissões
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "A função só pode ser chamada por um utilizador autenticado.");
        }
        const { contractId } = request.data;
        if (!contractId) {
            throw new HttpsError("invalid-argument", "O ID do contrato é obrigatório.");
        }
        logger.info(`A criar sala de telemedicina para o contrato: ${contractId}`);
    
        const DAILY_API_KEY = process.env.DAILY_APIKEY;
        if (!DAILY_API_KEY) {
            logger.error("A API Key do Daily.co não está configurada nos Secrets do Firebase.");
            throw new HttpsError("internal", "Configuração do servidor incompleta.");
        }
        const DAILY_API_URL = "https://api.daily.co/v1/rooms";

        const twelveHoursFromNow = Math.floor(Date.now() / 1000) + (12 * 60 * 60);
        const roomOptions = {
            properties: {
                exp: twelveHoursFromNow,
                enable_chat: true,
                enable_screenshare: true,
//                enable_recording: 'cloud',
            },
        };

        try {
            const apiResponse = await fetch(DAILY_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DAILY_API_KEY}`,
                },
                body: JSON.stringify(roomOptions),
            });

            if (!apiResponse.ok) {
                const errorBody = await apiResponse.json();
                logger.error("Erro da API do Daily.co:", errorBody);
                throw new HttpsError("internal", `Falha ao criar a sala de videochamada. Status: ${apiResponse.status}`);
            }

            const roomData: any = await apiResponse.json();
            const roomUrl = roomData.url;
            logger.info(`Sala criada com sucesso para o contrato ${contractId}. URL: ${roomUrl}`);

            const contractRef = db.collection("contracts").doc(contractId);
            await contractRef.update({
                telemedicineLink: roomUrl,
                updatedAt: FieldValue.serverTimestamp(),
            });

            return { success: true, roomUrl: roomUrl };

        } catch (error) {
            logger.error(`Falha crítica ao criar sala para o contrato ${contractId}:`, error);
            if (error instanceof HttpsError) { throw error; }
            throw new HttpsError("internal", "Ocorreu um erro inesperado ao criar a sala de telemedicina.");
        }
    }
);

// =======================================================================
// NOVA FUNÇÃO: SCRIPT DE CORREÇÃO DE DADOS
// =======================================================================
/**
 * Procura em todas as coleções relevantes por documentos com serviceType "telemedicina" (minúsculo)
 * e os atualiza para "Telemedicina" (maiúsculo).
 * Esta é uma função para ser executada uma única vez.
 */
export const correctServiceTypeCapitalization = onCall(
    { cors: true }, 
    async (request: CallableRequest) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "A função só pode ser chamada por um utilizador autenticado.");
        }
        logger.info("Iniciando script de correção para 'serviceType'...");

        const batch = db.batch();
        let updatedCount = { contracts: 0, shiftRequirements: 0, doctorTimeSlots: 0 };
        const incorrectValue = "telemedicina";
        const correctValue = "Telemedicina";

        try {
            // 1. Corrigir a coleção 'contracts'
            const contractsQuery = db.collection("contracts").where("serviceType", "==", incorrectValue);
            const contractsSnapshot = await contractsQuery.get();
            contractsSnapshot.forEach(doc => {
                batch.update(doc.ref, { serviceType: correctValue });
                updatedCount.contracts++;
            });
            logger.info(`Encontrados ${updatedCount.contracts} documentos para corrigir em 'contracts'.`);

            // 2. Corrigir a coleção 'shiftRequirements'
            const shiftsQuery = db.collection("shiftRequirements").where("serviceType", "==", incorrectValue);
            const shiftsSnapshot = await shiftsQuery.get();
            shiftsSnapshot.forEach(doc => {
                batch.update(doc.ref, { serviceType: correctValue });
                updatedCount.shiftRequirements++;
            });
            logger.info(`Encontrados ${updatedCount.shiftRequirements} documentos para corrigir em 'shiftRequirements'.`);
            
            // 3. Corrigir a coleção 'doctorTimeSlots'
            const timeSlotsQuery = db.collection("doctorTimeSlots").where("serviceType", "==", incorrectValue);
            const timeSlotsSnapshot = await timeSlotsQuery.get();
            timeSlotsSnapshot.forEach(doc => {
                batch.update(doc.ref, { serviceType: correctValue });
                updatedCount.doctorTimeSlots++;
            });
            logger.info(`Encontrados ${updatedCount.doctorTimeSlots} documentos para corrigir em 'doctorTimeSlots'.`);

            // Executar todas as atualizações de uma vez
            await batch.commit();

            const total = updatedCount.contracts + updatedCount.shiftRequirements + updatedCount.doctorTimeSlots;
            logger.info(`Script concluído. Total de ${total} documentos atualizados.`);
            
            return {
                success: true,
                message: `Correção concluída! ${total} documentos foram atualizados.`,
                details: updatedCount
            };

        } catch (error) {
            logger.error("Erro durante o script de correção de 'serviceType':", error);
            throw new HttpsError("internal", "Ocorreu um erro ao executar o script de correção.");
        }
    }
);