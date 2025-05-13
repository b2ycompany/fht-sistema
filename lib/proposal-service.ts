import { collection, doc, getDoc, getDocs, query, where, updateDoc, serverTimestamp } from "firebase/firestore"
import { db, auth } from "./firebase"

export type ProposalStatus = "pending" | "accepted" | "rejected"

export interface HospitalProfile {
  name: string
  description: string
  founded: string
  employees: string
  specialties: string[]
}

export interface Proposal {
  id?: string
  doctorId: string
  hospitalId: string
  hospital: string
  specialty: string
  date: Date
  time: string
  duration: string
  location: string
  description: string
  requirements: string
  value: number
  status: ProposalStatus
  hospitalProfile: HospitalProfile
  createdAt?: Date
  updatedAt?: Date
}

// Get all proposals for the current doctor
export const getProposals = async (): Promise<Proposal[]> => {
  try {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error("User not authenticated")

    // Buscar todas as propostas para o médico atual
    const q = query(collection(db, "proposals"), where("doctorId", "==", uid))
    const querySnapshot = await getDocs(q)

    const proposals: Proposal[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      proposals.push({
        id: doc.id,
        doctorId: data.doctorId,
        hospitalId: data.hospitalId,
        hospital: data.hospital,
        specialty: data.specialty,
        date: data.date.toDate(),
        time: data.time,
        duration: data.duration,
        location: data.location,
        description: data.description,
        requirements: data.requirements,
        value: data.value,
        status: data.status,
        hospitalProfile: data.hospitalProfile,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      })
    })

    return proposals
  } catch (error) {
    console.error("Error getting proposals:", error)
    throw error
  }
}

// Get a specific proposal
export const getProposal = async (id: string): Promise<Proposal | null> => {
  try {
    const proposalDoc = await getDoc(doc(db, "proposals", id))

    if (proposalDoc.exists()) {
      const data = proposalDoc.data()
      return {
        id: proposalDoc.id,
        doctorId: data.doctorId,
        hospitalId: data.hospitalId,
        hospital: data.hospital,
        specialty: data.specialty,
        date: data.date.toDate(),
        time: data.time,
        duration: data.duration,
        location: data.location,
        description: data.description,
        requirements: data.requirements,
        value: data.value,
        status: data.status,
        hospitalProfile: data.hospitalProfile,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      }
    }

    return null
  } catch (error) {
    console.error("Error getting proposal:", error)
    throw error
  }
}

// Update proposal status
export const updateProposalStatus = async (id: string, status: ProposalStatus): Promise<void> => {
  try {
    await updateDoc(doc(db, "proposals", id), {
      status,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating proposal status:", error)
    throw error
  }
}

// Buscar propostas compatíveis com as especialidades do médico
export const getMatchingProposals = async (specialty: string): Promise<Proposal[]> => {
  try {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error("User not authenticated")

    // Buscar propostas que correspondam à especialidade
    const q = query(collection(db, "proposals"), where("specialty", "==", specialty), where("status", "==", "pending"))

    const querySnapshot = await getDocs(q)

    const proposals: Proposal[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      // Verificar se a proposta já não foi atribuída a outro médico
      if (!data.doctorId || data.doctorId === uid) {
        proposals.push({
          id: doc.id,
          doctorId: uid, // Atribuir ao médico atual
          hospitalId: data.hospitalId,
          hospital: data.hospital,
          specialty: data.specialty,
          date: data.date.toDate(),
          time: data.time,
          duration: data.duration,
          location: data.location,
          description: data.description,
          requirements: data.requirements,
          value: data.value,
          status: "pending",
          hospitalProfile: data.hospitalProfile,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        })
      }
    })

    return proposals
  } catch (error) {
    console.error("Error getting matching proposals:", error)
    throw error
  }
}

