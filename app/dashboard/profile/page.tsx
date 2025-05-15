// app/dashboard/profile/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUserData, type DoctorProfile } from '@/lib/auth-service';
// Ajuste o caminho se LoadingState e ErrorState estiverem em um local compartilhado
// import { LoadingState, ErrorState } from '@/components/ui/state-indicators';
import { ProfileField } from '@/components/profile/ProfileField';
import { DocumentStatusField } from '@/components/profile/DocumentStatusField';
import { cn, formatDoc } from '@/lib/utils';
import { AlertTriangle, Edit, User, Home, FileText, Award, Briefcase, Loader2, RotateCcw, XCircle } from 'lucide-react'; // Adicionado Loader2, RotateCcw, XCircle
import Link from 'next/link';

// Definindo LoadingState e ErrorState localmente se não importados de um arquivo comum
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => (
    <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-gray-600 mt-3">{message}</span>
    </div>
));
LoadingState.displayName = 'LoadingState';

const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4"/> {/* Usando AlertTriangle importado */}
        <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p>
        <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados. Por favor, tente novamente."}</p>
        {onRetry && (
            <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4 bg-red-600 hover:bg-red-700 text-white">
                <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente
            </Button>
        )}
    </div>
));
ErrorState.displayName = 'ErrorState';


// Labels dos documentos
const DOC_LABELS = { personalRg: "RG Pessoal*", personalCpf: "CPF Pessoal*", professionalCrm: "Carteira Profissional (CRM)*", photo3x4: "Foto 3x4 Recente*", addressProof: "Comprovante de Residência Pessoal*", graduationCertificate: "Certificado de Graduação*", criminalRecordCert: "Certidão Negativa Criminal*", ethicalCert: "Certidão Negativa Ético-Profissional*", debtCert: "Certidão Negativa de Débitos CRM*", cv: "Currículo Vitae (CV)*", rqe: "Registro de Qualificação de Especialista (RQE)*", postGradCert: "Certificado de Pós-Graduação/Residência*", specialistTitle: "Título de Especialista*", recommendationLetter: "Carta de Recomendação (Opcional)" } as const;
type DoctorDocKeys = keyof DoctorProfile['documents'];
type SpecialistDocKeys = keyof DoctorProfile['specialistDocuments'];


export default function DoctorProfilePage() {
  const [profileData, setProfileData] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProfile = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const data = await getCurrentUserData();
      console.log("[DoctorProfilePage] Fetched data in doctor profile page:", data);
      if (data?.role === 'doctor') {
        const doctorData = data as DoctorProfile;
        if(doctorData.address && doctorData.documents && typeof doctorData.isSpecialist === 'boolean') {
            if (doctorData.specialistDocuments === undefined) {
                (doctorData as any).specialistDocuments = {};
            }
            setProfileData(doctorData);
        } else {
            console.error("[DoctorProfilePage] Doctor profile data incomplete:", doctorData);
            setError("Dados do perfil de médico incompletos ou com formato inesperado.");
            setProfileData(null);
        }
      } else if (data) {
        setError("Perfil inválido. Esperado perfil de médico.");
        console.error("[DoctorProfilePage] Expected doctor profile, got:", data?.role);
        setProfileData(null);
      } else {
        setError("Usuário não autenticado ou perfil não encontrado.");
        setProfileData(null);
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

  if (isLoading) { return <LoadingState message="Carregando seu perfil..." />; }
  if (error || !profileData) { return <ErrorState message={error || "Perfil de médico não encontrado."} onRetry={fetchProfile} />; }

  const essentialDocKeys: DoctorDocKeys[] = ['personalRg', 'personalCpf', 'professionalCrm', 'photo3x4', 'addressProof', 'graduationCertificate'];
  const certsAndCvDocKeys: DoctorDocKeys[] = ['criminalRecordCert', 'ethicalCert', 'debtCert', 'cv'];
  const specialistDocKeysArray: SpecialistDocKeys[] = ['rqe', 'postGradCert', 'specialistTitle', 'recommendationLetter'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Perfil: {profileData.displayName}</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/profile/edit">
            <>
              <Edit className="mr-2 h-4 w-4"/>
              <span>Editar Perfil</span>
            </>
          </Link>
        </Button>
      </div>

      <Card> <CardHeader><CardTitle className="flex items-center gap-2"><User size={18}/> Dados Pessoais</CardTitle></CardHeader> <CardContent><dl> <ProfileField label="Nome Completo" value={profileData.displayName} /> <ProfileField label="Email (Login)" value={profileData.email} /> <ProfileField label="Nascimento" value={profileData.dob} /> <ProfileField label="RG" value={profileData.rg} /> <ProfileField label="CPF" value={formatDoc(profileData.cpf, 'cpf')} /> <ProfileField label="Telefone" value={formatDoc(profileData.phone, 'phone')} /> </dl></CardContent> </Card>

      {profileData.address && (
        <Card> <CardHeader><CardTitle className="flex items-center gap-2"><Home size={18}/> Endereço</CardTitle></CardHeader> <CardContent><dl> <ProfileField label="CEP" value={formatDoc(profileData.address.cep, 'cep')} /> <ProfileField label="Logradouro" value={profileData.address.street} /> <ProfileField label="Número" value={profileData.address.number} /> <ProfileField label="Complemento" value={profileData.address.complement} /> <ProfileField label="Bairro" value={profileData.address.neighborhood} /> <ProfileField label="Cidade" value={profileData.address.city} /> <ProfileField label="Estado" value={profileData.address.state} /> </dl></CardContent> </Card>
      )}

      {profileData.documents && (
        <>
          <Card> <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18}/> Documentos Essenciais</CardTitle></CardHeader> <CardContent><dl> {essentialDocKeys.map(key => ( <DocumentStatusField key={key} label={DOC_LABELS[key as keyof typeof DOC_LABELS] || key} documentUrl={profileData.documents?.[key]} isOptional={!(DOC_LABELS[key as keyof typeof DOC_LABELS] || "").includes('*')} /> ))} </dl></CardContent> </Card>
          <Card> <CardHeader><CardTitle className="flex items-center gap-2"><Award size={18}/> Certidões e CV</CardTitle></CardHeader> <CardContent><dl> {certsAndCvDocKeys.map(key => ( <DocumentStatusField key={key} label={DOC_LABELS[key as keyof typeof DOC_LABELS] || key} documentUrl={profileData.documents?.[key]} isOptional={!(DOC_LABELS[key as keyof typeof DOC_LABELS] || "").includes('*')} /> ))} </dl></CardContent> </Card>
        </>
      )}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase size={18}/> Especialidade</CardTitle></CardHeader>
        <CardContent>
          {/* CORRIGIDO: Erro de Hidratação - <p> não pode ter <div> (Badge) dentro */}
          <div className="text-sm mb-4">
            <span>Possui RQE? </span>
            <Badge variant={profileData.isSpecialist ? 'default' : 'outline'} className={cn(profileData.isSpecialist ? 'bg-blue-100 text-blue-800' : '', "ml-1")}>{profileData.isSpecialist ? "Sim" : "Não"}</Badge>
          </div>
          {profileData.isSpecialist && profileData.specialistDocuments && (
            <dl>
              <h4 className="text-sm font-medium text-gray-600 mb-2">Documentos de Especialista:</h4>
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
          {!profileData.isSpecialist && (<p className="text-sm text-gray-500 italic">Nenhuma especialidade com RQE registrada ou documentos enviados.</p> )}
        </CardContent>
      </Card>
    </div>
  );
}