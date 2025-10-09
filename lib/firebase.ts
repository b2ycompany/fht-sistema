// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// A sua configuração do Firebase com o storageBucket corrigido
const firebaseConfig = {
  apiKey: "AIzaSyAyoX1YqAdqHuIvSoj0Yw_FYnhCBv-KfEA",
  authDomain: "fht-sistema.firebaseapp.com",
  projectId: "fht-sistema",
  // =================================================================
  // 🔹 CORREÇÃO APLICADA AQUI 🔹
  // =================================================================
  storageBucket: "fht-sistema.appspot.com",
  messagingSenderId: "583837273524",
  appId: "1:583837273524:web:1583addfce581e61ac76e1",
  measurementId: "G-6FJ2H3G32N"
};

// Inicialização do Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Alinhando a região do frontend com a região REAL do backend
const functions = getFunctions(app, "us-central1");

// Exportando 'functions' para que o resto da aplicação possa usá-lo
export { app, auth, db, storage, functions };