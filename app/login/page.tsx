// app/login/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent, Suspense } from "react"; // <<< ADICIONADO Suspense
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

// Componente de Loading para a página inteira
const LoadingPage = () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-700">Carregando...</p>
    </div>
);

// Componente interno para lidar com searchParams e lógica de redirecionamento
function LoginLogic() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const searchParams = useSearchParams(); // <<< useSearchParams AQUI DENTRO
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false); // Loading específico para busca de perfil no useEffect
  const [initialCheckDone, setInitialCheckDone] = useState(false);


  const getRedirectPath = useCallback((role?: UserProfile['role']) => {
    const explicitRedirect = searchParams.get('redirectUrl');
    if (explicitRedirect && explicitRedirect.startsWith('/')) return explicitRedirect;
    if (role === 'doctor') return '/dashboard';
    if (role === 'hospital') return '/hospital/dashboard';
    if (role === 'admin' || role === 'backoffice') return '/admin/matches';
    return '/';
  }, [searchParams]);

  useEffect(() => {
    console.log("[LoginLogic] useEffect for auth check - AuthLoading:", authLoading, "AuthUser:", authUser ? authUser.uid : null);
    if (!authLoading && authUser && !initialCheckDone) {
      setIsLoading(true);
      console.log("[LoginLogic] User is already authenticated. Attempting to fetch profile for redirection...");
      getCurrentUserData()
        .then(profile => {
          if (profile) {
            const redirectPath = getRedirectPath(profile.role);
            console.log("[LoginLogic] Profile found. Role:", profile.role, "Redirecting to:", redirectPath);
            router.push(redirectPath);
          } else {
            console.warn("[LoginLogic] AuthUser exists but no profile found. Staying.");
            setIsLoading(false);
          }
        })
        .catch(err => {
          console.error("[LoginLogic] Error fetching profile for already authenticated user:", err);
          toast({ title: "Erro ao Verificar Sessão", description: err.message, variant: "destructive" });
          setIsLoading(false);
        })
        .finally(() => {
            setInitialCheckDone(true); // Marca que a verificação inicial foi feita
            // Não setar isLoading(false) aqui se o redirecionamento ocorreu
        });
    } else if (!authLoading && !authUser) {
        setIsLoading(false);
        setInitialCheckDone(true);
    }
  }, [authUser, authLoading, router, getRedirectPath, toast, initialCheckDone]);

  // Se ainda estiver carregando o estado de auth ou o perfil do usuário já logado
  if (authLoading || (authUser && isLoading && !initialCheckDone) ) {
      return <LoadingPage />;
  }
  
  // Se o usuário está logado e o perfil foi carregado (ou falhou), o redirecionamento já deveria ter acontecido.
  // Este é um fallback caso o useEffect não redirecione por algum motivo (ex: erro no profile fetch)
  // e o usuário não deveria ver o formulário.
  if (authUser && initialCheckDone && !isLoading) {
      console.log("[LoginLogic] Fallback: AuthUser exists, initial check done, should have redirected.");
      return <div className="flex min-h-screen items-center justify-center"><p>Redirecionando...</p></div>;
  }

  return null; // Este componente não renderiza o formulário, apenas a lógica
}


export default function LoginPage() {
  const { toast } = useToast(); // toast para handleSubmit
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Renomeado de isLoading para evitar conflito

  // Função getRedirectPath duplicada aqui ou passada como prop se preferir
   const getRedirectPath = (role?: UserProfile['role']) => {
    // Não podemos usar useSearchParams aqui diretamente se LoginPage não está em Suspense
    // A lógica de redirectUrl via searchParams está agora em LoginLogic
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
      const profile = await getCurrentUserData();
      if (profile) {
        toast({ title: "Login bem-sucedido!", description: `Bem-vindo(a) de volta, ${profile.displayName}!`});
        const redirectPath = getRedirectPath(profile.role);
        router.push(redirectPath);
      } else {
        setError("Perfil do usuário não encontrado. Contate o suporte.");
        setIsSubmitting(false);
      }
    } catch (err: any) {
      let errorMessage = "Falha no login.";
      if (err.code) { /* ... (seu switch case de erros) ... */ 
          switch (err.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
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
  };

  // Se o AuthProvider ainda está carregando, mostre um loader global.
  // A lógica de redirecionamento para usuário já logado está no LoginLogic
  if (authLoading) {
    return <LoadingPage />;
  }


  // Se o usuário já está logado (detectado pelo AuthProvider, e não estamos mais em authLoading),
  // o componente LoginLogic dentro do Suspense cuidará da busca de perfil e redirecionamento.
  // Não mostre o formulário de login se authUser já existe.
  if (authUser) {
      return (
          <Suspense fallback={<LoadingPage />}>
              <LoginLogic />
          </Suspense>
      );
  }

  // Se não está autenticado e authLoading é false, mostra o formulário de login
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
        <Suspense fallback={<LoadingPage />}> {/* Envolve qualquer uso de useSearchParams */}
            <LoginLogic /> {/* Renderiza a lógica que pode redirecionar */}
        </Suspense>

        {/* Só renderiza o formulário se não houver usuário autenticado E o authProvider não estiver carregando */}
        {!authUser && !authLoading && (
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center">
                <Link href="/" className="inline-block mb-6">
                    <Image src={LogoPath} alt="FHT Sistemas Logo" width={180} priority className="mx-auto" />
                </Link>
                <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">Acesse sua Conta</CardTitle>
                <CardDescription className="text-gray-600">Bem-vindo(a) de volta!</CardDescription>
                </CardHeader>
                <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-gray-700">Email</Label>
                    <Input id="email" type="email" placeholder="seuemail@exemplo.com" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-gray-700">Senha</Label>
                        <Link href="/reset-password" className="text-xs text-blue-600 hover:text-blue-500 hover:underline">Esqueceu a senha?</Link>
                    </div>
                    <Input id="password" type="password" placeholder="********" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} required className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"/>
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