// Ex: lib/match-types.ts OU lib/hospital-shift-service.ts
import { Timestamp } from "firebase/firestore";
import { ShiftRequirement } from "./hospital-shift-service"; // Importe se necessário
import { TimeSlot } from "./availability-service"; // Importe se necessário

export interface Match {
    id?: string; // ID do documento do Firestore
    shiftRequirementId: string; // ID da vaga do hospital
    timeSlotId: string;         // ID da disponibilidade do médico
    hospitalId: string;
    doctorId: string;
    status: 'pending_admin_review' | 'admin_rejected' | 'pending_doctor_acceptance' | 'doctor_rejected' | 'doctor_accepted' | 'contract_pending' | 'contract_signed' | 'shift_completed' | 'shift_cancelled_by_hospital' | 'shift_cancelled_by_doctor'; // Workflow de status
    matchScore?: number; // Opcional: Para futura IA
    createdAt: Timestamp;
    updatedAt: Timestamp;

    // Dados denormalizados (opcional, para facilitar exibição)
    shiftDate?: Timestamp;
    shiftStartTime?: string;
    shiftEndTime?: string;
    shiftCity?: string;
    shiftState?: string;
    offeredRate?: number;
    requiredSpecialties?: string[];
    doctorName?: string;     // Denormalizado do perfil do médico
    doctorSpecialties?: string[]; // Denormalizado da disponibilidade/perfil
    hospitalName?: string;   // Denormalizado do perfil do hospital
}