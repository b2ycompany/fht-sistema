// lib/hospital-service.ts
import { db } from "./firebase";
import { doc, collection, query, where, getDocs, runTransaction, serverTimestamp } from "firebase/firestore";

// Interface para os dados do formulário
export interface NewExternalDoctorData {
    displayName: string;
    email: string;
    crm: string;
    // Adicione outros campos que queira coletar no formulário inicial
}

// O parâmetro 'hospitalName' não estava a ser usado, foi removido para limpar o código.
export const registerExternalDoctorByHospital = async (hospitalId: string, doctorData: NewExternalDoctorData): Promise<string> => {
    
    // Validação básica dos dados recebidos
    if (!hospitalId || !doctorData.email || !doctorData.crm || !doctorData.displayName) {
        throw new Error("Dados insuficientes para cadastrar o médico.");
    }

    const usersRef = collection(db, "users");

    // ============================================================================
    // MUDANÇA ESTRUTURAL: A verificação de existência foi movida para ANTES da transação.
    // Isso evita os erros de tipagem, usando a função getDocs() que o seu ambiente reconhece.
    // ============================================================================
    
    // Passo 1: Verificar se o médico já existe (por email ou CRM)
    const emailQuery = query(usersRef, where("email", "==", doctorData.email));
    const crmQuery = query(usersRef, where("professionalCrm", "==", doctorData.crm));

    // Usamos o Promise.all para executar as duas consultas em paralelo e otimizar o tempo.
    const [emailSnapshot, crmSnapshot] = await Promise.all([
        getDocs(emailQuery),
        getDocs(crmQuery)
    ]);

    // Se a consulta de email ou CRM retornar qualquer documento, lançamos um erro.
    if (!emailSnapshot.empty) {
        throw new Error(`O email ${doctorData.email} já está cadastrado na plataforma.`);
    }
    if (!crmSnapshot.empty) {
        throw new Error(`O CRM ${doctorData.crm} já está cadastrado na plataforma.`);
    }

    // A transação agora foca-se apenas na escrita segura dos dados.
    return await runTransaction(db, async (transaction) => {
        // Passo 2: Criar o novo documento do médico na coleção 'users'
        const newDoctorRef = doc(collection(db, "users")); // Cria uma referência com ID automático

        transaction.set(newDoctorRef, {
            displayName: doctorData.displayName,
            email: doctorData.email,
            professionalCrm: doctorData.crm,
            role: 'doctor',
            userType: 'doctor', // Campo para consistência
            documentVerificationStatus: 'PENDING_DOCUMENTS',
            onboardingMethod: 'EXTERNAL_HOSPITAL_INVITE',
            onboardedByHospitalId: hospitalId,
            // ============================================================================
            // MELHORIA IMPLEMENTADA: Adicionamos o ID do hospital ao array healthUnitIds.
            // Isto é ESSENCIAL para que o seu painel consiga encontrar e contar este médico.
            // ============================================================================
            healthUnitIds: [hospitalId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // Passo 3: Adicionar este médico à subcoleção 'hospitalDoctors' do hospital
        const hospitalDoctorRef = doc(collection(db, 'users', hospitalId, 'hospitalDoctors'), newDoctorRef.id);
        
        transaction.set(hospitalDoctorRef, {
            name: doctorData.displayName,
            crm: doctorData.crm,
            email: doctorData.email,
            status: 'ACTIVE_EXTERNAL',
            source: 'EXTERNAL',
            addedAt: serverTimestamp()
        });

        return newDoctorRef.id; // Retorna o ID do novo médico criado
    });
};