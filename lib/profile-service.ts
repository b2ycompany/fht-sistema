import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage, auth } from "./firebase"

export interface PersonalInfo {
  name: string
  email: string
  phone: string
  cpf: string
  birthdate: string
  gender: string
  address: string
  photoURL?: string
}

export interface ProfessionalInfo {
  crm: string
  graduation: string
  graduationYear: string
  specialties: string[]
  serviceType: string
  experience: number
  bio: string
}

export interface FinancialInfo {
  hourlyRate: number
  bank: string
  agency: string
  account: string
  accountType: string
  pix: string
}

export interface DoctorProfile {
  uid: string
  personal: PersonalInfo
  professional: ProfessionalInfo
  financial: FinancialInfo
  updatedAt: Date
}

// Get doctor profile
export const getDoctorProfile = async (userId?: string): Promise<DoctorProfile | null> => {
  try {
    const uid = userId || auth.currentUser?.uid
    if (!uid) return null

    const profileDoc = await getDoc(doc(db, "doctorProfiles", uid))
    if (profileDoc.exists()) {
      return profileDoc.data() as DoctorProfile
    }

    return null
  } catch (error) {
    console.error("Error getting doctor profile:", error)
    throw error
  }
}

// Create or update personal info
export const updatePersonalInfo = async (personalInfo: PersonalInfo): Promise<void> => {
  try {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error("User not authenticated")

    const profileRef = doc(db, "doctorProfiles", uid)
    const profileDoc = await getDoc(profileRef)

    if (profileDoc.exists()) {
      await updateDoc(profileRef, {
        personal: personalInfo,
        updatedAt: new Date(),
      })
    } else {
      await setDoc(profileRef, {
        uid,
        personal: personalInfo,
        professional: {},
        financial: {},
        updatedAt: new Date(),
      })
    }
  } catch (error) {
    console.error("Error updating personal info:", error)
    throw error
  }
}

// Create or update professional info
export const updateProfessionalInfo = async (professionalInfo: ProfessionalInfo): Promise<void> => {
  try {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error("User not authenticated")

    const profileRef = doc(db, "doctorProfiles", uid)
    const profileDoc = await getDoc(profileRef)

    if (profileDoc.exists()) {
      await updateDoc(profileRef, {
        professional: professionalInfo,
        updatedAt: new Date(),
      })
    } else {
      await setDoc(profileRef, {
        uid,
        personal: {},
        professional: professionalInfo,
        financial: {},
        updatedAt: new Date(),
      })
    }
  } catch (error) {
    console.error("Error updating professional info:", error)
    throw error
  }
}

// Create or update financial info
export const updateFinancialInfo = async (financialInfo: FinancialInfo): Promise<void> => {
  try {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error("User not authenticated")

    const profileRef = doc(db, "doctorProfiles", uid)
    const profileDoc = await getDoc(profileRef)

    if (profileDoc.exists()) {
      await updateDoc(profileRef, {
        financial: financialInfo,
        updatedAt: new Date(),
      })
    } else {
      await setDoc(profileRef, {
        uid,
        personal: {},
        professional: {},
        financial: financialInfo,
        updatedAt: new Date(),
      })
    }
  } catch (error) {
    console.error("Error updating financial info:", error)
    throw error
  }
}

// Upload profile photo
export const uploadProfilePhoto = async (file: File): Promise<string> => {
  try {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error("User not authenticated")

    const storageRef = ref(storage, `profilePhotos/${uid}`)
    await uploadBytes(storageRef, file)

    const downloadURL = await getDownloadURL(storageRef)

    // Update profile with photo URL
    const profileRef = doc(db, "doctorProfiles", uid)
    const profileDoc = await getDoc(profileRef)

    if (profileDoc.exists()) {
      const profile = profileDoc.data() as DoctorProfile
      await updateDoc(profileRef, {
        personal: {
          ...profile.personal,
          photoURL: downloadURL,
        },
        updatedAt: new Date(),
      })
    }

    return downloadURL
  } catch (error) {
    console.error("Error uploading profile photo:", error)
    throw error
  }
}

