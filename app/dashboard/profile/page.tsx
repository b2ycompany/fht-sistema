// app/dashboard/profile/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { type DoctorProfile } from '@/lib/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserCircle, Mail, Phone, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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

export default function DoctorProfilePage() {
    // ============================================================================
    // CORREÇÃO PRINCIPAL: Obtemos o estado de 'profileLoading' do hook de autenticação.
    // Este estado nos diz se o perfil do utilizador já foi carregado do Firestore.
    // ============================================================================
    const { userProfile, profileLoading } = useAuth();
    const [doctorData, setDoctorData] = useState<DoctorProfile | null>(null);

    // Este useEffect agora reage à mudança de 'profileLoading'.
    // Ele só tenta definir os dados do médico DEPOIS que o useAuth
    // confirma que o carregamento terminou (!profileLoading).
    useEffect(() => {
        if (!profileLoading && userProfile) {
            if (userProfile.userType === 'doctor') {
                setDoctorData(userProfile as DoctorProfile);
            }
        }
    }, [userProfile, profileLoading]);

    // 1. Mostra um indicador de carregamento ENQUANTO o AuthProvider busca os dados.
    if (profileLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            </div>
        );
    }

    // 2. Mostra uma mensagem de erro se, APÓS o carregamento, não houver dados de médico.
    // Isso cobre o caso de um utilizador não-médico aceder à página ou falha no carregamento.
    if (!doctorData) {
        return (
            <div className="container mx-auto p-6 text-center">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle>Erro</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Não foi possível carregar os dados do seu perfil de médico.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 3. Se tudo correu bem, renderiza o perfil com os dados de 'doctorData'.
    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <UserCircle className="h-16 w-16 text-blue-600" />
                            <div>
                                <CardTitle className="text-2xl">{doctorData.displayName}</CardTitle>
                                <CardDescription>Perfil do Profissional</CardDescription>
                            </div>
                        </div>
                        <Button asChild>
                            <Link href="/dashboard/profile/edit">Editar Perfil</Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ProfileField icon={Mail} label="Email de Contato" value={doctorData.email} />
                        <ProfileField icon={Phone} label="Telefone" value={doctorData.phone} />
                        <ProfileField icon={Briefcase} label="CRM" value={doctorData.professionalCrm} />
                    </div>
                    {/* Exibe as especialidades do médico, se existirem */}
                    {doctorData.specialties && doctorData.specialties.length > 0 && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">Especialidades</p>
                            <div className="flex flex-wrap gap-2">
                                {doctorData.specialties.map(spec => (
                                    <Badge key={spec} variant="secondary">{spec}</Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}