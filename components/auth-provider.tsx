// components/auth-provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentUserData, type UserProfile, AdminProfile, confirmFirstLogin } from "@/lib/auth-service";
import { useRouter } from "next/navigation";

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
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // ============================================================================
          // CORREÇÃO DEFINITIVA PARA O LOOP DE REDIRECIONAMENTO
          // ============================================================================
          
          // 1. Forçar a atualização do token para obter as claims mais recentes.
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          const userRole = tokenResult.claims.role as string | undefined;

          // 2. Verificar se o utilizador tem uma permissão (role) válida.
          if (userRole && ['hospital', 'doctor', 'admin', 'receptionist', 'triage_nurse', 'caravan_admin'].includes(userRole)) {
            // Se tem uma role, prossiga normalmente.
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
              console.log(`[AuthProvider] Utilizador com role '${userRole}' em rota pública. A redirecionar para: ${targetPath}`);
              router.replace(targetPath);
            }
          } else {
            // ============================================================================
            // 3. SE NÃO TEM UMA ROLE: Utilizador "preso". Forçar logout.
            // ============================================================================
            console.error(`[AuthProvider] UTILIZADOR PRESO DETETADO! O utilizador ${firebaseUser.uid} está autenticado mas não tem uma role válida. A forçar logout para quebrar o loop.`);
            setUserProfile(null);
            await signOut(auth);
            // O utilizador será deslogado e o listener onAuthStateChanged irá disparar novamente,
            // desta vez com firebaseUser como null, caindo no bloco 'else' abaixo.
          }
        } catch (error) {
          console.error("[AuthProvider] Erro crítico no fluxo de autenticação:", error);
          setUserProfile(null);
          await signOut(auth); // Faz logout como medida de segurança em caso de erro.
        } finally {
          setProfileLoading(false);
        }
      } else {
        // Se não há utilizador logado, limpamos os dados e garantimos que está tudo a zero.
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