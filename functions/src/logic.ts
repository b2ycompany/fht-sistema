// functions/src/logic.ts (Versão Completa e Corrigida)
import { HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { UserRecord } from "firebase-admin/auth";
import { Change } from "firebase-functions";
// 'limit' não é importado aqui, é um método de Query
// 'Timestamp' foi adicionado para a nova função de busca de horários
import { DocumentSnapshot, FieldValue, getFirestore, Query, GeoPoint, DocumentData, Timestamp } from "firebase-admin/firestore"; 
import { getStorage } from "firebase-admin/storage";
import { FirestoreEvent } from "firebase-functions/v2/firestore";
import { v4 as uuidv4 } from 'uuid';

// --- INICIALIZAÇÃO SEGURA ---
// Garante que o app Firebase seja inicializado ANTES de qualquer outra coisa
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// --- INTERFACES E TIPOS (Sem alterações) ---
interface UserProfile extends DocumentData {
    uid: string;
    userType: 'doctor' | 'hospital' | 'admin' | 'receptionist' | 'triage_nurse' | 'caravan_admin';
    displayName?: string;
    displayName_lowercase?: string;
    email?: string;
    professionalCrm?: string;
    specialties?: string[];
    healthUnitIds?: string[];
    hospitalId?: string;
    status?: 'INVITED' | 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED';
    invitationToken?: string;
    createdAt?: FieldValue;
    updatedAt?: FieldValue;
}
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


// --- SERVIÇOS DO FIREBASE (INICIALIZAÇÃO PREGUIÇOSA) ---
// CORREÇÃO: Constantes globais removidas.
// Criamos funções "getter" para inicializar os serviços apenas quando chamados.
const getDb = () => getFirestore();
const getAuth = () => admin.auth();
const getStorageBucket = () => getStorage().bucket(); // Assumindo um bucket padrão


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
    const batch = getDb().batch(); // USA getDb()
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
// (Todas as funções foram atualizadas para usar getDb(), getAuth() e getStorageBucket())

export const createStaffUserHandler = async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Apenas utilizadores autenticados podem adicionar membros à equipa.");
    }
    const callerUid = request.auth.uid;
    logger.info(`Iniciando criação de staff. Chamado por: ${callerUid}`);
    try {
        const callerDoc = await getDb().collection("users").doc(callerUid).get();
        if (!callerDoc.exists) {
            logger.error(`PERFIL NÃO ENCONTRADO para o chamador: ${callerUid}`);
            throw new HttpsError("not-found", "O seu perfil de utilizador não foi encontrado.");
        }
        const callerProfile = callerDoc.data();
        const allowedRoles = ['hospital', 'admin'];
        if (!callerProfile || !allowedRoles.includes(callerProfile.userType)) {
            logger.error(`PERMISSÃO NEGADA para ${callerUid}. Role encontrada: '${callerProfile?.userType}'`);
            throw new HttpsError("permission-denied", "Você não tem permissão para realizar esta ação.");
        }
        logger.info(`Permissão validada para ${callerUid}. Role: ${callerProfile.userType}`);
        const { name, email, userType, hospitalId } = request.data;
        if (!name || !email || !userType || !hospitalId) {
            logger.error("Dados de entrada inválidos.", request.data);
            throw new HttpsError("invalid-argument", "Nome, email, função e ID da unidade são obrigatórios.");
        }
        const temporaryPassword = `fht-${Math.random().toString(36).slice(2, 10)}`;
        const userRecord = await getAuth().createUser({
            email: email,
            emailVerified: true,
            displayName: name,
            password: temporaryPassword,
            disabled: false,
        });
        logger.info(`Utilizador de autenticação criado com sucesso para ${email} com UID ${userRecord.uid}`);
        const userProfile = {
            displayName: name,
            displayName_lowercase: name.toLowerCase(),
            email: email,
            userType: userType,
            hospitalId: hospitalId,
            status: 'ACTIVE' as const,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };
        await getDb().collection("users").doc(userRecord.uid).set(userProfile);
        logger.info(`SUCESSO: Funcionário ${userRecord.uid} criado para o hospital ${hospitalId}.`);
        return {
            success: true,
            user: { uid: userRecord.uid, ...userProfile },
            temporaryPassword: temporaryPassword
        };
    } catch (error: any) {
        logger.error(`!!! ERRO CRÍTICO ao criar profissional para o chamador ${callerUid} !!!`, { error: error.message, data: request.data });
        if (error instanceof HttpsError) throw error;
        if (error.code === 'auth/email-already-exists') {
            throw new HttpsError("already-exists", "Este endereço de e-mail já está em uso.");
        }
        throw new HttpsError("internal", "Ocorreu um erro inesperado no servidor. Contacte o suporte.");
    }
};

export const createDoctorUserHandler = async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Apenas utilizadores autenticados podem adicionar médicos.");
    }
    const callerUid = request.auth.uid; // Este é o hospitalId
    try {
        const callerDoc = await getDb().collection("users").doc(callerUid).get();
        if (!callerDoc.exists || callerDoc.data()?.userType !== 'hospital') {
            throw new HttpsError("permission-denied", "Apenas gestores de unidade podem realizar esta ação.");
        }
        const { name, email } = request.data;
        if (!name || !email) {
            throw new HttpsError("invalid-argument", "Nome e email do médico são obrigatórios.");
        }
        const temporaryPassword = `fht-med-${Math.random().toString(36).slice(2, 8)}`;
        const userRecord = await getAuth().createUser({
            email: email,
            emailVerified: true,
            displayName: name,
            password: temporaryPassword,
            disabled: false,
        });
        const userProfile = {
            displayName: name,
            displayName_lowercase: name.toLowerCase(),
            email: email,
            userType: 'doctor',
            healthUnitIds: [callerUid], // Vincula o médico ao hospital que o criou
            status: 'PENDING_APPROVAL' as const, // Médicos precisam de aprovação do admin
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };
        await getDb().collection("users").doc(userRecord.uid).set(userProfile);
        logger.info(`SUCESSO: Médico ${userRecord.uid} criado e vinculado ao hospital ${callerUid}.`);
        return {
            success: true,
            user: { uid: userRecord.uid, ...userProfile },
            temporaryPassword: temporaryPassword
        };
    } catch (error: any) {
        logger.error(`!!! ERRO CRÍTICO ao criar médico para o chamador ${callerUid} !!!`, { error: error.message, data: request.data });
        if (error.code === 'auth/email-already-exists') {
            throw new HttpsError("already-exists", "Um utilizador com este e-mail já existe. Use a função 'Buscar Médico'.");
        }
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao criar o médico.");
    }
};

export const resetDoctorUserPasswordHandler = async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Apenas utilizadores autenticados podem resetar senhas.");
    }
    const callerUid = request.auth.uid;
    const { doctorId } = request.data;
    if (!doctorId) {
        throw new HttpsError("invalid-argument", "O ID do médico é obrigatório.");
    }
    try {
        const doctorDoc = await getDb().collection("users").doc(doctorId).get();
        if (!doctorDoc.exists) throw new HttpsError("not-found", "Médico não encontrado.");
        
        const doctorProfile = doctorDoc.data();
        if (!doctorProfile?.healthUnitIds?.includes(callerUid)) {
            throw new HttpsError("permission-denied", "Você só pode resetar senhas de médicos vinculados à sua unidade.");
        }
        const newTemporaryPassword = `fht-med-reset-${Math.random().toString(36).slice(2, 8)}`;
        await getAuth().updateUser(doctorId, { password: newTemporaryPassword });
        logger.info(`Senha do médico ${doctorId} resetada com sucesso por ${callerUid}.`);
        return {
            success: true,
            newTemporaryPassword: newTemporaryPassword
        };
    } catch (error: any) {
        logger.error(`Falha ao resetar a senha do médico ${doctorId}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao resetar a senha.");
    }
};

export const finalizeRegistrationHandler = async (request: CallableRequest) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError("unauthenticated", "A função só pode ser chamada por um usuário autenticado.");
    }

    const { registrationPayload, tempFilePaths, role } = request.data;
    let profileData = registrationPayload;

    if (!profileData || !role || !tempFilePaths) {
        throw new HttpsError("invalid-argument", "Dados de registo incompletos.");
    }
    
    logger.info(`[${uid}] Iniciando finalização de registro para role: ${role}`);

    // Garante a estrutura de dados correta para hospitais
    if (role === 'hospital') {
        const { cnpj, stateRegistration, phone, address, legalRepresentativeInfo, ...rest } = profileData;
        profileData = {
            ...rest,
            companyInfo: { 
                cnpj,
                stateRegistration,
                phone,
                address
            },
            legalRepresentativeInfo
        };
        logger.info(`[${uid}] Estrutura de dados do hospital criada com sucesso.`);
    }

    const finalFileUrls: any = { documents: {}, specialistDocuments: {}, hospitalDocs: {}, legalRepDocuments: {} };

    try {
        // Passo 1: Definir as permissões (claims). É o passo mais crítico.
        try {
            logger.info(`[${uid}] Tentando definir a claim de role: '${role}'...`);
            await getAuth().setCustomUserClaims(uid, { role: role });
            logger.info(`[${uid}] SUCESSO: Claim '${role}' definida para o utilizador.`);
        } catch (claimError) {
            logger.error(`[${uid}] !!! FALHA CRÍTICA ao definir a claim de role !!!`, claimError);
            throw new HttpsError("internal", "Falha ao definir as permissões do usuário. Tente novamente.");
        }

        // Passo 2: Mover arquivos do bucket temporário para o permanente.
        const bucket = getStorageBucket();
        const movePromises = Object.entries(tempFilePaths).map(async ([key, tempPath]) => {
            if (typeof tempPath !== 'string' || tempPath === '') return;
            const tempFile = bucket.file(tempPath as string);
            const fileName = (tempPath as string).split('/').pop();
            let finalPath = '';
            const pathParts = key.split('_'); 
            const docType = pathParts[0];
            const docKey = pathParts[1];
            if (docType === "hospitalDocs") finalPath = `hospital_documents/${uid}/${fileName}`;
            else if (docType === "legalRepDocuments") finalPath = `hospital_documents/${uid}/legal_rep/${fileName}`;
            else if (docType === "documents") finalPath = `doctor_documents/${uid}/${fileName}`;
            else if (docType === "specialistDocuments") finalPath = `doctor_documents/${uid}/specialist/${fileName}`;
            else return; 
            const finalFile = bucket.file(finalPath);
            await tempFile.move(finalPath);
            const [publicUrl] = await finalFile.getSignedUrl({ action: 'read', expires: '03-09-2491' });
            if (docType === "hospitalDocs") finalFileUrls.hospitalDocs[docKey] = publicUrl;
            else if (docType === "legalRepDocuments") finalFileUrls.legalRepDocuments[docKey] = publicUrl;
            else if (docType === "documents") finalFileUrls.documents[docKey] = publicUrl;
            else if (docType === "specialistDocuments") finalFileUrls.specialistDocuments[docKey] = publicUrl;
        });

        await Promise.all(movePromises);
        logger.info(`[${uid}] Arquivos movidos com sucesso do bucket temporário para o final.`);

        // Passo 3: Montar e salvar o perfil final no Firestore.
        const finalProfileData = {
            ...profileData,
            ...finalFileUrls, 
            uid: uid,   
            userType: role,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            status: role === 'doctor' ? 'PENDING_APPROVAL' : 'ACTIVE'
        };

        await getDb().collection("users").doc(uid).set(finalProfileData);
        logger.info(`[${uid}] Perfil completo do utilizador salvo com sucesso no Firestore.`);

        // Passo 4: Limpar a pasta temporária de uploads.
        if (tempFilePaths && Object.values(tempFilePaths).length > 0) {
            const firstPath = Object.values(tempFilePaths)[0] as string;
            const uploadId = firstPath.split('/')[1];
            if (uploadId) {
                await bucket.deleteFiles({ prefix: `tmp_uploads/${uploadId}/` });
                logger.info(`[${uid}] Pasta temporária 'tmp_uploads/${uploadId}/' limpa com sucesso.`);
            }
        }
        
        logger.info(`[${uid}] Processo de finalização de registro concluído com sucesso.`);
        return { success: true, userId: uid, role: role };

    } catch (error: any) {
        logger.error(`[${uid}] !!! ERRO INESPERADO no processo de finalização de registro !!!`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao finalizar o registo. Verifique os logs.");
    }
};


export const onUserWrittenSetClaimsHandler = async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { userId: string }>) => {
    const change = event.data;
    if (!change) {
        logger.error("Evento de escrita de utilizador inválido.");
        return;
    }

    const dataAfter = change.after.data() as UserProfile | undefined;
    const dataBefore = change.before?.data() as UserProfile | undefined;
    
    if (!dataAfter) {
        logger.info(`Utilizador ${event.params.userId} foi apagado, nenhuma ação de claims a ser tomada.`);
        return;
    }

    if (dataAfter.userType && dataAfter.userType !== dataBefore?.userType) {
        const userId = event.params.userId;
        const { userType, hospitalId, displayName, invitationToken } = dataAfter;

        logger.info(`userType definido/alterado para '${userType}' para o utilizador ${userId}. A definir claims.`);

        if (userType === 'doctor' && invitationToken) {
            const invitationsRef = getDb().collection("invitations");
            const q = invitationsRef.where("token", "==", invitationToken).where("status", "==", "pending");
            const querySnapshot = await q.get();

            if (!querySnapshot.empty) {
                const invitationDoc = querySnapshot.docs[0];
                const invHospitalId = invitationDoc.data().hospitalId;
                await change.after.ref.update({
                    healthUnitIds: FieldValue.arrayUnion(invHospitalId),
                    status: 'PENDING_APPROVAL'
                });
                await invitationDoc.ref.update({ status: 'completed' });
                logger.info(`Médico ${userId} vinculado ao hospital ${invHospitalId} via convite.`);
            }
        }

        const claims = { role: userType, hospitalId: hospitalId || null };
        const profileUpdate: { displayName_lowercase?: string } = {};
        if (displayName) {
            profileUpdate.displayName_lowercase = displayName.toLowerCase();
        }

        try {
            await getAuth().setCustomUserClaims(userId, claims);
            logger.info(`Claims definidos com sucesso para o utilizador ${userId}:`, claims);

            if (Object.keys(profileUpdate).length > 0 && profileUpdate.displayName_lowercase !== dataBefore?.displayName_lowercase) {
                await change.after.ref.update(profileUpdate);
                logger.info(`Perfil do utilizador ${userId} atualizado com campo de busca.`);
            }
        } catch (error) {
            logger.error(`Falha ao finalizar configuração do utilizador ${userId}:`, error);
        }
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
      let timeSlotsQuery: Query = getDb().collection("doctorTimeSlots")
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

      const batch = getDb().batch();
      let matchesCreatedCount = 0;

      for (const timeSlotDoc of finalCandidates) {
        const timeSlot = timeSlotDoc.data() as TimeSlotData;

        if (!doIntervalsOverlap(timeToMinutes(timeSlot.startTime), timeToMinutes(timeSlot.endTime), timeSlot.isOvernight, timeToMinutes(requirement.startTime), timeToMinutes(requirement.endTime), requirement.isOvernight)) {
          continue;
        }

        const matchedDate = requirement.dates.find((reqDate) => reqDate.isEqual(timeSlot.date))!;
        if (!matchedDate) continue;

        const deterministicMatchId = `${event.params.requirementId}_${timeSlotDoc.id}_${matchedDate.seconds}`;
        const matchRef = getDb().collection("potentialMatches").doc(deterministicMatchId);

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
    const q = getDb().collection("potentialMatches").where("shiftRequirementId", "==", requirementId).where("status", "==", "PENDING_BACKOFFICE_REVIEW");
    return deleteQueryBatch(q, `matches para a demanda ${requirementId}`);
};

export const onTimeSlotDeleteHandler = async (event: FirestoreEvent<DocumentSnapshot | undefined, { timeSlotId: string }>) => {
    const { timeSlotId } = event.params;
    logger.info(`Disponibilidade ${timeSlotId} deletada. Removendo matches pendentes.`);
    const q = getDb().collection("potentialMatches").where("timeSlotId", "==", timeSlotId).where("status", "==", "PENDING_BACKOFFICE_REVIEW");
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
        const contractRef = getDb().collection("contracts").doc(contractId);
        const contractSnap = await contractRef.get();
        if (!contractSnap.exists) {
            throw new HttpsError("not-found", "Contrato não encontrado.");
        }
        const contractData = contractSnap.data()!;
        const doctorProfileSnap = await getDb().collection("users").doc(contractData.doctorId).get();
        const hospitalProfileSnap = await getDb().collection("users").doc(contractData.hospitalId).get();
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
        const bucket = getStorageBucket();
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

        const contractRef = getDb().collection("contracts").doc(contractId);
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

    const batch = getDb().batch();
    let updatedCount = { contracts: 0, shiftRequirements: 0, doctorTimeSlots: 0 };
    const incorrectValue = "telemedicina";
    const correctValue = "Telemedicina";

    try {
        const contractsQuery = getDb().collection("contracts").where("serviceType", "==", incorrectValue);
        const contractsSnapshot = await contractsQuery.get();
        contractsSnapshot.forEach(doc => {
            batch.update(doc.ref, { serviceType: correctValue });
            updatedCount.contracts++;
        });
        logger.info(`Encontrados ${updatedCount.contracts} documentos para corrigir em 'contracts'.`);

        const shiftsQuery = getDb().collection("shiftRequirements").where("serviceType", "==", incorrectValue);
        const shiftsSnapshot = await shiftsQuery.get();
        shiftsSnapshot.forEach(doc => {
            batch.update(doc.ref, { serviceType: correctValue });
            updatedCount.shiftRequirements++;
        });
        logger.info(`Encontrados ${updatedCount.shiftRequirements} documentos para corrigir em 'shiftRequirements'.`);
        
        const timeSlotsQuery = getDb().collection("doctorTimeSlots").where("serviceType", "==", incorrectValue);
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

    } catch (error: any) {
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
        page.drawText(crmText, { x: (width - crmTextWidth) / 2, y: signatureY - 30, font: font, size: 11 });
        
        const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        page.drawText(`Data: ${date}`, { x: 50, y: 50, font: font, size: 10 });

        const pdfBytes = await pdfDoc.save();
        
        const prescriptionsRef = getDb().collection('prescriptions').doc();
        
        const bucket = getStorageBucket();
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

        const consultationRef = getDb().collection('consultations').doc(consultationId);
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
        page.drawText(crmText, { x: (width - crmTextWidth) / 2, y: signatureY - 30, font: font, size: 11 });
        page.drawText(date, { x: 50, y: 50, font: font, size: 10 });

        const pdfBytes = await pdfDoc.save();
        const documentsRef = getDb().collection('documents').doc();
        
        const bucket = getStorageBucket();
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
        const requirementRef = getDb().collection("shiftRequirements").doc(shiftRequirementId);
        
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
        const contractRef = getDb().collection("contracts").doc(contractId);
        const contractSnap = await contractRef.get();
        if (!contractSnap.exists || contractSnap.data()?.doctorId !== doctorId) {
            throw new HttpsError("not-found", "Contrato não encontrado ou não pertence a este médico.");
        }
        
        const hospitalId = contractSnap.data()?.hospitalId;
        const recordId = `${contractId}_${doctorId}`;

        const bucket = getStorageBucket();
        const filePath = `timeRecords/${recordId}_checkin.jpg`;
        const file = bucket.file(filePath);
        const buffer = Buffer.from(photoBase64.replace(/^data:image\/jpeg;base64,/, ""), 'base64');
        
        await file.save(buffer, { metadata: { contentType: "image/jpeg" } });
        const [photoUrl] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });
        
        logger.info(`Foto de check-in salva em: ${photoUrl}`);

        const timeRecordRef = getDb().collection("timeRecords").doc(recordId);
        const newRecordData: TimeRecord = {
            contractId,
            doctorId,
            hospitalId,
            checkInTime: FieldValue.serverTimestamp(),
            checkInLocation: new GeoPoint(latitude, longitude),
            checkInPhotoUrl: photoUrl,
            status: 'IN_PROGRESS',
        };

        const batch = getDb().batch();
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
        const timeRecordRef = getDb().collection("timeRecords").doc(recordId);
        const recordSnap = await timeRecordRef.get();

        if (!recordSnap.exists || recordSnap.data()?.status !== 'IN_PROGRESS') {
            throw new HttpsError("failed-precondition", "Nenhum check-in em andamento foi encontrado para este plantão.");
        }

        const bucket = getStorageBucket();
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

        const contractRef = getDb().collection("contracts").doc(contractId);

        const batch = getDb().batch();
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
    if (request.auth?.token?.role !== 'admin') {
        throw new HttpsError("permission-denied", "Apenas administradores podem executar esta ação.");
    }

    const { email } = request.data;
    if (!email) {
        throw new HttpsError("invalid-argument", "O email do usuário é obrigatório.");
    }

    try {
        const user = await getAuth().getUserByEmail(email);
        await getAuth().setCustomUserClaims(user.uid, { role: 'admin' });
        
        logger.info(`Sucesso! O usuário ${email} (UID: ${user.uid}) agora tem a role de 'admin'.`);
        return { message: `Sucesso! ${email} agora é um administrador.` };

    } catch (error: any) {
        logger.error("Erro ao definir custom claim de admin:", error);
        throw new HttpsError("internal", error.message);
    }
};

export const confirmUserSetupHandler = async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Utilizador não autenticado.");
    }

    const userId = request.auth.uid;
    const userRef = getDb().collection("users").doc(userId);

    try {
        const userDoc = await userRef.get();
        if (userDoc.exists && userDoc.data()?.status === 'INVITED') {
            await userRef.update({
                status: 'ACTIVE',
                updatedAt: FieldValue.serverTimestamp(),
            });
            return { success: true, message: "Status do utilizador atualizado para ativo." };
        }
        return { success: false, message: "Nenhuma ação necessária." };
    } catch (error) {
        logger.error(`Falha ao confirmar o acesso do utilizador ${userId}:`, error);
        throw new HttpsError("internal", "Não foi possível atualizar o status do utilizador.");
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

    const consultationRef = getDb().collection("consultations").doc(consultationId);
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

// ============================================================================
// 🔹 `createAppointmentHandler` (Com retorno do roomUrl) 🔹
// ============================================================================
export const createAppointmentHandler = async (request: CallableRequest) => {
    const fetch = (await import("node-fetch")).default;
    
    // <<< VERIFICAÇÃO DE AUTH REMOVIDA >>>
    
    const { patientName, patientId, doctorId, doctorName, specialty, appointmentDate, type } = request.data;
    
    if (!patientName || !doctorId || !doctorName || !specialty || !appointmentDate || !type) {
        throw new HttpsError("invalid-argument", "Dados para o agendamento estão incompletos.");
    }
    
    let roomUrl = null;
    if (type === 'Telemedicina') {
        const DAILY_API_KEY = process.env.DAILY_APIKEY;
        if (!DAILY_API_KEY) throw new HttpsError("internal", "Configuração do servidor de vídeo incompleta.");
        const expirationDate = new Date(appointmentDate);
        const expirationTimestamp = Math.round((expirationDate.getTime() + 2 * 60 * 60 * 1000) / 1000); // Expira em 2 horas
        const roomOptions = { properties: { exp: expirationTimestamp, enable_chat: true } };
        const apiResponse = await fetch("https://api.daily.co/v1/rooms", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DAILY_API_KEY}` },
            body: JSON.stringify(roomOptions),
        });
        if (!apiResponse.ok) throw new HttpsError("internal", "Falha ao criar a sala de videochamada.");
        const roomData: any = await apiResponse.json();
        roomUrl = roomData.url;
    }

    const appointmentData = {
        patientName, 
        patientId: patientId || null,
        doctorId, doctorName, specialty, type,
        appointmentDate: admin.firestore.Timestamp.fromDate(new Date(appointmentDate)),
        status: "SCHEDULED",
        telemedicineRoomUrl: roomUrl, // O link é salvo no documento
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: request.auth?.uid || "public_portal", 
    };

    const docRef = await getDb().collection("appointments").add(appointmentData);
    logger.info(`Agendamento ${docRef.id} salvo com sucesso.`);
    
    // <<< CORREÇÃO: Retornando o roomUrl para o frontend >>>
    return { success: true, appointmentId: docRef.id, roomUrl: roomUrl };
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
        const doctorRef = getDb().collection('users').doc(doctorId);
        
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
            const doctorRef = getDb().collection('users').doc(doctorId);
            await doctorRef.update({
                healthUnitIds: FieldValue.arrayUnion(hospitalId)
            });
            logger.info(`Vínculo automático criado: Médico ${doctorId} associado à Unidade de Saúde ${hospitalId} via Contrato ${event.params.contractId}.`);
        } catch (error) {
            logger.error(`Falha ao criar vínculo automático para o Contrato ${event.params.contractId}:`, error);
        }
    }
};

export const migrateDoctorProfilesToUsersHandler = async (request: CallableRequest) => {
    if (request.auth?.token?.role !== 'admin') {
        throw new HttpsError("permission-denied", "Apenas administradores podem executar esta função.");
    }
    
    logger.info("Iniciando migração da coleção 'doctorProfiles' para 'users'.");
    
    try {
        const doctorProfilesRef = getDb().collection('doctorProfiles');
        const usersRef = getDb().collection('users');
        const snapshot = await doctorProfilesRef.get();

        if (snapshot.empty) {
            return { success: true, message: "Nenhum perfil encontrado em 'doctorProfiles' para migrar.", count: 0 };
        }

        const batch = getDb().batch();
        let migratedCount = 0;
        
        snapshot.forEach(doc => {
            const { professional, name, ...restOfData } = doc.data();
            const userId = doc.id;

            const newUserProfile = {
                ...restOfData,
                uid: userId,
                userType: 'doctor' as const,
                displayName: name || '',
                displayName_lowercase: name ? name.toLowerCase() : '',
                professionalCrm: professional?.crm || '',
                specialties: professional?.specialties || [],
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            const userDocRef = usersRef.doc(userId);
            batch.set(userDocRef, newUserProfile, { merge: true });
            migratedCount++;
        });

        await batch.commit();

        const message = `Migração concluída. ${migratedCount} perfis de médico foram migrados/atualizados para a coleção 'users'.`;
        logger.info(message);
        return { success: true, message: message, count: migratedCount };

    } catch (error) {
        logger.error("Erro crítico durante a migração de perfis de médico:", error);
        throw new HttpsError("internal", "Falha ao executar o script de migração.");
    }
};

export const searchAssociatedDoctorsHandler = async (request: CallableRequest) => {
    if (request.auth?.token?.role !== 'hospital') {
        throw new HttpsError("permission-denied", "Apenas gestores de unidade podem buscar médicos.");
    }

    const hospitalId = request.auth.uid;
    const { searchTerm, specialtiesFilter } = request.data;
    
    logger.info(`Hospital ${hospitalId} está a buscar médicos. Termo: '${searchTerm}', Especialidades:`, specialtiesFilter);

    try {
        let doctorsQuery: Query = getDb().collection('users').where('healthUnitIds', 'array-contains', hospitalId);
        
        if (specialtiesFilter && Array.isArray(specialtiesFilter) && specialtiesFilter.length > 0) {
            doctorsQuery = doctorsQuery.where('specialties', 'array-contains-any', specialtiesFilter);
        }

        const snapshot = await doctorsQuery.get();
        if (snapshot.empty) {
            logger.info(`Nenhum médico vinculado encontrado para o hospital ${hospitalId} com os filtros aplicados.`);
            return { success: true, doctors: [] };
        }

        let results: UserProfile[] = snapshot.docs.map(doc => ({
            ...(doc.data() as UserProfile),
            uid: doc.id,
        }));

        if (searchTerm && typeof searchTerm === 'string' && searchTerm.length > 0) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            results = results.filter(doctor => {
                const nameMatch = doctor.displayName_lowercase?.includes(lowerCaseSearchTerm);
                const crmMatch = doctor.professionalCrm?.toLowerCase().includes(lowerCaseSearchTerm);
                const emailMatch = doctor.email?.toLowerCase().includes(lowerCaseSearchTerm);
                return nameMatch || crmMatch || emailMatch;
            });
        }
        
        const finalDoctorsList = results.map(doc => ({
            uid: doc.uid,
            name: doc.displayName,
            crm: doc.professionalCrm,
            specialties: doc.specialties || [],
        }));

        return { success: true, doctors: finalDoctorsList };

    } catch (error) {
        logger.error(`Erro ao buscar médicos para o hospital ${hospitalId}:`, error);
        throw new HttpsError("internal", "Ocorreu um erro ao realizar a busca.");
    }
};

export const sendDoctorInvitationHandler = async (request: CallableRequest) => {
    if (request.auth?.token?.role !== 'hospital') {
        throw new HttpsError("permission-denied", "Apenas gestores de unidade podem convidar novos médicos.");
    }

    const { doctorEmail } = request.data;
    if (!doctorEmail) {
        throw new HttpsError("invalid-argument", "O email do médico é obrigatório.");
    }

    const hospitalId = request.auth.uid;
    const hospitalDoc = await getDb().collection('users').doc(hospitalId).get();
    const hospitalName = hospitalDoc.data()?.displayName || 'Uma unidade de saúde';

    try {
        await getAuth().getUserByEmail(doctorEmail);
        throw new HttpsError("already-exists", "Um utilizador com este e-mail já existe. Use a função 'Associar Médico'.");
    } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
            throw error;
        }
    }

    const token = uuidv4();
    const invitationLink = `https://fht-sistema.web.app/register?invitationToken=${token}`;

    await getDb().collection("invitations").add({
        hospitalId: hospitalId,
        hospitalName: hospitalName,
        doctorEmail: doctorEmail,
        token: token,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(`CONVITE GERADO para ${doctorEmail} pelo hospital ${hospitalName}. Link: ${invitationLink}`);

    return { success: true, message: `Convite enviado com sucesso para ${doctorEmail}.` };
};

export const approveDoctorHandler = async (request: CallableRequest) => {
    if (request.auth?.token?.role !== 'admin') {
        throw new HttpsError("permission-denied", "Apenas administradores podem aprovar cadastros.");
    }

    const { doctorId } = request.data;
    if (!doctorId) {
        throw new HttpsError("invalid-argument", "O ID do médico é obrigatório.");
    }

    try {
        const doctorRef = getDb().collection("users").doc(doctorId);
        await doctorRef.update({
            status: 'ACTIVE'
        });

        logger.info(`Médico ${doctorId} foi aprovado por um administrador.`);
        return { success: true, message: "Médico aprovado com sucesso." };

    } catch (error) {
        logger.error(`Falha ao aprovar médico ${doctorId}:`, error);
        throw new HttpsError("internal", "Não foi possível aprovar o cadastro do médico.");
    }
};

export const setHospitalManagerRoleHandler = async (request: CallableRequest) => {
    const { managerEmail } = request.data;
    if (!managerEmail) {
        throw new HttpsError("invalid-argument", "O email do gestor é obrigatório.");
    }

    logger.info(`Iniciando a atribuição da role 'hospital' para o gestor: ${managerEmail}`);

    try {
        const userRecord = await getAuth().getUserByEmail(managerEmail);

        await getAuth().setCustomUserClaims(userRecord.uid, {
            role: "hospital",
        });

        logger.info(`SUCESSO: Claim 'role: hospital' definida para o gestor ${managerEmail} (UID: ${userRecord.uid})`);
        
        return { success: true, message: `Permissão de gestor definida com sucesso para ${managerEmail}.` };

    } catch (error: any) {
        logger.error(`Erro ao definir a claim para o gestor ${managerEmail}:`, error);
        if (error.code === 'auth/user-not-found') {
            throw new HttpsError("not-found", `Nenhum utilizador encontrado com o email ${managerEmail}.`);
        }
        throw new HttpsError("internal", "Ocorreu um erro ao definir a permissão do gestor.");
    }
};

export const onUserDeletedCleanupHandler = async (user: UserRecord) => {
    const uid = user.uid;
    logger.info(`[Sintaxe V1] Utilizador de autenticação com UID: ${uid} foi excluído. A iniciar limpeza.`);
    
    const userDocRef = getDb().collection("users").doc(uid);
    
    try {
        await userDocRef.delete();
        logger.info(`Documento de perfil ${uid} em 'users' foi excluído com sucesso.`);
    } catch (error) {
        logger.error(`Falha ao excluir o documento de perfil ${uid} em 'users':`, error);
    }
    
    const hospitalDocRef = getDb().collection("hospitals").doc(uid);
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


// ============================================================================
// === FUNÇÕES ADICIONADAS PARA COMPLETAR A SOLUÇÃO
// ============================================================================

/**
 * @summary Migra um perfil de hospital da estrutura antiga para a nova (com companyInfo).
 * @description Esta função é chamada para corrigir perfis de hospitais existentes
 * que não possuem o objeto aninhado 'companyInfo'.
 * @param {string} hospitalId - O UID do usuário hospital a ser migrado.
 */
export const migrateHospitalProfileToV2Handler = async (request: CallableRequest) => {
    if (request.auth?.token?.role !== 'admin') {
        throw new HttpsError("permission-denied", "Apenas administradores podem executar esta migração.");
    }
    const { hospitalId } = request.data;
    if (!hospitalId) {
        throw new HttpsError("invalid-argument", "O ID do hospital é obrigatório.");
    }
    logger.info(`Iniciando migração de perfil para o Hospital ID: ${hospitalId}`);
    const userRef = getDb().collection("users").doc(hospitalId);
    try {
        await getDb().runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                throw new HttpsError("not-found", "Perfil de hospital não encontrado.");
            }
            const data = userDoc.data()!;
            if (data.companyInfo || !data.cnpj) {
                logger.info(`Perfil ${hospitalId} não necessita de migração.`);
                return;
            }
            transaction.update(userRef, {
                'companyInfo.cnpj': data.cnpj,
                'companyInfo.stateRegistration': data.stateRegistration || null,
                'companyInfo.phone': data.phone || null,
                'companyInfo.address': data.address || null,
                cnpj: FieldValue.delete(),
                stateRegistration: FieldValue.delete(),
                phone: FieldValue.delete(),
                address: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp()
            });
        });
        logger.info(`SUCESSO: Perfil do hospital ${hospitalId} foi migrado.`);
        return { success: true, message: `Perfil ${hospitalId} migrado com sucesso!` };
    } catch (error) {
        logger.error(`Falha CRÍTICA ao migrar o perfil ${hospitalId}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "Ocorreu um erro inesperado durante a migração.");
    }
};

/**
 * @summary Reseta a senha de um funcionário e retorna a nova senha temporária.
 * @description Chamada por um administrador de hospital para gerar uma nova senha
 * para um membro da sua equipe.
 * @param {string} staffUserId - O UID do funcionário cuja senha será resetada.
 */
export const resetStaffUserPasswordHandler = async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Apenas utilizadores autenticados podem resetar senhas.");
    }
    const callerUid = request.auth.uid;
    const callerDoc = await getDb().collection("users").doc(callerUid).get();
    const callerProfile = callerDoc.data();
    const allowedRoles = ['hospital', 'admin'];
    if (!callerProfile || !allowedRoles.includes(callerProfile.userType)) {
        throw new HttpsError("permission-denied", "Você não tem permissão para realizar esta ação.");
    }
    const { staffUserId } = request.data;
    if (!staffUserId) {
        throw new HttpsError("invalid-argument", "O ID do funcionário é obrigatório.");
    }
    try {
        const staffUserDoc = await getDb().collection("users").doc(staffUserId).get();
        if (!staffUserDoc.exists) {
            throw new HttpsError("not-found", "Funcionário não encontrado.");
        }
        const staffProfile = staffUserDoc.data();
        if (callerProfile.userType === 'hospital' && staffProfile?.hospitalId !== callerUid) {
            throw new HttpsError("permission-denied", "Você só pode resetar senhas de funcionários da sua própria unidade.");
        }
        const newTemporaryPassword = `fht-reset-${Math.random().toString(36).slice(2, 8)}`;
        logger.info(`Gerando nova senha para o usuário ${staffUserId} a pedido de ${callerUid}`);
        await getAuth().updateUser(staffUserId, {
            password: newTemporaryPassword,
        });
        logger.info(`Senha do usuário ${staffUserId} atualizada com sucesso.`);
        return {
            success: true,
            message: "Senha resetada com sucesso!",
            newTemporaryPassword: newTemporaryPassword
        };
    } catch (error: any) {
        logger.error(`Falha ao resetar a senha do usuário ${staffUserId}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao resetar a senha.");
    }
};


// ============================================================================
// === FUNÇÕES EXISTENTES (JÁ CORRIGIDAS NA ETAPA ANTERIOR) ===
// ============================================================================

/**
 * @summary Encontra um médico disponível para uma especialidade (Telemedicina).
 * @param {string} specialty - A especialidade médica desejada.
 */
export const findAvailableDoctorHandler = async (request: CallableRequest) => {
    const { specialty } = request.data;
    if (!specialty) {
        throw new HttpsError("invalid-argument", "A especialidade é obrigatória.");
    }
    logger.info(`Buscando médico para especialidade: ${specialty}`);

    try {
        // [CORREÇÃO] Sintaxe do Admin SDK (db.collection, .where, .limit, .get)
        const usersRef = getDb().collection("users");
        const q = usersRef
            .where("userType", "==", "doctor")
            .where("specialties", "array-contains", specialty)
            .where("status", "==", "ACTIVE")
            .limit(1); // CORREÇÃO: 'limit' é um método da query
        
        const snapshot = await q.get();

        if (snapshot.empty) {
            logger.warn(`Nenhum médico encontrado para a especialidade: ${specialty}`);
            throw new HttpsError("not-found", `Nenhum médico disponível para ${specialty} no momento.`);
        }

        const doctorDoc = snapshot.docs[0];
        const doctorData = doctorDoc.data();
        const doctorId = doctorDoc.id;
        const doctorName = doctorData.displayName || "Médico sem nome";

        logger.info(`Médico encontrado para ${specialty}: ${doctorName} (ID: ${doctorId})`);
        return { doctorId, doctorName };

    } catch (error: any) {
        logger.error(`Erro ao buscar médico disponível para ${specialty}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "Ocorreu um erro ao buscar um médico disponível.");
    }
};

/**
 * @summary Registra o uso de um material ou medicamento durante uma consulta.
 * @param {string} consultationId - ID da consulta.
 * @param {string} productId - ID do produto/medicamento (da coleção 'products').
 * @param {number} quantity - Quantidade utilizada.
 */
export const recordBillingItemHandler = async (request: CallableRequest) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Apenas utilizadores autenticados podem registrar itens.");
    }
    const { consultationId, productId, quantity } = request.data;
    if (!consultationId || !productId || !quantity || quantity <= 0) {
        throw new HttpsError("invalid-argument", "ID da consulta, ID do produto e quantidade válida são obrigatórios.");
    }
    const recordedByUid = request.auth.uid;
    logger.info(`[${consultationId}] Tentando registrar ${quantity}x do produto ${productId}.`);

    const consultationRef = getDb().collection("consultations").doc(consultationId);
    const productRef = getDb().collection("products").doc(productId);
    const billingItemsRef = consultationRef.collection("billingItems");

    try {
        const newBillingDocRef = await getDb().runTransaction(async (transaction) => {
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists) {
                throw new HttpsError("not-found", `Produto com ID ${productId} não encontrado no catálogo.`);
            }
            const productData = productDoc.data();
            const unitCost = productData?.costPerUnit;
            const productName = productData?.name || 'Nome Indisponível';

            if (typeof unitCost !== 'number' || unitCost < 0) {
                 throw new HttpsError("internal", `Custo inválido encontrado para o produto ${productId}.`);
            }
            
            const consultationDoc = await transaction.get(consultationRef);
            if (!consultationDoc.exists) {
                throw new HttpsError("not-found", `Consulta com ID ${consultationId} não encontrada.`);
            }
            const consultationData = consultationDoc.data();

            const itemTotalCost = unitCost * quantity;
            const newBillingItemData = {
                productId: productId,
                productName: productName,
                quantityUsed: quantity,
                unitCostAtTime: unitCost,
                totalCost: itemTotalCost,
                usedAt: FieldValue.serverTimestamp(),
                recordedByUid: recordedByUid,
            };

            const tempNewDocRef = billingItemsRef.doc();
            transaction.set(tempNewDocRef, newBillingItemData);

            const currentTotalCost = consultationData?.totalMaterialCost || 0;
            transaction.update(consultationRef, {
                totalMaterialCost: currentTotalCost + itemTotalCost,
                updatedAt: FieldValue.serverTimestamp()
            });
            
            return tempNewDocRef; 
        });

        logger.info(`[${consultationId}] Item ${newBillingDocRef.id} (Produto: ${productId}) registrado com sucesso.`);
        return { success: true, billingItemId: newBillingDocRef.id };

    } catch (error: any) {
        logger.error(`[${consultationId}] !!! ERRO CRÍTICO ao registrar item de faturamento (Produto: ${productId}) !!!`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "Ocorreu um erro inesperado ao registrar o item.");
    }
};


// ============================================================================
// === 🧠 NOVA FUNÇÃO DE GATILHO DA IA (FASE 1) 🧠 ===
// ============================================================================

/**
 * @summary Gatilho do Firestore para processar pré-avaliação por IA.
 * @description Esta função é disparada quando um novo agendamento ('appointments') é criado.
 * Ela verifica se é de telemedicina e, em caso afirmativo, chama uma IA para
 * gerar um relatório preliminar e o salva de volta no documento.
 */
export const onAppointmentCreated_RunAIAnalysis = async (
    event: FirestoreEvent<DocumentSnapshot | undefined, { appointmentId: string }>
) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.info(`[IA Gatilho] Documento de agendamento ${event.params.appointmentId} excluído ou inexistente, nenhuma ação tomada.`);
        return;
    }

    const appointment = snapshot.data() as DocumentData; // Usamos DocumentData por segurança
    const appointmentId = event.params.appointmentId;

    // 1. Verifica se é um agendamento novo e do tipo 'Telemedicina'
    // (Verifica também se o relatório já não existe, para evitar re-processamento)
    if (appointment.status !== 'SCHEDULED' || appointment.type !== 'Telemedicina' || appointment.aiAnalysisReport) {
        logger.info(`[IA Gatilho] Agendamento ${appointmentId} não é elegível para análise de IA (Status: ${appointment.status}, Tipo: ${appointment.type}, Relatório: ${!!appointment.aiAnalysisReport}).`);
        return;
    }

    logger.info(`[IA Gatilho] Iniciando pré-avaliação por IA para agendamento: ${appointmentId}, Especialidade: ${appointment.specialty}`);

    // --- Simulação da Chamada de IA ---
    // (Em uma implementação real, aqui é onde você chamaria a API do Gemini/OpenAI)
    // Passaríamos: appointment.patientId (para buscar histórico), appointment.specialty, etc.
    // ------------------------------------

    let aiReport = ""; // Relatório final da IA

    // Simulação de lógica de IA baseada na especialidade
    try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simula o tempo de processamento da IA

        const patientName = appointment.patientName || "Paciente";
        
        if (appointment.specialty && (appointment.specialty as string).toLowerCase().includes('psicologia')) {
            // Simula um relatório para Psicologia (ex: Protocolo TOC)
            aiReport = `Relatório Preliminar de Saúde Mental (Simulado):\n\nPaciente: ${patientName}\nEspecialidade: ${appointment.specialty}\n\nAnálise de Risco (Simulada):\n- Nenhum indicador de risco imediato detectado.\n\nProtocolo TOC (Simulação):\n- Paciente respondeu 'Sim' a 3 de 10 perguntas de triagem para TOC.\n- Sugestão: Investigar pensamentos obsessivos sobre limpeza e verificação.\n\nSugestão ao Médico:\n- Explorar queixa principal com foco em ansiedade e comportamentos repetitivos.\n- Avaliar histórico familiar de transtornos de ansiedade.`;
        } else if (appointment.specialty && (appointment.specialty as string).toLowerCase().includes('cardiologia')) {
            // Simula um relatório para Cardiologia
            aiReport = `Relatório Preliminar Cardiológico (Simulado):\n\nPaciente: ${patientName}\nEspecialidade: ${appointment.specialty}\n\nAnálise de Risco (Simulada):\n- (Assumindo dados de paciente) Paciente relata dor no peito esporádica.\n- Histórico familiar (simulado): Pai com hipertensão.\n\nSugestão ao Médico:\n- Verificar histórico de pressão arterial.\n- Perguntar sobre a frequência e intensidade da dor no peito.\n- Recomendar exames preliminares (ex: Eletrocardiograma), se ainda não realizados.`;
        } else {
            // Relatório genérico para outras especialidades
            aiReport = `Relatório Clínico Geral Preliminar (Simulado):\n\nPaciente: ${patientName}\nEspecialidade: ${appointment.specialty}\n\nAnálise de Risco (Simulada):\n- Triagem padrão. Nenhuma queixa principal registrada na pré-consulta.\n\nSugestão ao Médico:\n- Iniciar anamnese padrão para ${appointment.specialty}.`;
        }

        // Atualiza o documento do agendamento com o relatório da IA
        await snapshot.ref.update({
            aiAnalysisReport: aiReport,
            updatedAt: FieldValue.serverTimestamp()
        });

        logger.info(`[IA Gatilho] Sucesso! Relatório de IA salvo no agendamento ${appointmentId}.`);

    } catch (error) {
        logger.error(`[IA Gatilho] !!! ERRO ao processar análise de IA para ${appointmentId} !!!`, error);
        // Opcional: Salvar o erro no documento para o médico ver
        await snapshot.ref.update({
            aiAnalysisReport: `Falha ao gerar análise de IA: ${(error as Error).message}`
        });
    }
};

// ============================================================================
// 🔹 NOVA FUNÇÃO 1: `findOrCreatePatientHandler` (Cadastro do Paciente) 🔹
// ============================================================================
export const findOrCreatePatientHandler = async (request: CallableRequest) => {
    const { cpf, name, dob, phone, email } = request.data;
    if (!cpf || !name || !dob || !phone) {
        throw new HttpsError("invalid-argument", "Nome, CPF, Data de Nasc. e Telefone são obrigatórios.");
    }
    
    const patientsRef = getDb().collection("patients"); // Coleção separada para pacientes
    
    try {
        // 1. Tenta encontrar o paciente pelo CPF
        // <<< CORREÇÃO: Revertendo para a sintaxe encadeada (v8) do Admin SDK >>>
        const q = patientsRef.where("cpf", "==", cpf).limit(1);
        const snapshot = await q.get();

        if (!snapshot.empty) {
            // 2. Paciente encontrado, retorna o ID
            const existingPatient = snapshot.docs[0];
            logger.info(`Paciente encontrado (CPF: ${cpf}). ID: ${existingPatient.id}`);
            // Opcional: Atualizar dados do paciente se necessário
            await existingPatient.ref.update({
                name, dob, phone, email: email || null, updatedAt: FieldValue.serverTimestamp()
            });
            return { success: true, patientId: existingPatient.id, isNew: false };
        } else {
            // 3. Paciente não encontrado, cria um novo
            logger.info(`Nenhum paciente encontrado com CPF: ${cpf}. Criando novo...`);
            const newPatientRef = patientsRef.doc(); // Gera um ID automático
            const newPatientData = {
                id: newPatientRef.id,
                name, cpf, dob, phone, email: email || null,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            };
            await newPatientRef.set(newPatientData);
            logger.info(`Novo paciente criado. ID: ${newPatientRef.id}`);
            return { success: true, patientId: newPatientRef.id, isNew: true };
        }
    } catch (error: any) {
        logger.error(`Erro ao buscar ou criar paciente (CPF: ${cpf}):`, error);
        throw new HttpsError("internal", "Ocorreu um erro ao processar o cadastro do paciente.");
    }
};

// ============================================================================
// 🔹 NOVA FUNÇÃO 2: `getAvailableSlotsForSpecialtyHandler` (Agenda Real) 🔹
// ============================================================================
export const getAvailableSlotsForSpecialtyHandler = async (request: CallableRequest) => {
    const { specialty } = request.data;
    if (!specialty) {
        throw new HttpsError("invalid-argument", "A especialidade é obrigatória.");
    }

    logger.info(`Buscando horários reais para: ${specialty}`);
    
    try {
        const now = Timestamp.now();
        const slotsRef = getDb().collection("doctorTimeSlots");
        
        // <<< CORREÇÃO CRÍTICA (v3) >>>
        // O Firestore NÃO permite 'array-contains' e '>= (inequality)' na mesma query.
        // Vamos buscar todos os horários futuros disponíveis de Telemedicina
        // e FILTRAR a especialidade no backend (código).

        const q = slotsRef
            .where("status", "==", "AVAILABLE")
            .where("serviceType", "==", "Telemedicina") 
            .where("date", ">=", now)
            .orderBy("date", "asc")
            .limit(100); // Trazemos 100 para ter uma boa chance de encontrar a especialidade

        const snapshot = await q.get();

        if (snapshot.empty) {
            logger.warn(`Nenhum horário de telemedicina (de QUALQUER especialidade) encontrado.`);
            return { slots: [] };
        }

        // Agora, filtramos pela especialidade no código
        // <<< INÍCIO DA CORREÇÃO DE TIPO >>>
        const allSlots = snapshot.docs.map(doc => {
            return {
                id: doc.id,
                ...(doc.data() as TimeSlotData) // Explicitamente cast o data()
            };
        });
        // <<< FIM DA CORREÇÃO DE TIPO >>>

        // <<< INÍCIO DA CORREÇÃO DE CASE-SENSITIVITY >>>
        const lowerCaseSpecialty = specialty.toLowerCase();

        const specialtySlots = allSlots.filter(slot => {
            if (!slot.specialties || slot.specialties.length === 0) {
                return false;
            }
            // Converte o array do DB para minúsculas e verifica se inclui
            const lowerCaseDbSpecialties = slot.specialties.map(s => s.toLowerCase());
            return lowerCaseDbSpecialties.includes(lowerCaseSpecialty);
        });
        // <<< FIM DA CORREÇÃO DE CASE-SENSITIVITY >>>


        // Se filtrarmos tudo e não sobrar nada...
        if (specialtySlots.length === 0) {
             logger.warn(`Horários de telemedicina encontrados, mas nenhum para: ${specialty}`);
             return { slots: [] };
        }

        // Mapeia para o formato final
        const slots = specialtySlots.map(data => {
            return {
                id: data.id,
                doctorId: data.doctorId,
                doctorName: data.doctorName || "Médico",
                date: (data.date as Timestamp).toDate().toISOString(),
                startTime: data.startTime,
                endTime: data.endTime,
            };
        }).slice(0, 20); // Retorna os 20 primeiros encontrados

        logger.info(`Encontrados ${slots.length} horários para ${specialty}.`);
        return { slots };

    } catch (error: any) {
        logger.error(`Erro ao buscar horários para ${specialty}:`, error);
        
        if (error.code === 'failed-precondition') {
             // Este é o NOVO índice necessário
             const newIndexMessage = "O banco de dados precisa de um índice: doctorTimeSlots (status ASC, serviceType ASC, date ASC). Crie-o no link do console (F12).";
             logger.error(newIndexMessage); // Log no backend
             throw new HttpsError("failed-precondition", newIndexMessage); // Envia para o frontend
        }
        throw new HttpsError("internal", "Ocorreu um erro interno ao buscar horários.");
    }
};