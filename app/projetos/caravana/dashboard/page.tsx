// app/caravan/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';

// Componentes da UI
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle, User, Users, CheckCircle, Activity, BarChart2 } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

// --- Interfaces para os dados do nosso Dashboard ---
interface Stats {
  waiting: number;
  inProgress: number;
  completedToday: number;
  totalToday: number;
}

interface SpecialtyStat {
  name: string;
  total: number;
}

interface ConsultationDoc {
    status: 'AGUARDANDO' | 'EM_ANDAMENTO' | 'FINALIZADO';
    specialty: string;
    createdAt: Timestamp;
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
    const { user } = useAuth();

    // Estados para armazenar os dados do dashboard
    const [stats, setStats] = useState<Stats>({ waiting: 0, inProgress: 0, completedToday: 0, totalToday: 0 });
    const [specialtyStats, setSpecialtyStats] = useState<SpecialtyStat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Efeito para buscar e escutar os dados em tempo real
    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        // Define o intervalo de hoje para a consulta
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Query para buscar as consultas do dia
        const q = query(
            collection(db, "consultations"),
            where("createdAt", ">=", Timestamp.fromDate(todayStart)),
            where("createdAt", "<=", Timestamp.fromDate(todayEnd))
            // No futuro, podemos adicionar um filtro por 'caravanId' aqui.
        );

        // onSnapshot cria a escuta em tempo real
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const consultations = querySnapshot.docs.map(doc => doc.data() as ConsultationDoc);

            // Processa os dados para calcular os KPIs
            const newStats: Stats = { waiting: 0, inProgress: 0, completedToday: 0, totalToday: 0 };
            const specialtyMap = new Map<string, number>();

            consultations.forEach(consult => {
                // Contagem de Status
                if (consult.status === 'AGUARDANDO') newStats.waiting++;
                if (consult.status === 'EM_ANDAMENTO') newStats.inProgress++;
                if (consult.status === 'FINALIZADO') newStats.completedToday++;
                
                // Contagem por Especialidade
                if (consult.specialty) {
                    specialtyMap.set(consult.specialty, (specialtyMap.get(consult.specialty) || 0) + 1);
                }
            });

            newStats.totalToday = consultations.length;
            
            // Converte o Map para o formato do gráfico
            const newSpecialtyStats = Array.from(specialtyMap.entries()).map(([name, total]) => ({ name, total }));

            setStats(newStats);
            setSpecialtyStats(newSpecialtyStats);
            setIsLoading(false);
            
        }, (err) => {
            console.error("Erro ao escutar consultas:", err);
            setError("Não foi possível carregar os dados em tempo real.");
            setIsLoading(false);
        });

        // Função de limpeza: para de escutar quando o componente é desmontado
        return () => unsubscribe();
        
    }, [user]);

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
                        <CardDescription>Distribuição dos atendimentos realizados hoje.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={specialtyStats}>
                                <XAxis
                                    dataKey="name"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}`}
                                />
                                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}