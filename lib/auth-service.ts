// lib/auth-service.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User as FirebaseUser,
  type UserCredential
} from "firebase/auth";
import {
  doc, setDoc, getDoc, serverTimestamp, Timestamp
} from "firebase/firestore";
import { auth, db } from "./firebase";

// --- Tipos ---

export type UserType = "doctor" | "hospital";

// Tipos básicos reutilizados
export interface PersonalInfo { name: string; dob: string; rg: string; cpf: string; phone: string; email: string; }
export interface AddressInfo { cep: string; street: string; number: string; complement?: string; neighborhood: string; city: string; state: string; }
export interface LegalRepresentativeInfo { name: string; dob: string; rg: string; cpf: string; phone: string; email: string; position: string; }

// Tipos para referência de chaves de documentos (URLs serão strings)
export interface DoctorDocumentsRef { personalRg?: string; personalCpf?: string; professionalCrm?: string; photo3x4?: string; addressProof?: string; graduationCertificate?: string; criminalRecordCert?: string; ethicalCert?: string; debtCert?: string; cv?: string; }
export interface SpecialistDocumentsRef { rqe?: string; postGradCert?: string; specialistTitle?: string; recommendationLetter?: string; }
export interface HospitalDocumentsRef { socialContract?: string; cnpjCard?: string; companyAddressProof?: string; }
export interface LegalRepDocumentsRef { repRg?: string; repCpf?: string; repAddressProof?: string; }

// Payloads enviados para a função registerUser
export interface DoctorRegistrationPayload extends Omit<PersonalInfo, 'email' | 'name'> { // name/email vêm separados
  address: AddressInfo; // <<< CORRIGIDO: Usa 'address'
  isSpecialist: boolean;
  documents: Partial<DoctorDocumentsRef>;
  specialistDocuments: Partial<SpecialistDocumentsRef>;
}
// --- CORRIGIDO: HospitalRegistrationPayload inclui TUDO que o form coleta ---
export interface HospitalRegistrationPayload {
  // Dados da empresa (além do displayName/email que vêm separados)
  cnpj: string;
  stateRegistration?: string;
  phone: string;
  address: AddressInfo; // Endereço da empresa
  // Dados do representante
  legalRepresentativeInfo: LegalRepresentativeInfo;
  // Documentos (URLs)
  hospitalDocs: Partial<HospitalDocumentsRef>;
  legalRepDocuments: Partial<LegalRepDocumentsRef>;
}

// --- Tipos para os Dados Salvos no Firestore ---
export interface UserProfileBase { uid: string; email: string; displayName: string; role: UserType; createdAt: Timestamp; updatedAt: Timestamp; }

// --- CORRIGIDO: DoctorProfile usa 'address' ---
export interface DoctorProfile extends UserProfileBase, DoctorRegistrationPayload {
    role: 'doctor';
    // Herda todos os campos de DoctorRegistrationPayload, incluindo 'address: AddressInfo'
}

// --- CORRIGIDO: HospitalProfile inclui TUDO ---
export interface HospitalProfile extends UserProfileBase {
  role: 'hospital';
  companyInfo: {
    cnpj: string;
    stateRegistration?: string; // << Incluído
    phone: string;              // << Incluído
    address: AddressInfo;
  };
  legalRepresentativeInfo: LegalRepresentativeInfo; // << Incluído
  hospitalDocs?: Partial<HospitalDocumentsRef>;      // << Incluído
  legalRepDocuments?: Partial<LegalRepDocumentsRef>; // << Incluído
}
export type UserProfile = DoctorProfile | HospitalProfile;

// --- Funções do Serviço ---

export const registerUser = async (
  email: string, password: string, name: string, role: UserType,
  registrationData: DoctorRegistrationPayload | HospitalRegistrationPayload
): Promise<UserCredential> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName: name });

    const userProfileBase = { uid: user.uid, email: user.email || email, displayName: name, role: role };
    let userProfileDataToSave: Omit<UserProfile, 'createdAt' | 'updatedAt'>;

    if (role === 'doctor' && 'cpf' in registrationData) {
        userProfileDataToSave = {
            ...userProfileBase,
            role: 'doctor',
            // Copia todos os campos de DoctorRegistrationPayload
            dob: registrationData.dob, rg: registrationData.rg, cpf: registrationData.cpf, phone: registrationData.phone,
            address: registrationData.address, // <<< CORRIGIDO: usa 'address'
            isSpecialist: registrationData.isSpecialist,
            documents: registrationData.documents,
            specialistDocuments: registrationData.specialistDocuments,
        } as Omit<DoctorProfile, 'createdAt' | 'updatedAt'>;

    } else if (role === 'hospital' && 'cnpj' in registrationData) {
        // --- CORRIGIDO: Salvando todos os campos recebidos ---
        userProfileDataToSave = {
            ...userProfileBase,
            role: 'hospital',
            companyInfo: {
                cnpj: registrationData.cnpj,
                stateRegistration: registrationData.stateRegistration, // << Salva
                phone: registrationData.phone,                   // << Salva
                address: registrationData.address,
            },
            legalRepresentativeInfo: registrationData.legalRepresentativeInfo, // << Salva
            hospitalDocs: registrationData.hospitalDocs,                 // << Salva
            legalRepDocuments: registrationData.legalRepDocuments,         // << Salva
        } as Omit<HospitalProfile, 'createdAt' | 'updatedAt'>;
        // --- FIM CORREÇÃO ---
    } else { throw new Error("Dados de registro inválidos."); }

    await setDoc(doc(db, "users", user.uid), {
        ...userProfileDataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    console.log(`Perfil ${role} salvo para UID: ${user.uid}`);
    return userCredential;
  } catch (error) { console.error("Erro registro:", error); throw error; }
};

// --- Outras Funções (loginUser, logoutUser, resetPassword, getCurrentUserData como antes) ---
export const loginUser = async (email: string, password: string): Promise<FirebaseUser> => { try { const u = await signInWithEmailAndPassword(auth, email, password); return u.user; } catch (e) { console.error("Login error:", e); throw e; } };
export const logoutUser = async (): Promise<void> => { try { await signOut(auth); } catch (e) { console.error("Logout error:", e); throw e; } };
export const resetPassword = async (email: string): Promise<void> => { try { await sendPasswordResetEmail(auth, email); } catch (e) { console.error("Reset error:", e); throw e; } };
export const getCurrentUserData = async (): Promise<UserProfile | null> => { try { const user = auth.currentUser; if (!user) { return null; } const docRef = doc(db, "users", user.uid); const docSnap = await getDoc(docRef); if (docSnap.exists()) { const userProfile = docSnap.data() as UserProfile; console.log("Dados recuperados:", userProfile); return userProfile; } else { console.log("Documento do usuário não encontrado."); return null; } } catch (e) { console.error("Get user data error:", e); throw e; } };