import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db, storage, auth } from "./firebase"

// Upload facial recognition data
export const uploadFacialData = async (imageBlob: Blob): Promise<string> => {
  try {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error("User not authenticated")

    // Upload the facial data to storage
    const storageRef = ref(storage, `facialData/${uid}/${Date.now()}`)
    await uploadBytes(storageRef, imageBlob)

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef)

    // Store the reference in Firestore
    const facialDataRef = doc(db, "facialData", uid)
    const facialDataDoc = await getDoc(facialDataRef)

    if (facialDataDoc.exists()) {
      await updateDoc(facialDataRef, {
        imageUrls: [...facialDataDoc.data().imageUrls, downloadURL],
        updatedAt: serverTimestamp(),
      })
    } else {
      await setDoc(facialDataRef, {
        uid,
        imageUrls: [downloadURL],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    return downloadURL
  } catch (error) {
    console.error("Error uploading facial data:", error)
    throw error
  }
}

// Verify facial recognition (mock implementation)
export const verifyFacialRecognition = async (imageBlob: Blob): Promise<boolean> => {
  try {
    // In a real implementation, this would call a facial recognition API
    // For this MVP, we'll just return true to simulate successful verification

    // Upload the verification attempt for audit purposes
    await uploadFacialData(imageBlob)

    return true
  } catch (error) {
    console.error("Error verifying facial recognition:", error)
    throw error
  }
}

