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
  doc, setDoc, getDoc, updateDoc,
  serverTimestamp, Timestamp
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type UserType = "doctor" | "hospital" | "admin" | "backoffice";

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

export interface AdminProfile extends UserProfileBase {
    role: 'admin' | 'backoffice';
    permissions?: string[];
}

export type UserProfile = DoctorProfile | HospitalProfile | AdminProfile;

export const registerUser = async (
  email: string, password: string, name: string, role: UserType,
  registrationData: DoctorRegistrationPayload | HospitalRegistrationPayload
): Promise<UserCredential> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName: name });

    let userProfileDataToSave: Omit<DoctorProfile, 'createdAt' | 'updatedAt'> | Omit<HospitalProfile, 'createdAt' | 'updatedAt'>;

    if (role === 'doctor' && 'cpf' in registrationData) {
        const doctorData = registrationData as DoctorRegistrationPayload;
        userProfileDataToSave = {
            uid: user.uid, email: user.email || email, displayName: name, role: 'doctor',
            dob: doctorData.dob, rg: doctorData.rg, cpf: doctorData.cpf, phone: doctorData.phone,
            address: doctorData.address, isSpecialist: doctorData.isSpecialist,
            documents: doctorData.documents, specialistDocuments: doctorData.specialistDocuments,
        };
    } else if (role === 'hospital' && 'cnpj' in registrationData) {
        const hospitalData = registrationData as HospitalRegistrationPayload;
        userProfileDataToSave = {
            uid: user.uid, email: user.email || email, displayName: name, role: 'hospital',
            companyInfo: {
                cnpj: hospitalData.cnpj, stateRegistration: hospitalData.stateRegistration,
                phone: hospitalData.phone, address: hospitalData.address,
            },
            legalRepresentativeInfo: hospitalData.legalRepresentativeInfo,
            hospitalDocs: hospitalData.hospitalDocs, legalRepDocuments: hospitalData.legalRepDocuments,
        };
    } else {
        throw new Error("Dados de registro inválidos para o tipo de perfil selecionado.");
    }

    await setDoc(doc(db, "users", user.uid), {
        ...userProfileDataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return userCredential;
  } catch (error) { console.error("[auth-service] Erro no registro:", error); throw error; }
};

export const loginUser = async (email: string, password: string): Promise<FirebaseUser> => { try { const u = await signInWithEmailAndPassword(auth, email, password); return u.user; } catch (e) { console.error("Login error:", e); throw e; } };
export const logoutUser = async (): Promise<void> => { try { await signOut(auth); console.log("[auth-service] Usuário deslogado.");} catch (e) { console.error("Logout error:", e); throw e; } };
export const resetPassword = async (email: string): Promise<void> => { try { await sendPasswordResetEmail(auth, email); } catch (e) { console.error("Reset error:", e); throw e; } };

export const getCurrentUserData = async (): Promise<UserProfile | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return docSnap.data() as UserProfile;
    return null;
  } catch (e) { console.error("Get user data error:", e); throw e; }
};

export type DoctorProfileUpdatePayload = Partial<Omit<DoctorProfile,
  'uid' | 'email' | 'role' | 'cpf' | 'rg' |
  'documents' | 'specialistDocuments' |
  'createdAt' | 'updatedAt'
>>;

export const updateDoctorProfileData = async (userId: string, dataToUpdate: DoctorProfileUpdatePayload): Promise<void> => {
  if (!userId) throw new Error("ID do usuário não fornecido.");
  if (Object.keys(dataToUpdate).length === 0) return;
  const userDocRef = doc(db, "users", userId);
  const updatePayloadWithTimestamp: Record<string, any> = { ...dataToUpdate, updatedAt: serverTimestamp() };
  try {
    await updateDoc(userDocRef, updatePayloadWithTimestamp);
    if (dataToUpdate.displayName && auth.currentUser && auth.currentUser.uid === userId) {
      await updateProfile(auth.currentUser, { displayName: dataToUpdate.displayName });
    }
  } catch (error) { console.error("Erro ao atualizar perfil do médico:", error); throw error; }
};