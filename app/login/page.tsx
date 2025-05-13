// app/login/page.tsx
"use client";

import type React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import {
  loginUser,
  resetPassword,
  getCurrentUserData,
  type UserProfile
} from "@/lib/auth-service";
import { auth } from "@/lib/firebase"; // <<< ADICIONADA IMPORTAÇÃO DE 'auth'
import { FirebaseError } from "firebase/app";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const router = useRouter();
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();

  useEffect(() => {
    console.log("[LoginPage] useEffect for auth check - AuthLoading:", authLoading, "AuthUser:", authUser ? authUser.uid : null);
    if (!authLoading && authUser) {
      console.log("[LoginPage] User is already authenticated (authUser exists). Attempting to fetch profile for redirection...");
      setIsLoading(true);

      getCurrentUserData()
        .then(userProfile => {
          if (userProfile) {
            console.log("[LoginPage] Profile found for already authenticated user. Role:", userProfile.role, "Redirecting...");
            toast({
              title: "Você já está conectado(a)",
              description: "Redirecionando para seu painel...",
              variant: "default",
            });
            if (userProfile.role === 'doctor') {
              router.push('/dashboard/availability');
            } else if (userProfile.role === 'hospital') {
              router.push('/hospital/dashboard');
            } else {
              // CORREÇÃO: Não acessar userProfile.role aqui
              console.warn("[LoginPage] Role desconhecido para usuário já logado. Verifique Firestore. Redirecionando para Home.");
              router.push('/');
            }
          } else {
            console.warn("[LoginPage] AuthUser exists, but userProfile not found in Firestore for already authenticated user. UID:", authUser.uid);
            toast({
              title: "Perfil não encontrado",
              description: "Você está autenticado, mas seu perfil não foi localizado. Por favor, contate o suporte ou tente logar novamente.",
              variant: "destructive",
            });
            setIsLoading(false);
          }
        })
        .catch(error => {
          console.error("[LoginPage] Error fetching userProfile for already authenticated user:", error);
          toast({
            title: "Erro ao buscar perfil",
            description: "Não foi possível verificar seu perfil para redirecionamento. Por favor, tente logar manualmente.",
            variant: "destructive",
          });
          setIsLoading(false);
        });
    } else if (!authLoading && !authUser) {
        console.log("[LoginPage] User is not authenticated. Login form is active.");
    }
  }, [authUser, authLoading, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[LoginPage] handleSubmit: Attempting login for email:", email);
    setIsLoading(true);

    try {
      await loginUser(email, password);
      console.log("[LoginPage] handleSubmit: Firebase login successful.");

      const userProfile = await getCurrentUserData();
      // CORREÇÃO NA LINHA DO LOG ABAIXO: Usando auth.currentUser?.uid
      console.log("[LoginPage] handleSubmit: Fetched user profile:", userProfile, "Current Firebase Auth UID:", auth.currentUser?.uid);


      if (!userProfile) {
        console.error("[LoginPage] handleSubmit: UserProfile NOT FOUND after successful Firebase login. UID might be:", auth.currentUser?.uid);
        throw new Error("Perfil de usuário não encontrado após o login. Contate o suporte.");
      }

      console.log("[LoginPage] handleSubmit: Profile found with role:", userProfile.role, ". Redirecting...");
      toast({
        title: "Bem-vindo(a) de volta!",
        description: "Login realizado com sucesso. Redirecionando...",
        variant: "default",
      });

      if (userProfile.role === 'doctor') {
        router.push('/dashboard/availability');
      } else if (userProfile.role === 'hospital') {
        router.push('/hospital/dashboard');
      } else {
        // CORREÇÃO: Não acessar userProfile.role aqui
        console.warn("[LoginPage] handleSubmit: Unknown role after login. Verifique Firestore. Redirecting to Home.");
        router.push('/');
      }
    } catch (error) {
      console.error("[LoginPage] handleSubmit: Login failed.", error);
      setIsLoading(false);
      let errorMessage = "Verifique suas credenciais e tente novamente.";
      let errorTitle = "Erro ao Acessar";

      if (error instanceof FirebaseError) {
        switch (error.code) {
          case "auth/user-not-found":
          case "auth/wrong-password":
          case "auth/invalid-credential":
            errorMessage = "Email ou senha incorretos.";
            break;
          case "auth/too-many-requests":
            errorMessage = "Muitas tentativas de login falharam. Por favor, tente novamente mais tarde ou redefina sua senha.";
            break;
          case "auth/invalid-email":
            errorMessage = "O formato do email fornecido é inválido.";
            break;
          default:
            errorMessage = (error as Error).message || "Ocorreu um erro inesperado durante o login. Por favor, tente novamente.";
            break;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        errorTitle = "Erro";
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({ title: "Email necessário", description: "Por favor, insira seu email.", variant: "destructive" });
      return;
    }
    console.log("[LoginPage] handleResetPassword: Attempting password reset for email:", resetEmail);
    setIsResetting(true);
    try {
      await resetPassword(resetEmail);
      console.log("[LoginPage] handleResetPassword: Password reset email sent successfully (if email exists).");
      toast({
        title: "Link Enviado",
        description: "Se este email estiver cadastrado em nosso sistema, você receberá um link para redefinir sua senha. Verifique sua caixa de entrada e spam.",
        variant: "default",
      });
      setIsModalOpen(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("[LoginPage] handleResetPassword: Failed.", error);
      let errorMessage = "Não foi possível enviar o email de redefinição. Tente novamente.";
      if (error instanceof FirebaseError) {
        errorMessage = error.message || errorMessage;
      }
      toast({ title: "Erro ao Redefinir", description: errorMessage, variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  if (authLoading || isLoading) {
    console.log("[LoginPage] Rendering Loader - AuthLoading:", authLoading, "IsLoading (page specific):", isLoading);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="mt-4 text-lg text-gray-700">
          {authLoading ? "Verificando sessão..." : "Processando..."}
        </p>
      </div>
    );
  }

  if (!authLoading && authUser && !isLoading) {
      console.log("[LoginPage] AuthUser exists, authLoading is false, page isLoading is false - Should be redirecting or showing error from useEffect.");
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-lg text-gray-700">Aguarde...</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="flex w-full max-w-4xl shadow-xl rounded-lg overflow-hidden bg-white">
        <div className="hidden md:block w-1/2 bg-cover bg-center relative" style={{ backgroundImage: "url('/images/login-background.jpg')" }}>
          <div className="absolute inset-0 bg-gradient-to-t from-blue-900/70 via-blue-800/50 to-transparent flex flex-col justify-end p-8 text-white">
            <h1 className="text-3xl font-bold mb-2">Plataforma FHT</h1>
            <p className="text-lg leading-relaxed">Conectando médicos e hospitais com eficiência e segurança.</p>
          </div>
        </div>
        <div className="w-full md:w-1/2 p-8 md:p-12">
          <div className="space-y-6">
            <div className="space-y-2 text-center md:text-left">
              <img src="/images/logo-fht.svg" alt="Logo FHT Soluções Hospitalares" className="h-10 mx-auto md:mx-0 mb-4"/>
              <h2 className="text-2xl font-semibold text-gray-900">Acesso Profissional</h2>
              <p className="text-sm text-gray-600">Bem-vindo(a) de volta! Acesse sua conta.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 h-10" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-gray-700 font-medium">Senha</Label>
                  <button type="button" className="text-sm text-blue-600 hover:underline focus:outline-none font-medium" onClick={() => setIsModalOpen(true)} disabled={isResetting} >
                    {isResetting ? "Enviando..." : "Esqueceu a senha?"}
                  </button>
                </div>
                <Input id="password" type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} required className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 h-10" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 text-base font-semibold" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Acessando..." : "Entrar na Plataforma"}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-600 pt-4">
              Novo por aqui?{" "}
              <Link href="/register" className="font-medium text-blue-600 hover:underline">
                Crie sua conta gratuitamente
              </Link>
            </p>
          </div>
        </div>
      </div>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-lg">Redefinir Senha</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="resetEmail" className="text-gray-700 font-medium">E-mail de Cadastro</Label>
              <Input id="resetEmail" type="email" placeholder="seu@email.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 h-10" />
              <p className="text-xs text-gray-600 pt-1">Insira o e-mail associado à sua conta para receber o link de redefinição.</p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 font-semibold" disabled={isResetting}>
                {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isResetting ? "Enviando..." : "Enviar Link de Redefinição"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}