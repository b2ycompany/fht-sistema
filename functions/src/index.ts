// functions/src/index.ts
// Este arquivo é o "lançador". Ele é leve e carrega a lógica sob demanda.
import { onDocumentWritten, onDocumentDeleted, onDocumentCreated, FirestoreEvent } from "firebase-functions/v2/firestore";
import { onCall, CallableRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { UserRecord } from "firebase-admin/auth";
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-admin/firestore";

// --- INICIALIZAÇÃO GLOBAL ---
if (admin.apps.length === 0) {
  admin.initializeApp();
}
setGlobalOptions({ region: "us-central1", memory: "512MiB" });


// --- DEFINIÇÃO DOS GATILHOS (TRIGGERS) ---
// Cada trigger importa dinamicamente e executa o handler correspondente do logic.ts

export const onUserCreatedSetClaims = onDocumentCreated("users/{userId}",
    (event: FirestoreEvent<DocumentSnapshot | undefined, { userId: string }>) => import("./logic").then(api => api.onUserCreatedSetClaimsHandler(event))
);

export const findMatchesOnShiftRequirementWrite = onDocumentWritten({ document: "shiftRequirements/{requirementId}" },
    (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requirementId: string }>) => import("./logic").then(api => api.findMatchesOnShiftRequirementWriteHandler(event))
);

export const onShiftRequirementDelete = onDocumentDeleted("shiftRequirements/{requirementId}",
    (event: FirestoreEvent<DocumentSnapshot | undefined, { requirementId: string }>) => import("./logic").then(api => api.onShiftRequirementDeleteHandler(event))
);

export const onTimeSlotDelete = onDocumentDeleted("doctorTimeSlots/{timeSlotId}",
    (event: FirestoreEvent<DocumentSnapshot | undefined, { timeSlotId: string }>) => import("./logic").then(api => api.onTimeSlotDeleteHandler(event))
);

export const generateContractPdf = onCall({ cors: [/fhtgestao\.com\.br$/, "https://fht-sistema.web.app"] },
    (request: CallableRequest) => import("./logic").then(api => api.generateContractPdfHandler(request))
);

export const createTelemedicineRoom = onCall({ cors: true, secrets: ["DAILY_APIKEY"] },
    (request: CallableRequest) => import("./logic").then(api => api.createTelemedicineRoomHandler(request))
);

export const correctServiceTypeCapitalization = onCall({ cors: true },
    (request: CallableRequest) => import("./logic").then(api => api.correctServiceTypeCapitalizationHandler(request))
);

export const generatePrescriptionPdf = onCall({ cors: true },
    (request: CallableRequest) => import("./logic").then(api => api.generatePrescriptionPdfHandler(request))
);

export const generateDocumentPdf = onCall({ cors: true },
    (request: CallableRequest) => import("./logic").then(api => api.generateDocumentPdfHandler(request))
);

export const onContractFinalizedUpdateRequirement = onDocumentWritten("contracts/{contractId}",
    (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { contractId: string }>) => import("./logic").then(api => api.onContractFinalizedUpdateRequirementHandler(event))
);

export const registerTimeRecord = onCall({ cors: true },
    (request: CallableRequest) => import("./logic").then(api => api.registerTimeRecordHandler(request))
);

export const registerCheckout = onCall({ cors: true },
    (request: CallableRequest) => import("./logic").then(api => api.registerCheckoutHandler(request))
);

export const setAdminClaim = onCall({ region: "us-central1", cors: ["http://localhost:3000", "https://fht-sistema.web.app", "https://fht-sistema.firebaseapp.com"] },
    (request: CallableRequest) => import("./logic").then(api => api.setAdminClaimHandler(request))
);

export const createStaffUser = onCall({ cors: [/fhtgestao\.com\.br$/, "https://fht-sistema.web.app", "http://localhost:3000"] },
    (request: CallableRequest) => import("./logic").then(api => api.createStaffUserHandler(request))
);

export const createConsultationRoom = onCall({ cors: ["http://localhost:3000", "https://fht-sistema.web.app", "https://fht-sistema.firebaseapp.com"], secrets: ["DAILY_APIKEY"] },
    (request: CallableRequest) => import("./logic").then(api => api.createConsultationRoomHandler(request))
);

export const createAppointment = onCall({ cors: true, secrets: ["DAILY_APIKEY"] },
    (request: CallableRequest) => import("./logic").then(api => api.createAppointmentHandler(request))
);

export const onUserDeletedCleanup = functions.auth.user().onDelete(
    (user: UserRecord) => import("./logic").then(api => api.onUserDeletedCleanupHandler(user))
);

export const searchPlatformDoctors = onCall({ cors: true },
    (request: CallableRequest) => import("./logic").then(api => api.searchPlatformDoctorsHandler(request))
);

export const associateDoctorToUnit = onCall({ cors: true },
    (request: CallableRequest) => import("./logic").then(api => api.associateDoctorToUnitHandler(request))
);

export const onContractFinalizedLinkDoctor = onDocumentWritten("contracts/{contractId}",
    (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { contractId: string }>) => import("./logic").then(api => api.onContractFinalizedLinkDoctorHandler(event))
);