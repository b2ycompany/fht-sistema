// lib/hospital-dashboard-service.ts
import { db } from "./firebase";
import { 
    collection, 
    query, 
    where, 
    Timestamp,
    getCountFromServer 
} from "firebase/firestore";

/**
 * Interface para os dados consolidados do painel do gestor.
 */
export interface HospitalDashboardData {
    triageQueueCount: number;
    consultationQueueCount: number;
    completedTodayCount: number;
}

/**
 * Busca os dados principais para o painel do gestor de uma unidade de saúde específica.
 * @param unitId O ID da unidade de saúde (hospital) a ser consultada.
 * @returns Um objeto com as contagens para as filas e atendimentos finalizados no dia.
 */
export const getHospitalDashboardData = async (unitId: string): Promise<HospitalDashboardData> => {
    if (!unitId) {
        throw new Error("O ID da unidade de saúde é obrigatório.");
    }

    try {
        const queueRef = collection(db, "serviceQueue");
        const consultationsRef = collection(db, "consultations");

        // Define o início do dia de hoje
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayTimestamp = Timestamp.fromDate(startOfToday);

        // 1. Contagem de pacientes na fila de triagem
        const triageQuery = query(
            queueRef, 
            where("unitId", "==", unitId), 
            where("status", "==", "Aguardando Triagem")
        );

        // 2. Contagem de pacientes na fila de atendimento
        const consultationQueueQuery = query(
            queueRef,
            where("unitId", "==", unitId),
            where("status", "==", "Aguardando Atendimento")
        );

        // 3. Contagem de atendimentos finalizados hoje
        const completedQuery = query(
            consultationsRef,
            where("hospitalId", "==", unitId),
            where("status", "==", "COMPLETED"),
            where("createdAt", ">=", startOfTodayTimestamp)
        );

        // Executa todas as contagens em paralelo para melhor performance
        const [triageSnapshot, consultationQueueSnapshot, completedSnapshot] = await Promise.all([
            getCountFromServer(triageQuery),
            getCountFromServer(consultationQueueQuery),
            getCountFromServer(completedQuery)
        ]);

        return {
            triageQueueCount: triageSnapshot.data().count,
            consultationQueueCount: consultationQueueSnapshot.data().count,
            completedTodayCount: completedSnapshot.data().count,
        };

    } catch (error) {
        console.error("Erro ao buscar dados para o painel do gestor:", error);
        throw new Error("Não foi possível carregar os indicadores da unidade.");
    }
};