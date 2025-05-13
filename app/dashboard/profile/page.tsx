// app/dashboard/profile/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast"; // <-- IMPORTAÇÃO ADICIONADA
import { getCurrentUserData, type DoctorProfile } from '@/lib/auth-service';
import { LoadingState, ErrorState } from '@/components/ui/state-indicators'; // Ajuste o caminho se necessário
import { ProfileField } from '@/components/profile/ProfileField';       // Ajuste o caminho se necessário
import { DocumentStatusField } from '@/components/profile/DocumentStatusField'; // Ajuste o caminho se necessário
import { formatDoc } from '@/lib/utils'; // <-- IMPORTAÇÃO ADICIONADA
import { AlertTriangle, Edit, User, Home, FileText, Award, Briefcase } from 'lucide-react';
import Link from 'next/link';

// Labels dos documentos
const DOC_LABELS = { personalRg: "RG Pessoal*", personalCpf: "CPF Pessoal*", professionalCrm: "Carteira Profissional (CRM)*", photo3x4: "Foto 3x4 Recente*", addressProof: "Comprovante de Residência Pessoal*", graduationCertificate: "Certificado de Graduação*", criminalRecordCert: "Certidão Negativa Criminal*", ethicalCert: "Certidão Negativa Ético-Profissional*", debtCert: "Certidão Negativa de Débitos CRM*", cv: "Currículo Vitae (CV)*", rqe: "Registro de Qualificação de Especialista (RQE)*", postGradCert: "Certificado de Pós-Graduação/Residência*", specialistTitle: "Título de Especialista*", recommendationLetter: "Carta de Recomendação (Opcional)" } as const;
type DoctorDocKeys = keyof DoctorProfile['documents'];
type SpecialistDocKeys = keyof DoctorProfile['specialistDocuments'];


export default function DoctorProfilePage() {
  const [profileData, setProfileData] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast(); // Inicializa o hook

  const fetchProfile = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const data = await getCurrentUserData();
      console.log("Fetched data in doctor profile page:", data);
      if (data?.role === 'doctor') {
         // --- CORRIGIDO: Verifica 'address' em vez de 'addressInfo' ---
         if(data.address && data.documents && data.specialistDocuments !== undefined && data.isSpecialist !== undefined) {
            setProfileData(data);
         } else { console.error("Doctor profile data incomplete:", data); setError("Dados do perfil incompletos."); setProfileData(null); }
      } else if (data) { setError("Perfil inválido."); console.error("Expected doctor profile, got:", data?.role); setProfileData(null); }
      else { setError("Usuário não autenticado."); setProfileData(null); }
    } catch (err: any) { console.error("Error fetching profile:", err); setError(err.message || "Erro ao carregar perfil."); setProfileData(null); toast({ title: "Erro ao Carregar Perfil", description: err.message, variant: "destructive"}); }
    finally { setIsLoading(false); }
  }, [toast]); // Adicionado toast como dependência

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // --- Renderização ---
  if (isLoading) { return <LoadingState message="Carregando perfil..." />; }
  if (error || !profileData) { return <ErrorState message={error || "Perfil de médico não encontrado."} onRetry={fetchProfile} />; }

  const essentialDocKeys: DoctorDocKeys[] = ['personalRg', 'personalCpf', 'professionalCrm', 'photo3x4', 'addressProof', 'graduationCertificate'];
  const certsAndCvDocKeys: DoctorDocKeys[] = ['criminalRecordCert', 'ethicalCert', 'debtCert', 'cv'];
  const specialistDocKeys: SpecialistDocKeys[] = ['rqe', 'postGradCert', 'specialistTitle', 'recommendationLetter'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Perfil: {profileData.displayName}</h1>
        <Button variant="outline" size="sm" asChild> <Link href="/dashboard/profile/edit"> <Edit className="mr-2 h-4 w-4"/> Editar Perfil </Link> </Button>
      </div>

      <Card> <CardHeader><CardTitle className="flex items-center gap-2"><User size={18}/> Dados Pessoais</CardTitle></CardHeader> <CardContent><dl> <ProfileField label="Nome Completo" value={profileData.displayName} /> <ProfileField label="Email (Login)" value={profileData.email} /> <ProfileField label="Nascimento" value={profileData.dob} /> <ProfileField label="RG" value={profileData.rg} /> <ProfileField label="CPF" value={formatDoc(profileData.cpf, 'cpf')} /> <ProfileField label="Telefone" value={formatDoc(profileData.phone, 'phone')} /> </dl></CardContent> </Card>

      {/* --- CORRIGIDO: Usa profileData.address --- */}
      {profileData.address && (
        <Card> <CardHeader><CardTitle className="flex items-center gap-2"><Home size={18}/> Endereço</CardTitle></CardHeader> <CardContent><dl> <ProfileField label="CEP" value={formatDoc(profileData.address.cep, 'cep')} /> <ProfileField label="Logradouro" value={profileData.address.street} /> <ProfileField label="Número" value={profileData.address.number} /> <ProfileField label="Complemento" value={profileData.address.complement} /> <ProfileField label="Bairro" value={profileData.address.neighborhood} /> <ProfileField label="Cidade" value={profileData.address.city} /> <ProfileField label="Estado" value={profileData.address.state} /> </dl></CardContent> </Card>
      )}

      {profileData.documents && (
          <>
          <Card> <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18}/> Documentos Essenciais</CardTitle></CardHeader> <CardContent><dl> {essentialDocKeys.map(key => ( <DocumentStatusField key={key} label={DOC_LABELS[key]} documentUrl={profileData.documents?.[key]} isOptional={!DOC_LABELS[key]?.includes('*')} /> ))} </dl></CardContent> </Card>
          <Card> <CardHeader><CardTitle className="flex items-center gap-2"><Award size={18}/> Certidões e CV</CardTitle></CardHeader> <CardContent><dl> {certsAndCvDocKeys.map(key => ( <DocumentStatusField key={key} label={DOC_LABELS[key]} documentUrl={profileData.documents?.[key]} isOptional={!DOC_LABELS[key]?.includes('*')} /> ))} </dl></CardContent> </Card>
          </>
      )}
      <Card> <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase size={18}/> Especialidade</CardTitle></CardHeader> <CardContent> <p className="text-sm mb-4">Possui RQE? <Badge variant={profileData.isSpecialist ? 'default' : 'outline'} className={profileData.isSpecialist ? 'bg-blue-100 text-blue-800' : ''}>{profileData.isSpecialist ? "Sim" : "Não"}</Badge></p> {profileData.isSpecialist && profileData.specialistDocuments && ( <dl> <h4 className="text-sm font-medium text-gray-600 mb-2">Documentos de Especialista:</h4> {specialistDocKeys.map(key => ( <DocumentStatusField key={key} label={DOC_LABELS[key]} documentUrl={profileData.specialistDocuments?.[key]} isOptional={!DOC_LABELS[key]?.includes('*')} /> ))} </dl> )} {!profileData.isSpecialist && (<p className="text-sm text-gray-500 italic">Nenhuma especialidade registrada ou documentos enviados.</p> )} </CardContent> </Card>
    </div>
  );
}