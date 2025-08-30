// functions/src/index.ts
import { onDocumentWritten, onDocumentDeleted, onDocumentCreated, FirestoreEvent } from "firebase-functions/v2/firestore";
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
setGlobalOptions({ region: "us-central1", memory: "512MiB" });

const corsPolicy = [
    "https://fhtgestao.com.br", 
    "https://www.fhtgestao.com.br",
    "https://fht-sistema.web.app",
    "https://fht-sistema.firebaseapp.com",
    "http://localhost:3000"
];

// ===================================================================================
// === GATILHOS DE EVENTOS DO FIRESTORE (onDocument...) =============================
// ===================================================================================

export const onUserCreatedSetClaims = onDocumentCreated("users/{userId}",
    (event: FirestoreEvent<DocumentSnapshot | undefined, { userId: string }>) => import("./logic").then(api => api.onUserCreatedSetClaimsHandler(event))
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
// === FUNÇÕES CHAMÁVEIS PELO CLIENTE (onCall) =======================================
// ===================================================================================

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

export const sendDoctorInvitation = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.sendDoctorInvitationHandler(request))
);

export const associateDoctorToUnit = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.associateDoctorToUnitHandler(request))
);

export const searchAssociatedDoctors = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.searchAssociatedDoctorsHandler(request))
);

// --- Funções de Atendimento e Consulta ---
export const createConsultationRoom = onCall({ cors: corsPolicy, secrets: ["DAILY_APIKEY"] },
    (request: CallableRequest) => import("./logic").then(api => api.createConsultationRoomHandler(request))
);

export const createAppointment = onCall({ cors: corsPolicy, secrets: ["DAILY_APIKEY"] },
    (request: CallableRequest) => import("./logic").then(api => api.createAppointmentHandler(request))
);

// --- Funções de Geração de Documentos ---
export const generateContractPdf = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.generateContractPdfHandler(request))
);

export const generatePrescriptionPdf = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.generatePrescriptionPdfHandler(request))
);

export const generateDocumentPdf = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.generateDocumentPdfHandler(request))
);

// --- Funções de Plantão e Ponto ---
export const registerTimeRecord = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.registerTimeRecordHandler(request))
);

export const registerCheckout = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.registerCheckoutHandler(request))
);

// --- Funções de Manutenção e Scripts ---
export const correctServiceTypeCapitalization = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.correctServiceTypeCapitalizationHandler(request))
);

export const migrateDoctorProfilesToUsers = onCall({ cors: corsPolicy },
    (request: CallableRequest) => import("./logic").then(api => api.migrateDoctorProfilesToUsersHandler(request))
);

// A função createTelemedicineRoom parece ser uma duplicata de createConsultationRoom ou específica para 'contracts'.
// Mantendo a createConsultationRoom que é mais genérica.
export const createTelemedicineRoom = onCall({ cors: corsPolicy, secrets: ["DAILY_APIKEY"] },
    (request: CallableRequest) => import("./logic").then(api => api.createTelemedicineRoomHandler(request))
);

// ===================================================================================
// === GATILHOS DE AUTENTICAÇÃO (Auth Triggers V1) ===================================
// ===================================================================================

export const onUserDeletedCleanup = functions.auth.user().onDelete(
    (user: UserRecord) => import("./logic").then(api => api.onUserDeletedCleanupHandler(user))
);