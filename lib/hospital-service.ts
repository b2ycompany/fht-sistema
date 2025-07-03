// lib/hospital-service.ts
import { db } from "./firebase";
import { doc, collection, query, where, getDocs, runTransaction, serverTimestamp, documentId } from "firebase/firestore";

// Interface para os dados do formulário
export interface NewExternalDoctorData {
    displayName: string;
    email: string;
    crm: string;
    // Adicione outros campos que queira coletar no formulário inicial
}

export const registerExternalDoctorByHospital = async (hospitalId: string, hospitalName: string, doctorData: NewExternalDoctorData): Promise<string> => {
    
    // Validação básica dos dados recebidos
    if (!hospitalId || !doctorData.email || !doctorData.crm || !doctorData.displayName) {
        throw new Error("Dados insuficientes para cadastrar o médico.");
    }

    const usersRef = collection(db, "users");

    // Transação para garantir a atomicidade da operação
    return await runTransaction(db, async (transaction) => {
        // Passo 1: Verificar se o médico já existe (por email ou CRM)
        const emailQuery = query(usersRef, where("email", "==", doctorData.email));
        const crmQuery = query(usersRef, where("professionalCrm", "==", doctorData.crm));

        const [emailSnapshot, crmSnapshot] = await Promise.all([
            getDocs(emailQuery),
            getDocs(crmQuery)
        ]);

        if (!emailSnapshot.empty) {
            throw new Error(`O email ${doctorData.email} já está cadastrado na plataforma.`);
        }
        if (!crmSnapshot.empty) {
            throw new Error(`O CRM ${doctorData.crm} já está cadastrado na plataforma.`);
        }

        // Passo 2: Criar o novo documento do médico na coleção 'users'
        // NOTA: A criação do utilizador no "Firebase Auth" é um passo separado e mais complexo
        // que envolveria enviar um email de redefinição de senha. Por agora, criamos o registo de dados.
        const newDoctorRef = doc(collection(db, "users")); // Cria uma referência com ID automático

        transaction.set(newDoctorRef, {
            displayName: doctorData.displayName,
            email: doctorData.email,
            professionalCrm: doctorData.crm,
            role: 'doctor',
            documentVerificationStatus: 'PENDING_DOCUMENTS', // O médico precisará de completar o cadastro
            onboardingMethod: 'EXTERNAL_HOSPITAL_INVITE', // Campo chave para identificar a origem
            onboardedByHospitalId: hospitalId, // Link para o hospital que o cadastrou
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // Passo 3: Adicionar este médico à subcoleção 'hospitalDoctors' do hospital
        const hospitalDoctorRef = doc(collection(db, 'users', hospitalId, 'hospitalDoctors'), newDoctorRef.id);
        
        transaction.set(hospitalDoctorRef, {
            name: doctorData.displayName,
            crm: doctorData.crm,
            email: doctorData.email,
            status: 'ACTIVE_EXTERNAL', // Status para indicar que foi adicionado diretamente
            source: 'EXTERNAL',
            addedAt: serverTimestamp()
        });

        return newDoctorRef.id; // Retorna o ID do novo médico criado
    });
};