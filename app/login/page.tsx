// app/login/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast"; // Certifique-se que esta importação está correta
import { loginUser, getCurrentUserData, type UserProfile } from '@/lib/auth-service';
import { useAuth } from '@/components/auth-provider';
import LogoPath from '@/public/logo-fht.svg'; // SEU LOGO AQUI
import { Loader2, LogInIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Componente de Loading para a página inteira
const LoadingPage = () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6"> {/* Fundo claro */}
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-700">Carregando...</p>
    </div>
);

export default function LoginPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Loading específico do submit
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const getRedirectPath = (role?: UserProfile['role']) => {
    const explicitRedirect = searchParams.get('redirectUrl');
    // Se a redirectUrl não começar com '/', é provavelmente inválida ou externa, então ignoramos.
    if (explicitRedirect && explicitRedirect.startsWith('/')) return explicitRedirect;

    if (role === 'doctor') return '/dashboard'; // Rota principal do médico
    if (role === 'hospital') return '/hospital/dashboard'; // Rota principal do hospital
    if (role === 'admin' || role === 'backoffice') return '/admin/matches'; // Rota principal do admin
    return '/'; // Fallback geral
  };

  useEffect(() => {
    // Este useEffect lida com o caso de o usuário já estar logado quando a página carrega
    if (!authLoading && authUser) {
      setIsLoading(true); // Mostra o loader da página enquanto busca o perfil
      getCurrentUserData()
        .then(profile => {
          if (profile) {
            const redirectPath = getRedirectPath(profile.role);
            console.log(`[LoginPage] User already authenticated. Role: ${profile.role}. Redirecting to: ${redirectPath}`);
            router.push(redirectPath);
          } else {
            console.warn("[LoginPage] AuthUser exists but no profile found in Firestore. Staying on login page.");
            setIsLoading(false); // Para o loader se não houver perfil
          }
        })
        .catch(err => {
          console.error("[LoginPage] Error fetching profile for already authenticated user:", err);
          setError("Erro ao verificar sessão. Tente novamente.");
          setIsLoading(false);
        });
    } else if (!authLoading && !authUser) {
      setIsLoading(false); // Garante que o loader para se não houver usuário e o authProvider não estiver carregando
    }
  }, [authUser, authLoading, router, searchParams]);


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await loginUser(email, password);
      // Após login bem-sucedido, o onAuthStateChanged no AuthProvider deve pegar a mudança.
      // O useEffect acima deve então lidar com a busca de perfil e redirecionamento.
      // Para um feedback mais rápido, podemos tentar buscar o perfil aqui também, mas
      // é importante que a lógica de redirecionamento seja consistente.
      const profile = await getCurrentUserData(); // Busca o perfil do usuário recém-logado
      if (profile) {
        toast({ title: "Login bem-sucedido!", description: `Bem-vindo(a) de volta, ${profile.displayName}!`});
        const redirectPath = getRedirectPath(profile.role);
        console.log(`[LoginPage] Login successful. Role: ${profile.role}. Redirecting to: ${redirectPath}`);
        router.push(redirectPath);
      } else {
        // Isso é um estado inesperado: login no Firebase Auth bem-sucedido, mas sem perfil no Firestore.
        setError("Perfil do usuário não encontrado após o login. Contate o suporte.");
        console.error("[LoginPage] Profile not found in Firestore after successful Firebase login.");
        setIsLoading(false); 
      }
    } catch (err: any) {
      let errorMessage = "Falha no login. Verifique suas credenciais.";
      if (err.code) { /* ... (tratamento de erros como antes) ... */ }
      setError(errorMessage);
      toast({ title: "Erro no Login", description: errorMessage, variant: "destructive" });
      setIsLoading(false);
    }
  };

  // Se o AuthProvider ainda está carregando para determinar o estado inicial do usuário,
  // ou se a página está em processo de buscar perfil/redirecionar.
  if (authLoading || isLoading) {
    return <LoadingPage />;
  }
  // Se o usuário já está autenticado (authUser existe) e não estamos mais em isLoading,
  // o useEffect já deveria ter redirecionado. Se chegou aqui, é um fallback.
  if (authUser && !isLoading) {
     return <div className="flex min-h-screen items-center justify-center"><p>Redirecionando...</p></div>;
  }


  return (
    // Estilo para se assemelhar a um fundo branco/claro com card centralizado
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4"> {/* Fundo Cinza Claro */}
      <Card className="w-full max-w-md shadow-xl"> {/* Card com sombra */}
        <CardHeader className="text-center">
          <Link href="/" className="inline-block mb-6">
            {/* Você pode ter sua imagem aqui */}
            <Image src={LogoPath} alt="FHT Sistemas Logo" width={180} priority className="mx-auto" />
          </Link>
          <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">Acesse sua Conta</CardTitle>
          <CardDescription className="text-gray-600">
            Bem-vindo(a) de volta!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-gray-700">Senha</Label>
                <Link href="/reset-password" 
                    className="text-xs text-blue-600 hover:text-blue-500 hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center">{error}</p>}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogInIcon className="mr-2 h-5 w-5" />}
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
    </div>
  );
}