// app/projetos/caravana/login/page.tsx
"use client";

import React, { useState, ChangeEvent } from "react";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { loginUser, getCurrentUserData } from '@/lib/auth-service';
import LogoPath from '@/public/logo-fht.svg';
import { Loader2, LogInIcon } from 'lucide-react';

export default function CaravanLoginPage() {
  const { toast } = useToast();
  const router = useRouter();
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
      
      const authorizedRoles = ["doctor", "receptionist", "triage_nurse", "caravan_admin", "admin"];
      if (profile && authorizedRoles.includes(profile.userType)) { // <-- CORRIGIDO AQUI
        toast({ title: "Login bem-sucedido!", description: `Bem-vindo(a) ao Portal da Caravana, ${profile.displayName}!`});
        router.push('/caravan/portal'); 
      } else {
        setError("Este acesso é restrito a profissionais autorizados para este projeto.");
        setIsSubmitting(false);
      }
    } catch (err: any) {
      let errorMessage = "Falha no login. Verifique suas credenciais.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = "Email ou senha inválidos.";
      }
      setError(errorMessage);
      toast({ title: "Erro no Login", description: errorMessage, variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
        {/* O restante do JSX não precisa de alterações */}
        <Card className="w-full max-w-md shadow-xl bg-white">
            <CardHeader className="text-center">
            <Link href="/" className="inline-block mb-6">
                <Image src={LogoPath} alt="FHT Sistemas Logo" width={180} height={40} priority className="mx-auto h-auto" />
            </Link>
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">Portal da Caravana da Saúde</CardTitle>
            <CardDescription className="text-gray-600">Acesso para Profissionais</CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="email-login">Email</Label><Input id="email-login" type="email" placeholder="seuemail@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div className="space-y-1.5"><Label htmlFor="password-login">Senha</Label><Input id="password-login" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center">{error}</p>}
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogInIcon className="mr-2 h-5 w-5" />}
                    Entrar no Portal
                </Button>
            </form>
            </CardContent>
            <CardFooter className="flex-col items-center justify-center pt-4 border-t space-y-2">
              <p className="text-xs text-gray-600">É novo no projeto?{' '}<Link href="/projetos/caravana/register" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">Cadastre-se aqui</Link></p>
              <Link href="/login" className="text-xs text-gray-600 hover:underline">Acessar o portal principal de plantões</Link>
            </CardFooter>
        </Card>
    </div>
  );
}