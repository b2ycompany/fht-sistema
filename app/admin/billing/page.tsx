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
    externalDoctorRegistrationFee: number;
    monthlyFeePerActiveDoctor: number;
}
interface HospitalBillingData extends HospitalProfile {
    activeDoctorsCount: number;
    usageFee: number;
    shiftRevenue: number;
    registrationFee: number;
    totalBillable: number;
}

// Definição das colunas da tabela de faturamento
export const columns: ColumnDef<HospitalBillingData>[] = [
    { accessorKey: "displayName", header: "Hospital" },
    { accessorKey: "cnpj", header: "CNPJ" },
    { accessorKey: "activeDoctorsCount", header: "Médicos Ativos" },
    { header: "Taxa de Uso (Mês)", cell: ({ row }) => formatCurrency(row.original.usageFee) },
    { header: "Receita de Plantões (Mês)", cell: ({ row }) => formatCurrency(row.original.shiftRevenue) },
    { header: "Receita de Cadastros (Mês)", cell: ({ row }) => formatCurrency(row.original.registrationFee) },
    { header: "Faturamento Total (Mês)", cell: ({ row }) => <div className="font-bold text-base">{formatCurrency(row.original.totalBillable)}</div> },
    { id: "actions", cell: () => <Button variant="outline" size="sm">Ver Detalhes</Button> },
];

export default function AdminBillingPage() {
    const { toast } = useToast();
    const [billingData, setBillingData] = React.useState<HospitalBillingData[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [kpis, setKpis] = React.useState({ totalBillable: 0, totalShiftRevenue: 0, totalUsageAndFees: 0 });

    React.useEffect(() => {
        const fetchBillingData = async () => {
            setIsLoading(true);
            try {
                // 1. Buscar as taxas de faturamento
                const settingsDoc = await getDoc(doc(db, "settings", "billing"));
                if (!settingsDoc.exists()) throw new Error("Configurações de faturamento não encontradas.");
                const rates = settingsDoc.data() as BillingRates;

                // 2. Buscar todos os contratos
                const contractsSnapshot = await getDocs(collection(db, "contracts"));
                const allContracts = contractsSnapshot.docs.map(d => d.data() as Contract);

                // 3. Buscar todos os hospitais
                const hospitalsQuery = query(collection(db, "users"), where("role", "==", "hospital"));
                const hospitalsSnapshot = await getDocs(hospitalsQuery);
                const hospitalProfiles = hospitalsSnapshot.docs.map(d => ({ ...d.data(), uid: d.id } as HospitalProfile));

                // 4. Calcular os dados de faturamento para cada hospital
                const now = new Date();
                const startOfCurrentMonth = startOfMonth(now);
                const endOfCurrentMonth = endOfMonth(now);

                const data: HospitalBillingData[] = await Promise.all(
                    hospitalProfiles.map(async (hospital) => {
                        const doctorsSnapshot = await getDocs(collection(db, "users", hospital.uid, "hospitalDoctors"));
                        const activeDoctorsCount = doctorsSnapshot.size;
                        
                        let newExternalThisMonth = 0;
                        doctorsSnapshot.forEach(doc => {
                            const doctorData = doc.data();
                            // CORREÇÃO: Adicionada verificação se 'doctorData.addedAt' existe
                            if (doctorData.source === 'EXTERNAL' && doctorData.addedAt && doctorData.addedAt.toDate() >= startOfCurrentMonth) {
                                newExternalThisMonth++;
                            }
                        });

                        // CORREÇÃO: Adicionada verificação se 'c.updatedAt' existe
                        const shiftRevenue = allContracts
                            .filter(c => 
                                c.hospitalId === hospital.uid &&
                                c.status === 'COMPLETED' &&
                                c.updatedAt && // <-- Verificação de segurança aqui
                                c.updatedAt.toDate() >= startOfCurrentMonth &&
                                c.updatedAt.toDate() <= endOfCurrentMonth
                            )
                            .reduce((acc, c) => acc + (c.hospitalRate - c.doctorRate), 0);
                        
                        const usageFee = activeDoctorsCount * rates.monthlyFeePerActiveDoctor;
                        const registrationFee = newExternalThisMonth * rates.externalDoctorRegistrationFee;

                        return {
                            ...hospital,
                            activeDoctorsCount,
                            usageFee,
                            shiftRevenue,
                            registrationFee,
                            totalBillable: usageFee + registrationFee + shiftRevenue,
                        };
                    })
                );

                setBillingData(data);

                // Calcular KPIs globais
                const totalBillable = data.reduce((acc, h) => acc + h.totalBillable, 0);
                const totalShiftRevenue = data.reduce((acc, h) => acc + h.shiftRevenue, 0);
                const totalUsageAndFees = data.reduce((acc, h) => acc + h.usageFee + h.registrationFee, 0);
                setKpis({ totalBillable, totalShiftRevenue, totalUsageAndFees });

            } catch (error: any) {
                console.error("Erro no cálculo do faturamento:", error); // Log mais detalhado no console
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
            <h1 className="text-2xl md:text-3xl font-bold">Painel de Faturamento</h1>
            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Faturamento Total (Mês)</CardTitle><DollarSign/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalBillable)}</div></CardContent></Card>
                <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Receita de Plantões (Mês)</CardTitle><FileText/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalShiftRevenue)}</div></CardContent></Card>
                <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Receita de Taxas (Uso/Cadastro)</CardTitle><Users/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalUsageAndFees)}</div></CardContent></Card>
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