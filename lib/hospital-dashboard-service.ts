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
    associatedDoctorsCount: number; // Campo para a contagem correta de médicos
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
        // Referências às coleções do Firestore
        const queueRef = collection(db, "serviceQueue");
        const consultationsRef = collection(db, "consultations");
        const usersRef = collection(db, "users");

        // Define o início do dia de hoje para filtrar as consultas
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayTimestamp = Timestamp.fromDate(startOfToday);

        // Consultas seguras e específicas para a unidade logada
        const triageQuery = query(queueRef, where("unitId", "==", unitId), where("status", "==", "Aguardando Triagem"));
        const consultationQueueQuery = query(queueRef, where("unitId", "==", unitId), where("status", "==", "Aguardando Atendimento"));
        const completedQuery = query(consultationsRef, where("hospitalId", "==", unitId), where("status", "==", "COMPLETED"), where("createdAt", ">=", startOfTodayTimestamp));
        
        // CORREÇÃO: Conta apenas os médicos associados a esta unidade
        const doctorsQuery = query(usersRef, where("userType", "==", "doctor"), where("healthUnitIds", "array-contains", unitId));

        // Executa todas as contagens em paralelo para maior eficiência
        const [triageSnapshot, consultationQueueSnapshot, completedSnapshot, doctorsSnapshot] = await Promise.all([
            getCountFromServer(triageQuery),
            getCountFromServer(consultationQueueQuery),
            getCountFromServer(completedQuery),
            getCountFromServer(doctorsQuery)
        ]);

        // Retorna os dados consolidados
        return {
            triageQueueCount: triageSnapshot.data().count,
            consultationQueueCount: consultationQueueSnapshot.data().count,
            completedTodayCount: completedSnapshot.data().count,
            associatedDoctorsCount: doctorsSnapshot.data().count,
        };

    } catch (error) {
        console.error("Erro ao buscar dados para o painel do gestor:", error);
        // Lança um erro mais amigável para o frontend
        throw new Error("Não foi possível carregar os indicadores da unidade.");
    }
};