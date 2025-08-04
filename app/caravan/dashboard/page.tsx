// app/caravan/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';

// Componentes da UI
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, User, Users, CheckCircle, Activity } from 'lucide-react';

// --- Interfaces para os dados do nosso Dashboard ---
interface Stats {
  waiting: number;
  inProgress: number;
  completedToday: number;
  totalToday: number;
}

interface SpecialtyStat {
  name: string;
  count: number;
}

// --- Componentes de Estado (Helpers) ---
const LoadingState = () => (
    <div className="flex justify-center items-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
    </div>
);

const ErrorState = ({ message }: { message: string }) => (
    <div className="text-center p-10 bg-red-50 rounded-lg">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-4 font-semibold text-red-700">Ocorreu um Erro</p>
        <p className="mt-2 text-sm text-red-600">{message}</p>
    </div>
);

// --- Componente Principal do Dashboard ---
export default function CaravanDashboardPage() {
    // Linha 43 - CORRIGIDO: Removemos 'profile' que não existe no contexto.
    const { user } = useAuth();

    // Estados para armazenar os dados do dashboard
    const [stats, setStats] = useState<Stats>({ waiting: 0, inProgress: 0, completedToday: 0, totalToday: 0 });
    const [specialtyStats, setSpecialtyStats] = useState<SpecialtyStat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Função que buscará e ouvirá os dados em tempo real
    const fetchData = useCallback(() => {
        // A lógica de escuta do Firestore será implementada aqui no próximo passo.
        // Por enquanto, apenas removemos o estado de carregamento.
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading) {
        return <LoadingState />;
    }

    if (error) {
        return <ErrorState message={error} />;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard do Multirão</h1>
                <p className="text-muted-foreground">Visão geral dos atendimentos em tempo real.</p>
            </div>

            {/* Seção de KPIs Principais */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pacientes na Fila</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.waiting}</div>
                        <p className="text-xs text-muted-foreground">Aguardando atendimento</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.inProgress}</div>
                        <p className="text-xs text-muted-foreground">Sendo atendidos agora</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Atendimentos Finalizados</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.completedToday}</div>
                        <p className="text-xs text-muted-foreground">Finalizados hoje</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Hoje</CardTitle>
                        <User className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalToday}</div>
                        <p className="text-xs text-muted-foreground">Total de pacientes no dia</p>
                    </CardContent>
                </Card>
            </div>

            {/* Seção para o Gráfico de Especialidades */}
            <div className="grid gap-4">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Atendimentos por Especialidade</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        {/* O componente do gráfico será inserido aqui no futuro */}
                        <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground">
                            <p>(Gráfico em breve)</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}