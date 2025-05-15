// components/auth-provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react"; // CORRIGIDO
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase"; // Ajuste o caminho se necessário
import { getCurrentUserData, type UserProfile, type HospitalProfile, type DoctorProfile } from "@/lib/auth-service"; // Ajuste o caminho

interface AuthContextType {
  user: User | null; // Usuário do Firebase Auth
  userProfile: UserProfile | null; // Perfil do Firestore (DoctorProfile ou HospitalProfile ou AdminProfile)
  loading: boolean; // Estado de carregamento inicial do AuthProvider
  profileLoading: boolean; // Estado de carregamento do perfil do Firestore
  // Removido hospitalUser, usaremos userProfile com type guard
  // hospitalUser: HospitalProfile | null; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true); // Para o estado inicial do onAuthStateChanged
  const [profileLoading, setProfileLoading] = useState(true); // Para o carregamento do perfil do Firestore

  useEffect(() => {
    console.log("[AuthProvider] Subscribing to onAuthStateChanged (montagem do provider)");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AuthProvider] onAuthStateChanged: User state changed. New Firebase user:", firebaseUser ? firebaseUser.uid : null);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        setProfileLoading(true); // Inicia o carregamento do perfil
        try {
          const profile = await getCurrentUserData(); // getCurrentUserData já usa auth.currentUser
          setUserProfile(profile);
          console.log("[AuthProvider] onAuthStateChanged: Profile fetched after user state change:", profile);
        } catch (error) {
          console.error("[AuthProvider] onAuthStateChanged: Error fetching profile:", error);
          setUserProfile(null); 
        } finally {
          setProfileLoading(false); // Finaliza o carregamento do perfil
        }
      } else {
        setUserProfile(null); // Limpa o perfil se não houver usuário Firebase
        setProfileLoading(false); // Para o loading do perfil se não houver usuário
      }
      setLoading(false); // Finaliza o loading inicial do AuthProvider
      console.log("[AuthProvider] onAuthStateChanged: Loading set to false.");
    });

    return () => {
      console.log("[AuthProvider] Unsubscribing from onAuthStateChanged (desmontagem do provider)");
      unsubscribe();
    };
  }, []);

  const contextValue = {
    user,
    userProfile,
    loading, // Este é o loading do AuthProvider (estado inicial do Firebase Auth)
    profileLoading, // Este é o loading do perfil do Firestore
  };
  
  console.log("[AuthProvider] Context values updated - User:", user ? user.uid : null, "Loading:", loading, "ProfileLoading:", profileLoading);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};