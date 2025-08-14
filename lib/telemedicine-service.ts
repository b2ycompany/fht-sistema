// lib/telemedicine-service.ts
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * Busca a lista de especialidades de telemedicina disponíveis no Firestore.
 * @returns Uma promessa que resolve para um array de strings com os nomes das especialidades.
 */
export const getTelemedicineSpecialties = async (): Promise<string[]> => {
    try {
        const specialtiesDocRef = doc(db, "telemedicine", "specialties");
        const docSnap = await getDoc(specialtiesDocRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return Array.isArray(data.list) ? data.list : [];
        } else {
            console.warn("Documento de especialidades de telemedicina não encontrado.");
            return [];
        }
    } catch (error) {
        console.error("Erro ao buscar especialidades de telemedicina:", error);
        throw new Error("Não foi possível carregar a lista de especialidades.");
    }
};