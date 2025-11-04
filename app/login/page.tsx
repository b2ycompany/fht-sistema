// app/login/page.tsx (Versão CORRIGIDA E COMPLETA)
"use client";

import React, { useState, useEffect } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { loginUser } from '@/lib/auth-service';
import { useAuth } from '@/components/auth-provider'; // Importa o hook de autenticação
import LogoPath from '@/public/logo-fht.svg';
import { Loader2, LogInIcon } from 'lucide-react';
import { useRouter } from "next/navigation"; // Importa useRouter

export default function LoginPage() {
  const { toast } = useToast();
  // <<< CORREÇÃO: Usa o 'user' e 'loading' do AuthProvider >>>
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Efeito para lidar com usuários já logados
  useEffect(() => {
    // Se a autenticação não está a carregar e já temos um usuário,
    // o AuthProvider já deve ter iniciado o redirecionamento.
    // Esta é uma segurança extra.
    if (!authLoading && user) {
      // Não precisamos redirecionar daqui, o AuthProvider faz isso.
      // Apenas garantimos que o formulário permaneça desabilitado.
      console.log("[LoginPage] Usuário já está logado. Aguardando redirecionamento do AuthProvider.");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // <<< CORREÇÃO: Não tenta logar se já estiver logado >>>
    if (user) {
      setIsSubmitting(false);
      return; // Já está logado, não faz nada
    }

    try {
      await loginUser(email, password);
      toast({ title: "Login bem-sucedido!", description: `A redirecionar...`});
      // O redirecionamento será tratado pelo AuthProvider
    } catch (err: any) {
        let errorMessage = "Falha no login. Verifique suas credenciais.";
        if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
            errorMessage = "Email ou senha incorretos.";
        } else if (err.code === "auth/too-many-requests") {
            errorMessage = "Muitas tentativas de login. Tente novamente mais tarde.";
        }
        setError(errorMessage);
        setIsSubmitting(false); // Só define como falso em caso de erro
    }
  };
  
  // Define o estado de carregamento combinado
  const isLoading = authLoading || isSubmitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <Image src={LogoPath} alt="FHT Logo" width={150} height={60} priority />
          <CardTitle className="text-2xl font-bold pt-4">Aceder à Plataforma</CardTitle>
          <CardDescription>Use seu email e senha para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Se o authLoading for true (verificando usuário) ou user for true (usuário logado),
            mostramos um estado de carregamento em vez do formulário.
          */}
          {authLoading || user ? (
            <div className="flex flex-col items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-4 text-sm text-muted-foreground">
                {user ? "Usuário autenticado. A redirecionar..." : "A verificar sessão..."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email-login" className="text-gray-700">Email</Label>
                <Input 
                  id="email-login" 
                  type="email" 
                  placeholder="seu.email@exemplo.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password-login" className="text-gray-700">Senha</Label>
                  <Link href="/reset-password" className="text-xs text-blue-600 hover:text-blue-500 hover:underline">Esqueceu a senha?</Link>
                </div>
                <Input 
                  id="password-login" 
                  type="password" 
                  placeholder="********" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  disabled={isLoading}
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center">{error}</p>}
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogInIcon className="mr-2 h-5 w-5" />}
                {isSubmitting ? "A entrar..." : "Entrar"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center pt-4 border-t">
          <p className="text-xs text-gray-600">
            Não tem uma conta?{' '}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">
              Crie seu cadastro
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}