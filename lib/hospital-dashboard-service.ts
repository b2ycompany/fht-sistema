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
    associatedDoctorsCount: number; // <<< CAMPO ADICIONADO >>>
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
        const usersRef = collection(db, "users"); // <<< Referência para a coleção de utilizadores >>>

        // Define o início do dia de hoje para filtrar as consultas
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayTimestamp = Timestamp.fromDate(startOfToday);

        // 1. Contagem de pacientes na fila de triagem (status 'Aguardando Triagem')
        const triageQuery = query(
            queueRef, 
            where("unitId", "==", unitId), 
            where("status", "==", "Aguardando Triagem")
        );

        // 2. Contagem de pacientes na fila de atendimento médico (status 'Aguardando Atendimento')
        const consultationQueueQuery = query(
            queueRef,
            where("unitId", "==", unitId),
            where("status", "==", "Aguardando Atendimento")
        );

        // 3. Contagem de atendimentos que foram finalizados hoje
        const completedQuery = query(
            consultationsRef,
            where("hospitalId", "==", unitId),
            where("status", "==", "COMPLETED"),
            where("createdAt", ">=", startOfTodayTimestamp)
        );
        
        // ============================================================================
        // CORREÇÃO: A consulta agora filtra os utilizadores do tipo 'doctor' que
        // possuem o ID da unidade atual no seu array 'healthUnitIds'.
        // Isso garante que apenas os médicos associados a esta unidade sejam contados.
        // ============================================================================
        const doctorsQuery = query(
            usersRef, 
            where("userType", "==", "doctor"), 
            where("healthUnitIds", "array-contains", unitId)
        );


        // Executa todas as contagens em paralelo, incluindo a nova contagem de médicos
        const [triageSnapshot, consultationQueueSnapshot, completedSnapshot, doctorsSnapshot] = await Promise.all([
            getCountFromServer(triageQuery),
            getCountFromServer(consultationQueueQuery),
            getCountFromServer(completedQuery),
            getCountFromServer(doctorsQuery) // <<< Nova consulta adicionada >>>
        ]);

        return {
            triageQueueCount: triageSnapshot.data().count,
            consultationQueueCount: consultationQueueSnapshot.data().count,
            completedTodayCount: completedSnapshot.data().count,
            associatedDoctorsCount: doctorsSnapshot.data().count, // <<< Novo dado retornado >>>
        };

    } catch (error) {
        console.error("Erro ao buscar dados para o painel do gestor:", error);
        throw new Error("Não foi possível carregar os indicadores da unidade.");
    }
};