// app/dashboard/profile/edit/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, XCircle, User, Home, CalendarIcon } from "lucide-react";
import { useIMask } from 'react-imask';

import {
  getCurrentUserData,
  updateDoctorProfileData, // <<< Agora deve ser encontrado
  type DoctorProfile,
  type DoctorProfileUpdatePayload, // <<< Agora deve ser encontrado
  type AddressInfo
} from "@/lib/auth-service";
import { formatDoc } from "@/lib/utils";

// Componentes de Estado (Loading, Error)
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => (
    <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-gray-600 mt-3">{message}</span>
    </div>
));
LoadingState.displayName = 'LoadingState';

const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full">
        <XCircle className="w-12 h-12 text-red-400 mb-4"/>
        <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p>
        <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados. Por favor, tente novamente."}</p>
        {onRetry && (
            <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4 bg-red-600 hover:bg-red-700 text-white">
                Tentar Novamente
            </Button>
        )}
    </div>
));
ErrorState.displayName = 'ErrorState';

// Componente para inputs com máscara
interface InputWithIMaskProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onAccept' | 'value' | 'defaultValue'> {
  maskOptions: any;
  onAccept: (value: string, unmaskedValue: string) => void;
  rawValue?: string;
}
const InputWithIMask: React.FC<InputWithIMaskProps> = ({ maskOptions, onAccept, rawValue, ...rest }) => {
  const { ref, setValue } = useIMask(maskOptions, {
    onAccept: (value, maskRef) => onAccept(value, maskRef.unmaskedValue)
  });

  useEffect(() => {
    if (rawValue !== undefined && typeof setValue === 'function') {
      setValue(String(rawValue));
    }
  }, [rawValue, setValue]);

  return <Input ref={ref as React.RefObject<HTMLInputElement>} {...rest} />;
};


export default function EditDoctorProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [initialProfileData, setInitialProfileData] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState<AddressInfo>({ cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
  const [isSpecialist, setIsSpecialist] = useState(false);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const data = await getCurrentUserData();
      if (data?.role === 'doctor') {
        const doctorData = data as DoctorProfile;
        setInitialProfileData(doctorData);
        setDisplayName(doctorData.displayName || "");
        setPhone(doctorData.phone || "");
        setDob(doctorData.dob || "");
        setAddress(doctorData.address || { cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
        setIsSpecialist(doctorData.isSpecialist || false);
        console.log("[EditDoctorProfilePage] Perfil de médico carregado para edição:", doctorData);
      } else {
        setError("Perfil de médico não encontrado ou tipo de perfil inválido.");
        console.warn("[EditDoctorProfilePage] Perfil não é de médico ou não encontrado:", data);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados do perfil.");
      toast({ title: "Erro ao Carregar Perfil", description: err.message, variant: "destructive" });
      console.error("[EditDoctorProfilePage] Erro ao buscar perfil:", err);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleAddressInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddress(prev => ({ ...prev, [name]: value }));
  };
  
  const handlePhoneChange = (unmaskedValue: string) => {
    setPhone(unmaskedValue);
  };

  const handleCEPChange = (unmaskedValue: string) => {
    setAddress(prev => ({ ...prev, cep: unmaskedValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialProfileData?.uid) {
      toast({ title: "Erro", description: "Não foi possível identificar o usuário.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    setError(null);

    if (!displayName.trim()) {
      toast({ title: "Campo Obrigatório", description: "O nome completo não pode estar vazio.", variant: "destructive" });
      setIsSaving(false); return;
    }

    const payload: DoctorProfileUpdatePayload = {
      displayName: displayName.trim(),
      phone: phone.replace(/[^\d]/g, ""),
      dob,
      address: {
          cep: address.cep.replace(/[^\d]/g, ""),
          street: address.street,
          number: address.number,
          complement: address.complement || "",
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state.toUpperCase(),
      },
      isSpecialist,
    };
    
    console.log("[EditDoctorProfilePage] Payload para atualização:", payload);

    try {
      await updateDoctorProfileData(initialProfileData.uid, payload);
      toast({ title: "Perfil Atualizado", description: "Suas informações foram salvas com sucesso!", variant: "default" });
      router.push("/dashboard/profile");
      router.refresh();
    } catch (err: any) {
      console.error("[EditDoctorProfilePage] Erro ao salvar perfil:", err);
      setError(err.message || "Não foi possível salvar as alterações.");
      toast({ title: "Erro ao Salvar", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center items-center h-64"><LoadingState message="Carregando dados para edição..." /></div>;
  if (error) return <div className="flex justify-center items-center h-64"><ErrorState message={error} onRetry={fetchProfile} /></div>;
  if (!initialProfileData) return <div className="p-4 text-center">Dados do perfil não disponíveis para edição. Por favor, tente recarregar.</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Editar Perfil</h1>
      <form onSubmit={handleSubmit}>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User size={20}/> Informações Pessoais</CardTitle>
            <CardDescription>Atualize seus dados de contato e identificação.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Nome Completo*</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (Login)</Label>
              <Input id="email" type="email" value={initialProfileData.email} readOnly disabled className="bg-gray-100 cursor-not-allowed" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone Celular*</Label>
              <InputWithIMask
                id="phone"
                maskOptions={{ mask: '(00) 00000-0000' }}
                rawValue={phone}
                onAccept={(_, unmasked) => handlePhoneChange(unmasked)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dob">Data de Nascimento*</Label>
              <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF (Não editável)</Label>
                <Input id="cpf" value={formatDoc(initialProfileData.cpf, 'cpf')} readOnly disabled className="bg-gray-100 cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rg">RG (Não editável)</Label>
                <Input id="rg" value={initialProfileData.rg} readOnly disabled className="bg-gray-100 cursor-not-allowed" />
              </div>
              <div className="sm:col-span-2 flex items-center space-x-2 pt-2">
                <Switch id="isSpecialist" checked={isSpecialist} onCheckedChange={setIsSpecialist} />
                <Label htmlFor="isSpecialist" className="cursor-pointer">Sou especialista com RQE</Label>
              </div>
          </CardContent>
        </Card>

        <Card className="mt-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Home size={20}/> Endereço Residencial</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="cep">CEP*</Label>
              <InputWithIMask id="cep" maskOptions={{mask: '00000-000'}} rawValue={address.cep} onAccept={(_, unmasked) => handleCEPChange(unmasked)} />
            </div>
            <div className="sm:col-span-4 space-y-1.5">
              <Label htmlFor="street">Rua / Avenida*</Label>
              <Input id="street" name="street" value={address.street} onChange={handleAddressInputChange} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="number">Número*</Label>
              <Input id="number" name="number" value={address.number} onChange={handleAddressInputChange} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="complement">Complemento</Label>
              <Input id="complement" name="complement" value={address.complement || ""} onChange={handleAddressInputChange} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="neighborhood">Bairro*</Label>
              <Input id="neighborhood" name="neighborhood" value={address.neighborhood} onChange={handleAddressInputChange} />
            </div>
            <div className="sm:col-span-4 space-y-1.5">
              <Label htmlFor="city">Cidade*</Label>
              <Input id="city" name="city" value={address.city} onChange={handleAddressInputChange} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="state">Estado (UF)*</Label>
              <Input id="state" name="state" value={address.state} onChange={handleAddressInputChange} maxLength={2} />
            </div>
          </CardContent>
        </Card>
        
        <CardFooter className="mt-8 flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={() => router.push("/dashboard/profile")} disabled={isSaving}>
                <XCircle className="mr-2 h-4 w-4"/> Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Alterações
            </Button>
        </CardFooter>
      </form>
    </div>
  );
}