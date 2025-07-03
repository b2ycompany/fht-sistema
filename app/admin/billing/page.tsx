// app/admin/billing/page.tsx
"use client";

import * as React from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { DollarSign, Building, Users, UserCheck, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { type HospitalProfile } from "@/lib/auth-service";
import { formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Interfaces para os dados
interface BillingRates {
    externalDoctorRegistrationFee: number;
    monthlyFeePerActiveDoctor: number;
}
interface HospitalBillingData extends HospitalProfile {
    internalDoctors: number;
    externalDoctors: number;
    newExternalThisMonth: number;
    monthlyUsageCost: number;
    registrationFeeCost: number;
    totalBillable: number;
}

// Definição das colunas da tabela de faturamento
export const columns: ColumnDef<HospitalBillingData>[] = [
    { accessorKey: "displayName", header: "Hospital" },
    { accessorKey: "cnpj", header: "CNPJ" },
    { header: "Médicos (Plataforma)", cell: ({ row }) => row.original.internalDoctors },
    { header: "Médicos (Externos)", cell: ({ row }) => row.original.externalDoctors },
    { header: "Custo Mensal (Uso)", cell: ({ row }) => formatCurrency(row.original.monthlyUsageCost) },
    { header: "Taxas de Cadastro (Mês)", cell: ({ row }) => formatCurrency(row.original.registrationFeeCost) },
    { header: "Faturamento Total (Mês)", cell: ({ row }) => <div className="font-bold text-base">{formatCurrency(row.original.totalBillable)}</div> },
    { id: "actions", cell: () => <Button variant="outline" size="sm">Gerar Fatura</Button> },
];

export default function AdminBillingPage() {
    const { toast } = useToast();
    const [billingData, setBillingData] = React.useState<HospitalBillingData[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [kpis, setKpis] = React.useState({ totalBillable: 0, totalUsage: 0, totalFees: 0 });

    React.useEffect(() => {
        const fetchBillingData = async () => {
            setIsLoading(true);
            try {
                // 1. Buscar as taxas de faturamento
                const settingsDoc = await getDoc(doc(db, "settings", "billing"));
                if (!settingsDoc.exists()) throw new Error("Configurações de faturamento não encontradas.");
                const rates = settingsDoc.data() as BillingRates;

                // 2. Buscar todos os hospitais
                const hospitalsQuery = query(collection(db, "users"), where("role", "==", "hospital"));
                const hospitalsSnapshot = await getDocs(hospitalsQuery);
                const hospitalProfiles = hospitalsSnapshot.docs.map(d => ({ ...d.data(), uid: d.id } as HospitalProfile));

                // 3. Calcular os dados de faturamento para cada hospital
                const startOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                const data: HospitalBillingData[] = await Promise.all(
                    hospitalProfiles.map(async (hospital) => {
                        const doctorsSnapshot = await getDocs(collection(db, "users", hospital.uid, "hospitalDoctors"));
                        
                        let internalDoctors = 0;
                        let externalDoctors = 0;
                        let newExternalThisMonth = 0;

                        doctorsSnapshot.forEach(doc => {
                            const doctorData = doc.data();
                            if (doctorData.source === 'PLATFORM') {
                                internalDoctors++;
                            } else if (doctorData.source === 'EXTERNAL') {
                                externalDoctors++;
                                if (doctorData.addedAt.toDate() >= startOfCurrentMonth) {
                                    newExternalThisMonth++;
                                }
                            }
                        });

                        const totalActiveDoctors = internalDoctors + externalDoctors;
                        const monthlyUsageCost = totalActiveDoctors * rates.monthlyFeePerActiveDoctor;
                        const registrationFeeCost = newExternalThisMonth * rates.externalDoctorRegistrationFee;

                        return {
                            ...hospital,
                            internalDoctors,
                            externalDoctors,
                            newExternalThisMonth,
                            monthlyUsageCost,
                            registrationFeeCost,
                            totalBillable: monthlyUsageCost + registrationFeeCost
                        };
                    })
                );

                setBillingData(data);

                // Calcular KPIs globais
                const totalBillable = data.reduce((acc, h) => acc + h.totalBillable, 0);
                const totalUsage = data.reduce((acc, h) => acc + h.monthlyUsageCost, 0);
                const totalFees = data.reduce((acc, h) => acc + h.registrationFeeCost, 0);
                setKpis({ totalBillable, totalUsage, totalFees });

            } catch (error: any) {
                toast({ title: "Erro ao calcular faturamento", description: error.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchBillingData();
    }, [toast]);

    const table = useReactTable({
        data: billingData, columns, getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="w-full space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold">Painel de Faturamento</h1>
            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Faturamento Total (Mês)</CardTitle><DollarSign/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalBillable)}</div></CardContent></Card>
                <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Receita de Uso (Mês)</CardTitle><Users/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalUsage)}</div></CardContent></Card>
                <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Receita de Cadastros (Mês)</CardTitle><UserCheck/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalFees)}</div></CardContent></Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Detalhamento por Hospital</CardTitle><CardDescription>Relatório de faturamento mensal para cada hospital na plataforma.</CardDescription></CardHeader>
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