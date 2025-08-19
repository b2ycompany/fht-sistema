// functions/src/logic.ts
// Este arquivo contém toda a lógica pesada e as importações.
import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { UserRecord } from "firebase-admin/auth";
import { Change } from "firebase-functions";
import { DocumentSnapshot, FieldValue, getFirestore, Query, GeoPoint } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FirestoreEvent } from "firebase-functions/v2/firestore";

// --- INTERFACES E TIPOS ---
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
  matchScore: number;
}

interface TimeRecord {
    contractId: string;
    doctorId: string;
    hospitalId: string;
    checkInTime: FieldValue;
    checkInLocation: GeoPoint;
    checkInPhotoUrl: string;
    status: 'IN_PROGRESS' | 'COMPLETED';
    checkOutTime?: FieldValue;
    checkOutLocation?: GeoPoint;
    checkOutPhotoUrl?: string;
}

interface Medication {
  name: string;
  dosage: string;
  instructions: string;
}

interface PrescriptionPayload {
  consultationId: string;
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  medications: Medication[];
}

type DocumentType = 'medicalCertificate' | 'attendanceCertificate';

interface DocumentPayload {
  type: DocumentType;
  consultationId: string;
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  details: {
    daysOff?: number;
    cid?: string;
    consultationPeriod?: string;
  };
}

// --- SERVIÇOS DO FIREBASE ---
const db = getFirestore();
const auth = admin.auth();
const storage = getStorage();


// --- FUNÇÕES AUXILIARES ---
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

async function deleteQueryBatch(query: Query, context: string) {
    const snapshot = await query.get();
    if (snapshot.size === 0) { return; }
    const batch = db.batch();
    snapshot.docs.forEach((doc) => { batch.delete(doc.ref); });
    await batch.commit();
    logger.info(`Batch delete concluído para: ${context}. ${snapshot.size} documentos removidos.`);
}

async function drawTextWithWrapping(page: any, text: string, options: { x: number, y: number, font: any, size: number, maxWidth: number, lineHeight: number }, rgb: any) {
    const { x, font, size, maxWidth, lineHeight } = options;
    let { y } = options;
    const words = text.split(' ');
    let line = '';

    for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = font.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth && line !== '') {
            page.drawText(line, { x, y, font, size, color: rgb(0, 0, 0) });
            y -= lineHeight;
            line = word + ' ';
        } else {
            line = testLine;
        }
    }
    page.drawText(line, { x, y, font, size, color: rgb(0, 0, 0) });
    return y - lineHeight;
}

// --- LÓGICA DE CADA FUNÇÃO (HANDLERS) ---
export const onUserCreatedSetClaimsHandler = async (event: FirestoreEvent<DocumentSnapshot | undefined, { userId: string }>) => {
    const userSnap = event.data;
    if (!userSnap) {
        logger.error("Snapshot do utilizador não encontrado no evento de criação.");
        return;
    }
    const userData = userSnap.data();

    if (!userData) {
        logger.error(`Dados do utilizador (userData) não encontrados para o UID: ${event.params.userId}`);
        return;
    }

    const userId = event.params.userId;
    const userType = userData.userType;
    const hospitalId = userData.hospitalId || null;

    if (!userType) {
        logger.warn(`Utilizador ${userId} criado sem um 'userType'. Claims não serão definidos.`);
        return;
    }

    try {
        const claims = { role: userType, hospitalId: hospitalId };
        await auth.setCustomUserClaims(userId, claims);
        logger.info(`Claims definidos com sucesso para o utilizador ${userId}:`, claims);
    } catch (error) {
        logger.error(`Falha ao definir claims para o utilizador ${userId}:`, error);
    }
};

export const findMatchesOnShiftRequirementWriteHandler = async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>): Promise<void> => {
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

        let score = 0;
        const doctorSpecialtiesSet = new Set(timeSlot.specialties || []);
        const requiredSpecialtiesSet = new Set(requirement.specialtiesRequired || []);
        const intersection = new Set([...doctorSpecialtiesSet].filter(x => requiredSpecialtiesSet.has(x)));
        if (intersection.size > 0) {
            score += 5;
            if (intersection.size === requiredSpecialtiesSet.size) {
                 score += 3;
            }
        }
        if (requirement.serviceType === timeSlot.serviceType) {
            score += 3;
        }
        if (timeSlot.desiredHourlyRate <= requirement.offeredRate) {
            score += 4;
        }
        const doctorCities = new Set(timeSlot.cities || []);
        const requirementCities = new Set(requirement.cities || []);
        const cityIntersection = new Set([...doctorCities].filter(city => requirementCities.has(city)));
        if (cityIntersection.size > 0) {
            score += 2;
        }

        const newPotentialMatchData: PotentialMatchInput = {
          shiftRequirementId: event.params.requirementId, hospitalId: requirement.hospitalId, hospitalName: requirement.hospitalName || "",
          originalShiftRequirementDates: requirement.dates, matchedDate: matchedDate, shiftRequirementStartTime: requirement.startTime,
          shiftRequirementEndTime: requirement.endTime, shiftRequirementIsOvernight: requirement.isOvernight,
          shiftRequirementServiceType: requirement.serviceType,
          doctorServiceType: timeSlot.serviceType,
          shiftRequirementSpecialties: requirement.specialtiesRequired || [], offeredRateByHospital: requirement.offeredRate,
          shiftRequirementNotes: requirement.notes || "", numberOfVacanciesInRequirement: requirement.numberOfVacancies,
          timeSlotId: timeSlotDoc.id, doctorId: timeSlot.doctorId,
          doctorName: timeSlot.doctorName ?? "",
          timeSlotStartTime: timeSlot.startTime, timeSlotEndTime: timeSlot.endTime, timeSlotIsOvernight: timeSlot.isOvernight,
          doctorTimeSlotNotes: timeSlot.notes || "", doctorDesiredRate: timeSlot.desiredHourlyRate, doctorSpecialties: timeSlot.specialties || [],
          status: "PENDING_BACKOFFICE_REVIEW",
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
          shiftCities: requirement.cities,
          shiftState: requirement.state,
          matchScore: score,
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
};

export const onShiftRequirementDeleteHandler = async (event: FirestoreEvent<DocumentSnapshot | undefined, { requirementId: string }>) => {
    const { requirementId } = event.params;
    logger.info(`Demanda ${requirementId} deletada. Removendo matches pendentes.`);
    const q = db.collection("potentialMatches").where("shiftRequirementId", "==", requirementId).where("status", "==", "PENDING_BACKOFFICE_REVIEW");
    return deleteQueryBatch(q, `matches para a demanda ${requirementId}`);
};

export const onTimeSlotDeleteHandler = async (event: FirestoreEvent<DocumentSnapshot | undefined, { timeSlotId: string }>) => {
    const { timeSlotId } = event.params;
    logger.info(`Disponibilidade ${timeSlotId} deletada. Removendo matches pendentes.`);
    const q = db.collection("potentialMatches").where("timeSlotId", "==", timeSlotId).where("status", "==", "PENDING_BACKOFFICE_REVIEW");
    return deleteQueryBatch(q, `matches para a disponibilidade ${timeSlotId}`);
};

export const generateContractPdfHandler = async (request: CallableRequest) => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");

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
        const size = 11;
        let y = height - 50;
        
        const drawText = (text: string, fontSize = size, indent = 50) => {
            page.drawText(text, { x: indent, y, size: fontSize, font, lineHeight: fontSize * 1.5 });
            y -= fontSize * 1.5;
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
};

export const createTelemedicineRoomHandler = async (request: CallableRequest) => {
    const fetch = (await import("node-fetch")).default;

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
};

export const correctServiceTypeCapitalizationHandler = async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "A função só pode ser chamada por um utilizador autenticado.");
    }
    logger.info("Iniciando script de correção para 'serviceType'...");

    const batch = db.batch();
    let updatedCount = { contracts: 0, shiftRequirements: 0, doctorTimeSlots: 0 };
    const incorrectValue = "telemedicina";
    const correctValue = "Telemedicina";

    try {
        const contractsQuery = db.collection("contracts").where("serviceType", "==", incorrectValue);
        const contractsSnapshot = await contractsQuery.get();
        contractsSnapshot.forEach(doc => {
            batch.update(doc.ref, { serviceType: correctValue });
            updatedCount.contracts++;
        });
        logger.info(`Encontrados ${updatedCount.contracts} documentos para corrigir em 'contracts'.`);

        const shiftsQuery = db.collection("shiftRequirements").where("serviceType", "==", incorrectValue);
        const shiftsSnapshot = await shiftsQuery.get();
        shiftsSnapshot.forEach(doc => {
            batch.update(doc.ref, { serviceType: correctValue });
            updatedCount.shiftRequirements++;
        });
        logger.info(`Encontrados ${updatedCount.shiftRequirements} documentos para corrigir em 'shiftRequirements'.`);
        
        const timeSlotsQuery = db.collection("doctorTimeSlots").where("serviceType", "==", incorrectValue);
        const timeSlotsSnapshot = await timeSlotsQuery.get();
        timeSlotsSnapshot.forEach(doc => {
            batch.update(doc.ref, { serviceType: correctValue });
            updatedCount.doctorTimeSlots++;
        });
        logger.info(`Encontrados ${updatedCount.doctorTimeSlots} documentos para corrigir em 'doctorTimeSlots'.`);

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
};

export const generatePrescriptionPdfHandler = async (request: CallableRequest<PrescriptionPayload>) => {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "A função só pode ser chamada por um usuário autenticado.");
    }

    const { consultationId, patientName, doctorName, doctorCrm, medications } = request.data;
    if (!consultationId || !patientName || !doctorName || !doctorCrm || !medications || medications.length === 0) {
        throw new HttpsError("invalid-argument", "Dados da receita incompletos.");
    }
    logger.info(`Iniciando geração de receita para a consulta: ${consultationId}`);

    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        page.drawText("Receituário Médico", { x: 50, y: height - 60, font: fontBold, size: 20 });
        
        page.drawText("Paciente:", { x: 50, y: height - 100, font: fontBold, size: 12 });
        page.drawText(patientName, { x: 50, y: height - 115, font: font, size: 12 });

        page.drawText("Prescrição:", { x: 50, y: height - 150, font: fontBold, size: 14 });
        
        let currentY = height - 175;
        for (let i = 0; i < medications.length; i++) {
            const med = medications[i];
            page.drawText(`${i + 1}. ${med.name}`, { x: 60, y: currentY, font: fontBold, size: 12 });
            currentY -= 15;
            currentY = await drawTextWithWrapping(page, `${med.dosage} - ${med.instructions}`, {
                x: 60, y: currentY, font, size: 11, maxWidth: width - 120, lineHeight: 15
            }, rgb);
            currentY -= 10;
        }

        const signatureY = 100;
        page.drawLine({
            start: { x: width / 2 - 100, y: signatureY },
            end: { x: width / 2 + 100, y: signatureY },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
        
        const doctorNameWidth = fontBold.widthOfTextAtSize(doctorName, 12);
        page.drawText(doctorName, { x: (width - doctorNameWidth) / 2, y: signatureY - 15, font: fontBold, size: 12 });
        
        const crmText = `CRM: ${doctorCrm}`;
        const crmTextWidth = font.widthOfTextAtSize(crmText, 11);
        // CORREÇÃO: A sintaxe estava incorreta aqui.
        page.drawText(crmText, { x: (width - crmTextWidth) / 2, y: signatureY - 30, font: font, size: 11 });
        
        const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        page.drawText(`Data: ${date}`, { x: 50, y: 50, font: font, size: 10 });

        const pdfBytes = await pdfDoc.save();
        
        const prescriptionsRef = db.collection('prescriptions').doc();
        
        const bucket = storage.bucket();
        const filePath = `prescriptions/${prescriptionsRef.id}.pdf`;
        const file = bucket.file(filePath);
        await file.save(Buffer.from(pdfBytes), { metadata: { contentType: "application/pdf" }, });
        const [url] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });
        
        await prescriptionsRef.set({
            consultationId,
            patientName,
            doctorName,
            doctorCrm,
            medications,
            createdAt: FieldValue.serverTimestamp(),
            pdfUrl: url,
        });

        const consultationRef = db.collection('consultations').doc(consultationId);
        await consultationRef.update({
            prescriptions: FieldValue.arrayUnion(prescriptionsRef.id)
        });

        logger.info(`Receita ${prescriptionsRef.id} gerada e salva com sucesso.`);
        return { success: true, prescriptionId: prescriptionsRef.id, pdfUrl: url };

    } catch (error) {
        logger.error(`Falha ao gerar PDF da receita para a consulta ${consultationId}:`, error);
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao gerar a receita.");
    }
};

export const generateDocumentPdfHandler = async (request: CallableRequest<DocumentPayload>) => {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "A função só pode ser chamada por um usuário autenticado.");
    }

    const { type, consultationId, patientName, doctorName, doctorCrm, details } = request.data;
    if (!type || !consultationId || !patientName || !doctorName || !doctorCrm) {
        throw new HttpsError("invalid-argument", "Dados do documento incompletos.");
    }
    logger.info(`Iniciando geração de documento tipo '${type}' para a consulta: ${consultationId}`);

    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

        if (type === 'medicalCertificate') {
            const days = details.daysOff || 0;
            page.drawText("Atestado Médico", { x: 50, y: height - 60, font: fontBold, size: 24 });
            const text = `Atesto para os devidos fins que o(a) Sr(a). ${patientName} esteve sob meus cuidados médicos nesta data, necessitando de ${days} dia(s) de afastamento de suas atividades laborais a partir de hoje.`;
            await drawTextWithWrapping(page, text, { x: 50, y: height - 120, font, size: 12, lineHeight: 20, maxWidth: width - 100 }, rgb);
            if (details.cid) {
                page.drawText(`CID: ${details.cid}`, { x: 50, y: height - 200, font, size: 12 });
            }
        } else if (type === 'attendanceCertificate') {
            page.drawText("Declaração de Comparecimento", { x: 50, y: height - 60, font: fontBold, size: 24 });
            const text = `Declaro para os devidos fins que o(a) Sr(a). ${patientName} esteve presente nesta unidade de saúde para consulta médica no dia de hoje, ${date}, durante o período de ${details.consultationPeriod || 'não informado'}.`;
            await drawTextWithWrapping(page, text, { x: 50, y: height - 120, font, size: 12, lineHeight: 20, maxWidth: width - 100 }, rgb);
        }

        const signatureY = 150;
        page.drawLine({ start: { x: width / 2 - 100, y: signatureY }, end: { x: width / 2 + 100, y: signatureY }, thickness: 1 });
        const doctorNameWidth = fontBold.widthOfTextAtSize(doctorName, 12);
        page.drawText(doctorName, { x: (width - doctorNameWidth) / 2, y: signatureY - 15, font: fontBold, size: 12 });
        const crmText = `CRM: ${doctorCrm}`;
        const crmTextWidth = font.widthOfTextAtSize(crmText, 11);
        // CORREÇÃO: A sintaxe estava incorreta aqui.
        page.drawText(crmText, { x: (width - crmTextWidth) / 2, y: signatureY - 30, font: font, size: 11 });
        page.drawText(date, { x: 50, y: 50, font, size: 10 });

        const pdfBytes = await pdfDoc.save();
        const documentsRef = db.collection('documents').doc();
        
        const bucket = storage.bucket();
        const filePath = `documents/${documentsRef.id}.pdf`;
        const file = bucket.file(filePath);
        await file.save(Buffer.from(pdfBytes), { metadata: { contentType: "application/pdf" }, });
        const [url] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });

        await documentsRef.set({
            consultationId,
            patientName,
            doctorName,
            doctorCrm,
            type,
            details,
            createdAt: FieldValue.serverTimestamp(),
            pdfUrl: url,
        });

        logger.info(`Documento ${documentsRef.id} gerado e salvo com sucesso.`);
        return { success: true, documentId: documentsRef.id, pdfUrl: url };

    } catch (error) {
        logger.error(`Falha ao gerar PDF para a consulta ${consultationId}:`, error);
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao gerar o documento.");
    }
};

export const onContractFinalizedUpdateRequirementHandler = async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { contractId: string }>) => {
    const change = event.data;
    if (!change) {
        return;
    }

    const dataBefore = change.before?.data();
    const dataAfter = change.after.data();

    if (!dataAfter || dataAfter.status !== 'ACTIVE_SIGNED' || dataBefore?.status === 'ACTIVE_SIGNED') {
        logger.info(`Gatilho de contrato ${event.params.contractId} ignorado. Status não é ACTIVE_SIGNED ou não houve mudança.`);
        return;
    }
    
    const contract = dataAfter;
    const shiftRequirementId = contract.shiftRequirementId;

    if (!shiftRequirementId) {
        logger.warn(`Contrato ${event.params.contractId} finalizado, mas não possui shiftRequirementId.`);
        return;
    }

    logger.info(`Contrato ${event.params.contractId} finalizado. Atualizando demanda original: ${shiftRequirementId}`);

    try {
        const requirementRef = db.collection("shiftRequirements").doc(shiftRequirementId);
        
        await requirementRef.update({
            status: "CONFIRMED",
            contractId: event.params.contractId,
            updatedAt: FieldValue.serverTimestamp(),
        });
        
        logger.info(`Demanda ${shiftRequirementId} atualizada para CONFIRMED com sucesso!`);

    } catch (error) {
        logger.error(`Erro ao tentar atualizar a demanda ${shiftRequirementId} a partir do contrato ${event.params.contractId}:`, error);
    }
};

export const registerTimeRecordHandler = async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "A função só pode ser chamada por um usuário autenticado.");
    }
    const { contractId, latitude, longitude, photoBase64 } = request.data;
    if (!contractId || !latitude || !longitude || !photoBase64) {
        throw new HttpsError("invalid-argument", "Dados para registro de ponto estão incompletos.");
    }

    const doctorId = request.auth.uid;
    logger.info(`Médico ${doctorId} iniciando check-in para o contrato ${contractId}.`);

    try {
        const contractRef = db.collection("contracts").doc(contractId);
        const contractSnap = await contractRef.get();
        if (!contractSnap.exists || contractSnap.data()?.doctorId !== doctorId) {
            throw new HttpsError("not-found", "Contrato não encontrado ou não pertence a este médico.");
        }
        
        const hospitalId = contractSnap.data()?.hospitalId;
        const recordId = `${contractId}_${doctorId}`; // ID determinístico

        const bucket = storage.bucket();
        const filePath = `timeRecords/${recordId}_checkin.jpg`;
        const file = bucket.file(filePath);
        const buffer = Buffer.from(photoBase64.replace(/^data:image\/jpeg;base64,/, ""), 'base64');
        
        await file.save(buffer, { metadata: { contentType: "image/jpeg" } });
        const [photoUrl] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });
        
        logger.info(`Foto de check-in salva em: ${photoUrl}`);

        const timeRecordRef = db.collection("timeRecords").doc(recordId);
        const newRecordData: TimeRecord = {
            contractId,
            doctorId,
            hospitalId,
            checkInTime: FieldValue.serverTimestamp(),
            checkInLocation: new GeoPoint(latitude, longitude),
            checkInPhotoUrl: photoUrl,
            status: 'IN_PROGRESS',
        };

        const batch = db.batch();
        batch.set(timeRecordRef, newRecordData, { merge: true }); 

        batch.update(contractRef, { status: "IN_PROGRESS", updatedAt: FieldValue.serverTimestamp() });

        await batch.commit();

        logger.info(`Check-in para o contrato ${contractId} registrado com sucesso.`);
        return { success: true, recordId: timeRecordRef.id };

    } catch (error) {
        logger.error(`Falha ao registrar ponto para o contrato ${contractId}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao registrar o ponto.");
    }
};

export const registerCheckoutHandler = async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "A função só pode ser chamada por um usuário autenticado.");
    }

    const { contractId, latitude, longitude, photoBase64 } = request.data;
    if (!contractId || !latitude || !longitude || !photoBase64) {
        throw new HttpsError("invalid-argument", "Dados para registro de check-out estão incompletos.");
    }

    const doctorId = request.auth.uid;
    logger.info(`Médico ${doctorId} iniciando check-out para o contrato ${contractId}.`);

    try {
        const recordId = `${contractId}_${doctorId}`;
        const timeRecordRef = db.collection("timeRecords").doc(recordId);
        const recordSnap = await timeRecordRef.get();

        if (!recordSnap.exists || recordSnap.data()?.status !== 'IN_PROGRESS') {
            throw new HttpsError("failed-precondition", "Nenhum check-in em andamento foi encontrado para este plantão.");
        }

        const bucket = storage.bucket();
        const filePath = `timeRecords/${recordId}_checkout.jpg`;
        const file = bucket.file(filePath);
        const buffer = Buffer.from(photoBase64.replace(/^data:image\/jpeg;base64,/, ""), 'base64');
        
        await file.save(buffer, { metadata: { contentType: "image/jpeg" } });
        const [photoUrl] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });
        logger.info(`Foto de check-out salva em: ${photoUrl}`);

        const checkoutData = {
            checkOutTime: FieldValue.serverTimestamp(),
            checkOutLocation: new GeoPoint(latitude, longitude),
            checkOutPhotoUrl: photoUrl,
            status: 'COMPLETED' as const,
        };

        const contractRef = db.collection("contracts").doc(contractId);

        const batch = db.batch();
        batch.update(timeRecordRef, checkoutData);
        batch.update(contractRef, { status: "COMPLETED", updatedAt: FieldValue.serverTimestamp() });
        
        await batch.commit();

        logger.info(`Check-out para o contrato ${contractId} registrado com sucesso.`);
        return { success: true, recordId: timeRecordRef.id };

    } catch (error) {
        logger.error(`Falha ao registrar check-out para o contrato ${contractId}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao registrar o check-out.");
    }
};

export const setAdminClaimHandler = async (request: CallableRequest) => {
    const { email } = request.data;
    if (!email) {
        throw new HttpsError("invalid-argument", "O email do usuário é obrigatório.");
    }

    try {
        const user = await auth.getUserByEmail(email);
        await auth.setCustomUserClaims(user.uid, { admin: true });
        
        logger.info(`Sucesso! O usuário ${email} (UID: ${user.uid}) agora é um administrador.`);
        return { message: `Sucesso! ${email} agora é um administrador.` };

    } catch (error: any) {
        logger.error("Erro ao definir custom claim de admin:", error);
        throw new HttpsError("internal", error.message);
    }
};

export const createStaffUserHandler = async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Apenas gestores autenticados podem adicionar membros à equipa.");
    }
    
    const managerUid = request.auth.uid;
    const managerDoc = await db.collection("users").doc(managerUid).get();
    const managerProfile = managerDoc.data();

    if (managerProfile?.userType !== 'hospital') {
        throw new HttpsError("permission-denied", "Você não tem permissão para realizar esta ação.");
    }

    const { name, email, userType } = request.data;
    if (!name || !email || !userType) {
        throw new HttpsError("invalid-argument", "Nome, email e função são obrigatórios.");
    }

    const validStaffRoles = ['receptionist', 'triage_nurse', 'caravan_admin'];
    if(!validStaffRoles.includes(userType)) {
        throw new HttpsError("invalid-argument", "Função de utilizador inválida.");
    }

    logger.info(`Gestor ${managerUid} está a criar um novo profissional '${name}' com a função '${userType}'`);

    try {
        const tempPassword = Math.random().toString(36).slice(-8);
        
        const userRecord = await auth.createUser({
            email: email,
            emailVerified: false,
            password: tempPassword,
            displayName: name,
            disabled: false,
        });

        logger.info(`Utilizador de autenticação criado para ${email} com UID: ${userRecord.uid}`);

        const userProfile = {
            uid: userRecord.uid,
            displayName: name,
            email: email,
            userType: userType,
            hospitalId: managerUid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await db.collection("users").doc(userRecord.uid).set(userProfile);
        
        logger.info(`TODO: Enviar email de boas-vindas para ${email} com a senha temporária: ${tempPassword}`);

        return { success: true, user: userProfile };

    } catch (error: any) {
        logger.error("Falha ao criar profissional:", error);
        if (error.code === 'auth/email-already-exists') {
            throw new HttpsError("already-exists", "Este endereço de e-mail já está em uso.");
        }
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao criar o profissional.");
    }
};

export const createConsultationRoomHandler = async (request: CallableRequest) => {
    const fetch = (await import("node-fetch")).default;

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "A função só pode ser chamada por um usuário autenticado.");
    }

    const { consultationId } = request.data;
    if (!consultationId) {
        throw new HttpsError("invalid-argument", "O ID da consulta é obrigatório.");
    }
    logger.info(`Criando sala de telemedicina para a consulta: ${consultationId}`);

    const consultationRef = db.collection("consultations").doc(consultationId);
    const consultationSnap = await consultationRef.get();
    
    if (!consultationSnap.exists) {
        throw new HttpsError("not-found", "Consulta não encontrada.");
    }

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
        logger.info(`Sala criada com sucesso para a consulta ${consultationId}. URL: ${roomUrl}`);

        await consultationRef.update({
            telemedicineLink: roomUrl,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return { success: true, roomUrl: roomUrl };

    } catch (error) {
        logger.error(`Falha crítica ao criar sala para a consulta ${consultationId}:`, error);
        if (error instanceof HttpsError) { throw error; }
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao criar a sala de telemedicina.");
    }
};

export const createAppointmentHandler = async (request: CallableRequest) => {
    const fetch = (await import("node-fetch")).default;
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "A função só pode ser chamada por um utilizador autenticado.");
    }
    
    const createdByUid = request.auth.uid;
    const { patientName, doctorId, doctorName, specialty, appointmentDate, type } = request.data;
    
    if (!patientName || !doctorId || !doctorName || !specialty || !appointmentDate || !type) {
        throw new HttpsError("invalid-argument", "Dados para o agendamento estão incompletos.");
    }
    
    let roomUrl = null;
    if (type === 'Telemedicina') {
        const DAILY_API_KEY = process.env.DAILY_APIKEY;
        if (!DAILY_API_KEY) throw new HttpsError("internal", "Configuração do servidor de vídeo incompleta.");

        const expirationDate = new Date(appointmentDate);
        const expirationTimestamp = Math.round((expirationDate.getTime() + 2 * 60 * 60 * 1000) / 1000);

        const roomOptions = { properties: { exp: expirationTimestamp, enable_chat: true } };
        const apiResponse = await fetch("https://api.daily.co/v1/rooms", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DAILY_API_KEY}` },
            body: JSON.stringify(roomOptions),
        });
        if (!apiResponse.ok) throw new HttpsError("internal", "Falha ao criar a sala de videochamada.");
        const roomData: any = await apiResponse.json();
        roomUrl = roomData.url;
        logger.info(`Sala de vídeo criada com sucesso: ${roomUrl}`);
    }

    const appointmentData = {
        patientName, doctorId, doctorName, specialty, type,
        appointmentDate: admin.firestore.Timestamp.fromDate(new Date(appointmentDate)),
        status: "SCHEDULED",
        telemedicineRoomUrl: roomUrl,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: createdByUid,
    };

    const docRef = await db.collection("appointments").add(appointmentData);
    logger.info(`Agendamento ${docRef.id} salvo com sucesso.`);
    return { success: true, appointmentId: docRef.id };
};

export const onUserDeletedCleanupHandler = async (user: UserRecord) => {
    const uid = user.uid;
    logger.info(`[Sintaxe V1] Utilizador de autenticação com UID: ${uid} foi excluído. A iniciar limpeza.`);
    
    const userDocRef = db.collection("users").doc(uid);
    
    try {
        await userDocRef.delete();
        logger.info(`Documento de perfil ${uid} em 'users' foi excluído com sucesso.`);
    } catch (error) {
        logger.error(`Falha ao excluir o documento de perfil ${uid} em 'users':`, error);
    }
    
    const hospitalDocRef = db.collection("hospitals").doc(uid);
    const hospitalDoc = await hospitalDocRef.get();
    if(hospitalDoc.exists) {
        try {
            await hospitalDocRef.delete();
            logger.info(`Documento de perfil ${uid} em 'hospitals' foi excluído com sucesso.`);
        } catch (error) {
            logger.error(`Falha ao excluir o documento de perfil ${uid} em 'hospitals':`, error);
        }
    }
    
    return;
};

export const searchPlatformDoctorsHandler = async (request: CallableRequest) => {
    if (request.auth?.token?.role !== 'hospital') {
        throw new HttpsError("permission-denied", "Apenas gestores de unidade podem buscar médicos.");
    }
    const { searchTerm } = request.data;
    if (typeof searchTerm !== 'string' || searchTerm.length < 3) {
        throw new HttpsError("invalid-argument", "O termo de busca deve ter pelo menos 3 caracteres.");
    }

    try {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        
        const nameQuery = db.collection('users').where('userType', '==', 'doctor').where('displayName_lowercase', '>=', lowerCaseSearchTerm).where('displayName_lowercase', '<=', lowerCaseSearchTerm + '\uf8ff');
        const crmQuery = db.collection('users').where('userType', '==', 'doctor').where('professionalCrm', '==', searchTerm.toUpperCase());
        const emailQuery = db.collection('users').where('userType', '==', 'doctor').where('email', '==', lowerCaseSearchTerm);

        const [nameSnap, crmSnap, emailSnap] = await Promise.all([nameQuery.get(), crmQuery.get(), emailQuery.get()]);

        const resultsMap = new Map();
        const processSnapshot = (snap: admin.firestore.QuerySnapshot) => {
            snap.forEach(doc => {
                const data = doc.data();
                if (!resultsMap.has(doc.id)) {
                    resultsMap.set(doc.id, {
                        uid: doc.id,
                        name: data.displayName,
                        crm: data.professionalCrm,
                        specialties: data.specialties || [],
                    });
                }
            });
        };

        processSnapshot(nameSnap);
        processSnapshot(crmSnap);
        processSnapshot(emailSnap);
        
        const results = Array.from(resultsMap.values());
        return { success: true, doctors: results };

    } catch (error) {
        logger.error("Erro ao buscar médicos na plataforma:", error);
        throw new HttpsError("internal", "Ocorreu um erro ao realizar a busca.");
    }
};

export const associateDoctorToUnitHandler = async (request: CallableRequest) => {
    if (request.auth?.token?.role !== 'hospital') {
        throw new HttpsError("permission-denied", "Apenas gestores de unidade podem associar médicos.");
    }

    const { doctorId } = request.data;
    const hospitalId = request.auth.uid; 

    if (!doctorId) {
        throw new HttpsError("invalid-argument", "O ID do médico é obrigatório.");
    }

    try {
        const doctorRef = db.collection('users').doc(doctorId);
        
        await doctorRef.update({
            healthUnitIds: FieldValue.arrayUnion(hospitalId)
        });

        logger.info(`Médico ${doctorId} associado com sucesso à Unidade de Saúde ${hospitalId}.`);
        return { success: true, message: "Médico associado com sucesso." };

    } catch (error) {
        logger.error(`Falha ao associar médico ${doctorId} à unidade ${hospitalId}:`, error);
        throw new HttpsError("internal", "Não foi possível concluir a associação.");
    }
};

export const onContractFinalizedLinkDoctorHandler = async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { contractId: string }>) => {
    const change = event.data;
    
    if (!change || !change.after.exists) {
        return;
    }

    const contractData = change.after.data();
    if (!contractData) {
        logger.warn(`Dados do contrato ${event.params.contractId} não encontrados após a atualização.`);
        return;
    }
    
    const statusBefore = change.before?.data()?.status ?? null;

    if (contractData.status === 'ACTIVE_SIGNED' && statusBefore !== 'ACTIVE_SIGNED') {
        const { doctorId, hospitalId } = contractData;

        if (!doctorId || !hospitalId) {
            logger.warn(`Contrato ${event.params.contractId} finalizado sem doctorId ou hospitalId.`);
            return;
        }

        try {
            const doctorRef = db.collection('users').doc(doctorId);
            await doctorRef.update({
                healthUnitIds: FieldValue.arrayUnion(hospitalId)
            });
            logger.info(`Vínculo automático criado: Médico ${doctorId} associado à Unidade de Saúde ${hospitalId} via Contrato ${event.params.contractId}.`);
        } catch (error) {
            logger.error(`Falha ao criar vínculo automático para o Contrato ${event.params.contractId}:`, error);
        }
    }
};