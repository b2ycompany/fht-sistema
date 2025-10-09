// components/auth-provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentUserData, type UserProfile, AdminProfile, confirmFirstLogin } from "@/lib/auth-service";
import { useRouter, usePathname } from "next/navigation";

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
  isRegistering: boolean; // <-- NOVO ESTADO
  setIsRegistering: (isRegistering: boolean) => void; // <-- NOVA FUNÇÃO
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false); // <-- NOVO ESTADO
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setProfileLoading(true);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          const userRole = tokenResult.claims.role as string | undefined;

          const isPublicRoute = ['/login', '/register', '/reset-password']
            .some(route => pathname.startsWith(route));

          // =================================================================
          // 🔹 LÓGICA FINAL E ROBUSTA 🔹
          // =================================================================
          // Agora, só forçamos o logout se o usuário não tiver role, não estiver
          // numa rota pública E NÃO ESTIVER NO MEIO DE UM CADASTRO.
          if (!userRole && !isPublicRoute && !isRegistering) {
            console.warn(
              `[AuthProvider] Usuário ${firebaseUser.uid} autenticado mas sem role válida. Forçando logout para segurança. Pathname: ${pathname}`
            );
            await signOut(auth);
            setProfileLoading(false);
            setLoading(false);
            return;
          }
          
          if (userRole) {
            console.log("[AuthProvider] Role válida encontrada. Carregando perfil do usuário...");
            const profile = await getCurrentUserData();
            
            if (profile && profile.status === 'INVITED') {
              await confirmFirstLogin();
              const updatedProfile = { ...profile, status: 'ACTIVE' as const };
              setUserProfile(updatedProfile);
            } else {
              setUserProfile(profile);
            }
  
            const targetPath = getRedirectPathForProfile(profile);
            
            if (isPublicRoute) {
              router.replace(targetPath);
            }
          } else if (isPublicRoute || isRegistering) {
            console.log(`[AuthProvider] Usuário ${firebaseUser.uid} sem role, mas fluxo de registro/público permitido. Pathname: ${pathname}`);
          }

        } catch (error) {
          console.error("[AuthProvider] Erro crítico no fluxo de autenticação:", error);
          await signOut(auth);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setUserProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname, isRegistering]); // Adicionado isRegistering às dependências

  const contextValue = { user, userProfile, loading, profileLoading, isRegistering, setIsRegistering };

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