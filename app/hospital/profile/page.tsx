"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/components/auth-provider';
import { getCurrentUserData, type HospitalProfile } from "@/lib/auth-service";
import { Loader2, AlertTriangle, Building, User, Mail, Phone, MapPin, Edit, CheckCircle, Clock, FileUp } from 'lucide-react';
import { DOC_LABELS } from '@/lib/constants';

const LoadingState = () => ( <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="ml-3">Carregando perfil...</p></div> );
const ErrorState = ({ message, onRetry }: { message: string, onRetry: () => void }) => ( <div className="text-center p-6"><p className="text-red-600">{message}</p><Button onClick={onRetry} className="mt-4">Tentar Novamente</Button></div> );

const ProfileField = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string | null }) => (
    <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
        <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm font-medium text-gray-800 break-words">{value || '-'}</p>
        </div>
    </div>
);

const DocumentLink = ({ label, url }: { label: string, url?: string }) => (
    <div className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-md border">
        <span className="text-gray-700">{label.replace('*', '')}</span>
        {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium text-xs">Ver Documento</a>
        ) : (
            <span className="text-xs text-gray-400 italic">Não enviado</span>
        )}
    </div>
);

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType, title: string }) => (
    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4 border-b pb-2">
        <Icon size={18} className="text-blue-700" />
        {title}
    </h3>
);

export default function HospitalProfilePage() {
    const { user } = useAuth();
    const router = useRouter();

    const [profile, setProfile] = useState<HospitalProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        setIsLoading(true); setError(null);
        try {
            const data = await getCurrentUserData();
            if (data?.userType === 'hospital') {
                setProfile(data as HospitalProfile);
            } else {
                setError("Perfil de hospital não encontrado.");
            }
        } catch (err: any) {
            setError(err.message || "Ocorreu um erro ao buscar os dados do perfil.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={fetchProfile} />;
    if (!profile) return <div className="p-4 text-center">Não foi possível carregar o perfil.</div>;

    const { 
        companyInfo, 
        legalRepresentativeInfo, 
        hospitalDocs, 
        legalRepDocuments, 
        documentVerificationStatus, 
        adminVerificationNotes 
    } = profile;

    const VerificationStatusAlert = () => {
        switch (documentVerificationStatus) {
            case 'APPROVED':
                return (
                    <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Cadastro Aprovado</AlertTitle>
                        <AlertDescription>Seu perfil foi verificado e está tudo certo.</AlertDescription>
                    </Alert>
                );
            case 'PENDING_REVIEW':
                return (
                    <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                        <Clock className="h-4 w-4" />
                        <AlertTitle>Cadastro em Análise</AlertTitle>
                        <AlertDescription>Seus dados e documentos estão sendo verificados pela nossa equipe.</AlertDescription>
                    </Alert>
                );
            case 'REJECTED_NEEDS_RESUBMISSION':
                return (
                     <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Correções Necessárias</AlertTitle>
                        <AlertDescription className="flex flex-col items-start gap-2">
                           <p>Encontramos um problema com seus documentos. Por favor, revise as notas do administrador e reenvie o que for necessário.</p>
                           {adminVerificationNotes && <p className="text-xs font-semibold p-2 bg-red-100 rounded w-full"><strong>Nota do Admin:</strong> {adminVerificationNotes}</p>}
                           <Button size="sm" onClick={() => router.push('/hospital/profile/edit')} className="mt-2">
                                <Edit className="mr-2 h-4 w-4"/> Corrigir Documentação
                           </Button>
                        </AlertDescription>
                    </Alert>
                );
            default:
                return null;
        }
    };
    
    return (
        <div className="space-y-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Perfil da Empresa</h1>
            
            <VerificationStatusAlert />

            <Card className="shadow-lg">
                <CardHeader>
                    <SectionTitle icon={Building} title="Informações da Empresa" />
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                    <ProfileField icon={Building} label="Razão Social" value={profile.displayName} />
                    <ProfileField icon={Building} label="CNPJ" value={companyInfo.cnpj} />
                    <ProfileField icon={Mail} label="Email de Contato (Login)" value={profile.email} />
                    <ProfileField icon={Phone} label="Telefone" value={companyInfo.phone} />
                    <ProfileField icon={MapPin} label="Endereço" value={`${companyInfo.address.street}, ${companyInfo.address.number} - ${companyInfo.address.city}, ${companyInfo.address.state}`} />
                    <ProfileField icon={Building} label="Inscrição Estadual" value={companyInfo.stateRegistration} />
                </CardContent>
            </Card>
            
            <Card className="shadow-lg">
                <CardHeader>
                    <SectionTitle icon={FileUp} title="Documentos da Empresa" />
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-3">
                    {Object.keys(DOC_LABELS).filter(key => key in (hospitalDocs || {})).map(key => (
                        <DocumentLink key={key} label={DOC_LABELS[key as keyof typeof DOC_LABELS]} url={(hospitalDocs as any)?.[key]} />
                    ))}
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <SectionTitle icon={User} title="Responsável Legal" />
                </CardHeader>
                 <CardContent className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                    <ProfileField icon={User} label="Nome" value={legalRepresentativeInfo.name} />
                    <ProfileField icon={User} label="CPF" value={legalRepresentativeInfo.cpf} />
                    <ProfileField icon={User} label="Cargo" value={legalRepresentativeInfo.position} />
                    <ProfileField icon={Mail} label="Email" value={legalRepresentativeInfo.email} />
                    <ProfileField icon={Phone} label="Telefone" value={legalRepresentativeInfo.phone} />
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <SectionTitle icon={FileUp} title="Documentos do Responsável" />
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-3">
                     {Object.keys(DOC_LABELS).filter(key => key in (legalRepDocuments || {})).map(key => (
                        <DocumentLink key={key} label={DOC_LABELS[key as keyof typeof DOC_LABELS]} url={(legalRepDocuments as any)?.[key]} />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}