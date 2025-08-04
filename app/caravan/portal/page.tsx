// app/caravan/portal/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { getCurrentUserData, type UserProfile } from '@/lib/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, ClipboardList, LayoutDashboard, Loader2, UserCheck, Stethoscope } from 'lucide-react';

interface ActionCardProps { title: string; description: string; href: string; icon: React.ElementType; }
const ActionCard: React.FC<ActionCardProps> = ({ title, description, href, icon: Icon }) => (
    <Card className="hover:border-blue-500 hover:shadow-lg transition-all">
        <CardHeader>
            <CardTitle className="flex items-center gap-3"><Icon className="h-6 w-6 text-blue-600" />{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent><Button asChild className="w-full"><Link href={href}>Acessar <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent>
    </Card>
);

export default function CaravanPortalPage() {
    const { user, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (user && !profile) {
            getCurrentUserData()
                .then(setProfile)
                .finally(() => setIsProfileLoading(false));
        } else {
            setIsProfileLoading(false);
        }
    }, [user, authLoading, profile]);
    
    if (authLoading || isProfileLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    }

    if (!profile) {
        return (
            <div className="text-center p-10">
                <h1 className="text-2xl font-bold">Acesso Negado</h1>
                <p>Você não está logado ou seu perfil não foi encontrado.</p>
                <Button asChild className="mt-4"><Link href="/projetos/caravana/login">Ir para o Login</Link></Button>
            </div>
        );
    }

    // --- CORREÇÃO: Verifica 'userType' primeiro, depois 'role' ---
    const userRole = profile.userType || (profile as any).role;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Portal do Multirão da Saúde</h1>
                <p className="text-muted-foreground">Bem-vindo(a), {profile.displayName}. Selecione sua área de trabalho.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(userRole === 'receptionist' || userRole === 'caravan_admin' || userRole === 'admin') && (
                    <ActionCard title="Acolhimento (Recepção)" description="Cadastre novos pacientes e encaminhe-os para a triagem." href="/caravan/reception" icon={ClipboardList} />
                )}
                {(userRole === 'triage_nurse' || userRole === 'caravan_admin' || userRole === 'admin') && (
                    <ActionCard title="Fila de Triagem" description="Colete o histórico e os dados iniciais dos pacientes." href="/caravan/triage" icon={UserCheck} />
                )}
                {(userRole === 'doctor' || userRole === 'caravan_admin' || userRole === 'admin') && (
                    <ActionCard title="Fila de Atendimento" description="Visualize sua fila e chame o próximo paciente para atender." href="/dashboard/fila" icon={Stethoscope} />
                )}
                 {(userRole === 'caravan_admin' || userRole === 'admin') && (
                    <ActionCard title="Dashboard de Gestão" description="Acompanhe os indicadores do evento em tempo real." href="/caravan/dashboard" icon={LayoutDashboard} />
                )}
            </div>
        </div>
    );
}