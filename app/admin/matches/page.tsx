// app/admin/matches/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
    ColumnDef, ColumnFiltersState, SortingState, VisibilityState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable
} from "@tanstack/react-table";
import {
    ChevronDown, MoreHorizontal, ArrowUpDown, FileText, DollarSign, TrendingUp, CheckCircle, Clock, XCircle, Loader2, RotateCcw, ClipboardList, Users, Briefcase, CalendarDays, MapPinIcon, Info, Building, User, ShieldCheck
} from 'lucide-react';
import { Timestamp, query, collection, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { approveMatchAndCreateContract, rejectMatchByBackoffice, type PotentialMatch } from "@/lib/match-service";
import { updateUserVerificationStatus, type UserProfile, type ProfileStatus } from "@/lib/auth-service";
import { type Contract } from "@/lib/contract-service";

// =================================================================================================
// 1. COMPONENTES DE UI E ESTADOS (Loading, Empty, StatCard, etc.)
// =================================================================================================

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ title, message }: { title: string, message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{message}</p></div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300"><Info className="w-12 h-12 text-red-400 mb-4"/><p className="text-base font-semibold text-red-700 mb-1">Oops!</p><p>{message || "Não foi possível carregar."}</p>{onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}</div> ));
const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader>
        <CardContent><div className="text-2xl font-bold">{value}</div>{description && <p className="text-xs text-muted-foreground">{description}</p>}</CardContent>
    </Card>
);

// =================================================================================================
// 2. COMPONENTES DE LÓGICA (Cards de Verificação e Match)
// =================================================================================================

const UserVerificationCard: React.FC<{ user: UserProfile; onAction: (userId: string, status: ProfileStatus, notes: string, reasons?: Record<string, string>) => Promise<void>; }> = ({ user, onAction }) => {
    // (Este código permanece o mesmo do seu ficheiro original)
    const [generalNotes, setGeneralNotes] = useState(user.adminVerificationNotes || "");
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionState, setRejectionState] = useState<Record<string, { selected: boolean; reason: string }>>({});
    const DOC_LABELS: Record<string, string> = { personalRg: "RG Pessoal", personalCpf: "CPF Pessoal", professionalCrm: "CRM", photo3x4: "Foto 3x4", addressProof: "Comprov. Endereço", graduationCertificate: "Cert. Graduação", criminalRecordCert: "Cert. Neg. Criminal", ethicalCert: "Cert. Neg. Ética", debtCert: "Cert. Neg. Débitos CRM", cv: "Currículo Vitae", rqe: "RQE", postGradCert: "Cert. Pós/Residência", specialistTitle: "Título Especialista", recommendationLetter: "Carta Recomendação", socialContract: "Contrato Social", cnpjCard: "Cartão CNPJ", companyAddressProof: "Comprovante Endereço Empresa", repRg: "RG do Responsável", repCpf: "CPF do Responsável", repAddressProof: "Comprovante Endereço Responsável" };
    const allDocuments = user.role === 'doctor' ? { ...(user.documents || {}), ...(user.specialistDocuments || {}) } : user.role === 'hospital' ? { ...(user.hospitalDocs || {}), ...(user.legalRepDocuments || {}) } : {};

    const handleCheckboxChange = (docKey: string, checked: boolean) => { setRejectionState(prev => ({ ...prev, [docKey]: { ...prev[docKey], selected: checked } })); };
    const handleReasonChange = (docKey: string, reason: string) => { setRejectionState(prev => ({ ...prev, [docKey]: { ...prev[docKey], reason: reason } })); };
    const handleAction = async (status: ProfileStatus) => {
        setIsProcessing(true);
        let reasonsToSubmit: Record<string, string> = {};
        if (status === 'REJECTED_NEEDS_RESUBMISSION') {
            Object.entries(rejectionState).forEach(([key, value]) => {
                if (value.selected && value.reason?.trim()) { reasonsToSubmit[key] = value.reason.trim(); }
            });
            if (Object.keys(reasonsToSubmit).length === 0) {
                alert("Para solicitar correções, selecione pelo menos um documento e escreva o motivo."); setIsProcessing(false); return;
            }
        }
        try { await onAction(user.uid, status, generalNotes, reasonsToSubmit); } finally { setIsProcessing(false); }
    };
    
    return (
      <Card className="border-l-4 border-yellow-500">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div><CardTitle className="flex items-center gap-2">{user.role === 'doctor' ? <User size={20}/> : <Building size={20}/>} {user.displayName}</CardTitle><CardDescription>{user.role === 'doctor' ? 'Médico(a)' : 'Hospital'} - {user.email}</CardDescription></div>
            <Badge variant="outline">Pendente de Revisão</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold text-sm mb-2">Selecione os documentos para solicitar correções</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(allDocuments).map(([key, url]) => {
                if (!url) return null;
                const isSelected = rejectionState[key]?.selected;
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center space-x-2"><Checkbox id={key} checked={isSelected} onCheckedChange={(checked: boolean) => handleCheckboxChange(key, checked)} /><a href={url as string} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-2">{DOC_LABELS[key] || key}</a></div>
                    {isSelected && ( <Textarea placeholder={`Motivo da rejeição para ${DOC_LABELS[key]}...`} value={rejectionState[key]?.reason || ''} onChange={(e) => handleReasonChange(key, e.target.value)} className="h-20"/> )}
                  </div>
                )
              })}
              {Object.keys(allDocuments).length === 0 && <p className="text-sm text-gray-500 col-span-full">Nenhum documento enviado.</p>}
            </div>
          </div>
          <div><Label htmlFor={`notes-${user.uid}`} className="font-semibold text-sm mb-2 block">Observações Gerais (Opcional)</Label><Textarea id={`notes-${user.uid}`} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Notas gerais sobre o cadastro..." disabled={isProcessing}/></div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3"><Button variant="destructive" onClick={() => handleAction('REJECTED_NEEDS_RESUBMISSION')} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}Pedir Correção</Button><Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction('APPROVED')} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}Aprovar Cadastro</Button></CardFooter>
      </Card>
    );
};

const MatchReviewCard: React.FC<{ match: PotentialMatch; onApproveMatch: (matchId: string, negotiatedRate: number, platformMargin: number, notes?: string) => Promise<void>; onRejectMatch: (matchId: string, notes: string) => Promise<void>; }> = ({ match, onApproveMatch, onRejectMatch }) => {
    // (Este código permanece o mesmo do seu ficheiro original)
    const [notes, setNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [negotiatedRate, setNegotiatedRate] = useState(match.offeredRateByHospital);
    const [platformMargin, setPlatformMargin] = useState(10);
    
    useEffect(() => {
        if (match.offeredRateByHospital >= match.doctorDesiredRate) { setNegotiatedRate(match.doctorDesiredRate); }
    }, [match.offeredRateByHospital, match.doctorDesiredRate]);

    const handleApprove = async () => { setIsProcessing(true); try { await onApproveMatch(match.id, negotiatedRate, platformMargin, notes); } finally { setIsProcessing(false); } };
    const handleReject = async () => { if (!notes.trim()) { alert("Para rejeitar um match, é obrigatório preencher o motivo."); return; } setIsProcessing(true); try { await onRejectMatch(match.id, notes); } finally { setIsProcessing(false); } };
    const matchDate = match.matchedDate instanceof Timestamp ? match.matchedDate.toDate().toLocaleDateString('pt-BR') : 'Data inválida';
    const location = `${(match as any).shiftCity || 'Cidade?'}, ${(match as any).shiftState || 'Estado?'}`;

    return (
      <Card className="border-l-4 border-blue-500">
        <CardHeader>
            <div className="flex justify-between items-start">
                <div><CardTitle className="text-lg">Match: {match.shiftRequirementSpecialties.join(", ")}</CardTitle><CardDescription>{match.hospitalName} &harr; {match.doctorName}</CardDescription></div>
                <Badge variant="outline">Revisão Pendente</Badge>
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2 p-3 bg-gray-50 rounded-md"><h4 className="font-bold flex items-center gap-2"><Building size={16}/> Demanda do Hospital</h4><p><MapPinIcon size={14} className="inline mr-2"/>{match.shiftRequirementServiceType} - {location}</p><p><CalendarDays size={14} className="inline mr-2"/>{matchDate}</p><p><Clock size={14} className="inline mr-2"/>{match.shiftRequirementStartTime} às {match.shiftRequirementEndTime}</p><p><DollarSign size={14} className="inline mr-2"/>Oferecido: <strong>{formatCurrency(match.offeredRateByHospital)}/h</strong></p></div>
                <div className="space-y-2 p-3 bg-gray-50 rounded-md"><h4 className="font-bold flex items-center gap-2"><User size={16}/> Disponibilidade do Médico</h4><p><MapPinIcon size={14} className="inline mr-2"/>{match.doctorServiceType} - {location}</p><p><CalendarDays size={14} className="inline mr-2"/>{matchDate}</p><p><Clock size={14} className="inline mr-2"/>{match.timeSlotStartTime} às {match.timeSlotEndTime}</p><p><DollarSign size={14} className="inline mr-2"/>Desejado: {formatCurrency(match.doctorDesiredRate)}/h</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div><Label htmlFor={`rate-${match.id}`} className="font-semibold text-sm mb-2 block">Valor/Hora a Propor ao Médico (R$)</Label><Input id={`rate-${match.id}`} type="number" value={negotiatedRate} onChange={(e) => setNegotiatedRate(Number(e.target.value))} disabled={isProcessing} /></div>
                <div><Label htmlFor={`margin-${match.id}`} className="font-semibold text-sm mb-2 block">Margem da Plataforma (%)</Label><Input id={`margin-${match.id}`} type="number" value={platformMargin} onChange={(e) => setPlatformMargin(Number(e.target.value))} disabled={isProcessing} /></div>
            </div>
            <div><Label htmlFor={`notes-match-${match.id}`} className="font-semibold text-sm mb-2 block">Observações do Admin (Para o Médico)</Label><Textarea id={`notes-match-${match.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Proposta enviada ao médico com ajuste no valor." disabled={isProcessing}/></div>
        </CardContent>
        <CardFooter className="flex justify-end items-center gap-3"><Button variant="destructive" onClick={handleReject} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}Rejeitar Match</Button><Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}Aprovar e Criar Contrato</Button></CardFooter>
      </Card>
    );
};


// =================================================================================================
// 3. LÓGICA DA TABELA DE CONTRATOS
// =================================================================================================

export const contractColumns: ColumnDef<Contract>[] = [
    { accessorKey: "status", header: "Status", cell: ({ row }) => { const status = row.getValue("status") as string; const badgeClass = status === 'ACTIVE_SIGNED' ? 'bg-green-100 text-green-800' : status.includes('PENDING') ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'; return <Badge variant="outline" className={cn("capitalize", badgeClass)}>{status.replace(/_/g, " ").toLowerCase()}</Badge>; }, },
    { id: "participants", header: "Participantes", cell: ({ row }) => <div className="flex flex-col"><span className="font-medium">{row.original.doctorName}</span><span className="text-xs text-muted-foreground">{row.original.hospitalName}</span></div> },
    { accessorKey: "shiftDates", header: ({ column }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Data <ArrowUpDown className="ml-2 h-4 w-4" /></Button>, cell: ({ row }) => <div>{row.original.shiftDates?.[0]?.toDate()?.toLocaleDateString('pt-BR') || 'N/A'}</div> },
    { id: 'values', header: "Valores (H/M/P)", cell: ({ row }) => { const c = row.original; const margin = c.hospitalRate - c.doctorRate; return (<div className="flex flex-col text-xs"><span title={`Hospital: ${formatCurrency(c.hospitalRate)}/h`}>H: <strong className="text-red-600">{formatCurrency(c.hospitalRate)}</strong></span><span title={`Médico: ${formatCurrency(c.doctorRate)}/h`}>M: <strong className="text-green-600">{formatCurrency(c.doctorRate)}</strong></span><span title={`Plataforma: ${formatCurrency(margin)}/h`}>P: <strong>{formatCurrency(margin)}</strong></span></div>); }},
    { id: "actions", enableHiding: false, cell: ({ row }) => { const contract = row.original; return ( <Sheet><AlertDialog><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Ações</DropdownMenuLabel><SheetTrigger asChild><DropdownMenuItem>Ver Detalhes</DropdownMenuItem></SheetTrigger><DropdownMenuSeparator /><AlertDialogTrigger asChild><DropdownMenuItem className="text-red-600" disabled={contract.status !== 'ACTIVE_SIGNED'}>Cancelar Contrato</DropdownMenuItem></AlertDialogTrigger></DropdownMenuContent></DropdownMenu><SheetContent><SheetHeader><SheetTitle>Detalhes do Contrato</SheetTitle><SheetDescription>ID: {contract.id}</SheetDescription></SheetHeader></SheetContent><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Tem a certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction>Confirmar Cancelamento</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></Sheet> );}},
];


// =================================================================================================
// 4. COMPONENTE PRINCIPAL DA PÁGINA
// =================================================================================================

export default function AdminUnifiedPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("verification");

    // Estados para cada tipo de dado
    const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
    const [matches, setMatches] = useState<PotentialMatch[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);

    // Estados de carregamento para cada busca
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isLoadingMatches, setIsLoadingMatches] = useState(true);
    const [isLoadingContracts, setIsLoadingContracts] = useState(true);

    // Estados para a tabela de contratos
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    
    // Efeito para buscar todos os dados em tempo real
    useEffect(() => {
        // Busca Cadastros Pendentes
        const usersQuery = query(collection(db, "users"), where("documentVerificationStatus", "==", "PENDING_REVIEW"));
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => { setPendingUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))); setIsLoadingUsers(false); }, (error) => { console.error("Erro Cadastros:", error); setIsLoadingUsers(false); });

        // Busca Matches Pendentes
        const matchesQuery = query(collection(db, "potentialMatches"), where("status", "==", "PENDING_BACKOFFICE_REVIEW"), orderBy("createdAt", "desc"));
        const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => { setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PotentialMatch))); setIsLoadingMatches(false); }, (error) => { console.error("Erro Matches:", error); setIsLoadingMatches(false); });

        // Busca TODOS os Contratos
        const contractsQuery = query(collection(db, "contracts"), orderBy("createdAt", "desc"));
        const unsubscribeContracts = onSnapshot(contractsQuery, (snapshot) => { setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract))); setIsLoadingContracts(false); }, (error) => { console.error("Erro Contratos:", error); setIsLoadingContracts(false); });
        
        return () => { unsubscribeUsers(); unsubscribeMatches(); unsubscribeContracts(); };
    }, []);

    // Handlers de Ação (sem alteração)
    const handleUserVerification = async (userId: string, status: ProfileStatus, notes: string, reasons?: Record<string, string>) => { try { await updateUserVerificationStatus(userId, status, notes, reasons); toast({ title: "Cadastro Atualizado!" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};
    const handleApproveMatch = async (matchId: string, negotiatedRate: number, platformMargin: number, notes?: string) => { try { await approveMatchAndCreateContract(matchId, negotiatedRate, platformMargin, notes); toast({ title: "Match Aprovado!", description: "Contrato enviado ao médico." }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};
    const handleRejectMatch = async (matchId: string, adminNotes: string) => { try { await rejectMatchByBackoffice(matchId, adminNotes); toast({ title: "Match Rejeitado" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};

    // Lógica e estado da tabela de contratos
    const contractsTable = useReactTable({ data: contracts, columns: contractColumns, onSortingChange: setSorting, onColumnFiltersChange: setColumnFilters, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(), state: { sorting, columnFilters } });
    const kpiData = useMemo(() => {
        const totalRevenue = contracts.reduce((acc, c) => acc + (c.hospitalRate - c.doctorRate) * (c.shiftDates?.length || 1) * 12, 0); // Exemplo, precisa da duração real do plantão
        const totalValue = contracts.reduce((acc, c) => acc + c.hospitalRate, 0);
        const activeContracts = contracts.filter(c => c.status === 'ACTIVE_SIGNED').length;
        return { totalRevenue, totalValue, activeContracts };
    }, [contracts]);

    const isLoadingAnything = isLoadingUsers || isLoadingMatches || isLoadingContracts;

    return (
      <div className="space-y-6">
          <div className="flex items-center justify-between"><h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2"><ShieldCheck size={28}/> Painel de Controlo</h1><Button variant="outline" size="sm" disabled><RotateCcw className={cn("mr-2 h-4 w-4", isLoadingAnything && "animate-spin")}/>Sincronizado</Button></div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="verification">Verificação de Cadastros<Badge variant={pendingUsers.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoadingUsers ? <Loader2 className="h-3 w-3 animate-spin"/> : pendingUsers.length}</Badge></TabsTrigger>
                <TabsTrigger value="matches">Revisão de Matches<Badge variant={matches.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoadingMatches ? <Loader2 className="h-3 w-3 animate-spin"/> : matches.length}</Badge></TabsTrigger>
                <TabsTrigger value="contracts">Gestão de Contratos<Badge variant="secondary" className="ml-2">{isLoadingContracts ? <Loader2 className="h-3 w-3 animate-spin"/> : contracts.length}</Badge></TabsTrigger>
            </TabsList>
            
            {/* Aba 1: Verificação de Cadastros */}
            <TabsContent value="verification" className="mt-4">
                <Card><CardHeader><CardTitle>Cadastros Pendentes</CardTitle><CardDescription>Aprove ou solicite correções nos cadastros de médicos e hospitais.</CardDescription></CardHeader><CardContent>{isLoadingUsers ? <LoadingState /> : pendingUsers.length === 0 ? <EmptyState title="Nenhum cadastro para verificar" message="Todos estão em dia." /> : <div className="space-y-4">{pendingUsers.map(user => <UserVerificationCard key={user.uid} user={user} onAction={handleUserVerification} />)}</div>}</CardContent></Card>
            </TabsContent>

            {/* Aba 2: Revisão de Matches */}
            <TabsContent value="matches" className="mt-4">
                <Card><CardHeader><CardTitle>Matches Pendentes</CardTitle><CardDescription>Combinações de disponibilidade e demanda para sua revisão e aprovação.</CardDescription></CardHeader><CardContent>{isLoadingMatches ? <LoadingState /> : matches.length === 0 ? <EmptyState title="Nenhum match aguardando" message="Novas combinações aparecerão aqui." /> : <div className="space-y-4">{matches.map(match => <MatchReviewCard key={match.id} match={match} onApproveMatch={handleApproveMatch} onRejectMatch={handleRejectMatch}/>)}</div>}</CardContent></Card>
            </TabsContent>

            {/* Aba 3: Gestão de Contratos (Nova!) */}
            <TabsContent value="contracts" className="mt-4">
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <StatCard title="Receita da Plataforma" value={formatCurrency(kpiData.totalRevenue)} icon={TrendingUp} description="Soma das margens" />
                        <StatCard title="Valor Transacionado" value={formatCurrency(kpiData.totalValue)} icon={DollarSign} description="Custo total dos hospitais" />
                        <StatCard title="Contratos Ativos" value={kpiData.activeContracts.toString()} icon={CheckCircle} description="Contratos assinados aguardando conclusão"/>
                    </div>
                    <Card>
                        <CardHeader><CardTitle>Histórico de Contratos</CardTitle><CardDescription>Visualize, filtre e gira todos os contratos da plataforma.</CardDescription></CardHeader>
                        <CardContent>
                            <div className="flex items-center py-4"><Input placeholder="Filtrar por nome..." value={(contractsTable.getColumn("participants")?.getFilterValue() as string) ?? ""} onChange={(event) => contractsTable.getColumn("participants")?.setFilterValue(event.target.value)} className="max-w-sm"/></div>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>{contractsTable.getHeaderGroups().map((hg) => (<TableRow key={hg.id}>{hg.headers.map((h) => (<TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>))}</TableRow>))}</TableHeader>
                                    <TableBody>{isLoadingContracts ? <TableRow><TableCell colSpan={contractColumns.length} className="h-24 text-center">Carregando...</TableCell></TableRow> : contractsTable.getRowModel().rows?.length ? (contractsTable.getRowModel().rows.map((row) => (<TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>{row.getVisibleCells().map((cell) => (<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>))) : (<TableRow><TableCell colSpan={contractColumns.length} className="h-24 text-center">Nenhum contrato encontrado.</TableCell></TableRow>)}</TableBody>
                                </Table>
                            </div>
                            <div className="flex items-center justify-end space-x-2 py-4">
                                <Button variant="outline" size="sm" onClick={() => contractsTable.previousPage()} disabled={!contractsTable.getCanPreviousPage()}>Anterior</Button>
                                <Button variant="outline" size="sm" onClick={() => contractsTable.nextPage()} disabled={!contractsTable.getCanNextPage()}>Próximo</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

          </Tabs>
      </div>
    );
}