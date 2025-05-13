import { collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db, auth } from "./firebase"

export type ContractStatus = "upcoming" | "completed" | "canceled"

export interface Contract {
  id?: string
  proposalId: string
  doctorId: string
  hospitalId: string
  hospital: string
  specialty: string
  date: Date
  time: string
  duration: string
  location: string
  value: number
  status: ContractStatus
  checkInTime?: Date
  checkOutTime?: Date
  createdAt?: Date
  updatedAt?: Date
}

// Create a new contract from a proposal
export const createContract = async (proposalId: string): Promise<string> => {
  try {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error("User not authenticated")

    // Get the proposal
    const proposalDoc = await getDoc(doc(db, "proposals", proposalId))
    if (!proposalDoc.exists()) throw new Error("Proposal not found")

    const proposal = proposalDoc.data()

    // Create the contract
    const contractRef = await addDoc(collection(db, "contracts"), {
      proposalId,
      doctorId: uid,
      hospitalId: proposal.hospitalId,
      hospital: proposal.hospital,
      specialty: proposal.specialty,
      date: proposal.date,
      time: proposal.time,
      duration: proposal.duration,
      location: proposal.location,
      value: proposal.value,
      status: "upcoming" as ContractStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Update the proposal status
    await updateDoc(doc(db, "proposals", proposalId), {
      status: "accepted",
      updatedAt: serverTimestamp(),
    })

    return contractRef.id
  } catch (error) {
    console.error("Error creating contract:", error)
    throw error
  }
}

// Get all contracts for the current doctor
export const getContracts = async (): Promise<Contract[]> => {
  try {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error("User not authenticated")

    const q = query(collection(db, "contracts"), where("doctorId", "==", uid))
    const querySnapshot = await getDocs(q)

    const contracts: Contract[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      contracts.push({
        id: doc.id,
        proposalId: data.proposalId,
        doctorId: data.doctorId,
        hospitalId: data.hospitalId,
        hospital: data.hospital,
        specialty: data.specialty,
        date: data.date.toDate(),
        time: data.time,
        duration: data.duration,
        location: data.location,
        value: data.value,
        status: data.status,
        checkInTime: data.checkInTime?.toDate(),
        checkOutTime: data.checkOutTime?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      })
    })

    return contracts
  } catch (error) {
    console.error("Error getting contracts:", error)
    throw error
  }
}

// Get a specific contract
export const getContract = async (id: string): Promise<Contract | null> => {
  try {
    const contractDoc = await getDoc(doc(db, "contracts", id))

    if (contractDoc.exists()) {
      const data = contractDoc.data()
      return {
        id: contractDoc.id,
        proposalId: data.proposalId,
        doctorId: data.doctorId,
        hospitalId: data.hospitalId,
        hospital: data.hospital,
        specialty: data.specialty,
        date: data.date.toDate(),
        time: data.time,
        duration: data.duration,
        location: data.location,
        value: data.value,
        status: data.status,
        checkInTime: data.checkInTime?.toDate(),
        checkOutTime: data.checkOutTime?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      }
    }

    return null
  } catch (error) {
    console.error("Error getting contract:", error)
    throw error
  }
}

// Update contract status
export const updateContractStatus = async (id: string, status: ContractStatus): Promise<void> => {
  try {
    await updateDoc(doc(db, "contracts", id), {
      status,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating contract status:", error)
    throw error
  }
}

// Record check-in
export const recordCheckIn = async (id: string): Promise<void> => {
  try {
    await updateDoc(doc(db, "contracts", id), {
      checkInTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error recording check-in:", error)
    throw error
  }
}

// Record check-out
export const recordCheckOut = async (id: string): Promise<void> => {
  try {
    await updateDoc(doc(db, "contracts", id), {
      checkOutTime: serverTimestamp(),
      status: "completed" as ContractStatus,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error recording check-out:", error)
    throw error
  }
}

