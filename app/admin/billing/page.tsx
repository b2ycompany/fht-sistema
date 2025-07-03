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
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// CORREÇÃO 1 de 2: A forma como importamos as bibliotecas de PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interfaces para os dados
interface BillingRates {
    feePerManagedDoctor: number;
}
interface HospitalBillingData extends HospitalProfile {
    cnpj?: string;
    managedDoctorsCount: number;
    usageFee: number;
    shiftRevenue: number;
    totalBillable: number;
}

const generateInvoicePdf = (hospitalData: HospitalBillingData) => {
    const doc = new jsPDF();
    const billingMonth = format(new Date(), 'MMMM de yyyy', { locale: ptBR });

    // Cabeçalho da Fatura
    doc.setFontSize(20);
    doc.text("FATURA DE SERVIÇOS", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Mês de Referência: ${billingMonth}`, 105, 28, { align: 'center' });

    doc.setFontSize(10);
    doc.text("CLIENTE:", 14, 40);
    doc.text(`${hospitalData.displayName}`, 14, 45);
    doc.text(`CNPJ: ${hospitalData.cnpj || 'Não informado'}`, 14, 50);

    doc.text("EMISSOR:", 205, 40, { align: 'right' });
    doc.text("FHT Gestão e Serviços Médicos", 205, 45, { align: 'right' });
    doc.text("CNPJ: 00.000.000/0001-00", 205, 50, { align: 'right' }); 

    // CORREÇÃO 2 de 2: A forma como chamamos a função autoTable
    autoTable(doc, {
        startY: 65,
        head: [['Descrição do Serviço', 'Valor']],
        body: [
            [`Taxa de Uso da Plataforma (${hospitalData.managedDoctorsCount} médicos)`, formatCurrency(hospitalData.usageFee)],
            [`Receita de Intermediação de Plantões (${billingMonth})`, formatCurrency(hospitalData.shiftRevenue)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74] },
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("TOTAL A PAGAR:", 14, finalY + 15);
    doc.text(formatCurrency(hospitalData.totalBillable), 205, finalY + 15, { align: 'right' });
    
    doc.save(`fatura-${hospitalData.displayName?.replace(/\s/g, '_')}-${format(new Date(), 'MM-yyyy')}.pdf`);
};

export const columns: ColumnDef<HospitalBillingData>[] = [
    { accessorKey: "displayName", header: "Hospital" },
    { accessorKey: "cnpj", header: "CNPJ" },
    { accessorKey: "managedDoctorsCount", header: "Médicos Associados" },
    { header: "Faturamento por Uso", cell: ({ row }) => formatCurrency(row.original.usageFee) },
    { header: "Faturamento por Plantões (Mês)", cell: ({ row }) => formatCurrency(row.original.shiftRevenue) },
    { header: "Total a Cobrar", cell: ({ row }) => <div className="font-bold text-base text-blue-600">{formatCurrency(row.original.totalBillable)}</div> },
    { id: "actions", cell: ({ row }) => (<Button variant="outline" size="sm" onClick={() => generateInvoicePdf(row.original)}>Gerar Fatura</Button>),},
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
                const settingsDoc = await getDoc(doc(db, "settings", "billing"));
                if (!settingsDoc.exists() || !settingsDoc.data()?.feePerManagedDoctor) { throw new Error("Taxa 'feePerManagedDoctor' não encontrada nas configurações."); }
                const rates = settingsDoc.data() as BillingRates;
                const contractsSnapshot = await getDocs(collection(db, "contracts"));
                const allContracts = contractsSnapshot.docs.map(d => d.data() as Contract);
                const hospitalsQuery = query(collection(db, "users"), where("role", "==", "hospital"));
                const hospitalsSnapshot = await getDocs(hospitalsQuery);
                const hospitalProfiles = hospitalsSnapshot.docs.map(d => ({ ...d.data(), uid: d.id } as HospitalProfile));
                const now = new Date();
                const startOfCurrentMonth = startOfMonth(now);
                const endOfCurrentMonth = endOfMonth(now);
                const data: HospitalBillingData[] = await Promise.all(
                    hospitalProfiles.map(async (hospital) => {
                        const doctorsSnapshot = await getDocs(collection(db, "users", hospital.uid, "hospitalDoctors"));
                        const managedDoctorsCount = doctorsSnapshot.size;
                        const usageFee = managedDoctorsCount * rates.feePerManagedDoctor;
                        const shiftRevenue = allContracts.filter(c => { const signatureDate = c.hospitalSignature?.signedAt?.toDate(); const isBillableStatus = c.status === 'ACTIVE_SIGNED' || c.status === 'COMPLETED'; return (c.hospitalId === hospital.uid && isBillableStatus && signatureDate && signatureDate >= startOfCurrentMonth && signatureDate <= endOfCurrentMonth); }).reduce((acc, c) => acc + (c.hospitalRate - c.doctorRate), 0);
                        return { ...hospital, managedDoctorsCount, usageFee, shiftRevenue, totalBillable: usageFee + shiftRevenue, };
                    })
                );
                setBillingData(data);
                const totalUsageFee = data.reduce((acc, h) => acc + h.usageFee, 0);
                const totalShiftRevenue = data.reduce((acc, h) => acc + h.shiftRevenue, 0);
                setKpis({ totalPlatformRevenue: totalUsageFee + totalShiftRevenue, totalShiftRevenue, totalUsageFee });
            } catch (error: any) { console.error("Erro no cálculo do faturamento:", error); toast({ title: "Erro ao calcular faturamento", description: error.message, variant: "destructive" }); }
            finally { setIsLoading(false); }
        };
        fetchBillingData();
    }, [toast]);

    const table = useReactTable({ data: billingData, columns, getCoreRowModel: getCoreRowModel() });

    return (
        <div className="w-full space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold">Painel de Faturamento da Plataforma</h1>
            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Receita Total (Mês)</CardTitle><DollarSign/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(kpis.totalPlatformRevenue)}</div></CardContent></Card>
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