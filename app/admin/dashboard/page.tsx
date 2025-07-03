// app/admin/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, DollarSign, TrendingUp, Users, Building, FileText, ShieldCheck } from "lucide-react";

import { type Contract } from "@/lib/contract-service";
import { type UserProfile } from "@/lib/auth-service";
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// =================================================================================================
// 1. COMPONENTES DE UI
// =================================================================================================

const StatCard = ({ title, value, icon: Icon, description, isLoading }: { title: string; value: string | number; icon: React.ElementType; description?: string; isLoading?: boolean; }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <div className="text-2xl font-bold">{value}</div>}
            {description && !isLoading && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const ChartLoadingState = () => <div className="flex h-[350px] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

// =================================================================================================
// 2. COMPONENTE PRINCIPAL DA PÁGINA
// =================================================================================================

export default function AdminDashboardPage() {
    const { toast } = useToast();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [pendingActions, setPendingActions] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Efeito para buscar todos os dados necessários para a dashboard
    useEffect(() => {
        const contractsQuery = query(collection(db, "contracts"), orderBy("createdAt", "desc"));
        const usersQuery = query(collection(db, "users"));
        const pendingActionsQuery = query(collection(db, "potentialMatches"), where("status", "==", "PENDING_BACKOFFICE_REVIEW"));
        
        const unsubscribeContracts = onSnapshot(contractsQuery, (snap) => setContracts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Contract))));
        const unsubscribeUsers = onSnapshot(usersQuery, (snap) => setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))));
        const unsubscribePending = onSnapshot(pendingActionsQuery, (snap) => setPendingActions(snap.size));
        
        // Simula o fim do carregamento inicial
        const timer = setTimeout(() => setIsLoading(false), 1500);

        return () => {
            unsubscribeContracts();
            unsubscribeUsers();
            unsubscribePending();
            clearTimeout(timer);
        };
    }, []);

    // Processamento de dados com useMemo para performance
    const dashboardData = useMemo(() => {
        const now = new Date();
        const startOfCurrentMonth = startOfMonth(now);

        // KPIs
        const activeDoctors = users.filter(u => u.role === 'doctor').length;
        const activeHospitals = users.filter(u => u.role === 'hospital').length;
        const revenueCurrentMonth = contracts
            .filter(c => c.createdAt.toDate() >= startOfCurrentMonth)
            .reduce((acc, c) => acc + (c.hospitalRate - c.doctorRate), 0);
        const newContractsCurrentMonth = contracts.filter(c => c.createdAt.toDate() >= startOfCurrentMonth).length;

        // Dados para Gráficos
        const monthlyRevenue = Array.from({ length: 6 }).map((_, i) => {
            const monthDate = subMonths(now, i);
            const start = startOfMonth(monthDate);
            const end = endOfMonth(monthDate);
            const revenue = contracts
                .filter(c => { const d = c.createdAt.toDate(); return d >= start && d <= end; })
                .reduce((acc, c) => acc + (c.hospitalRate - c.doctorRate), 0);
            return { name: format(monthDate, 'MMM/yy', { locale: ptBR }), Receita: revenue };
        }).reverse();
        
        const topHospitals = Object.entries(contracts.reduce((acc, c) => {
            acc[c.hospitalName] = (acc[c.hospitalName] || 0) + c.hospitalRate;
            return acc;
        }, {} as Record<string, number>))
        .sort(([,a],[,b]) => b - a)
        .slice(0, 5)
        .map(([name, value]) => ({ name, 'Valor Gasto': value }));

        return { activeDoctors, activeHospitals, revenueCurrentMonth, newContractsCurrentMonth, monthlyRevenue, topHospitals };
    }, [contracts, users]);

    return (
        <div className="w-full space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Dashboard</h1>
            
            {/* Seção 1: KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <StatCard title="Receita (Mês)" value={formatCurrency(dashboardData.revenueCurrentMonth)} icon={DollarSign} isLoading={isLoading} />
                <StatCard title="Novos Contratos (Mês)" value={dashboardData.newContractsCurrentMonth} icon={FileText} isLoading={isLoading} />
                <StatCard title="Médicos Ativos" value={dashboardData.activeDoctors} icon={Users} isLoading={isLoading} />
                <StatCard title="Hospitais Ativos" value={dashboardData.activeHospitals} icon={Building} isLoading={isLoading} />
                <Card className="border-yellow-500 border-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ações Pendentes</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pendingActions}</div>
                        <Link href="/admin/matches">
                            <Button variant="link" className="p-0 h-auto text-xs text-muted-foreground">Ir para o painel de revisão</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Seção 2: Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <Card className="lg:col-span-3">
                    <CardHeader><CardTitle>Receita Mensal da Plataforma (Últimos 6 meses)</CardTitle><CardDescription>Evolução da margem de lucro gerada.</CardDescription></CardHeader>
                    <CardContent>
                        {isLoading ? <ChartLoadingState /> : (
                            <ResponsiveContainer width="100%" height={350}>
                                <LineChart data={dashboardData.monthlyRevenue}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                                    <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => formatCurrency(value as number)}/>
                                    <Tooltip formatter={(value) => formatCurrency(value as number)}/>
                                    <Legend />
                                    <Line type="monotone" dataKey="Receita" stroke="#16a34a" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle>Top 5 Hospitais</CardTitle><CardDescription>Maiores clientes por valor gasto em plantões.</CardDescription></CardHeader>
                    <CardContent>
                        {isLoading ? <ChartLoadingState /> : (
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={dashboardData.topHospitals} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={80} stroke="#888888" fontSize={12} />
                                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                    <Legend />
                                    <Bar dataKey="Valor Gasto" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            {/* Seção 3: Atividade Recente (Opcional, pode ser adicionado depois) */}
        </div>
    );
}