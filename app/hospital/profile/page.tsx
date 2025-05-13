// app/hospital/profile/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast"; // <-- IMPORTAÇÃO ADICIONADA
// Ajuste os imports conforme sua estrutura e arquivos de serviço/tipos
import { getCurrentUserData, type HospitalProfile } from '@/lib/auth-service';
import { LoadingState, ErrorState } from '@/components/ui/state-indicators'; // Ajuste o caminho
import { ProfileField } from '@/components/profile/ProfileField';       // Ajuste o caminho
import { DocumentStatusField } from '@/components/profile/DocumentStatusField'; // Ajuste o caminho
import { formatDoc } from '@/lib/utils'; // Importa função de formatação
import { AlertTriangle, Edit, Building, Home, FileText, UserCircle } from 'lucide-react';
import Link from 'next/link';

// Labels e Tipos de Chaves dos Documentos (Adapte às chaves REAIS em HospitalProfile)
const HOSPITAL_DOC_LABELS = { socialContract: "Contrato Social*", cnpjCard: "Cartão CNPJ*", companyAddressProof: "Comprovante de Endereço da Empresa*" } as const;
const LEGALREP_DOC_LABELS = { repRg: "RG do Responsável*", repCpf: "CPF do Responsável*", repAddressProof: "Comprovante de Residência do Responsável*"} as const;
// Estas chaves DEVEM existir em HospitalProfile['hospitalDocs'] e ['legalRepDocuments'] em auth-service.ts
type HospitalDocKeys = keyof typeof HOSPITAL_DOC_LABELS;
type LegalRepDocKeys = keyof typeof LEGALREP_DOC_LABELS;


export default function HospitalProfilePage() {
  const [profileData, setProfileData] = useState<HospitalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast(); // Inicializa o hook

  const fetchProfile = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const data = await getCurrentUserData();
      console.log("Fetched data in hospital profile:", data);
      if (data?.role === 'hospital') {
        if(data.companyInfo && data.legalRepresentativeInfo && data.companyInfo.address) {
           setProfileData(data as HospitalProfile);
        } else {
           console.error("Hospital profile data incomplete:", data);
           setError("Dados do perfil do hospital estão incompletos.");
           setProfileData(null);
        }
      } else if (data) { setError("Tipo de perfil inválido."); setProfileData(null); }
      else { setError("Usuário não encontrado ou não autenticado."); setProfileData(null); }
    } catch (err: any) {
        console.error("Error fetching profile:", err);
        const errorMsg = err.message || "Erro ao carregar perfil.";
        setError(errorMsg);
        setProfileData(null);
        // Adiciona toast aqui também para o erro de fetch
        toast({ title: "Erro ao Carregar Perfil", description: errorMsg, variant: "destructive"});
    }
    finally { setIsLoading(false); }
  }, [toast]); // toast como dependência

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // --- Renderização ---
  if (isLoading) { return <LoadingState message="Carregando perfil da empresa..." />; }
  if (error || !profileData) { return <ErrorState message={error || "Perfil da empresa não encontrado."} onRetry={fetchProfile} />; }

  const hospitalDocKeys: HospitalDocKeys[] = profileData.hospitalDocs ? Object.keys(HOSPITAL_DOC_LABELS).filter(k => k in profileData.hospitalDocs!) as HospitalDocKeys[] : [];
  const legalRepDocKeys: LegalRepDocKeys[] = profileData.legalRepDocuments ? Object.keys(LEGALREP_DOC_LABELS).filter(k => k in profileData.legalRepDocuments!) as LegalRepDocKeys[] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Perfil: {profileData.displayName}</h1>
        <Button variant="outline" size="sm" asChild>
           <Link href="/hospital/profile/edit"> {/* TODO: Criar página de edição */}
               <Edit className="mr-2 h-4 w-4"/> Editar Perfil
           </Link>
        </Button>
      </div>

      {/* Card Dados da Empresa */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building size={18}/> Dados da Empresa</CardTitle></CardHeader>
        <CardContent><dl>
          <ProfileField label="Razão Social" value={profileData.displayName} />
          <ProfileField label="Email (Login)" value={profileData.email} />
          <ProfileField label="CNPJ" value={formatDoc(profileData.companyInfo?.cnpj, 'cnpj')} />
          <ProfileField label="Inscrição Estadual" value={profileData.companyInfo?.stateRegistration} />
          <ProfileField label="Telefone" value={formatDoc(profileData.companyInfo?.phone, 'phone')} />
        </dl></CardContent>
      </Card>

       {/* Card Endereço da Empresa */}
       {profileData.companyInfo?.address && (
         <Card>
           <CardHeader><CardTitle className="flex items-center gap-2"><Home size={18}/> Endereço da Empresa</CardTitle></CardHeader>
           <CardContent><dl>
             <ProfileField label="CEP" value={formatDoc(profileData.companyInfo.address.cep, 'cep')} />
             <ProfileField label="Logradouro" value={profileData.companyInfo.address.street} />
             <ProfileField label="Número" value={profileData.companyInfo.address.number} />
             <ProfileField label="Complemento" value={profileData.companyInfo.address.complement} />
             <ProfileField label="Bairro" value={profileData.companyInfo.address.neighborhood} />
             <ProfileField label="Cidade" value={profileData.companyInfo.address.city} />
             <ProfileField label="Estado" value={profileData.companyInfo.address.state} />
           </dl></CardContent>
         </Card>
       )}

      {/* Card Responsável Legal */}
       {profileData.legalRepresentativeInfo && (
         <Card>
           <CardHeader><CardTitle className="flex items-center gap-2"><UserCircle size={18}/> Responsável Legal</CardTitle></CardHeader>
           <CardContent><dl>
             <ProfileField label="Nome" value={profileData.legalRepresentativeInfo.name} />
             <ProfileField label="Cargo" value={profileData.legalRepresentativeInfo.position} />
             <ProfileField label="Nascimento" value={profileData.legalRepresentativeInfo.dob} />
             <ProfileField label="RG" value={profileData.legalRepresentativeInfo.rg} />
             <ProfileField label="CPF" value={formatDoc(profileData.legalRepresentativeInfo.cpf, 'cpf')} />
             <ProfileField label="Telefone" value={formatDoc(profileData.legalRepresentativeInfo.phone, 'phone')} />
             <ProfileField label="Email Pessoal" value={profileData.legalRepresentativeInfo.email} />
           </dl></CardContent>
         </Card>
       )}

       {/* Card Documentos Empresa */}
       {profileData.hospitalDocs && hospitalDocKeys.length > 0 && (
           <Card>
             <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18}/> Documentos da Empresa</CardTitle></CardHeader>
             <CardContent><dl>
               {hospitalDocKeys.map(key => (
                 profileData.hospitalDocs && key in profileData.hospitalDocs && (
                     <DocumentStatusField
                         key={key}
                         label={HOSPITAL_DOC_LABELS[key]}
                         documentUrl={profileData.hospitalDocs?.[key] ?? null}
                         isOptional={!HOSPITAL_DOC_LABELS[key]?.includes('*')}
                     />
                 )
               ))}
             </dl></CardContent>
           </Card>
       )}

        {/* Card Documentos Responsável */}
        {profileData.legalRepDocuments && legalRepDocKeys.length > 0 && (
           <Card>
             <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18}/> Documentos do Responsável</CardTitle></CardHeader>
             <CardContent><dl>
               {legalRepDocKeys.map(key => (
                  profileData.legalRepDocuments && key in profileData.legalRepDocuments && (
                     <DocumentStatusField
                         key={key}
                         label={LEGALREP_DOC_LABELS[key]}
                         documentUrl={profileData.legalRepDocuments?.[key] ?? null}
                         isOptional={!LEGALREP_DOC_LABELS[key]?.includes('*')}
                     />
                   )
               ))}
             </dl></CardContent>
           </Card>
        )}

    </div>
  );
}