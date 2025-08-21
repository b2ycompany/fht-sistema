// components/auth-provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentUserData, type UserProfile, AdminProfile } from "@/lib/auth-service";
import { useRouter, usePathname } from "next/navigation";

// --- FUNÇÃO DE REDIRECIONAMENTO AGORA É DINÂMICA ---
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
        case 'triage_nurse':
            // Lógica dinâmica: verifica se há uma caravana/unidade associada
            const adminProfileStaff = profile as AdminProfile;
            if (adminProfileStaff.assignedCaravanId) {
                // Constrói a URL para a página de atendimento da unidade específica
                return `/caravan/${adminProfileStaff.assignedCaravanId}/attendance`;
            }
            // Se, por algum motivo, não tiver uma unidade associada, envia para uma página de erro/aviso
            console.warn(`Utilizador ${profile.uid} (${profile.userType}) não tem uma unidade de saúde associada.`);
            return '/unassigned'; // Uma página que diz "Contacte o seu gestor"

        case 'caravan_admin':
            // O admin da caravana também pode precisar ser direcionado para sua caravana específica
            const adminProfileCaravan = profile as AdminProfile;
            if (adminProfileCaravan.assignedCaravanId) {
                // Talvez para o dashboard da caravana em vez da página de atendimento
                return `/caravan/${adminProfileCaravan.assignedCaravanId}/dashboard`;
            }
            return '/'; // Ou para uma página geral de caravanas

        default:
            return '/'; // Rota padrão segura
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
      setUser(firebaseUser);
      
      if (firebaseUser) {
        setProfileLoading(true);
        try {
          const profile = await getCurrentUserData();
          setUserProfile(profile);

          const targetPath = getRedirectPathForProfile(profile);
          const publicRoutes = ['/login', '/register', '/reset-password', '/', '/unassigned'];
          
          if (pathname === targetPath) {
              // Já está na página certa, não faz nada para evitar loops
          } else if (publicRoutes.includes(pathname)) {
              console.log(`[AuthProvider] Utilizador em rota pública. Redirecionando '${profile?.userType}' para: ${targetPath}`);
              router.push(targetPath);
          }
          
        } catch (error) {
          console.error("[AuthProvider] onAuthStateChanged: Error fetching profile:", error);
          setUserProfile(null); 
        } finally {
          setProfileLoading(false);
        }
      } else {
        const protectedRoutesPrefixes = ['/admin', '/hospital', '/dashboard', '/caravan'];
        if (protectedRoutesPrefixes.some(prefix => pathname.startsWith(prefix))) {
            router.push('/login');
        }
        setUserProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]); // Dependências mantidas para reavaliar se o utilizador navegar manualmente

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