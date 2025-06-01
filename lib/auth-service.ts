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
  documents: Partial<DoctorDocumentsRef>; // URLs após upload
  specialistDocuments: Partial<SpecialistDocumentsRef>; // URLs após upload
}
export interface HospitalRegistrationPayload {
  cnpj: string;
  stateRegistration?: string;
  phone: string;
  address: AddressInfo;
  legalRepresentativeInfo: LegalRepresentativeInfo;
  hospitalDocs: Partial<HospitalDocumentsRef>; // URLs
  legalRepDocuments: Partial<LegalRepDocumentsRef>; // URLs
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
    | Omit<DoctorProfile, keyof UserProfileBase | "documents" | "specialistDocuments">
    | Omit<HospitalProfile, keyof UserProfileBase | "hospitalDocs" | "legalRepDocuments">;

  let documentsToSave: any = {};

  if (role === "doctor") {
    const doctorData = registrationData as DoctorRegistrationPayload;
    userProfileDataSpecific = {
      // Campos de PersonalInfo (exceto email, name)
      dob: doctorData.dob,
      rg: doctorData.rg,
      cpf: doctorData.cpf,
      phone: doctorData.phone,
      // Outros campos específicos de DoctorProfile
      address: doctorData.address,
      isSpecialist: doctorData.isSpecialist,
      documentVerificationStatus: "PENDING_REVIEW", // Status inicial
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

  const finalProfileData = {
    uid: userId,
    email: email,
    displayName: displayName,
    role: role,
    ...userProfileDataSpecific,
    ...documentsToSave, // Adiciona os objetos de documentos (que contêm URLs)
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
  // TODO: Adicionar verificação de role do admin que está fazendo a chamada
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
  // TODO: Adicionar verificação de role do admin
  const doctorDocRef = doc(db, "users", doctorId);
  const updatePayload: {
    documentVerificationStatus: NonNullable<DoctorProfile["documentVerificationStatus"]>;
    adminVerificationNotes?: string;
    updatedAt: Timestamp;
  } = {
    documentVerificationStatus: status,
    updatedAt: serverTimestamp() as Timestamp, // Cast para Timestamp do cliente
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