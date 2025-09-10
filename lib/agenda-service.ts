// lib/agenda-service.ts
"use strict";

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { type Contract } from '@/lib/contract-service';
// <<< CORREÇÃO: Importa a interface Appointment correta
import { type Appointment } from '@/lib/appointment-service';

// Interface para um evento unificado do calendário
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    type: 'SHIFT' | 'APPOINTMENT'; // Simplificado para 'APPOINTMENT'
    data: Contract | Appointment;
  };
}

/**
 * Busca e unifica TODOS os dados da agenda para um médico específico.
 * Esta é a ÚNICA função que a sua página de agenda deve chamar.
 * @param doctorId O ID do médico autenticado.
 * @returns Uma lista de eventos prontos para o calendário.
 */
export const getUnifiedDoctorAgenda = async (doctorId: string): Promise<CalendarEvent[]> => {
  if (!doctorId) {
    throw new Error("O ID do médico é obrigatório para carregar a agenda.");
  }

  try {
    // 1. Consulta SEGURA para buscar os contratos (plantões)
    const contractsQuery = query(
      collection(db, "contracts"),
      where("doctorId", "==", doctorId),
      where("status", "in", ["ACTIVE_SIGNED", "IN_PROGRESS"])
    );

    // <<< CORREÇÃO: A consulta agora aponta para a coleção "appointments" >>>
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("doctorId", "==", doctorId),
      where("status", "in", ["SCHEDULED", "IN_PROGRESS"])
    );

    const [contractsSnapshot, appointmentsSnapshot] = await Promise.all([
      getDocs(contractsQuery),
      getDocs(appointmentsQuery),
    ]);

    const events: CalendarEvent[] = [];

    // Mapeia os Contratos/Plantões para eventos
    contractsSnapshot.forEach(doc => {
      const contract = { id: doc.id, ...doc.data() } as Contract;
      if (!contract.shiftDates || contract.shiftDates.length === 0) return;

      const shiftDate = contract.shiftDates[0].toDate();
      const [startHour, startMinute] = contract.startTime.split(':').map(Number);
      const [endHour, endMinute] = contract.endTime.split(':').map(Number);
      const startDate = new Date(new Date(shiftDate).setHours(startHour, startMinute, 0, 0));
      const endDate = new Date(new Date(shiftDate).setHours(endHour, endMinute, 0, 0));
      
      events.push({
        id: contract.id,
        title: `Plantão: ${contract.hospitalName}`,
        start: startDate,
        end: endDate,
        backgroundColor: contract.status === 'IN_PROGRESS' ? '#059669' : '#3b82f6',
        borderColor: contract.status === 'IN_PROGRESS' ? '#047857' : '#1e40af',
        extendedProps: { type: 'SHIFT', data: contract },
      });
    });

    // Mapeia os Agendamentos (presenciais ou telemedicina) para eventos
    appointmentsSnapshot.forEach(doc => {
      const appointment = { id: doc.id, ...doc.data() } as Appointment;
      const startDate = appointment.appointmentDate.toDate();
      const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // Adiciona 30 minutos
      
      events.push({
        id: appointment.id,
        title: `${appointment.type}: ${appointment.patientName}`, // Mostra se é Telemedicina ou Presencial
        start: startDate,
        end: endDate,
        backgroundColor: '#8b5cf6',
        borderColor: '#6d28d9',
        extendedProps: { type: 'APPOINTMENT', data: appointment },
      });
    });
    
    return events;

  } catch (error) {
    console.error("Erro no serviço ao carregar agenda unificada:", error);
    throw new Error("Não foi possível carregar os dados da agenda.");
  }
};