// app/dashboard/profile/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button, buttonVariants } from "@/components/ui/button"; // Importar buttonVariants
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUserData, type DoctorProfile } from '@/lib/auth-service';
// Se LoadingState e ErrorState são globais:
import { LoadingState, ErrorState } from '@/components/ui/state-indicators'; 
// Se ProfileField e DocumentStatusField são globais:
import { ProfileField } from '@/components/profile/ProfileField'; 
import { DocumentStatusField } from '@/components/profile/DocumentStatusField';
import { formatDoc, cn } from '@/lib/utils'; // Adicionado cn
import { AlertTriangle, Edit, User, Home, FileText, Award, Briefcase, Loader2, RotateCcw } from 'lucide-react'; // Adicionado Loader2, RotateCcw se usados em ErrorState
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Para o botão de edição alternativo

const DOC_LABELS = { personalRg: "RG Pessoal*", personalCpf: "CPF Pessoal*", professionalCrm: "Carteira Profissional (CRM)*", photo3x4: "Foto 3x4 Recente*", addressProof: "Comprovante de Residência Pessoal*", graduationCertificate: "Certificado de Graduação*", criminalRecordCert: "Certidão Negativa Criminal*", ethicalCert: "Certidão Negativa Ético-Profissional*", debtCert: "Certidão Negativa de Débitos CRM*", cv: "Currículo Vitae (CV)*", rqe: "Registro de Qualificação de Especialista (RQE)*", postGradCert: "Certificado de Pós-Graduação/Residência*", specialistTitle: "Título de Especialista*", recommendationLetter: "Carta de Recomendação (Opcional)" } as const;
type DoctorDocKeys = keyof DoctorProfile['documents'];
type SpecialistDocKeys = keyof DoctorProfile['specialistDocuments'];

// Se LoadingState ou ErrorState não forem globais, defina-os aqui como antes.

export default function DoctorProfilePage() {
  const [profileData, setProfileData] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter(); // Para o botão de edição alternativo

  const fetchProfile = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const data = await getCurrentUserData();
      console.log("[DoctorProfilePage] Fetched data:", data);
      if (data?.role === 'doctor') {
        const doctorData = data as DoctorProfile;
        // Garantir que objetos opcionais existam para evitar erros de renderização
        if (!doctorData.documents) (doctorData as any).documents = {};
        if (!doctorData.specialistDocuments) (doctorData as any).specialistDocuments = {};
        if (!doctorData.address) (doctorData as any).address = {};

        setProfileData(doctorData);
      } else if (data) { 
        setError("Perfil inválido. Esperado perfil de médico.");
        console.error("[DoctorProfilePage] Expected doctor profile, got:", data?.role);
      } else { 
        setError("Usuário não autenticado ou perfil não encontrado.");
      }
    } catch (err: any) { 
      console.error("[DoctorProfilePage] Error fetching profile:", err);
      setError(err.message || "Erro ao carregar perfil."); 
      toast({ title: "Erro ao Carregar Perfil", description: err.message, variant: "destructive"}); 
    } finally { 
      setIsLoading(false); 
    }
  }, [toast]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (isLoading) { return <div className="p-6 flex justify-center"><LoadingState message="Carregando seu perfil..." /></div>; }
  if (error || !profileData) { return <div className="p-6"><ErrorState message={error || "Perfil de médico não encontrado."} onRetry={fetchProfile} /></div>; }

  const essentialDocKeys: DoctorDocKeys[] = ['personalRg', 'personalCpf', 'professionalCrm', 'photo3x4', 'addressProof', 'graduationCertificate'];
  const certsAndCvDocKeys: DoctorDocKeys[] = ['criminalRecordCert', 'ethicalCert', 'debtCert', 'cv'];
  const specialistDocKeysArray: SpecialistDocKeys[] = ['rqe', 'postGradCert', 'specialistTitle', 'recommendationLetter'];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Perfil: {profileData.displayName}</h1>
        {/* Alternativa para o botão de Edição para evitar React.Children.only */}
        <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.push('/dashboard/profile/edit')}
        >
            <Edit className="mr-2 h-4 w-4"/> Editar Perfil
        </Button>
      </div>

      <Card> <CardHeader><CardTitle className="flex items-center gap-2"><User size={18}/> Dados Pessoais</CardTitle></CardHeader> <CardContent><dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2"> <ProfileField label="Nome Completo" value={profileData.displayName} /> <ProfileField label="Email (Login)" value={profileData.email} /> <ProfileField label="Nascimento" value={profileData.dob ? new Date(profileData.dob + "T00:00:00").toLocaleDateString('pt-BR') : "Não informado"} /> <ProfileField label="RG" value={profileData.rg} /> <ProfileField label="CPF" value={formatDoc(profileData.cpf, 'cpf')} /> <ProfileField label="Telefone" value={formatDoc(profileData.phone, 'phone')} /> </dl></CardContent> </Card>

      {profileData.address && (
        <Card> <CardHeader><CardTitle className="flex items-center gap-2"><Home size={18}/> Endereço</CardTitle></CardHeader> <CardContent><dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2"> <ProfileField label="CEP" value={formatDoc(profileData.address.cep, 'cep')} /> <ProfileField label="Logradouro" value={profileData.address.street} /> <ProfileField label="Número" value={profileData.address.number} /> <ProfileField label="Complemento" value={profileData.address.complement} /> <ProfileField label="Bairro" value={profileData.address.neighborhood} /> <ProfileField label="Cidade" value={profileData.address.city} /> <ProfileField label="Estado" value={profileData.address.state} /> </dl></CardContent> </Card>
      )}

      {profileData.documents && (
        <>
          <Card> <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18}/> Documentos Essenciais</CardTitle></CardHeader> <CardContent><dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2"> {essentialDocKeys.map(key => ( <DocumentStatusField key={key} label={DOC_LABELS[key as keyof typeof DOC_LABELS] || key} documentUrl={profileData.documents?.[key]} isOptional={!(DOC_LABELS[key as keyof typeof DOC_LABELS] || "").includes('*')} /> ))} </dl></CardContent> </Card>
          <Card> <CardHeader><CardTitle className="flex items-center gap-2"><Award size={18}/> Certidões e CV</CardTitle></CardHeader> <CardContent><dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2"> {certsAndCvDocKeys.map(key => ( <DocumentStatusField key={key} label={DOC_LABELS[key as keyof typeof DOC_LABELS] || key} documentUrl={profileData.documents?.[key]} isOptional={!(DOC_LABELS[key as keyof typeof DOC_LABELS] || "").includes('*')} /> ))} </dl></CardContent> </Card>
        </>
      )}
      <Card> 
        <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase size={18}/> Especialidade</CardTitle></CardHeader> 
        <CardContent> 
          {/* CORRIGIDO: Erro de Hidratação */}
          <div className="text-sm mb-4">
            <span>Possui RQE? </span>
            <Badge variant={profileData.isSpecialist ? 'default' : 'outline'} className={cn(profileData.isSpecialist ? 'bg-blue-100 text-blue-800' : 'border-gray-300', "ml-2")}>{profileData.isSpecialist ? "Sim" : "Não"}</Badge>
          </div>
          {profileData.isSpecialist && profileData.specialistDocuments && Object.keys(profileData.specialistDocuments).length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2"> 
              <h4 className="text-sm font-medium text-gray-600 mb-1 sm:col-span-2">Documentos de Especialista:</h4> 
              {specialistDocKeysArray.map(key => (
                <DocumentStatusField 
                  key={key} 
                  label={DOC_LABELS[key as keyof typeof DOC_LABELS] || key} 
                  documentUrl={profileData.specialistDocuments?.[key]} 
                  isOptional={!(DOC_LABELS[key as keyof typeof DOC_LABELS] || "").includes('*')} 
                /> 
              ))} 
            </dl> 
          )}
          {profileData.isSpecialist && (!profileData.specialistDocuments || Object.keys(profileData.specialistDocuments).length === 0) && (<p className="text-sm text-amber-700 italic">Você indicou que é especialista, mas não há documentos de especialidade enviados.</p> )}
          {!profileData.isSpecialist && (<p className="text-sm text-gray-500 italic">Nenhuma especialidade com RQE registrada.</p> )}
        </CardContent> 
      </Card>
    </div>
  );
}