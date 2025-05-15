// lib/match-service.ts
import { Timestamp } from "firebase/firestore";
// Remova as importações do Firestore se esta for apenas a definição de tipos e mocks
// import { db, auth } from "./firebase"; 

export interface PotentialMatch {
  id: string; 
  shiftRequirementId: string;
  hospitalId: string;
  hospitalName?: string;
  shiftRequirementDates: Timestamp[];
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
  timeSlotDate: Timestamp;
  timeSlotStartTime: string;
  timeSlotEndTime: string;
  timeSlotIsOvernight: boolean;
  doctorDesiredRate: number;
  doctorSpecialties: string[];
  doctorServiceType: string;
  status:
    | 'PENDING_BACKOFFICE_REVIEW' | 'BACKOFFICE_APPROVED_PENDING_DOCTOR' | 'BACKOFFICE_REJECTED'
    | 'PROPOSED_TO_DOCTOR' | 'DOCTOR_ACCEPTED_PENDING_CONTRACT' | 'DOCTOR_REJECTED'
    | 'CONTRACT_GENERATED_PENDING_SIGNATURES' | 'CONTRACT_SIGNED_BY_DOCTOR' | 'CONTRACT_SIGNED_BY_HOSPITAL'
    | 'CONTRACT_ACTIVE' | 'SHIFT_COMPLETED' | 'PAYMENT_PROCESSED' | 'CANCELLED_BY_BACKOFFICE'
    | 'CANCELLED_BY_HOSPITAL_POST_MATCH' | 'CANCELLED_BY_DOCTOR_POST_ACCEPTANCE';
  backofficeReviewerId?: string;
  backofficeReviewedAt?: Timestamp;
  backofficeNotes?: string;
  negotiatedRateForDoctor?: number;
  doctorResponseAt?: Timestamp;
  doctorRejectionReason?: string;
  contractId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const getMatchesForBackofficeReview = async (): Promise<PotentialMatch[]> => {
  console.log("[getMatchesForBackofficeReview] Buscando matches (MOCK)...");
  await new Promise(resolve => setTimeout(resolve, 100)); // Reduzido delay para teste
  const mockMatches: PotentialMatch[] = [
    {
      id: "match001",
      shiftRequirementId: "req_A_001", hospitalId: "hospA", hospitalName: "Hospital Modelo A",
      shiftRequirementDates: [Timestamp.fromDate(new Date(2025, 7, 10)), Timestamp.fromDate(new Date(2025, 7, 11))],
      shiftRequirementStartTime: "07:00", shiftRequirementEndTime: "19:00", shiftRequirementIsOvernight: false,
      shiftRequirementServiceType: "plantao_12h_diurno", shiftRequirementSpecialties: ["Clínica Médica"],
      offeredRateByHospital: 120, numberOfVacanciesInRequirement: 1,
      timeSlotId: "ts_X_001", doctorId: "docX", doctorName: "Dr. Xavier",
      timeSlotDate: Timestamp.fromDate(new Date(2025, 7, 10)),
      timeSlotStartTime: "07:00", timeSlotEndTime: "19:00", timeSlotIsOvernight: false,
      doctorDesiredRate: 100, doctorSpecialties: ["Clínica Médica"], doctorServiceType: "plantao_12h_diurno",
      status: 'PENDING_BACKOFFICE_REVIEW', createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }
  ];
  return mockMatches;
};

export const approveMatchAndProposeToDoctor = async (matchId: string, negotiatedRate: number, backofficeNotes?: string): Promise<void> => {
  console.log(`[MatchService] Aprovando match ${matchId} com tarifa ${negotiatedRate} (MOCK)`);
  return Promise.resolve();
};

export const rejectMatchByBackoffice = async (matchId: string, rejectionNotes: string): Promise<void> => {
  console.log(`[MatchService] Rejeitando match ${matchId} (MOCK)`);
  return Promise.resolve();
};