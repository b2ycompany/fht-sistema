// functions/src/index.ts (Versão CORRIGIDA E DEFINITIVA)

import {
    onDocumentWritten,
    onDocumentDeleted,
    onDocumentCreated, // <<< Importado para o gatilho de IA
    FirestoreEvent,
    Change,
    DocumentSnapshot
} from "firebase-functions/v2/firestore";
import {
    onCall,
    CallableRequest, // <<< Agora é usado
    HttpsOptions
} from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin"; // <<< Este é o 'admin' do Firebase
import * as functions from "firebase-functions/v1";
import { UserRecord } from "firebase-admin/auth";
import * as logic from "./logic"; // Importa toda a lógica

// Inicialização (como estava no seu arquivo original)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Configurações Globais
setGlobalOptions({ region: "us-central1", memory: "128MiB" });

const corsPolicy = [
    "https://fhtgestao.com.br",
    "https://www.fhtgestao.com.br",
    "https://fht-sistema.web.app",
    "https://fht-sistema.firebaseapp.com",
    "http://localhost:3000"
];

const defaultOnCallOptions: HttpsOptions = {
    cors: corsPolicy,
    memory: "256MiB"
};

// ===================================================================================
// === GRUPOS DE FUNÇÕES V2
// ===================================================================================

// Grupo 1: Funções relacionadas a Usuários e Autenticação (V2)
export const users = {
    finalizeRegistration: onCall({ ...defaultOnCallOptions, memory: "512MiB", timeoutSeconds: 300 }, 
        (req: CallableRequest) => logic.finalizeRegistrationHandler(req)
    ),
    createStaff: onCall({ ...defaultOnCallOptions, memory: "256MiB" }, 
        (req: CallableRequest) => logic.createStaffUserHandler(req)
    ),
    confirmSetup: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.confirmUserSetupHandler(req)
    ),
    associateDoctor: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.associateDoctorToUnitHandler(req)
    ),
    searchAssociatedDoctors: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.searchAssociatedDoctorsHandler(req)
    ),
    onWrittenSetClaims: onDocumentWritten({ document: "users/{userId}", memory: "256MiB" }, 
        (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { userId: string }>) => logic.onUserWrittenSetClaimsHandler(event)
    ),
    resetStaffUserPassword: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.resetStaffUserPasswordHandler(req)
    ),
    createDoctorUser: onCall({ ...defaultOnCallOptions, memory: "256MiB" }, 
        (req: CallableRequest) => logic.createDoctorUserHandler(req)
    ),
    resetDoctorUserPassword: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.resetDoctorUserPasswordHandler(req)
    ),
};

// Grupo 2: Funções de Administração (V2)
// <<< CORREÇÃO: Renomeado de 'admin' para 'adminTools' para evitar conflito >>>
export const adminTools = {
    setAdminClaim: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.setAdminClaimHandler(req)
    ),
    approveDoctor: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.approveDoctorHandler(req)
    ),
    setHospitalManagerRole: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.setHospitalManagerRoleHandler(req)
    )
};

// Grupo 3: Funções de Geração de Documentos (V2)
export const documents = {
    generateContractPdf: onCall({ ...defaultOnCallOptions, memory: "512MiB" }, 
        (req: CallableRequest) => logic.generateContractPdfHandler(req)
    ),
    generatePrescriptionPdf: onCall({ ...defaultOnCallOptions, memory: "512MiB" }, 
        (req: CallableRequest) => logic.generatePrescriptionPdfHandler(req)
    ),
    generateDocumentPdf: onCall({ ...defaultOnCallOptions, memory: "512MiB" }, 
        (req: CallableRequest) => logic.generateDocumentPdfHandler(req)
    )
};

// Grupo 4: Agendamentos e Matching de Plantões (V2)
export const scheduling = {
    createAppointment: onCall({ ...defaultOnCallOptions, secrets: ["DAILY_APIKEY"] }, 
        (req: CallableRequest) => logic.createAppointmentHandler(req)
    ),
    onShiftRequirementWrite: onDocumentWritten({ document: "shiftRequirements/{requirementId}" }, 
        (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>) => logic.findMatchesOnShiftRequirementWriteHandler(event)
    ),
    onShiftRequirementDelete: onDocumentDeleted("shiftRequirements/{requirementId}", 
        (event: FirestoreEvent<DocumentSnapshot | undefined, { requirementId: string }>) => logic.onShiftRequirementDeleteHandler(event)
    ),
    onTimeSlotDelete: onDocumentDeleted("doctorTimeSlots/{timeSlotId}", 
        (event: FirestoreEvent<DocumentSnapshot | undefined, { timeSlotId: string }>) => logic.onTimeSlotDeleteHandler(event)
    ),
    findAvailableDoctor: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.findAvailableDoctorHandler(req) // <<< CORRIGIDO (Garante que está exportado em logic.ts)
    ),
};

// Grupo 5: Operações (Ponto, Contratos, Telemedicina) (V2)
export const operations = {
    registerTimeRecord: onCall({ ...defaultOnCallOptions, memory: "512MiB" }, 
        (req: CallableRequest) => logic.registerTimeRecordHandler(req)
    ),
    registerCheckout: onCall({ ...defaultOnCallOptions, memory: "512MiB" }, 
        (req: CallableRequest) => logic.registerCheckoutHandler(req)
    ),
    createTelemedicineRoomForContract: onCall({ ...defaultOnCallOptions, secrets: ["DAILY_APIKEY"] }, 
        (req: CallableRequest) => logic.createTelemedicineRoomHandler(req)
    ),
    createTelemedicineRoomForConsultation: onCall({ ...defaultOnCallOptions, secrets: ["DAILY_APIKEY"] }, 
        (req: CallableRequest) => logic.createConsultationRoomHandler(req)
    ),
    recordBillingItem: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.recordBillingItemHandler(req) // <<< CORRIGIDO (Garante que está exportado em logic.ts)
    ),
    onContractFinalizedUpdateRequirement: onDocumentWritten("contracts/{contractId}", 
        (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { contractId: string }>) => logic.onContractFinalizedUpdateRequirementHandler(event)
    ),
    onContractFinalizedLinkDoctor: onDocumentWritten("contracts/{contractId}", 
        (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { contractId: string }>) => logic.onContractFinalizedLinkDoctorHandler(event)
    ),
};

// Grupo 6: Scripts de Manutenção (V2)
export const scripts = {
    correctServiceType: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.correctServiceTypeCapitalizationHandler(req)
    ),
    migrateDoctorProfiles: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.migrateDoctorProfilesToUsersHandler(req)
    ),
    migrateHospitalProfile: onCall(defaultOnCallOptions, 
        (req: CallableRequest) => logic.migrateHospitalProfileToV2Handler(req)
    ),
};

// Grupo 7: Gatilho de IA (V2)
// <<< CORREÇÃO: Alterado de onDocumentWritten para onDocumentCreated >>>
export const analysis = {
     onAppointmentCreatedRunAIAnalysis: onDocumentCreated( // <<< CORRIGIDO
        { 
            document: "appointments/{appointmentId}",
            memory: "256MiB"
        },
        (event: FirestoreEvent<DocumentSnapshot | undefined, { appointmentId: string }>) => // <<< Tipo de evento correto
            logic.onAppointmentCreated_RunAIAnalysis(event)
    ),
};

// ===================================================================================
// === GATILHO V1 (Exportado Separadamente)
// ===================================================================================
export const onUserDeletedCleanup = functions.region("us-central1").auth.user().onDelete(
    (user: UserRecord) => logic.onUserDeletedCleanupHandler(user)
);