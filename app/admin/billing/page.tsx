// app/admin/billing/page.tsx
"use client";

import * as React from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { DollarSign, Building, Users, UserCheck, Loader2, FileText } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { type HospitalProfile } from "@/lib/auth-service";
import { type Contract } from "@/lib/contract-service";
import { formatCurrency } from "@/lib/utils";
import { startOfMonth, endOfMonth } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Interfaces para os dados
interface BillingRates {
    feePerManagedDoctor: number;
}
interface HospitalBillingData extends HospitalProfile {
    managedDoctorsCount: number;
    usageFee: number;
    shiftRevenue: number;
    totalBillable: number;
}

// Definição das colunas da tabela de faturamento
export const columns: ColumnDef<HospitalBillingData>[] = [
    { accessorKey: "displayName", header: "Hospital" },
    { accessorKey: "cnpj", header: "CNPJ" },
    { accessorKey: "managedDoctorsCount", header: "Médicos Associados" },
    { header: "Faturamento por Uso", cell: ({ row }) => formatCurrency(row.original.usageFee) },
    { header: "Faturamento por Plantões (Mês)", cell: ({ row }) => formatCurrency(row.original.shiftRevenue) },
    { header: "Total a Cobrar", cell: ({ row }) => <div className="font-bold text-base text-blue-600">{formatCurrency(row.original.totalBillable)}</div> },
    { id: "actions", cell: () => <Button variant="outline" size="sm">Gerar Fatura</Button> },
];

export default function AdminBillingPage() {
    const { toast } = useToast();
    const [billingData, setBillingData] = React.useState<HospitalBillingData[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [kpis, setKpis] = React.useState({ totalPlatformRevenue: 0, totalShiftRevenue: 0, totalUsageFee: 0 });

    React.useEffect(() => {
        const fetchBillingData = async () => {
            setIsLoading(true);
            try {
                // 1. Buscar a nova taxa de faturamento
                const settingsDoc = await getDoc(doc(db, "settings", "billing"));
                if (!settingsDoc.exists() || !settingsDoc.data()?.feePerManagedDoctor) {
                    throw new Error("Taxa 'feePerManagedDoctor' não encontrada nas configurações de faturamento.");
                }
                const rates = settingsDoc.data() as BillingRates;

                // 2. Buscar todos os contratos e hospitais
                const contractsSnapshot = await getDocs(collection(db, "contracts"));
                const allContracts = contractsSnapshot.docs.map(d => d.data() as Contract);
                const hospitalsQuery = query(collection(db, "users"), where("role", "==", "hospital"));
                const hospitalsSnapshot = await getDocs(hospitalsQuery);
                const hospitalProfiles = hospitalsSnapshot.docs.map(d => ({ ...d.data(), uid: d.id } as HospitalProfile));

                // 3. Calcular os dados de faturamento para cada hospital
                const now = new Date();
                const startOfCurrentMonth = startOfMonth(now);
                const endOfCurrentMonth = endOfMonth(now);

                const data: HospitalBillingData[] = await Promise.all(
                    hospitalProfiles.map(async (hospital) => {
                        // Calcula a receita de Taxa por Utilização
                        const doctorsSnapshot = await getDocs(collection(db, "users", hospital.uid, "hospitalDoctors"));
                        const managedDoctorsCount = doctorsSnapshot.size;
                        const usageFee = managedDoctorsCount * rates.feePerManagedDoctor;

                        // Calcula a receita de Taxa por Intermediação (margem nos plantões)
                        const shiftRevenue = allContracts
                            .filter(c => 
                                c.hospitalId === hospital.uid &&
                                c.status === 'COMPLETED' &&
                                c.updatedAt &&
                                c.updatedAt.toDate() >= startOfCurrentMonth &&
                                c.updatedAt.toDate() <= endOfCurrentMonth
                            )
                            .reduce((acc, c) => acc + (c.hospitalRate - c.doctorRate), 0);
                        
                        return {
                            ...hospital,
                            managedDoctorsCount,
                            usageFee,
                            shiftRevenue,
                            totalBillable: usageFee + shiftRevenue,
                        };
                    })
                );

                setBillingData(data);

                // Calcular KPIs globais da plataforma
                const totalUsageFee = data.reduce((acc, h) => acc + h.usageFee, 0);
                const totalShiftRevenue = data.reduce((acc, h) => acc + h.shiftRevenue, 0);
                setKpis({ 
                    totalPlatformRevenue: totalUsageFee + totalShiftRevenue,
                    totalShiftRevenue,
                    totalUsageFee 
                });

            } catch (error: any) {
                console.error("Erro no cálculo do faturamento:", error);
                toast({ title: "Erro ao calcular faturamento", description: error.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchBillingData();
    }, [toast]);

    const table = useReactTable({ data: billingData, columns, getCoreRowModel: getCoreRowModel() });

    return (
        <div className="w-full space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold">Painel de Faturamento da Plataforma</h1>
            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Receita Total da Plataforma (Mês)</CardTitle><DollarSign/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalPlatformRevenue)}</div></CardContent></Card>
                <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Receita de Plantões (Mês)</CardTitle><FileText/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalShiftRevenue)}</div></CardContent></Card>
                <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Receita por Uso (Taxas)</CardTitle><Users/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalUsageFee)}</div></CardContent></Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Detalhamento por Hospital</CardTitle><CardDescription>Relatório de faturamento a ser cobrado de cada hospital na plataforma.</CardDescription></CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>{table.getHeaderGroups().map(hg => (<TableRow key={hg.id}>{hg.headers.map(h => (<TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>))}</TableRow>))}</TableHeader>
                            <TableBody>{isLoading ? <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="animate-spin"/></TableCell></TableRow> : table.getRowModel().rows.map(row => (<TableRow key={row.id}>{row.getVisibleCells().map(cell => (<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>))}</TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}