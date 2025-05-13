import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMzel8YJ9l9puiOIHvKOKR7A1tGTGZB9M",
  authDomain: "clinic-b51d7.firebaseapp.com",
  projectId: "clinic-b51d7",
  storageBucket: "clinic-b51d7.firebasestorage.app",
  messagingSenderId: "735856020061",
  appId: "1:735856020061:web:baf1218873a185d4dc5bb4",
  measurementId: "G-FT4RYZCRH4"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)

export { app, auth, db, storage }

