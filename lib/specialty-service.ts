import { db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export interface Specialty {
    id: string;
    name: string;
    description?: string;
}

/**
 * Busca a lista de todas as especialidades ativas na plataforma.
 * @returns Uma promessa que resolve para um array de objetos de especialidade.
 */
export const getSpecialtiesList = async (): Promise<Specialty[]> => {
    try {
        const specialtiesRef = collection(db, "specialties");
        const q = query(specialtiesRef, where("active", "==", true));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn("Nenhuma especialidade ativa encontrada no Firestore.");
            return [];
        }

        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            ...doc.data(),
        } as Specialty));

    } catch (error) {
        console.error("[SpecialtyService] Erro ao buscar lista de especialidades:", error);
        throw new Error("Não foi possível carregar a lista de especialidades.");
    }
};