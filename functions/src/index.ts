import { onDocumentWritten } from "firebase-functions/v2/firestore"; // v2 import
import { setGlobalOptions } from "firebase-functions/v2"; // v2 para opções globais
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2"; // v2 logger

// Inicializa o Firebase Admin SDK (apenas uma vez)
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- INTERFACES (Como definido anteriormente, mas usando tipos do admin.firestore) ---
interface ShiftRequirementData {
  state: string;
  city: string;
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
}

interface PotentialMatchInput {
  shiftRequirementId: string;
  hospitalId: string;
  hospitalName?: string;
  shiftRequirementDates: admin.firestore.Timestamp[];
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
  doctorName?: string;
  timeSlotDate: admin.firestore.Timestamp;
  timeSlotStartTime: string;
  timeSlotEndTime: string;
  timeSlotIsOvernight: boolean;
  doctorDesiredRate: number;
  doctorSpecialties: string[];
  doctorServiceType: string;
  status: string;
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}
// --- FIM DAS INTERFACES ---

// Definindo opções globais para as funções (incluindo região)
setGlobalOptions({ region: "southamerica-east1" });

export const onShiftRequirementWrittenV2 = onDocumentWritten(
  "shiftRequirements/{requirementId}",
  async (event) => { // event já é tipado por onDocumentWritten
    const { requirementId } = event.params;
    const change = event.data; // event.data é Change<DocumentSnapshot> | undefined

    if (!change) {
        logger.info("Evento de escrita sem dados (change é undefined), ignorando.", { structuredData: true });
        return;
    }
    
    if (!change.after?.exists) { // Usar optional chaining aqui
      logger.info(`ShiftRequirement ${requirementId} deletado. Nenhuma ação de match.`, { structuredData: true });
      return;
    }

    const shiftNewData = change.after.data() as ShiftRequirementData;
    const shiftOldData = change.before?.exists ? change.before.data() as ShiftRequirementData : null; // Optional chaining

    logger.info(`v2: ShiftRequirement ${requirementId} escrito. Novo status: ${shiftNewData.status}`, { structuredData: true });
    if (shiftOldData) {
        logger.info(`v2: Status anterior: ${shiftOldData.status}`, { structuredData: true });
    }

    const isNewAndOpen = !change.before?.exists && shiftNewData.status === "OPEN";
    const wasUpdatedToOpen = change.before?.exists && shiftOldData?.status !== "OPEN" && shiftNewData.status === "OPEN";
    
    if ((!isNewAndOpen && !wasUpdatedToOpen) || shiftNewData.numberOfVacancies <= 0) {
      logger.info(`v2: ShiftRequirement ${requirementId} não recém aberto/sem vagas. Status: ${shiftNewData.status}, Vagas: ${shiftNewData.numberOfVacancies}.`, { structuredData: true });
      return;
    }

    logger.info(`v2: Processando ShiftRequirement ${requirementId} (Status: ${shiftNewData.status}) para matches.`, { structuredData: true });

    try {
      const timeSlotsQuery = db.collection("doctorTimeSlots")
        .where("serviceType", "==", shiftNewData.serviceType)
        .where("status", "==", "AVAILABLE");
      // Adicionar mais filtros aqui (localização, etc.) seria ideal para otimizar.

      const timeSlotsSnapshot = await timeSlotsQuery.get();

      if (timeSlotsSnapshot.empty) {
        logger.info(`v2: Nenhum TimeSlot compatível (serviceType, status) para demanda ${requirementId}.`, { structuredData: true });
        return;
      }

      logger.info(`v2: Encontrados ${timeSlotsSnapshot.docs.length} TimeSlots com serviceType e status compatíveis.`, { structuredData: true });

      const batch = db.batch();
      let matchesFoundCount = 0;
      const processedTimeSlotIdsForThisRun = new Set<string>();

      for (const timeSlotDoc of timeSlotsSnapshot.docs) {
        const timeSlotId = timeSlotDoc.id;
        if (processedTimeSlotIdsForThisRun.has(timeSlotId)) continue;

        const timeSlotData = timeSlotDoc.data() as TimeSlotData;

        let dateMatch = false;
        for (const reqDate of shiftNewData.dates) {
          if (reqDate.isEqual(timeSlotData.date)) {
            if (shiftNewData.startTime === timeSlotData.startTime && 
                shiftNewData.endTime === timeSlotData.endTime &&
                shiftNewData.isOvernight === timeSlotData.isOvernight) {
              dateMatch = true;
              break; 
            }
          }
        }
        if (!dateMatch) continue;

        const hasSpecialtyMatch = shiftNewData.specialtiesRequired.length === 0 ||
                                  shiftNewData.specialtiesRequired.some(reqSpec => timeSlotData.specialties.includes(reqSpec));
        if (!hasSpecialtyMatch) continue;
        
        if (shiftNewData.city !== timeSlotData.city || shiftNewData.state !== timeSlotData.state) {
            logger.info(`TimeSlot ${timeSlotId} em ${timeSlotData.city}/${timeSlotData.state} não bate com demanda em ${shiftNewData.city}/${shiftNewData.state}`, { structuredData: true });
            continue;
        }

        logger.info(`v2: MATCH POTENCIAL: Demanda ${requirementId} com TimeSlot ${timeSlotId} (Dr. ${timeSlotData.doctorName})`, { structuredData: true });
        
        const newMatchRef = db.collection("potentialMatches").doc(); // Gera ID automático
        const newPotentialMatchData: Omit<PotentialMatchInput, "id"> = { // 'id' é gerado pelo .doc()
          shiftRequirementId: requirementId,
          hospitalId: shiftNewData.hospitalId, hospitalName: shiftNewData.hospitalName,
          shiftRequirementDates: shiftNewData.dates, 
          shiftRequirementStartTime: shiftNewData.startTime, shiftRequirementEndTime: shiftNewData.endTime, shiftRequirementIsOvernight: shiftNewData.isOvernight,
          shiftRequirementServiceType: shiftNewData.serviceType, shiftRequirementSpecialties: shiftNewData.specialtiesRequired,
          offeredRateByHospital: shiftNewData.offeredRate, shiftRequirementNotes: shiftNewData.notes,
          numberOfVacanciesInRequirement: shiftNewData.numberOfVacancies,
          timeSlotId: timeSlotId, doctorId: timeSlotData.doctorId, doctorName: timeSlotData.doctorName,
          timeSlotDate: timeSlotData.date, timeSlotStartTime: timeSlotData.startTime, timeSlotEndTime: timeSlotData.endTime, timeSlotIsOvernight: timeSlotData.isOvernight,
          doctorDesiredRate: timeSlotData.desiredHourlyRate, doctorSpecialties: timeSlotData.specialties, doctorServiceType: timeSlotData.serviceType,
          status: 'PENDING_BACKOFFICE_REVIEW',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        batch.set(newMatchRef, newPotentialMatchData);
        matchesFoundCount++;
        processedTimeSlotIdsForThisRun.add(timeSlotId);
      }

      if (matchesFoundCount > 0) {
        await batch.commit();
        logger.info(`v2: Criados ${matchesFoundCount} PotentialMatch(es) para a Demanda ${requirementId}.`, { structuredData: true });
      } else {
        logger.info(`v2: Nenhum match final encontrado para a Demanda ${requirementId} após filtros detalhados.`, { structuredData: true });
      }

    } catch (error) {
      logger.error(`v2: Erro ao processar ShiftRequirement ${requirementId} para matches:`, error, { structuredData: true });
    }
    return; // Funções v2 geralmente retornam void ou Promise<void>
  });