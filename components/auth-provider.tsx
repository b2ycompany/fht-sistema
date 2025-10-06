// components/auth-provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentUserData, type UserProfile, AdminProfile, confirmFirstLogin } from "@/lib/auth-service";
import { useRouter } from "next/navigation";

// Sua função de redirecionamento foi mantida, está perfeita.
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
            if (adminProfileCaravan.assignedCaravanId) { // Corrigido para corresponder à sua lógica
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
          // CORREÇÃO DEFINITIVA DA "CONDIÇÃO DE CORRIDA"
          // ============================================================================
          
          // 1. Forçar a atualização do token uma vez para obter as claims mais recentes.
          let tokenResult = await firebaseUser.getIdTokenResult(true);
          let userRole = tokenResult.claims.role as string | undefined;
          
          // 2. SE A ROLE NÃO EXISTIR, INICIAMOS O MODO DE VERIFICAÇÃO PACIENTE
          if (!userRole) {
            console.log("[AuthProvider] Role não encontrada. A iniciar verificador para aguardar a atribuição da claim...");
            
            // Vamos tentar por até 15 segundos (5 tentativas a cada 3 segundos)
            const attempts = 5;
            for (let i = 0; i < attempts; i++) {
              // Espera 3 segundos entre cada tentativa
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              tokenResult = await firebaseUser.getIdTokenResult(true); // Força a atualização novamente
              userRole = tokenResult.claims.role as string | undefined;

              if (userRole) {
                console.log(`[AuthProvider] SUCESSO! Role '${userRole}' encontrada na tentativa ${i + 1}.`);
                break; // Sai do loop se a role for encontrada
              } else {
                console.log(`[AuthProvider] Tentativa ${i + 1}/${attempts}: role ainda não atribuída.`);
              }
            }
          }

          // 3. Após o verificador, tomamos a decisão final.
          if (userRole && ['hospital', 'doctor', 'admin', 'receptionist', 'triage_nurse', 'caravan_admin'].includes(userRole)) {
            // Se tem uma role, prossiga normalmente.
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
              console.log(`[AuthProvider] Utilizador com role '${userRole}' em rota pública. A redirecionar para: ${targetPath}`);
              router.replace(targetPath);
            }
          } else {
            // 4. SE, APÓS TODAS AS TENTATIVAS, A ROLE AINDA NÃO EXISTIR, AÍ SIM FORÇAMOS O LOGOUT.
            console.error(`[AuthProvider] UTILIZADOR PRESO DETETADO! O utilizador ${firebaseUser.uid} não recebeu uma role válida após 15 segundos. A forçar logout.`);
            setUserProfile(null);
            await signOut(auth);
          }
        } catch (error) {
          console.error("[AuthProvider] Erro crítico no fluxo de autenticação:", error);
          setUserProfile(null);
          await signOut(auth);
        } finally {
          setProfileLoading(false);
        }
      } else {
        // Se não há utilizador logado, limpamos os dados.
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