// app/login/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent, Suspense } from "react"; // Suspense importado
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
import { cn } from '@/lib/utils';

// Componente de Loading para a página inteira e para Suspense
const LoadingPage = ({ message = "Carregando..." }: { message?: string }) => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-700">{message}</p>
    </div>
);
LoadingPage.displayName = "LoadingPage";

// ====================================================================================
// Componente LoginLogic (MOVIMENTO PARA FORA E ANTES DE LoginPage)
// ====================================================================================
function LoginLogic() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const searchParams = useSearchParams(); // useSearchParams usado aqui
  const { toast } = useToast();
  const [profileCheckLoading, setProfileCheckLoading] = useState(false);
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false);

  const getRedirectPath = useCallback((role?: UserProfile['role']) => {
    const explicitRedirect = searchParams.get('redirectUrl');
    if (explicitRedirect && explicitRedirect.startsWith('/')) return explicitRedirect;
    if (role === 'doctor') return '/dashboard';
    if (role === 'hospital') return '/hospital/dashboard';
    if (role === 'admin' || role === 'backoffice') return '/admin/matches';
    return '/';
  }, [searchParams]);

  useEffect(() => {
    console.log("[LoginLogic] Auth State - AuthLoading:", authLoading, "AuthUser:", authUser ? authUser.uid : null);
    if (!authLoading) {
        if (authUser && !initialAuthCheckDone) {
            setProfileCheckLoading(true);
            console.log("[LoginLogic] User already authenticated. Attempting to fetch profile...");
            getCurrentUserData()
            .then(profile => {
                if (profile) {
                    const redirectPath = getRedirectPath(profile.role);
                    console.log("[LoginLogic] Profile found. Role:", profile.role, "Redirecting to:", redirectPath);
                    router.push(redirectPath);
                } else {
                    console.warn("[LoginLogic] AuthUser exists but no profile found. User might need to complete registration or an error occurred.");
                    setProfileCheckLoading(false); // Permite que o formulário de login seja mostrado
                }
            })
            .catch(err => {
                console.error("[LoginLogic] Error fetching profile for already authenticated user:", err);
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
  }, [authUser, authLoading, router, getRedirectPath, toast, initialAuthCheckDone]);

  // Se AuthProvider ainda está carregando ou se estamos buscando perfil de usuário já logado
  if (authLoading || (authUser && profileCheckLoading && !initialAuthCheckDone)) {
      return <LoadingPage message="Verificando sua sessão..." />;
  }
  // Este componente não renderiza o formulário de login diretamente.
  // Ele lida com a lógica de redirecionamento e o estado de loading inicial.
  return null;
}
// ====================================================================================
// FIM do Componente LoginLogic
// ====================================================================================


export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth(); // Usado para decidir se mostra o formulário

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Para o loader do botão de submit

  // getRedirectPath agora é local para handleSubmit, pois searchParams está em LoginLogic
  const getRedirectPathForSubmit = (role?: UserProfile['role']) => {
    if (role === 'doctor') return '/dashboard';
    if (role === 'hospital') return '/hospital/dashboard';
    if (role === 'admin' || role === 'backoffice') return '/admin/matches';
    return '/';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await loginUser(email, password);
      // O AuthProvider vai detectar a mudança de authUser.
      // O componente LoginLogic, que é renderizado quando authUser existe,
      // cuidará da busca de perfil e redirecionamento.
      // Para feedback imediato, poderíamos tentar o redirecionamento aqui também,
      // mas a lógica principal já está no LoginLogic.
      const profile = await getCurrentUserData(); // Re-buscar perfil após login
      if (profile) {
        toast({ title: "Login bem-sucedido!", description: `Bem-vindo(a) de volta, ${profile.displayName}!`});
        const redirectPath = getRedirectPathForSubmit(profile.role);
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
          case 'auth/invalid-email':
            errorMessage = "O formato do email é inválido."; break;
          case 'auth/too-many-requests':
            errorMessage = "Muitas tentativas de login. Tente novamente mais tarde."; break;
          default: errorMessage = "Ocorreu um erro inesperado durante o login.";
        }
      }
      setError(errorMessage);
      toast({ title: "Erro no Login", description: errorMessage, variant: "destructive" });
      setIsSubmitting(false);
    }
    // Não resetar isLoadingSubmit se o redirecionamento for ocorrer, mas sim se falhar.
  };

  // Se o AuthProvider ainda está carregando o estado inicial do usuário.
  if (authLoading) {
    return <LoadingPage />;
  }

  // Se o usuário JÁ ESTÁ LOGADO (authUser existe), renderiza LoginLogic dentro de Suspense
  // LoginLogic cuidará da busca de perfil e redirecionamento.
  // Não mostramos o formulário de login neste caso.
  if (authUser) {
      return (
          <Suspense fallback={<LoadingPage message="Redirecionando..." />}>
              <LoginLogic />
          </Suspense>
      );
  }
  
  // Se chegou aqui, authLoading é false e authUser é null, então mostramos o formulário de login.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
        {/* O Suspense com LoginLogic pode não ser necessário aqui se authUser já é null,
            mas mantê-lo não prejudica e garante que a lógica de redirectUrl seja pega se o usuário
            chegar aqui de alguma forma com searchParams e sem authUser ainda. */}
        <Suspense fallback={<LoadingPage />}>
            <LoginLogic /> 
        </Suspense>

        {!authUser && ( // Garante que o formulário só aparece se não houver usuário
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
                    <Input
                        id="email-login" type="email" placeholder="seuemail@exemplo.com"
                        value={email}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        required
                        className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    />
                    </div>
                    <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password-login" className="text-gray-700">Senha</Label>
                        <Link href="/reset-password" className="text-xs text-blue-600 hover:text-blue-500 hover:underline">
                        Esqueceu a senha?
                        </Link>
                    </div>
                    <Input
                        id="password-login" type="password" placeholder="********"
                        value={password}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        required
                        className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    />
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
                    <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">
                    Cadastre-se aqui
                    </Link>
                </p>
                </CardFooter>
            </Card>
        )}
    </div>
  );
}