// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration (SUAS CREDENCIAIS ORIGINAIS)
const firebaseConfig = {
  apiKey: "AIzaSyAyoX1YqAdqHuIvSoj0Yw_FYnhCBv-KfEA",
  authDomain: "fht-sistema.firebaseapp.com",
  projectId: "fht-sistema",
  storageBucket: "fht-sistema.firebasestorage.app",
  messagingSenderId: "583837273524",
  appId: "1:583837273524:web:1583addfce581e61ac76e1",
  measurementId: "G-6FJ2H3G32N"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };