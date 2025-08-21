// app/login/page.tsx
"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { loginUser, getCurrentUserData, type UserProfile } from '@/lib/auth-service';
import { useAuth } from '@/components/auth-provider';
import LogoPath from '@/public/logo-fht.svg';
import { Loader2, LogInIcon } from 'lucide-react';

// --- LÓGICA DE REDIRECIONAMENTO CENTRALIZADA E CORRIGIDA ---
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
            // CORRIGIDO: Redireciona para o painel de pacientes do hospital
            return '/hospital/patients'; 
        case 'caravan_admin':
            // APENAS este perfil vai para o portal da caravana/multirão
            return '/caravan/portal';
        default:
            // Rota padrão segura
            return '/';
    }
};

const LoadingPage = ({ message = "Carregando..." }: { message?: string }) => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-700">{message}</p>
    </div>
);
LoadingPage.displayName = "LoadingPage";

function LoginLogic() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profileCheckLoading, setProfileCheckLoading] = useState(false);
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false);

  useEffect(() => {
    if (!authLoading) {
        if (authUser && !initialAuthCheckDone) {
            setProfileCheckLoading(true);
            getCurrentUserData()
            .then(profile => {
                if (profile) {
                    // Usa a nova função centralizada
                    const redirectPath = getRedirectPathForRole(profile.userType);
                    console.log("[LoginLogic] Profile found. Role/UserType:", profile.userType, "Redirecting to:", redirectPath);
                    router.push(redirectPath);
                } else {
                    setProfileCheckLoading(false);
                }
            })
            .catch(err => {
                toast({ title: "Erro ao Verificar Sessão", description: err.message || "Tente novamente.", variant: "destructive" });
                setProfileCheckLoading(false);
            })
            .finally(() => {
                setInitialAuthCheckDone(true);
            });
        } else if (!authUser) {
            setProfileCheckLoading(false);
            setInitialAuthCheckDone(true);
        }
    }
  }, [authUser, authLoading, router, toast, initialAuthCheckDone]);

  if (authLoading || (authUser && profileCheckLoading && !initialAuthCheckDone)) {
      return <LoadingPage message="Verificando sua sessão..." />;
  }
  return null;
}

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await loginUser(email, password);
      const profile = await getCurrentUserData();
      if (profile) {
        toast({ title: "Login bem-sucedido!", description: `Bem-vindo(a) de volta, ${profile.displayName}!`});
        // Usa a nova função centralizada
        const redirectPath = getRedirectPathForRole(profile.userType);
        router.push(redirectPath);
      } else {
        setError("Perfil do usuário não encontrado após o login. Contate o suporte.");
        setIsSubmitting(false);
      }
    } catch (err: any) {
        let errorMessage = "Falha no login. Verifique suas credenciais.";
        if (err.code) {
          switch (err.code) {
            case 'auth/user-not-found': case 'auth/wrong-password': case 'auth/invalid-credential':
              errorMessage = "Email ou senha inválidos."; break;
            default: errorMessage = "Ocorreu um erro inesperado durante o login.";
          }
        }
        setError(errorMessage);
        toast({ title: "Erro no Login", description: errorMessage, variant: "destructive" });
        setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <LoadingPage />;
  }

  if (authUser) {
      return (
          <Suspense fallback={<LoadingPage message="Redirecionando..." />}>
              <LoginLogic />
          </Suspense>
      );
  }
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
        <Suspense fallback={<LoadingPage />}>
            <LoginLogic /> 
        </Suspense>

        {!authUser && (
            <Card className="w-full max-w-md shadow-xl bg-white">
                <CardHeader className="text-center">
                    <Link href="/" className="inline-block mb-6">
                        <Image src={LogoPath} alt="FHT Sistemas Logo" width={180} height={40} priority className="mx-auto h-auto" />
                    </Link>
                    <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">Acesse sua Conta</CardTitle>
                    <CardDescription className="text-gray-600">Bem-vindo(a) de volta!</CardDescription>
                </CardHeader>
                <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                    <Label htmlFor="email-login" className="text-gray-700">Email</Label>
                    <Input id="email-login" type="email" placeholder="seuemail@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required/>
                    </div>
                    <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password-login" className="text-gray-700">Senha</Label>
                        <Link href="/reset-password" className="text-xs text-blue-600 hover:text-blue-500 hover:underline">Esqueceu a senha?</Link>
                    </div>
                    <Input id="password-login" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center">{error}</p>}
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogInIcon className="mr-2 h-5 w-5" />}
                        Entrar
                    </Button>
                </form>
                </CardContent>
                <CardFooter className="flex flex-col items-center justify-center pt-4 border-t">
                <p className="text-xs text-gray-600">
                    Não tem uma conta?{' '}
                    <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">Cadastre-se aqui</Link>
                </p>
                </CardFooter>
            </Card>
        )}
    </div>
  );
}