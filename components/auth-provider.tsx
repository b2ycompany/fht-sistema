// components/auth-provider.tsx (Código Completo e Corrigido)
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
    
    // ============================================================================
    // 🔹 CORREÇÃO DE FLUXO (Segurança) 🔹
    // Se o status não for APROVADO, redireciona para o dashboard (onde será bloqueado)
    // ============================================================================
    const verificationStatus = (profile as any).documentVerificationStatus;
    if (verificationStatus && verificationStatus !== 'APPROVED' && verificationStatus !== 'NOT_APPLICABLE') {
        // Se estiver pendente ou rejeitado, força o utilizador a ir para o dashboard
        // onde o layout.tsx irá mostrar a tela de bloqueio.
        if (profile.userType === 'doctor' || profile.userType === 'hospital') {
            return '/dashboard';
        }
    }

    switch (profile.userType) {
        case 'admin':
        case 'backoffice':
            return '/admin/matches'; // <<< CORREÇÃO: Enviando para 'matches' em vez de 'caravanas'
        case 'hospital':
            return '/dashboard'; // <<< CORREÇÃO: Hospital agora usa o layout /dashboard
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
  // ============================================================================
  // 🔹 CORREÇÃO DE FLUXO (Segurança) 🔹
  // Adiciona o status de verificação ao contexto global.
  // ============================================================================
  documentVerificationStatus: string | null; 
  loading: boolean;
  profileLoading: boolean;
  isRegistering: boolean;
  setIsRegistering: (isRegistering: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // <<< CORREÇÃO: Adiciona o estado para o status de verificação >>>
  const [documentVerificationStatus, setDocumentVerificationStatus] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setProfileLoading(true);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult(); 
          const userRole = tokenResult.claims.role as string | undefined;

          const isPublicRoute = ['/login', '/register', '/reset-password']
            .some(route => pathname.startsWith(route));

          if (!userRole && !isPublicRoute && !isRegistering) {
            console.warn(
              `[AuthProvider] Usuário ${firebaseUser.uid} autenticado mas sem role válida. Forçando logout para segurança. Pathname: ${pathname}`
            );
            await signOut(auth);
            setUserProfile(null);
            setDocumentVerificationStatus(null); // <<< CORREÇÃO: Limpa o status
            setProfileLoading(false);
            setLoading(false);
            return;
          }
          
          if (userRole) {
            console.log("[AuthProvider] Role válida encontrada. Carregando perfil do usuário...");
            let profile = await getCurrentUserData();
            
            if (profile && profile.status === 'INVITED') {
              await confirmFirstLogin();
              profile = { ...profile, status: 'ACTIVE' as const };
            }
            
            setUserProfile(profile);

            // ============================================================================
            // 🔹 CORREÇÃO DE FLUXO (Segurança) 🔹
            // Armazena o status de verificação no estado do AuthProvider
            // ============================================================================
            const verificationStatus = (profile as any)?.documentVerificationStatus || null;
            setDocumentVerificationStatus(verificationStatus);
            // ============================================================================

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
        // Se não há usuário Firebase, limpa tudo
        setUserProfile(null);
        setDocumentVerificationStatus(null); // <<< CORREÇÃO: Limpa o status
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname, isRegistering]); // Adicionado isRegistering às dependências

  const contextValue = { 
    user, 
    userProfile, 
    loading, 
    profileLoading, 
    isRegistering, 
    setIsRegistering,
    documentVerificationStatus // <<< CORREÇÃO: Passa o status para o contexto
  };

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