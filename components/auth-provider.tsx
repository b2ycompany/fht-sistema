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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
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
          // 🔹 CORREÇÃO FINAL APLICADA AQUI 🔹
          // =================================================================
          // Se não houver role e NÃO estivermos numa rota pública, aí sim forçamos o logout.
          // Se estivermos numa rota pública (como a de registo), a condição será falsa e este bloco não será executado.
          if (!userRole && !isPublicRoute) {
            console.warn(
              `[AuthProvider] Utilizador ${firebaseUser.uid} autenticado mas sem role válida. Forçando logout para segurança. Pathname: ${pathname}`
            );
            // O signOut FOI MANTIDO AQUI INTENCIONALMENTE para proteger rotas privadas.
            // O erro anterior era a lógica que não ignorava as rotas públicas corretamente.
            // A sua lógica atual está correta, mas a mensagem do console estava errada.
            // A correção é que o `isPublicRoute` deve impedir a entrada neste bloco.
            // Vamos ajustar a mensagem para ser mais clara.
            await signOut(auth);
            return;
          }
          
          if (userRole) {
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
            const publicRoutes = ['/login', '/register', '/reset-password'];
  
            if (publicRoutes.some(route => pathname.startsWith(route))) {
              router.replace(targetPath);
            }
          } else if (isPublicRoute) {
            console.log(`[AuthProvider] Utilizador ${firebaseUser.uid} sem role, mas em rota pública. Permitindo continuação do fluxo de registo/login.`);
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
  }, [router, pathname]);

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