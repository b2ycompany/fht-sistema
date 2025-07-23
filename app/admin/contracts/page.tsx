// app/admin/contracts/page.tsx
"use client";

import { Textarea } from "@/components/ui/textarea";
import { cancelContractByAdmin } from "@/lib/contract-service";
import * as React from "react";
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import {
    ChevronDown, MoreHorizontal, ArrowUpDown, FileText, DollarSign, TrendingUp, CheckCircle, Clock, XCircle, Loader2, Calendar, ShieldCheck
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { type Contract } from "@/lib/contract-service";

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const TableLoadingState = () => (
    <TableRow>
        <TableCell colSpan={10} className="h-24 text-center">
            <div className="flex justify-center items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">A carregar contratos...</span>
            </div>
        </TableCell>
    </TableRow>
);

const TableEmptyState = () => (
    <TableRow>
        <TableCell colSpan={10} className="h-24 text-center">
            Nenhum contrato encontrado.
        </TableCell>
    </TableRow>
);

const ActionCell: React.FC<{ contract: Contract }> = ({ contract }) => {
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [isAlertOpen, setIsAlertOpen] = React.useState(false);
    const [cancellationReason, setCancellationReason] = React.useState("");
    const [isCancelling, setIsCancelling] = React.useState(false);
    const { toast } = useToast();

    const handleCancelContract = async () => {
        if (!cancellationReason.trim()) {
            toast({ title: "Motivo obrigatório", description: "Por favor, preencha o motivo do cancelamento.", variant: "destructive" });
            return;
        }
        setIsCancelling(true);
        try {
            await cancelContractByAdmin(contract.id, cancellationReason);
            toast({ title: "Sucesso!", description: "O contrato foi cancelado." });
            setIsAlertOpen(false);
        } catch (error: any) {
            toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setIsSheetOpen(true)}>Ver Detalhes</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" disabled={contract.status === 'CANCELLED' || contract.status === 'COMPLETED'} onClick={() => setIsAlertOpen(true)}>
                            Cancelar Contrato
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Detalhes do Contrato</SheetTitle>
                        <SheetDescription>ID do Contrato: {contract.id}</SheetDescription>
                    </SheetHeader>
                    <div className="py-4 space-y-2 text-sm">
                        <p><strong>Status:</strong> <Badge variant={contract.status === 'CANCELLED' ? 'destructive' : 'default'} className="capitalize">{contract.status.replace(/_/g, " ")}</Badge></p>
                        <p><strong>Médico:</strong> {contract.doctorName}</p>
                        <p><strong>Hospital:</strong> {contract.hospitalName}</p>
                        <p><strong>Data do Plantão:</strong> {contract.shiftDates?.[0]?.toDate()?.toLocaleDateString('pt-BR') || 'N/A'}</p>
                        <p><strong>Horário:</strong> {contract.startTime} - {contract.endTime}</p>
                        <p><strong>Especialidades:</strong> {contract.specialties.join(", ")}</p>
                        <p className="font-semibold pt-2 border-t mt-2">Valores</p>
                        <p><strong>Valor Hospital:</strong> {formatCurrency(contract.hospitalRate)}/h</p>
                        <p><strong>Valor Médico:</strong> {formatCurrency(contract.doctorRate)}/h</p>
                        <p><strong>Margem Plataforma:</strong> {formatCurrency(contract.hospitalRate - contract.doctorRate)}/h ({contract.platformMarginPercentage}%)</p>
                        {contract.status === 'CANCELLED' && <p className="text-red-600"><strong>Motivo do Cancelamento:</strong> {contract.cancellationReason || 'Não informado'}</p>}
                    </div>
                </SheetContent>

                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Confirmar Cancelamento?</AlertDialogTitle><AlertDialogDescription>Esta ação é irreversível. O contrato será marcado como "CANCELADO".</AlertDialogDescription></AlertDialogHeader>
                    <Textarea placeholder="Descreva o motivo do cancelamento..." value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} />
                    <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={handleCancelContract} disabled={isCancelling}>{isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirmar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Sheet>
    );
};

export const columns: ColumnDef<Contract>[] = [
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            const badgeClass = status === 'ACTIVE_SIGNED' ? 'bg-green-100 text-green-800' : status.includes('PENDING') ? 'bg-amber-100 text-amber-800' : status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';
            return <Badge variant="outline" className={cn("capitalize", badgeClass)}>{status.replace(/_/g, " ").toLowerCase()}</Badge>;
        },
    },
    {
        id: "participants",
        header: "Participantes",
        cell: ({ row }) => (<div className="flex flex-col"><span className="font-medium">{row.original.doctorName}</span><span className="text-xs text-muted-foreground">{row.original.hospitalName}</span></div>),
    },
    {
        accessorKey: "shiftDates",
        header: ({ column }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Data <ArrowUpDown className="ml-2 h-4 w-4" /></Button>,
        cell: ({ row }) => <div className="font-medium">{row.original.shiftDates?.[0]?.toDate()?.toLocaleDateString('pt-BR') || 'N/A'}</div>,
    },
    {
        id: 'values',
        header: "Valores (H/M/P)",
        cell: ({ row }) => {
            const contract = row.original;
            return (<div className="flex flex-col text-xs"><span title={`Hospital: ${formatCurrency(contract.hospitalRate)}/h`}>H: <strong className="text-red-600">{formatCurrency(contract.hospitalRate)}</strong></span><span title={`Médico: ${formatCurrency(contract.doctorRate)}/h`}>M: <strong className="text-green-600">{formatCurrency(contract.doctorRate)}</strong></span><span title={`Plataforma: ${formatCurrency(contract.hospitalRate - contract.doctorRate)}/h`}>P: <strong>{formatCurrency(contract.hospitalRate - contract.doctorRate)}</strong></span></div>)
        }
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => <ActionCell contract={row.original} />,
    },
];

export default function AdminContractsPage() {
    const { toast } = useToast();
    const [data, setData] = React.useState<Contract[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    React.useEffect(() => {
        const q = query(collection(db, "contracts"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const contractsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract));
            setData(contractsData);
            setIsLoading(false);
        }, (error) => {
            console.error("Erro ao buscar contratos: ", error);
            toast({ title: "Erro ao carregar dados", description: "Não foi possível buscar os contratos.", variant: "destructive" });
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [toast]);

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: { sorting, columnFilters, columnVisibility, rowSelection },
    });

    const kpiData = React.useMemo(() => {
        const totalRevenue = data.reduce((acc, contract) => acc + (contract.hospitalRate - contract.doctorRate), 0);
        const totalValue = data.reduce((acc, contract) => acc + contract.hospitalRate, 0);
        const activeContracts = data.filter(c => c.status === 'ACTIVE_SIGNED').length;
        const completedContracts = data.filter(c => c.status === 'COMPLETED').length;
        return { totalRevenue, totalValue, activeContracts, completedContracts };
    }, [data]);

    return (
        <div className="w-full space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
                    <FileText size={28}/> Gestão de Contratos
                </h1>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Receita da Plataforma" value={formatCurrency(kpiData.totalRevenue)} icon={TrendingUp} description="Soma de todas as margens" />
                <StatCard title="Valor Transacionado" value={formatCurrency(kpiData.totalValue)} icon={DollarSign} description="Custo total dos hospitais" />
                <StatCard title="Contratos Ativos" value={kpiData.activeContracts.toString()} icon={CheckCircle} />
                <StatCard title="Contratos Concluídos" value={kpiData.completedContracts.toString()} icon={ShieldCheck} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Todos os Contratos</CardTitle>
                    <CardDescription>Visualize, filtre e gira todos os contratos da plataforma.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center py-4 gap-4">
                        <Input
                            placeholder="Filtrar por nome do médico ou hospital..."
                            value={(table.getColumn("participants")?.getFilterValue() as string) ?? ""}
                            onChange={(event) => table.getColumn("participants")?.setFilterValue(event.target.value)}
                            className="max-w-sm"
                        />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="ml-auto">
                                    Colunas <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {table.getAllColumns().filter((column) => column.getCanHide()).map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value: boolean) => column.toggleVisibility(!!value)}
                                    >
                                        {column.id}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                                    <TableLoadingState />
                                ) : table.getRowModel().rows?.length ? (
                                    table.getRowModel().rows.map((row) => (
                                        <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableEmptyState />
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <div className="flex-1 text-sm text-muted-foreground">
                            {table.getFilteredRowModel().rows.length} contrato(s) encontrado(s).
                        </div>
                        <div className="space-x-2">
                            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</Button>
                            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Próximo</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}