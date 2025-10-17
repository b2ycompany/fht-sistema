// functions/src/index.ts

// --- IMPORTS ---
import { onDocumentWritten, onDocumentDeleted, FirestoreEvent } from "firebase-functions/v2/firestore";
import { onCall, CallableRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { UserRecord } from "firebase-admin/auth";
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-admin/firestore";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Configurações globais mantidas para as outras funções
setGlobalOptions({ 
    region: "us-central1", 
    memory: "128MiB",
    cpu: 1,
    minInstances: 0,
    concurrency: 80
});

// Política de CORS Centralizada
const corsPolicy = [
    "https://fhtgestao.com.br",
    "https://www.fhtgestao.com.br",
    "https://fht-sistema.web.app",
    "https://fht-sistema.firebaseapp.com",
    "http://localhost:3000" // Manter para desenvolvimento local
];

// ===================================================================================
// === FUNÇÕES CHAMÁVEIS PELO CLIENTE (onCall)
// ===================================================================================

// <<< NOVA FUNÇÃO ADICIONADA >>>
export const finalizeRegistration = onCall(
    { 
        cors: corsPolicy, 
        memory: "512MiB", // Damos mais memória a esta função crítica
        timeoutSeconds: 300 // E mais tempo para os uploads e processamento
    },
    (request: CallableRequest) => import("./logic").then(api => api.finalizeRegistrationHandler(request))
);

// --- Funções de Gestão e Admin ---
export const setAdminClaim = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.setAdminClaimHandler(request))
);

export const approveDoctor = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.approveDoctorHandler(request))
);

export const createStaffUser = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.createStaffUserHandler(request))
);

export const confirmUserSetup = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.confirmUserSetupHandler(request))
);

// REMOVIDO: A antiga função de convite foi substituída pela de criação direta
// export const sendDoctorInvitation = onCall({ cors: corsPolicy },
//     (request: CallableRequest) => import("./logic").then(api => api.sendDoctorInvitationHandler(request))
// );

export const associateDoctorToUnit = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.associateDoctorToUnitHandler(request))
);

export const searchAssociatedDoctors = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.searchAssociatedDoctorsHandler(request))
);

export const setHospitalManagerRole = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.setHospitalManagerRoleHandler(request))
);

export const resetStaffUserPassword = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.resetStaffUserPasswordHandler(request))
);

// <<< NOVAS FUNÇÕES PARA MÉDICOS ADICIONADAS AQUI >>>
export const createDoctorUser = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.createDoctorUserHandler(request))
);

export const resetDoctorUserPassword = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.resetDoctorUserPasswordHandler(request))
);


// --- Funções de Atendimento e Consulta ---
export const createConsultationRoom = onCall({ cors: corsPolicy, secrets: ["DAILY_APIKEY"] },
    (request: CallableRequest) => import("./logic").then(api => api.createConsultationRoomHandler(request))
);

export const createAppointment = onCall({ cors: corsPolicy, secrets: ["DAILY_APIKEY"] },
    (request: CallableRequest) => import("./logic").then(api => api.createAppointmentHandler(request))
);

// --- Funções de Geração de Documentos ---
export const generateContractPdf = onCall({ cors: corsPolicy, memory: "512MiB" },
    (request: CallableRequest) => import("./logic").then(api => api.generateContractPdfHandler(request))
);

export const generatePrescriptionPdf = onCall({ cors: corsPolicy, memory: "512MiB" },
    (request: CallableRequest) => import("./logic").then(api => api.generatePrescriptionPdfHandler(request))
);

export const generateDocumentPdf = onCall({ cors: corsPolicy, memory: "512MiB" },
    (request: CallableRequest) => import("./logic").then(api => api.generateDocumentPdfHandler(request))
);

// --- Funções de Plantão e Ponto ---
export const registerTimeRecord = onCall({ cors: corsPolicy, memory: "512MiB" },
    (request: CallableRequest) => import("./logic").then(api => api.registerTimeRecordHandler(request))
);

export const registerCheckout = onCall({ cors: corsPolicy, memory: "512MiB" },
    (request: CallableRequest) => import("./logic").then(api => api.registerCheckoutHandler(request))
);

// --- Funções de Manutenção e Scripts ---
export const correctServiceTypeCapitalization = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.correctServiceTypeCapitalizationHandler(request))
);

export const migrateDoctorProfilesToUsers = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.migrateDoctorProfilesToUsersHandler(request))
);

export const createTelemedicineRoom = onCall({ cors: corsPolicy, secrets: ["DAILY_APIKEY"] },
    (request: CallableRequest) => import("./logic").then(api => api.createTelemedicineRoomHandler(request))
);

export const migrateHospitalProfile = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.migrateHospitalProfileToV2Handler(request))
);


// ===================================================================================
// === GATILHOS DE EVENTOS DO FIRESTORE
// ===================================================================================

// ============================================================================
// 🔹 CORREÇÃO DE MEMÓRIA APLICADA AQUI 🔹
// Aumentamos a memória APENAS para esta função para evitar o 'crash'.
// ============================================================================
export const onUserWrittenSetClaims = onDocumentWritten(
    {
        document: "users/{userId}",
        memory: "256MiB" // Memória aumentada
    },
    (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { userId: string }>) => import("./logic").then(api => api.onUserWrittenSetClaimsHandler(event))
);

export const findMatchesOnShiftRequirementWrite = onDocumentWritten({ document: "shiftRequirements/{requirementId}" },
    (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>) => import("./logic").then(api => api.findMatchesOnShiftRequirementWriteHandler(event))
);

export const onContractFinalizedUpdateRequirement = onDocumentWritten("contracts/{contractId}",
    (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { contractId: string }>) => import("./logic").then(api => api.onContractFinalizedUpdateRequirementHandler(event))
);

export const onContractFinalizedLinkDoctor = onDocumentWritten("contracts/{contractId}",
    (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { contractId: string }>) => import("./logic").then(api => api.onContractFinalizedLinkDoctorHandler(event))
);

export const onShiftRequirementDelete = onDocumentDeleted("shiftRequirements/{requirementId}",
    (event: FirestoreEvent<DocumentSnapshot | undefined, { requirementId: string }>) => import("./logic").then(api => api.onShiftRequirementDeleteHandler(event))
);

export const onTimeSlotDelete = onDocumentDeleted("doctorTimeSlots/{timeSlotId}",
    (event: FirestoreEvent<DocumentSnapshot | undefined, { timeSlotId: string }>) => import("./logic").then(api => api.onTimeSlotDeleteHandler(event))
);

// ===================================================================================
// === GATILHOS DE AUTENTICAÇÃO (Auth Triggers V1 - Estável) - SEM ALTERAÇÕES
// ===================================================================================
export const onUserDeletedCleanup = functions.region("us-central1").auth.user().onDelete(
    (user: UserRecord) => import("./logic").then(api => api.onUserDeletedCleanupHandler(user))
);