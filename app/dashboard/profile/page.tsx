// app/dashboard/profile/page.tsx (Código Completo e Corrigido)
"use client";

import React, { useEffect, useState, ChangeEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { type UserProfile, type DoctorProfile, type HospitalProfile } from '@/lib/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, UserCircle, Mail, Phone, Briefcase, FileText, CheckCircle, ShieldAlert, FileWarning, Upload, ExternalLink, BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Input } from '@/components/ui/input'; // <<< IMPORTAÇÃO ADICIONADA
import { Label } from '@/components/ui/label'; // <<< IMPORTAÇÃO ADICIONADA
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils'; // <<< IMPORTAÇÃO ADICIONADA

// --- (Este é um objeto de mapeamento para nomes amigáveis) ---
const DOCUMENT_LABELS: Record<string, string> = { 
    personalRg: "RG Pessoal", personalCpf: "CPF Pessoal", professionalCrm: "CRM", photo3x4: "Foto 3x4", addressProof: "Comprov. Endereço", graduationCertificate: "Cert. Graduação", criminalRecordCert: "Cert. Neg. Criminal", ethicalCert: "Cert. Neg. Ética", debtCert: "Cert. Neg. Débitos CRM", cv: "Currículo Vitae", rqe: "RQE", postGradCert: "Cert. Pós/Residência", specialistTitle: "Título Especialista", recommendationLetter: "Carta Recomendação", 
    socialContract: "Contrato Social", cnpjCard: "Cartão CNPJ", companyAddressProof: "Comprovante Endereço Empresa", 
    repRg: "RG do Responsável", repCpf: "CPF do Responsável", repAddressProof: "Comprovante Endereço Responsável" 
};

// Componente para exibir um campo de informação do perfil de forma padronizada
const ProfileField = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | undefined | null }) => (
    <div className="flex items-start gap-4">
        <Icon className="h-5 w-5 text-muted-foreground mt-1" />
        <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-semibold">{value || 'Não informado'}</p>
        </div>
    </div>
);

// --- NOVO COMPONENTE: DocumentStatusCard ---
// Mostra o status geral da aprovação
const DocumentStatusCard = ({ profile }: { profile: UserProfile }) => {
    const status = (profile as any).documentVerificationStatus;

    if (status === 'APPROVED') {
        return (
            <Card className="bg-green-50 border-green-200">
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <BadgeCheck className="h-10 w-10 text-green-600" />
                    <div>
                        <CardTitle className="text-green-800">Perfil Aprovado</CardTitle>
                        <CardDescription className="text-green-700">Seu cadastro foi verificado e aprovado. Você tem acesso total à plataforma.</CardDescription>
                    </div>
                </CardHeader>
            </Card>
        );
    }
    
    if (status === 'REJECTED_NEEDS_RESUBMISSION') {
        return (
            <Card className="bg-red-50 border-red-200">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <FileWarning className="h-10 w-10 text-red-600" />
                        <div>
                            <CardTitle className="text-red-800">Correções Necessárias</CardTitle>
                            <CardDescription className="text-red-700">O administrador solicitou correções. Verifique seus documentos abaixo.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                {/* Mostra as notas gerais do admin */}
                {(profile as any).adminVerificationNotes && (
                    <CardContent>
                        <Label className="text-gray-700 font-semibold">Observações do Administrador:</Label>
                        <p className="text-sm text-gray-600 italic border-l-4 border-red-300 pl-3 py-2 bg-red-100 rounded-r-md">
                            {(profile as any).adminVerificationNotes}
                        </p>
                    </CardContent>
                )}
            </Card>
        );
    }

    // Padrão: PENDING_REVIEW ou indefinido
    return (
        <Card className="bg-yellow-50 border-yellow-200">
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <ShieldAlert className="h-10 w-10 text-yellow-600" />
                <div>
                    <CardTitle className="text-yellow-800">Perfil em Análise</CardTitle>
                    <CardDescription className="text-yellow-700">Seu cadastro está sendo analisado pela nossa equipa. Você será notificado por email.</CardDescription>
                </div>
            </CardHeader>
        </Card>
    );
};

// --- NOVO COMPONENTE: DocumentManager ---
// Lista todos os documentos e permite o re-envio
const DocumentManager = ({ profile }: { profile: UserProfile }) => {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState<string | null>(null); // Armazena o 'docKey' do doc a ser enviado
    
    const rejectionReasons = (profile as any).documentRejectionReasons || {};
    
    // Combina todos os objetos de documento num só
    const allDocuments = {
        ...(profile as DoctorProfile).documents,
        ...(profile as DoctorProfile).specialistDocuments,
        ...(profile as HospitalProfile).hospitalDocs,
        ...(profile as HospitalProfile).legalRepDocuments,
    };

    // Função (placeholder) para lidar com o re-envio de arquivos
    const handleFileResubmit = async (e: ChangeEvent<HTMLInputElement>, docKey: string, docGroup: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(docKey);
        toast({ title: "A enviar documento...", description: file.name });

        try {
            // ================================================================
            // IMPORTANTE: Esta é a Fase 2 (Ainda não implementada)
            // Precisamos de uma nova Cloud Function 'users-resubmitDocument'
            // e uma função de serviço em 'profile-service.ts'
            // ================================================================
            
            // Exemplo da lógica futura:
            // await resubmitDocument(profile.uid, docKey, docGroup, file);
            
            // Simulação de 2 segundos de upload
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            toast({ title: "Função AINDA NÃO IMPLEMENTADA", description: "O UI está pronto, mas o backend de re-envio precisa ser criado.", variant: "destructive", duration: 5000 });
            // Quando implementado, trocar o toast acima por:
            // toast({ title: "Documento Enviado!", description: "Seu documento foi enviado para re-análise.", variant: "success" });
            
        } catch (error: any) {
            toast({ title: "Erro no Envio", description: error.message, variant: "destructive" });
        } finally {
            setIsUploading(null);
            // Limpa o input file para permitir novo envio se falhar
            e.target.value = ""; 
        }
    };

    // Função para renderizar uma seção de documentos
    const renderDocumentSection = (title: string, docGroup: string, documents: Record<string, string> | undefined) => {
        if (!documents || Object.keys(documents).length === 0) return null;
        
        return (
            <Card>
                <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {Object.entries(documents).map(([key, url]) => {
                        const friendlyName = DOCUMENT_LABELS[key] || key;
                        const reason = rejectionReasons[key];
                        const isRejected = !!reason;

                        return (
                            <div key={key} className={cn("p-3 rounded-md border", 
                                isRejected ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
                            )}>
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div>
                                        <p className="font-medium text-gray-800">{friendlyName}</p>
                                        <Link href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                            Ver documento enviado <ExternalLink size={12} />
                                        </Link>
                                    </div>
                                    {/* Botão de Substituir */}
                                    <Button asChild variant={isRejected ? "destructive" : "secondary"} size="sm" className="relative cursor-pointer w-full sm:w-auto">
                                        <Label htmlFor={`file-resubmit-${key}`}>
                                            {isUploading === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                            {isRejected ? "Substituir" : "Atualizar"}
                                        </Label>
                                    </Button>
                                    <Input 
                                        type="file" 
                                        id={`file-resubmit-${key}`} 
                                        className="sr-only" 
                                        disabled={isUploading === key}
                                        onChange={(e) => handleFileResubmit(e, key, docGroup)}
                                    />
                                </div>
                                {/* Mostra a razão da rejeição, se houver */}
                                {isRejected && (
                                    <p className="text-sm text-red-700 mt-2 p-2 bg-red-100 border-l-4 border-red-500 rounded-r-md">
                                        <strong>Motivo da Rejeição:</strong> {reason}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        );
    };
    
    // Filtra documentos que realmente existem no perfil
    const docGroups = {
        documents: (profile as DoctorProfile).documents,
        specialistDocuments: (profile as DoctorProfile).specialistDocuments,
        hospitalDocs: (profile as HospitalProfile).hospitalDocs,
        legalRepDocuments: (profile as HospitalProfile).legalRepDocuments
    };

    return (
        <div className="space-y-6">
            {renderDocumentSection("Documentos Pessoais/Profissionais", "documents", docGroups.documents)}
            {renderDocumentSection("Documentos de Especialista", "specialistDocuments", docGroups.specialistDocuments)}
            {renderDocumentSection("Documentos da Empresa", "hospitalDocs", docGroups.hospitalDocs)}
            {renderDocumentSection("Documentos do Responsável Legal", "legalRepDocuments", docGroups.legalRepDocuments)}
        </div>
    );
};


// --- PÁGINA PRINCIPAL ---
export default function ProfilePage() {
    // Usamos o profileLoading do useAuth para saber quando os dados estão prontos
    const { userProfile, profileLoading } = useAuth();

    if (profileLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!userProfile) {
        return (
            <div className="container mx-auto p-6 text-center">
                <Card className="max-w-md mx-auto">
                    <CardHeader><CardTitle>Erro</CardTitle></CardHeader>
                    <CardContent>
                        <p>Não foi possível carregar os dados do seu perfil.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Apenas para simplificar a passagem de props
    const profileData = userProfile as DoctorProfile | HospitalProfile;

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
            
            {/* 1. Status Geral da Conta */}
            <DocumentStatusCard profile={profileData} />

            {/* 2. Informações Básicas (Não editáveis aqui) */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <UserCircle className="h-16 w-16 text-blue-600" />
                            <div>
                                <CardTitle className="text-2xl">{profileData.displayName}</CardTitle>
                                <CardDescription>Perfil de {profileData.userType === 'doctor' ? 'Profissional' : 'Hospital'}</CardDescription>
                            </div>
                        </div>
                        {/* <Button asChild>
                            <Link href="/dashboard/profile/edit">Editar Perfil</Link>
                        </Button> 
                        */}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ProfileField icon={Mail} label="Email de Contato" value={profileData.email} />
                        <ProfileField icon={Phone} label="Telefone" value={(profileData as any).phone || (profileData as HospitalProfile).companyInfo?.phone} />
                        {profileData.userType === 'doctor' && (
                            <ProfileField icon={Briefcase} label="CRM" value={(profileData as DoctorProfile).professionalCrm} />
                        )}
                        {profileData.userType === 'hospital' && (
                            <ProfileField icon={Briefcase} label="CNPJ" value={(profileData as HospitalProfile).companyInfo?.cnpj} />
                        )}
                    </div>
                    {/* Exibe as especialidades do médico, se existirem */}
                    {(profileData as DoctorProfile).specialties && (profileData as DoctorProfile).specialties.length > 0 && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">Especialidades</p>
                            <div className="flex flex-wrap gap-2">
                                {(profileData as DoctorProfile).specialties.map(spec => (
                                    <Badge key={spec} variant="secondary">{spec}</Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 3. Gestor de Documentos (A nova seção) */}
            <DocumentManager profile={profileData} />

        </div>
    );
}