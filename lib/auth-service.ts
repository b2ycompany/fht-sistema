// lib/auth-service.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile, // Importação do Firebase Auth para atualizar o perfil do Auth User
  type User as FirebaseUser,
  type UserCredential
} from "firebase/auth";
import {
  doc, setDoc, getDoc, updateDoc, // Adicionado updateDoc
  serverTimestamp, Timestamp
} from "firebase/firestore";
import { auth, db } from "./firebase";

// --- Tipos ---

export type UserType = "doctor" | "hospital";

export interface PersonalInfo { name: string; dob: string; rg: string; cpf: string; phone: string; email: string; }
export interface AddressInfo { cep: string; street: string; number: string; complement?: string; neighborhood: string; city: string; state: string; }
export interface LegalRepresentativeInfo { name: string; dob: string; rg: string; cpf: string; phone: string; email: string; position: string; }

export interface DoctorDocumentsRef { personalRg?: string; personalCpf?: string; professionalCrm?: string; photo3x4?: string; addressProof?: string; graduationCertificate?: string; criminalRecordCert?: string; ethicalCert?: string; debtCert?: string; cv?: string; }
export interface SpecialistDocumentsRef { rqe?: string; postGradCert?: string; specialistTitle?: string; recommendationLetter?: string; }
export interface HospitalDocumentsRef { socialContract?: string; cnpjCard?: string; companyAddressProof?: string; }
export interface LegalRepDocumentsRef { repRg?: string; repCpf?: string; repAddressProof?: string; }

export interface DoctorRegistrationPayload extends Omit<PersonalInfo, 'email' | 'name'> {
  address: AddressInfo;
  isSpecialist: boolean;
  documents: Partial<DoctorDocumentsRef>;
  specialistDocuments: Partial<SpecialistDocumentsRef>;
}
export interface HospitalRegistrationPayload {
  cnpj: string;
  stateRegistration?: string;
  phone: string;
  address: AddressInfo;
  legalRepresentativeInfo: LegalRepresentativeInfo;
  hospitalDocs: Partial<HospitalDocumentsRef>;
  legalRepDocuments: Partial<LegalRepDocumentsRef>;
}

export interface UserProfileBase { uid: string; email: string; displayName: string; role: UserType; createdAt: Timestamp; updatedAt: Timestamp; }

export interface DoctorProfile extends UserProfileBase, DoctorRegistrationPayload {
  role: 'doctor';
}

export interface HospitalProfile extends UserProfileBase {
  role: 'hospital';
  companyInfo: {
    cnpj: string;
    stateRegistration?: string;
    phone: string;
    address: AddressInfo;
  };
  legalRepresentativeInfo: LegalRepresentativeInfo;
  hospitalDocs?: Partial<HospitalDocumentsRef>;
  legalRepDocuments?: Partial<LegalRepDocumentsRef>;
}
export type UserProfile = DoctorProfile | HospitalProfile;


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
        const doctorData = registrationData as DoctorRegistrationPayload;
        userProfileDataToSave = {
            ...userProfileBase,
            role: 'doctor',
            dob: doctorData.dob,
            rg: doctorData.rg,
            cpf: doctorData.cpf,
            phone: doctorData.phone,
            address: doctorData.address,
            isSpecialist: doctorData.isSpecialist,
            documents: doctorData.documents,
            specialistDocuments: doctorData.specialistDocuments,
        } as Omit<DoctorProfile, 'createdAt' | 'updatedAt'>;
    } else if (role === 'hospital' && 'cnpj' in registrationData) {
        const hospitalData = registrationData as HospitalRegistrationPayload;
        userProfileDataToSave = {
            ...userProfileBase,
            role: 'hospital',
            companyInfo: {
                cnpj: hospitalData.cnpj,
                stateRegistration: hospitalData.stateRegistration,
                phone: hospitalData.phone,
                address: hospitalData.address,
            },
            legalRepresentativeInfo: hospitalData.legalRepresentativeInfo,
            hospitalDocs: hospitalData.hospitalDocs,
            legalRepDocuments: hospitalData.legalRepDocuments,
        } as Omit<HospitalProfile, 'createdAt' | 'updatedAt'>;
    } else {
        throw new Error("Dados de registro inválidos para o tipo de perfil selecionado.");
    }

    await setDoc(doc(db, "users", user.uid), {
        ...userProfileDataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    console.log(`[auth-service] Perfil ${role} salvo para UID: ${user.uid}`);
    return userCredential;
  } catch (error) {
    console.error("[auth-service] Erro no registro:", error);
    throw error;
  }
};

export const loginUser = async (email: string, password: string): Promise<FirebaseUser> => { try { const u = await signInWithEmailAndPassword(auth, email, password); return u.user; } catch (e) { console.error("Login error:", e); throw e; } };
export const logoutUser = async (): Promise<void> => { try { await signOut(auth); console.log("[auth-service] Usuário deslogado.");} catch (e) { console.error("Logout error:", e); throw e; } };
export const resetPassword = async (email: string): Promise<void> => { try { await sendPasswordResetEmail(auth, email); } catch (e) { console.error("Reset error:", e); throw e; } };

export const getCurrentUserData = async (): Promise<UserProfile | null> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log("[auth-service] getCurrentUserData: Nenhum usuário logado no Firebase Auth.");
      return null;
    }
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const userProfileData = docSnap.data() as UserProfile;
      console.log("[auth-service] getCurrentUserData - Dados recuperados:", JSON.stringify(userProfileData, null, 2));
      return userProfileData;
    } else {
      console.warn("[auth-service] getCurrentUserData: Documento do usuário não encontrado no Firestore para UID:", user.uid);
      return null;
    }
  } catch (e) {
    console.error("[auth-service] getCurrentUserData: Erro ao buscar dados do usuário:", e);
    throw e;
  }
};

// --- ADICIONADO E EXPORTADO: Tipo para payload de atualização do perfil do médico ---
export type DoctorProfileUpdatePayload = Partial<Omit<DoctorProfile,
  'uid' | 'email' | 'role' | 'cpf' | 'rg' |
  'documents' | 'specialistDocuments' |
  'createdAt' | 'updatedAt'
>>;

// --- ADICIONADO E EXPORTADO: Função para atualizar perfil do médico ---
export const updateDoctorProfileData = async (
  userId: string,
  dataToUpdate: DoctorProfileUpdatePayload
): Promise<void> => {
  if (!userId) {
    console.error("[updateDoctorProfileData] ID do usuário não fornecido.");
    throw new Error("ID do usuário não fornecido para atualização.");
  }
  if (Object.keys(dataToUpdate).length === 0) {
    console.log("[updateDoctorProfileData] Nenhum dado fornecido para atualização.");
    return;
  }

  const userDocRef = doc(db, "users", userId);

  const updatePayloadWithTimestamp: Record<string, any> = {
    ...dataToUpdate,
    updatedAt: serverTimestamp(),
  };

  // Especificamente para o endereço, precisamos garantir que ele seja atualizado corretamente.
  // Se dataToUpdate.address for undefined, não queremos sobrescrever o endereço existente.
  // Se dataToUpdate.address for um objeto (mesmo que vazio), ele tentará sobrescrever.
  // A lógica no componente de edição deve garantir que `address` seja enviado apenas se houver alterações.
  if (dataToUpdate.address && Object.keys(dataToUpdate.address).length > 0) {
    updatePayloadWithTimestamp.address = dataToUpdate.address;
  } else if (dataToUpdate.hasOwnProperty('address') && !dataToUpdate.address) {
    // Se 'address' foi explicitamente setado como null/undefined no payload (para limpar),
    // você pode precisar de uma lógica para remover o campo ou setá-lo como null no Firestore,
    // mas Omit já deve prevenir isso se address não for parte do payload.
    // A forma como DoctorProfileUpdatePayload é definido com Partial<Omit<...>> significa
    // que 'address' pode não estar presente no dataToUpdate.
    // Se estiver, e for um objeto vazio, pode causar problemas.
    // A lógica na página de edição deve construir o payload 'address' cuidadosamente.
  }


  try {
    await updateDoc(userDocRef, updatePayloadWithTimestamp);
    console.log("[updateDoctorProfileData] Perfil do médico atualizado com sucesso no Firestore para UID:", userId);

    if (dataToUpdate.displayName && auth.currentUser && auth.currentUser.uid === userId) {
      try {
        await updateProfile(auth.currentUser, { displayName: dataToUpdate.displayName });
        console.log("[updateDoctorProfileData] DisplayName no Firebase Auth atualizado para:", dataToUpdate.displayName);
      } catch (authError) {
        console.error("[updateDoctorProfileData] Erro ao atualizar displayName no Firebase Auth:", authError);
      }
    }
  } catch (error) {
    console.error("[updateDoctorProfileData] Erro ao atualizar perfil do médico no Firestore:", error);
    throw error;
  }
};