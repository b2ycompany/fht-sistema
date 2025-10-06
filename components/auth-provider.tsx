// components/auth-provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentUserData, type UserProfile, AdminProfile, confirmFirstLogin } from "@/lib/auth-service";
import { useRouter } from "next/navigation";

// Sua função de redirecionamento foi mantida
const getRedirectPathForProfile = (profile: UserProfile | null): string => {
    if (!profile || !profile.userType) {
        return '/login'; 
    }
    switch (profile.userType) {
        case 'admin':
        case 'backoffice':
            return '/admin/caravanas';
        case 'hospital':
            return '/hospital/dashboard';
        case 'doctor':
            return '/dashboard';
        case 'receptionist':
            return '/dashboard/reception';
        case 'triage_nurse':
            return '/dashboard/triage';
        case 'caravan_admin':
            const adminProfileCaravan = profile as AdminProfile;
            if (adminProfileCaravan.assignedCaravanId) {
                return `/caravan/${adminProfileCaravan.assignedCaravanId}/dashboard`;
            }
            return '/';
        default:
            return '/';
    }
};

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
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setProfileLoading(true);
      setUser(firebaseUser); // Define o utilizador Firebase imediatamente
      
      if (firebaseUser) {
        try {
          // Força a atualização do token para obter as claims mais recentes
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          const userRole = tokenResult.claims.role as string | undefined;

          // Lógica simplificada: se não tem uma role válida, não deve prosseguir
          if (!userRole || !['hospital', 'doctor', 'admin', 'receptionist', 'triage_nurse', 'caravan_admin'].includes(userRole)) {
              console.error(`[AuthProvider] Utilizador ${firebaseUser.uid} autenticado mas sem uma role válida. A forçar logout.`);
              await signOut(auth);
              // A limpeza dos estados será feita no próximo ciclo do onAuthStateChanged
              return; 
          }
          
          // Se tem uma role, prossiga normalmente
          console.log("[AuthProvider] Role válida encontrada. A carregar perfil do utilizador...");
          const profile = await getCurrentUserData();
          
          if (profile && profile.status === 'INVITED') {
            await confirmFirstLogin();
            const updatedProfile = { ...profile, status: 'ACTIVE' as const };
            setUserProfile(updatedProfile);
          } else {
            setUserProfile(profile);
          }

          const targetPath = getRedirectPathForProfile(profile);
          const currentPath = window.location.pathname;
          const publicRoutes = ['/login', '/register', '/reset-password'];

          if (publicRoutes.includes(currentPath)) {
            router.replace(targetPath);
          }

        } catch (error) {
          console.error("[AuthProvider] Erro crítico no fluxo de autenticação:", error);
          await signOut(auth);
        } finally {
          setProfileLoading(false);
        }
      } else {
        // Se não há utilizador logado, limpa os dados
        setUserProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const contextValue = { user, userProfile, loading, profileLoading };

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