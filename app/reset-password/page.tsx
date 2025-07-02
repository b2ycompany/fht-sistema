// app/reset-password/page.tsx
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { resetPassword } from '@/lib/auth-service'; // Importa a sua função existente
import LogoPath from '@/public/logo-fht.svg';
import { Loader2, Mail, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // Chama a função que já existe no seu auth-service
      await resetPassword(email);
      setSubmitted(true); // Altera o estado para mostrar a mensagem de sucesso
    } catch (err: any) {
      let errorMessage = "Ocorreu um erro. Tente novamente.";
      // O Firebase pode retornar 'auth/user-not-found', mas por segurança,
      // não confirmamos ao utilizador se o e-mail existe ou não.
      // Apenas informamos que, se existir, o e-mail será enviado.
      // No entanto, para debug, podemos tratar o erro.
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        // Para uma melhor UX, podemos mostrar um erro genérico
        errorMessage = "Ocorreu um erro ao processar o seu pedido.";
        // E mesmo em caso de 'erro', mostramos a tela de sucesso para não confirmar que o email não existe.
        setSubmitted(true);
      } else {
         setError(errorMessage);
         toast({ title: "Erro", description: errorMessage, variant: "destructive" });
      }

    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md shadow-xl bg-white">
        <CardHeader className="text-center">
          <Link href="/" className="inline-block mb-6">
            <Image src={LogoPath} alt="FHT Sistemas Logo" width={180} height={40} priority className="mx-auto h-auto" />
          </Link>
          <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">Redefinir Senha</CardTitle>
        </CardHeader>

        {/* Mostra a mensagem de sucesso OU o formulário */}
        {submitted ? (
          <CardContent className="text-center space-y-4 p-8">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <p className="text-gray-700">
              Pedido recebido. Se uma conta com o e-mail <strong className="text-gray-900">{email}</strong> existir, um link para redefinição de senha foi enviado.
            </p>
            <p className="text-sm text-gray-500">
              Por favor, verifique a sua caixa de entrada e a pasta de spam.
            </p>
          </CardContent>
        ) : (
          <>
            <CardContent>
              <CardDescription className="text-center mb-4">
                Digite o seu e-mail abaixo e enviaremos um link para você voltar a ter acesso à sua conta.
              </CardDescription>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-reset" className="text-gray-700">Email</Label>
                  <Input
                    id="email-reset" type="email" placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mail className="mr-2 h-5 w-5" />}
                  Enviar Link de Redefinição
                </Button>
              </form>
            </CardContent>
          </>
        )}

        <CardFooter className="flex flex-col items-center justify-center pt-4 border-t">
          <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline">
            Voltar para o Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}