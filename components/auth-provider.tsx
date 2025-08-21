// components/auth-provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentUserData, type UserProfile } from "@/lib/auth-service";
import { useRouter, usePathname } from "next/navigation"; // Importar useRouter e usePathname

// Função de redirecionamento centralizada
const getRedirectPathForRole = (userRole?: UserProfile['userType']): string => {
    switch (userRole) {
        case 'admin':
        case 'backoffice':
            return '/admin/caravanas';
        case 'hospital':
            return '/hospital/dashboard';
        case 'doctor':
            return '/dashboard';
        case 'receptionist':
        case 'triage_nurse':
            return '/hospital/patients'; // Rota correta para a equipa do hospital
        case 'caravan_admin':
            return '/caravan/portal';
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

          // --- LÓGICA DE REDIRECIONAMENTO CENTRALIZADA ---
          if (profile && profile.userType) {
            const targetPath = getRedirectPathForRole(profile.userType);
            const publicRoutes = ['/login', '/register', '/reset-password', '/'];
            
            // Redireciona apenas se o utilizador estiver numa página pública ou numa rota que não corresponde ao seu perfil
            // Ex: Um 'doctor' em '/hospital/dashboard' será redirecionado.
            const currentBaseRoute = `/${pathname.split('/')[1]}`;
            const targetBaseRoute = `/${targetPath.split('/')[1]}`;

            if (publicRoutes.includes(pathname) || (currentBaseRoute !== targetBaseRoute)) {
                console.log(`[AuthProvider] Redirecionando utilizador '${profile.userType}' da rota '${pathname}' para: ${targetPath}`);
                router.push(targetPath);
            }
          }
        } catch (error) {
          console.error("[AuthProvider] onAuthStateChanged: Error fetching profile:", error);
          setUserProfile(null); 
        } finally {
          setProfileLoading(false);
        }
      } else {
        // Se não há utilizador, mas ele está numa página protegida, redireciona para o login
        const protectedRoutesPrefixes = ['/admin', '/hospital', '/dashboard', '/caravan'];
        if (protectedRoutesPrefixes.some(prefix => pathname.startsWith(prefix))) {
            console.log(`[AuthProvider] Utilizador deslogado em rota protegida '${pathname}'. Redirecionando para /login.`);
            router.push('/login');
        }
        setUserProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]); // Adicionado router e pathname às dependências

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