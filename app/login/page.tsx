// app/login/page.tsx
"use client";

import React, { useState } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { loginUser } from '@/lib/auth-service';
import { useAuth } from '@/components/auth-provider';
import LogoPath from '@/public/logo-fht.svg';
import { Loader2, LogInIcon } from 'lucide-react';

export default function LoginPage() {
  const { toast } = useToast();
  const { user, loading, profileLoading } = useAuth();

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
      // O AuthProvider vai detetar a mudança de estado e fará o redirecionamento.
      // Apenas mostramos um toast para feedback imediato.
      toast({ title: "Login bem-sucedido!", description: `A redirecionar...`});
    } catch (err: any) {
        let errorMessage = "Falha no login. Verifique suas credenciais.";
        if (err.code) {
          switch (err.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
              errorMessage = "Email ou senha inválidos."; break;
            default: errorMessage = "Ocorreu um erro inesperado durante o login.";
          }
        }
        setError(errorMessage);
        toast({ title: "Erro no Login", description: errorMessage, variant: "destructive" });
        setIsSubmitting(false);
    }
  };

  // Mostra um ecrã de carregamento se o AuthProvider ainda estiver a verificar a sessão ou o perfil
  // OU se o utilizador já estiver logado (o AuthProvider está a tratar do redirecionamento)
  if (loading || user) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="mt-4 text-gray-700">
              {user ? "A redirecionar para o seu painel..." : "A verificar sessão..."}
            </p>
        </div>
    );
  }
  
  // Apenas mostra o formulário se o carregamento inicial terminou e não há utilizador
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md shadow-xl bg-white animate-fade-in">
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
                <Input id="email-login" type="email" placeholder="seuemail@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting}/>
                </div>
                <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password-login" className="text-gray-700">Senha</Label>
                    <Link href="/reset-password" className="text-xs text-blue-600 hover:text-blue-500 hover:underline">Esqueceu a senha?</Link>
                </div>
                <Input id="password-login" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isSubmitting}/>
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
    </div>
  );
}