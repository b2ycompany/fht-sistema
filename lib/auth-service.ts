// lib/auth-service.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User as FirebaseUser,
  type UserCredential,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type UserType = "doctor" | "hospital" | "admin" | "backoffice";

export interface PersonalInfo {
  name: string;
  dob: string;
  rg: string;
  cpf: string;
  phone: string;
  email: string;
}
export interface AddressInfo {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}
export interface LegalRepresentativeInfo {
  name: string;
  dob: string;
  rg: string;
  cpf: string;
  phone: string;
  email: string;
  position: string;
}

export interface DoctorDocumentsRef {
  personalRg?: string;
  personalCpf?: string;
  professionalCrm?: string;
  photo3x4?: string;
  addressProof?: string;
  graduationCertificate?: string;
  criminalRecordCert?: string;
  ethicalCert?: string;
  debtCert?: string;
  cv?: string;
}
export interface SpecialistDocumentsRef {
  rqe?: string;
  postGradCert?: string;
  specialistTitle?: string;
  recommendationLetter?: string;
}
export interface HospitalDocumentsRef {
  socialContract?: string;
  cnpjCard?: string;
  companyAddressProof?: string;
}
export interface LegalRepDocumentsRef {
  repRg?: string;
  repCpf?: string;
  repAddressProof?: string;
}

export interface DoctorRegistrationPayload
  extends Omit<PersonalInfo, "email" | "name"> {
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

export interface UserProfileBase {
  uid: string;
  email: string;
  displayName: string;
  role: UserType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DoctorProfile extends UserProfileBase, DoctorRegistrationPayload {
  role: "doctor";
  documentVerificationStatus?: "PENDING_REVIEW" | "APPROVED" | "REJECTED_NEEDS_RESUBMISSION";
  adminVerificationNotes?: string;
}

export interface HospitalProfile extends UserProfileBase {
  role: "hospital";
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

export interface AdminProfile extends UserProfileBase {
  role: "admin" | "backoffice";
  permissions?: string[];
}

export type UserProfile = DoctorProfile | HospitalProfile | AdminProfile;

// Interface para os dados de atualização do perfil do médico
export interface DoctorProfileUpdatePayload {
  name?: string;
  dob?: string;
  rg?: string;
  phone?: string;
  address?: Partial<AddressInfo>;
  isSpecialist?: boolean; // Adicionado caso o médico possa mudar esse status
  // Adicione quaisquer outros campos que o médico possa editar no seu perfil
  // Ex: crm?: string; bio?: string; etc.
}


export const createAuthUser = async (
  email: string,
  password: string,
  displayName: string,
): Promise<FirebaseUser> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    await updateProfile(userCredential.user, {displayName});
    return userCredential.user;
  } catch (error) {
    console.error("[AuthService] Erro ao criar usuário no Auth:", error);
    throw error;
  }
};

export const completeUserRegistration = async (
  userId: string,
  email: string,
  displayName: string,
  role: UserType,
  registrationData: DoctorRegistrationPayload | HospitalRegistrationPayload,
): Promise<void> => {
  let userProfileDataSpecific:
    | Omit<DoctorProfile, keyof UserProfileBase | "documents" | "specialistDocuments" | "role"> 
    | Omit<HospitalProfile, keyof UserProfileBase | "hospitalDocs" | "legalRepDocuments" | "role">;

  let documentsToSave: any = {};

  if (role === "doctor") {
    const doctorData = registrationData as DoctorRegistrationPayload;
    userProfileDataSpecific = {
      dob: doctorData.dob,
      rg: doctorData.rg,
      cpf: doctorData.cpf,
      phone: doctorData.phone,
      address: doctorData.address,
      isSpecialist: doctorData.isSpecialist,
      documentVerificationStatus: "PENDING_REVIEW", 
      adminVerificationNotes: "",
    };
    documentsToSave = {
        documents: doctorData.documents,
        specialistDocuments: doctorData.specialistDocuments,
    };
  } else if (role === "hospital") {
    const hospitalData = registrationData as HospitalRegistrationPayload;
    userProfileDataSpecific = {
      companyInfo: {
        cnpj: hospitalData.cnpj,
        stateRegistration: hospitalData.stateRegistration,
        phone: hospitalData.phone,
        address: hospitalData.address,
      },
      legalRepresentativeInfo: hospitalData.legalRepresentativeInfo,
    };
    documentsToSave = {
        hospitalDocs: hospitalData.hospitalDocs,
        legalRepDocuments: hospitalData.legalRepDocuments,
    };
  } else {
    throw new Error("Tipo de perfil de registro inválido.");
  }

  const finalProfileData: Omit<UserProfileBase, "createdAt" | "updatedAt"> & typeof userProfileDataSpecific & typeof documentsToSave & { createdAt: any, updatedAt: any} = {
    uid: userId,
    email: email,
    displayName: displayName,
    role: role,
    ...userProfileDataSpecific,
    ...documentsToSave, 
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", userId), finalProfileData);
  console.log(`[AuthService] Perfil ${role} salvo para UID: ${userId}`);
};

export const loginUser = async (email: string, password: string): Promise<FirebaseUser> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (e) {
    console.error("[AuthService] Login error:", e);
    throw e;
  }
};
export const logoutUser = async (): Promise<void> => { try { await signOut(auth); } catch (e) { console.error("[AuthService] Logout error:", e); throw e; }};
export const resetPassword = async (email: string): Promise<void> => { try { await sendPasswordResetEmail(auth, email); } catch (e) { console.error("[AuthService] Reset error:", e); throw e; }};

export const getCurrentUserData = async (): Promise<UserProfile | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
    }
    return null;
  } catch (e) {
    console.error("[AuthService] Get current user data error:", e);
    throw e;
  }
};

export const getDoctorProfileForAdmin = async (doctorId: string): Promise<DoctorProfile | null> => {
  if (!doctorId) return null;
  try {
    const docRef = doc(db, "users", doctorId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().role === "doctor") {
      return { uid: docSnap.id, ...docSnap.data() } as DoctorProfile;
    }
    return null;
  } catch (error) {
    console.error(`[AuthService] Erro ao buscar perfil do doutor ${doctorId} para admin:`, error);
    throw error;
  }
};

export const updateDoctorDocumentVerificationStatus = async (
  doctorId: string,
  status: NonNullable<DoctorProfile["documentVerificationStatus"]>,
  notes?: string,
): Promise<void> => {
  if (!doctorId) throw new Error("ID do Doutor não fornecido.");
  const doctorDocRef = doc(db, "users", doctorId);
  const updatePayload: {
    documentVerificationStatus: NonNullable<DoctorProfile["documentVerificationStatus"]>;
    adminVerificationNotes?: string;
    updatedAt: Timestamp;
  } = {
    documentVerificationStatus: status,
    updatedAt: serverTimestamp() as Timestamp,
  };
  if (notes !== undefined) {
    updatePayload.adminVerificationNotes = notes;
  }
  try {
    await updateDoc(doctorDocRef, updatePayload);
  } catch (error) {
    console.error(`[AuthService] Erro ao atualizar status de docs do doutor ${doctorId}:`, error);
    throw error;
  }
};

// FUNÇÃO ADICIONADA PARA ATUALIZAR PERFIL DO MÉDICO
export const updateDoctorProfileData = async (
  doctorId: string,
  dataToUpdate: DoctorProfileUpdatePayload,
): Promise<void> => {
  if (!doctorId) {
    throw new Error("ID do Doutor não fornecido para atualização.");
  }
  if (!dataToUpdate || Object.keys(dataToUpdate).length === 0) {
    // Considerar se é um erro ou apenas não fazer nada
    console.warn("[AuthService] Nenhum dado fornecido para atualização do perfil do doutor.");
    return; 
  }

  const doctorDocRef = doc(db, "users", doctorId);
  const updatePayload: any = {};

  // Mapeia apenas os campos definidos em dataToUpdate para o payload final
  // Isso evita sobrescrever campos não intencionais com undefined
  Object.keys(dataToUpdate).forEach(key => {
    const fieldKey = key as keyof DoctorProfileUpdatePayload;
    if (dataToUpdate[fieldKey] !== undefined) {
      if (fieldKey === 'address' && typeof dataToUpdate.address === 'object' && dataToUpdate.address !== null) {
        // Atualização de campos aninhados para o endereço
        Object.keys(dataToUpdate.address).forEach(addressKey => {
          const typedAddressKey = addressKey as keyof AddressInfo;
          if (dataToUpdate.address![typedAddressKey] !== undefined) {
             updatePayload[`address.${typedAddressKey}`] = dataToUpdate.address![typedAddressKey];
          }
        });
      } else if (fieldKey !== 'address') { // Evita adicionar o objeto 'address' diretamente se já foi desmembrado
        updatePayload[fieldKey] = dataToUpdate[fieldKey];
      }
    }
  });
  
  // Se não há nada para atualizar após filtrar undefined (exceto updatedAt), não faz a chamada
  if (Object.keys(updatePayload).length === 0) {
    console.warn("[AuthService] Nenhum dado válido para atualizar após filtrar undefined.");
    return;
  }

  updatePayload.updatedAt = serverTimestamp();

  try {
    const docSnap = await getDoc(doctorDocRef);
    if (!docSnap.exists() || docSnap.data()?.role !== 'doctor') {
        throw new Error("Perfil de doutor não encontrado ou tipo de usuário incorreto para atualização.");
    }

    await updateDoc(doctorDocRef, updatePayload);
    console.log(`[AuthService] Perfil do doutor ${doctorId} atualizado com sucesso.`);
  } catch (error) {
    console.error(`[AuthService] Erro ao atualizar perfil do doutor ${doctorId}:`, error);
    throw error;
  }
};