// app/projetos/caravana/register/page.tsx
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
import { createAuthUser, completeUserRegistration } from '@/lib/auth-service';
import LogoPath from '@/public/logo-fht.svg';
import { Loader2, UserPlus } from 'lucide-react';

export default function CaravanRegisterPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [name, setName] = useState('');
  const [crm, setCrm] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    // Validação simples de senha
    if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        setIsSubmitting(false);
        return;
    }

    try {
      // 1. Cria o usuário na autenticação do Firebase
      const authUser = await createAuthUser(email, password, name);
      
      // 2. Prepara os dados para salvar no Firestore (perfil do usuário)
      // Este é um formulário simplificado. Outros dados podem ser coletados depois.
      const registrationData = {
          professionalCrm: crm,
          specialties: [], // O admin pode atribuir depois, ou podemos adicionar um campo aqui
          // Dados vazios para campos obrigatórios na sua interface
          cpf: '',
          dob: '',
          phone: '',
          rg: '',
          address: { cep: '', city: '', neighborhood: '', number: '', state: '', street: ''},
          isSpecialist: false,
          documents: {},
          specialistDocuments: {}
      };

      // 3. Salva o perfil do usuário no Firestore
      await completeUserRegistration(authUser.uid, email, name, "doctor", registrationData);

      toast({ title: "Cadastro realizado com sucesso!", description: "Seu perfil foi criado. Você já pode fazer o login." });
      router.push('/projetos/caravana/login');

    } catch (err: any) {
      let errorMessage = "Falha no cadastro. Tente novamente.";
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = "Este endereço de e-mail já está em uso.";
      }
      setError(errorMessage);
      toast({ title: "Erro no Cadastro", description: errorMessage, variant: "destructive" });
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
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">Cadastro para Caravana da Saúde</CardTitle>
            <CardDescription className="text-gray-600">Crie sua conta para participar do projeto.</CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input id="name" type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                 <div className="space-y-1.5">
                    <Label htmlFor="crm">CRM</Label>
                    <Input id="crm" type="text" placeholder="CRM (com estado, ex: 123456/SP)" value={crm} onChange={(e) => setCrm(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="seuemail@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center">{error}</p>}
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
                    Criar Conta
                </Button>
            </form>
            </CardContent>
            <CardFooter className="flex items-center justify-center pt-4 border-t">
              <p className="text-xs text-gray-600">
                  Já tem uma conta?{' '}
                  <Link href="/projetos/caravana/login" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">
                    Faça o login
                  </Link>
              </p>
            </CardFooter>
        </Card>
    </div>
  );
}