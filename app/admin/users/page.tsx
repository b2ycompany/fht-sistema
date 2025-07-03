// app/admin/users/page.tsx
"use client";

import * as React from "react";
import {
    ColumnDef, SortingState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable
} from "@tanstack/react-table";
import { Users, Building, ArrowUpDown, Loader2, MoreHorizontal } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { type HospitalProfile } from "@/lib/auth-service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Tipo estendido para incluir a contagem de médicos
type HospitalWithDoctorCount = HospitalProfile & { doctorCount: number };

// Definição das colunas para a tabela de hospitais
export const columns: ColumnDef<HospitalWithDoctorCount>[] = [
    {
        accessorKey: "displayName",
        header: "Nome do Hospital",
        cell: ({ row }) => <div className="font-medium">{row.getValue("displayName")}</div>,
    },
    {
        accessorKey: "cnpj",
        header: "CNPJ",
        cell: ({ row }) => <div>{row.getValue("cnpj") || 'N/A'}</div>,
    },
    {
        accessorKey: "documentVerificationStatus",
        header: "Status do Cadastro",
        cell: ({ row }) => {
            const status = row.getValue("documentVerificationStatus") as string;
            const badgeClass = status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
            return <Badge variant="outline" className={badgeClass}>{status === 'APPROVED' ? 'Aprovado' : 'Pendente'}</Badge>
        },
    },
    {
        accessorKey: "doctorCount",
        header: ({ column }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Médicos Associados<ArrowUpDown className="ml-2 h-4 w-4" /></Button>,
        cell: ({ row }) => <div className="text-center font-bold text-lg">{row.getValue("doctorCount")}</div>,
    },
    {
        id: "actions",
        cell: ({ row }) => (
            <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
            </Button>
        ),
    },
];

export default function AdminUsersPage() {
    const { toast } = useToast();
    const [hospitals, setHospitals] = React.useState<HospitalWithDoctorCount[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = React.useState('');

    React.useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Buscar todos os hospitais
                const hospitalsQuery = query(collection(db, "users"), where("role", "==", "hospital"));
                const hospitalsSnapshot = await getDocs(hospitalsQuery);
                const hospitalData = hospitalsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as HospitalProfile));

                // 2. Para cada hospital, buscar a contagem de médicos na sua subcoleção
                const hospitalsWithCounts = await Promise.all(
                    hospitalData.map(async (hospital) => {
                        const doctorsQuery = query(collection(db, 'users', hospital.uid, 'hospitalDoctors'));
                        const doctorsSnapshot = await getDocs(doctorsQuery);
                        return {
                            ...hospital,
                            doctorCount: doctorsSnapshot.size, // .size é eficiente e não baixa os dados dos documentos
                        };
                    })
                );
                
                setHospitals(hospitalsWithCounts);

            } catch (error) {
                console.error("Erro ao buscar utilizadores:", error);
                toast({ title: "Erro ao carregar dados", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [toast]);

    const table = useReactTable({
        data: hospitals,
        columns,
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: { sorting, globalFilter },
    });
    
    return (
        <div className="w-full space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
                <Users size={28}/> Gestão de Utilizadores
            </h1>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Building />Hospitais Cadastrados</CardTitle>
                    <CardDescription>Visualize todos os hospitais e o número de médicos associados para fins de gestão e cobrança.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center py-4">
                        <Input
                            placeholder="Filtrar por nome do hospital ou CNPJ..."
                            value={globalFilter}
                            onChange={(event) => setGlobalFilter(event.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead key={header.id}>
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                ) : table.getRowModel().rows?.length ? (
                                    table.getRowModel().rows.map((row) => (
                                        <TableRow key={row.id}>
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">Nenhum hospital encontrado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</Button>
                        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Próximo</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}