// components/auth-provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentUserData, type UserProfile, AdminProfile, confirmFirstLogin } from "@/lib/auth-service";
import { useRouter } from "next/navigation";

// A sua função de redirecionamento dinâmico foi mantida, está perfeita.
const getRedirectPathForProfile = (profile: UserProfile | null): string => {
    if (!profile || !profile.userType) {
        return '/login'; // Rota de segurança
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
             // Redireciona para a página específica da recepção
            return '/dashboard/reception';

        case 'triage_nurse':
            // Redireciona para a página específica da triagem
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
    // Este listener é a "fonte da verdade" e só precisa de ser configurado uma vez.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        setProfileLoading(true);
        try {
          const profile = await getCurrentUserData();
          
          if (profile && profile.status === 'INVITED') {
            await confirmFirstLogin();
            const updatedProfile = { ...profile, status: 'ACTIVE' as const };
            setUserProfile(updatedProfile);
          } else {
            setUserProfile(profile);
          }
          
          // --- LÓGICA DE REDIRECIONAMENTO CORRIGIDA ---
          const targetPath = getRedirectPathForProfile(profile);
          const currentPath = window.location.pathname; // Usamos o path real no momento da execução
          
          const publicRoutes = ['/login', '/register', '/reset-password'];

          // Redireciona se o utilizador estiver numa página pública (ex: /login)
          // OU se ele estiver numa página protegida que não é a sua página de destino.
          if (publicRoutes.includes(currentPath)) {
              console.log(`[AuthProvider] Utilizador em rota pública. Redirecionando para: ${targetPath}`);
              router.replace(targetPath); // .replace() é melhor para não poluir o histórico do navegador
          }
          
        } catch (error) {
          console.error("[AuthProvider] onAuthStateChanged: Erro ao buscar perfil:", error);
          setUserProfile(null); 
        } finally {
          setProfileLoading(false);
        }
      } else {
        // Se não há utilizador logado, limpamos os dados
        setUserProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    // A função de limpeza é retornada para ser executada quando o componente for desmontado
    return () => unsubscribe();
  }, [router]); // <<< CORREÇÃO: A dependência do 'pathname' foi removida para evitar o loop.

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