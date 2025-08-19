// components/auth-provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentUserData, type UserProfile } from "@/lib/auth-service";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    console.log("[AuthProvider] Subscribing to onAuthStateChanged (montagem do provider)");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AuthProvider] onAuthStateChanged: User state changed. New Firebase user:", firebaseUser ? firebaseUser.uid : null);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        setProfileLoading(true);
        try {
          const profile = await getCurrentUserData();
          setUserProfile(profile);
          console.log("[AuthProvider] onAuthStateChanged: Profile fetched after user state change:", profile);

          // --- BLOCO DE DEPURACÃO ADICIONADO ---
          // Estas linhas são cruciais para descobrirmos o problema
          console.log("--- DEBUGGING AUTH PROVIDER ---");
          console.log("Perfil recebido do Firestore:", profile);
          console.log("Tipo de utilizador (userType):", profile?.userType);
          console.log("---------------------------------");
          // --- FIM DO BLOCO DE DEPURACÃO ---

        } catch (error) {
          console.error("[AuthProvider] onAuthStateChanged: Error fetching profile:", error);
          setUserProfile(null); 
        } finally {
          setProfileLoading(false);
        }
      } else {
        setUserProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
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
    loading,
    profileLoading,
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