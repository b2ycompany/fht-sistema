// app/login/page.tsx
"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
    loginUser,
    resetPassword,
    getCurrentUserData,
    type UserProfile // Importando o tipo UserProfile [cite: 7, 102]
} from "@/lib/auth-service";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Tentar fazer login
      await loginUser(email, password); // [cite: 108]
      console.log("Login Auth bem-sucedido."); // [cite: 109]

      // 2. Buscar dados do perfil para obter o ROLE
      const userProfile = await getCurrentUserData(); // [cite: 109, 110]

      if (!userProfile) { // [cite: 110]
        // Se getCurrentUserData retornar null (raro se login funcionou, mas possível)
        throw new Error("Perfil de usuário não encontrado após o login. Contate o suporte."); // [cite: 110]
      }

      // userProfile agora é UserProfile (DoctorProfile | HospitalProfile)
      console.log("Perfil encontrado com role:", userProfile.role); // [cite: 111]

      // 3. Redirecionar com base no ROLE
      toast({
        title: "Bem-vindo(a)",
        description: "Login realizado com sucesso. Redirecionando...",
        variant: "default" // Usando "default" (ou uma variante customizada 'success' se você a criou)
      }); // [cite: 112]

      if (userProfile.role === 'doctor') { // [cite: 113]
        router.push('/dashboard/availability'); // [cite: 113]
      } else if (userProfile.role === 'hospital') { // [cite: 114]
        router.push('/hospital/shifts'); // Rota do Hospital [cite: 114]
      } else {
        // --- CORREÇÃO APLICADA AQUI ---
        // Este bloco é considerado inalcançável pelo TS se UserType for só 'doctor' | 'hospital'.
        // Não acessamos mais 'userProfile.role' aqui para evitar o erro 'never'.
        console.warn("Role desconhecido ou não tratado encontrado no perfil do usuário. Verifique Firestore."); // [cite: 116]
        // A linha abaixo causaria o erro 'never' se descomentada, pois este 'else' é logicamente inalcançável.
        // const _exhaustiveCheck: never = userProfile.role;
        router.push('/'); // Fallback seguro [cite: 117]
        // --- FIM DA CORREÇÃO ---
      }

    } catch (error) { // [cite: 117]
      console.error("Login error:", error); // [cite: 117]
      setIsLoading(false); // Garante que o loading pare em caso de erro [cite: 118]
      let errorMessage = "Verifique suas credenciais e tente novamente."; // [cite: 118]
      let errorTitle = "Erro ao acessar"; // [cite: 118]

      if (error instanceof FirebaseError) { // [cite: 119]
        switch (error.code) {
          case "auth/user-not-found":
          case "auth/wrong-password":
          case "auth/invalid-credential":
            errorMessage = "Email ou senha incorretos."; // [cite: 119]
            break; // [cite: 120]
          case "auth/too-many-requests":
            errorMessage = "Muitas tentativas. Tente novamente mais tarde."; // [cite: 120]
            break; // [cite: 121]
          case "auth/invalid-email":
            errorMessage = "O formato do email é inválido."; // [cite: 121]
            break; // [cite: 121]
          default:
             errorMessage = (error as Error).message || "Ocorreu um erro inesperado no login."; // [cite: 122]
             break; // [cite: 123]
        }
      } else if (error instanceof Error) { // [cite: 123]
          errorMessage = error.message; // [cite: 123]
          errorTitle = "Erro"; // Muda título para erros gerais (ex: perfil não encontrado) [cite: 124]
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      }); // [cite: 124]
    }
    // Não definir setIsLoading(false) aqui, pois o sucesso leva a um redirect.
  }; // [cite: 125]

  const handleResetPassword = async (e: React.FormEvent) => { // [cite: 125]
    e.preventDefault(); // [cite: 125]
    if (!resetEmail) { // [cite: 126]
        toast({ title: "Email necessário", description: "Por favor, insira seu email.", variant: "destructive" }); // [cite: 126]
        return; // [cite: 126]
    }
    setIsResetting(true); // [cite: 126]
    try {
      await resetPassword(resetEmail); // [cite: 127]
      toast({
          title: "Email enviado",
          description: "Se o email estiver cadastrado, você receberá um link para redefinir sua senha. Verifique sua caixa de entrada e spam.",
          variant: "default" // Usando default
      }); // [cite: 127]
      setIsModalOpen(false); // [cite: 128]
      setResetEmail(""); // [cite: 128]
    } catch (error: any) { // [cite: 128]
        console.error("Reset password error:", error); // [cite: 128]
        let errorMessage = "Não foi possível enviar o email de redefinição."; // [cite: 129]
        if (error instanceof FirebaseError) { // [cite: 129]
            // Poderia adicionar casos específicos como 'auth/invalid-email' se quisesse
            errorMessage = error.message || errorMessage; // [cite: 129]
        }
        toast({ title: "Erro ao Redefinir Senha", description: errorMessage, variant: "destructive" }); // [cite: 129]
    } finally { // [cite: 130]
      setIsResetting(false); // [cite: 130]
    }
  }; // [cite: 130]

  // --- JSX ---
  return ( // [cite: 131]
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="flex w-full max-w-4xl shadow-xl rounded-lg overflow-hidden bg-white">
        {/* Lado esquerdo - Imagem */}
        {/* Garanta que a imagem '/images/login-background.jpg' existe na pasta 'public/images' */}
        <div className="hidden md:block w-1/2 bg-cover bg-center relative" style={{ backgroundImage: "url('/images/login-background.jpg')" }}>
          <div className="absolute inset-0 bg-gradient-to-t from-blue-900/70 via-blue-800/50 to-transparent flex flex-col justify-end p-8 text-white">
             <h1 className="text-3xl font-bold mb-2">Plataforma FHT</h1>
             <p className="text-lg leading-relaxed">Conectando médicos e hospitais.</p>
          </div>
        </div>

        {/* Lado direito - Formulário */}
        <div className="w-full md:w-1/2 p-8 md:p-12">
          <div className="space-y-6">
            <div className="space-y-2 text-center md:text-left">
                 {/* Garanta que o logo '/images/logo-fht.svg' existe em 'public/images' */}
                <img src="/images/logo-fht.svg" alt="Logo FHT" className="h-10 mx-auto md:mx-0 mb-4"/>
                <h2 className="text-2xl font-semibold text-gray-900">Acesso Profissional</h2>
                <p className="text-sm text-gray-600">Entre com suas credenciais</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 h-10" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-gray-700">Senha</Label>
                  <button type="button" className="text-sm text-blue-600 hover:underline focus:outline-none" onClick={() => setIsModalOpen(true)} disabled={isResetting} >
                    {isResetting ? "Enviando..." : "Esqueceu a senha?"}
                  </button>
                </div>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 h-10" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 text-base" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Acessando..." : "Entrar"}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-600 pt-4">
              Novo por aqui?{" "}
              <Link href="/register" className="font-medium text-blue-600 hover:underline">
                Faça seu Cadastro
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Redefinição de Senha */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Redefinir Senha</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="resetEmail" className="text-gray-700">E-mail de Cadastro</Label>
              <Input id="resetEmail" type="email" placeholder="seu@email.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 h-10" />
              <p className="text-sm text-gray-600 pt-1"> Insira seu email para receber o link de redefinição.</p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10" disabled={isResetting}>
                 {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 {isResetting ? "Enviando..." : "Enviar Link"}
               </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}