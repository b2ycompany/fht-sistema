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
  collection,
  query,
  where,
  getDocs,
  documentId,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type UserType = "doctor" | "hospital" | "admin" | "backoffice";
export type ProfileStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED_NEEDS_RESUBMISSION";

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
  professionalCrm: string;
  specialties: string[];    
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
  documentVerificationStatus?: ProfileStatus;
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
  documentVerificationStatus?: ProfileStatus;
  adminVerificationNotes?: string;
}
export interface AdminProfile extends UserProfileBase {
  role: "admin" | "backoffice";
  permissions?: string[];
  adminVerificationNotes?: string;
}

export type UserProfile = DoctorProfile | HospitalProfile | AdminProfile;

// Interface para os dados de atualização do perfil do médico
export interface DoctorProfileUpdatePayload {
  displayName?: string; // <<< CAMPO CORRIGIDO/ADICIONADO
  name?: string;
  dob?: string;
  rg?: string;
  phone?: string;
  address?: Partial<AddressInfo>;
  isSpecialist?: boolean;
  documents?: Partial<DoctorDocumentsRef>;
  specialistDocuments?: Partial<SpecialistDocumentsRef>;
  documentVerificationStatus?: ProfileStatus;
  adminVerificationNotes?: string;
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
  let userProfileDataSpecific: any = {};

  if (role === "doctor") {
    const { documents, specialistDocuments, ...doctorDetails } = registrationData as DoctorRegistrationPayload;
    userProfileDataSpecific = {
      ...doctorDetails,
      documents,
      specialistDocuments,
      documentVerificationStatus: "PENDING_REVIEW",
      adminVerificationNotes: "",
    };
  } else if (role === "hospital") {
    const { hospitalDocs, legalRepDocuments, ...hospitalDetails } = registrationData as HospitalRegistrationPayload;
    userProfileDataSpecific = {
      // O seu código original estava correto, mas faltavam os campos de status
      companyInfo: {
        cnpj: (hospitalDetails as any).cnpj,
        stateRegistration: (hospitalDetails as any).stateRegistration,
        phone: (hospitalDetails as any).phone,
        address: (hospitalDetails as any).address,
      },
      legalRepresentativeInfo: (hospitalDetails as any).legalRepresentativeInfo,
      hospitalDocs,
      legalRepDocuments,
      // *** ALTERAÇÃO APLICADA AQUI ***
      documentVerificationStatus: "PENDING_REVIEW",
      adminVerificationNotes: "",
    };
  } else {
    throw new Error("Tipo de perfil de registro inválido.");
  }
  
  const finalProfileData = {
    uid: userId,
    email,
    displayName,
    role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...userProfileDataSpecific
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
  await updateUserVerificationStatus(doctorId, status, notes);
};

export const updateDoctorProfileData = async (
  doctorId: string,
  dataToUpdate: DoctorProfileUpdatePayload,
): Promise<void> => {
  if (!doctorId) {
    throw new Error("ID do Doutor não fornecido para atualização.");
  }
  if (!dataToUpdate || Object.keys(dataToUpdate).length === 0) {
    console.warn("[AuthService] Nenhum dado fornecido para atualização do perfil do doutor.");
    return; 
  }

  const doctorDocRef = doc(db, "users", doctorId);
  const updatePayload: any = {};

  Object.keys(dataToUpdate).forEach(key => {
    const fieldKey = key as keyof DoctorProfileUpdatePayload;
    if (dataToUpdate[fieldKey] !== undefined) {
      if (fieldKey === 'address' && typeof dataToUpdate.address === 'object' && dataToUpdate.address !== null) {
        Object.keys(dataToUpdate.address).forEach(addressKey => {
          const typedAddressKey = addressKey as keyof AddressInfo;
          if (dataToUpdate.address![typedAddressKey] !== undefined) {
             updatePayload[`address.${typedAddressKey}`] = dataToUpdate.address![typedAddressKey];
          }
        });
      } else {
        updatePayload[fieldKey] = dataToUpdate[fieldKey];
      }
    }
  });
  
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

// --- NOVAS FUNÇÕES PARA O ADMIN ---

export const getUsersForVerification = async (): Promise<UserProfile[]> => {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("documentVerificationStatus", "==", "PENDING_REVIEW"));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return [];
      }
      
      return querySnapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
    } catch (error) {
      console.error("Erro ao buscar usuários para verificação:", error);
      throw new Error("Não foi possível buscar os cadastros pendentes.");
    }
};
  
export const updateUserVerificationStatus = async (
    userId: string,
    status: ProfileStatus,
    notes = ""
): Promise<void> => {
    if (!userId) throw new Error("ID do usuário não fornecido.");
  
    const userRef = doc(db, "users", userId);
    const payload: any = {
      documentVerificationStatus: status,
      adminVerificationNotes: notes,
      updatedAt: serverTimestamp(),
    };
    
    try {
      await updateDoc(userRef, payload);
    } catch (error) {
      console.error(`Erro ao atualizar status do usuário ${userId}:`, error);
      throw new Error("Falha ao atualizar o status do cadastro.");
    }
};