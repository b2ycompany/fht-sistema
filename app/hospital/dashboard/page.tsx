// app/hospital/dashboard/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, ClipboardList, CheckCircle, AlertCircle } from 'lucide-react';
import { getHospitalDashboardData, type HospitalDashboardData } from '@/lib/hospital-dashboard-service';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Componente reutilizável para os cartões de estatísticas (KPIs)
const StatCard = ({ title, value, icon: Icon, description, isLoading }: { title: string; value: string | number; icon: React.ElementType; description?: string; isLoading: boolean; }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {isLoading ? 
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /> : 
                <div className="text-2xl font-bold">{value}</div>
            }
            {description && !isLoading && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

export default function HospitalDashboardPage() {
    const { userProfile, loading: authLoading } = useAuth();
    const { toast } = useToast();

    const [dashboardData, setDashboardData] = useState<HospitalDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Apenas busca os dados se o perfil do gestor estiver carregado
        if (userProfile && userProfile.userType === 'hospital') {
            const fetchData = async () => {
                setIsLoading(true);
                setError(null);
                try {
                    // Chama a nossa nova função de serviço, passando o ID do gestor (que é o ID da unidade)
                    const data = await getHospitalDashboardData(userProfile.uid);
                    setDashboardData(data);
                } catch (err: any) {
                    setError(err.message);
                    toast({
                        title: "Erro ao Carregar Painel",
                        description: err.message,
                        variant: "destructive"
                    });
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [userProfile, toast]);

    if (authLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    }
    
    // Mostra uma mensagem de erro se a busca de dados falhar
    if (error) {
        return (
            <div className="container mx-auto p-6 text-center">
                <Card className="max-w-md mx-auto bg-red-50 border-red-300">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2 text-red-700">
                            <AlertCircle />
                            Falha ao Carregar
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-red-600">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Painel da Unidade</h1>
                    <p className="text-muted-foreground">Visão geral da operação de hoje em {userProfile?.displayName}.</p>
                </div>
                {/* Botões para as outras páginas de gestão que já criámos ou vamos criar */}
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/hospital/dashboard/Equipe">
                            <Users className="mr-2 h-4 w-4" />
                            Gerir Equipa
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/hospital/shifts">
                            <ClipboardList className="mr-2 h-4 w-4" />
                            Gerir Plantões
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatCard 
                    title="Pacientes na Fila de Triagem" 
                    value={dashboardData?.triageQueueCount ?? 0}
                    icon={Users}
                    description="Aguardando o primeiro atendimento."
                    isLoading={isLoading}
                />
                <StatCard 
                    title="Pacientes na Fila de Atendimento" 
                    value={dashboardData?.consultationQueueCount ?? 0}
                    icon={Users}
                    description="Triados e aguardando o médico."
                    isLoading={isLoading}
                />
                <StatCard 
                    title="Atendimentos Finalizados Hoje" 
                    value={dashboardData?.completedTodayCount ?? 0}
                    icon={CheckCircle}
                    description="Total de consultas concluídas."
                    isLoading={isLoading}
                />
            </div>
            
            {/* No futuro, este é o local ideal para adicionar gráficos de desempenho */}
            
        </div>
    );
}