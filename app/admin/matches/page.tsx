// app/admin/matches/page.tsx (Versão com Correções de Tipagem)
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
    ColumnDef, ColumnFiltersState, SortingState, VisibilityState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable
} from "@tanstack/react-table";
import {
    ChevronDown, MoreHorizontal, ArrowUpDown, FileText, DollarSign, TrendingUp, CheckCircle, Clock, XCircle, Loader2, RotateCcw, ClipboardList, Briefcase, CalendarDays, MapPinIcon, Info, Building, User, ShieldCheck
} from 'lucide-react';
// CORREÇÃO: Importando tipos do Firestore para tipagem explícita
import { Timestamp, query, collection, where, onSnapshot, orderBy, getDocs, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";

// Componentes da UI
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

// Serviços e Tipos
import { approveMatchAndCreateContract, rejectMatchByBackoffice, type PotentialMatch } from "@/lib/match-service";
import { updateUserVerificationStatus, type UserProfile, type ProfileStatus, type HospitalProfile } from "@/lib/auth-service";
import { type Contract } from "@/lib/contract-service";


// =================================================================================================
// 1. COMPONENTES DE UI E ESTADOS
// =================================================================================================

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = React.memo(({ title, message }: { title: string, message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{message}</p></div> ));

// CORREÇÃO: StatCard foi refatorado para aceitar um estado de 'isLoading'
const StatCard = ({ title, value, icon: Icon, description, isLoading }: { title: string; value: string | number; icon: React.ElementType; description?: string; isLoading?: boolean; }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader>
        <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <div className="text-2xl font-bold">{value}</div>}
            {description && !isLoading && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

// =================================================================================================
// 2. COMPONENTES DE LÓGICA (Cards de Verificação e Match)
// =================================================================================================
const UserVerificationCard: React.FC<{ user: UserProfile; onAction: (userId: string, status: ProfileStatus, notes: string, reasons?: Record<string, string>) => Promise<void>; }> = ({ user, onAction }) => {
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
      <Card className="border-l-4 border-yellow-500"><CardHeader><div className="flex justify-between items-start"><div><CardTitle className="flex items-center gap-2">{user.role === 'doctor' ? <User size={20}/> : <Building size={20}/>} {user.displayName}</CardTitle><CardDescription>{user.role === 'doctor' ? 'Médico(a)' : 'Hospital'} - {user.email}</CardDescription></div><Badge variant="outline">Pendente</Badge></div></CardHeader><CardContent className="space-y-6"><div><h4 className="font-semibold text-sm mb-2">Documentos</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">{Object.entries(allDocuments).map(([key, url]) => {if (!url) return null; const isSelected = rejectionState[key]?.selected; return (<div key={key} className="space-y-2"><div className="flex items-center space-x-2"><Checkbox id={key} checked={isSelected} onCheckedChange={(checked: boolean) => handleCheckboxChange(key, checked)} /><a href={url as string} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-2">{DOC_LABELS[key] || key}</a></div>{isSelected && ( <Textarea placeholder={`Motivo...`} value={rejectionState[key]?.reason || ''} onChange={(e) => handleReasonChange(key, e.target.value)} className="h-20"/> )}</div>)})}</div></div><div><Label>Observações</Label><Textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} disabled={isProcessing}/></div></CardContent><CardFooter className="flex justify-end gap-3"><Button variant="destructive" onClick={() => handleAction('REJECTED_NEEDS_RESUBMISSION')} disabled={isProcessing}>{isProcessing?<Loader2/>:<XCircle/>}Pedir Correção</Button><Button onClick={() => handleAction('APPROVED')} disabled={isProcessing}>{isProcessing?<Loader2/>:<CheckCircle/>}Aprovar</Button></CardFooter></Card>
    );
};

const MatchReviewCard: React.FC<{ match: PotentialMatch; onApproveMatch: (matchId: string, negotiatedRate: number, platformMargin: number, notes?: string) => Promise<void>; onRejectMatch: (matchId: string, notes: string) => Promise<void>; }> = ({ match, onApproveMatch, onRejectMatch }) => {
    const [notes, setNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [negotiatedRate, setNegotiatedRate] = useState(match.offeredRateByHospital);
    const [platformMargin, setPlatformMargin] = useState(10);
    useEffect(() => { if (match.offeredRateByHospital >= match.doctorDesiredRate) { setNegotiatedRate(match.doctorDesiredRate); } }, [match.offeredRateByHospital, match.doctorDesiredRate]);
    const handleApprove = async () => { setIsProcessing(true); try { await onApproveMatch(match.id, negotiatedRate, platformMargin, notes); } finally { setIsProcessing(false); } };
    const handleReject = async () => { if (!notes.trim()) { alert("Para rejeitar, preencha o motivo."); return; } setIsProcessing(true); try { await onRejectMatch(match.id, notes); } finally { setIsProcessing(false); } };
    const matchDate = match.matchedDate instanceof Timestamp ? match.matchedDate.toDate().toLocaleDateString('pt-BR') : 'Data inválida';
    const location = `${(match as any).shiftCity || 'Cidade?'}, ${(match as any).shiftState || 'Estado?'}`;
    return (
        <Card className="border-l-4 border-blue-500"><CardHeader><div className="flex justify-between items-start"><div><CardTitle className="text-lg">Match: {match.shiftRequirementSpecialties.join(", ")}</CardTitle><CardDescription>{match.hospitalName} &harr; {match.doctorName}</CardDescription></div><Badge variant="outline">Revisão</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"><div className="space-y-2 p-3 bg-gray-50 rounded-md"><h4 className="font-bold"><Building size={16}/> Demanda Hospital</h4><p><MapPinIcon size={14}/>{location}</p><p><CalendarDays size={14}/>{matchDate}</p><p><DollarSign size={14}/>Oferecido: <strong>{formatCurrency(match.offeredRateByHospital)}/h</strong></p></div><div className="space-y-2 p-3 bg-gray-50 rounded-md"><h4 className="font-bold"><User size={16}/> Disp. Médico</h4><p><MapPinIcon size={14}/>{location}</p><p><CalendarDays size={14}/>{matchDate}</p><p><DollarSign size={14}/>Desejado: <strong>{formatCurrency(match.doctorDesiredRate)}/h</strong></p></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4"><div><Label>Valor/Hora (R$)</Label><Input type="number" value={negotiatedRate} onChange={(e) => setNegotiatedRate(Number(e.target.value))} disabled={isProcessing} /></div><div><Label>Margem (%)</Label><Input type="number" value={platformMargin} onChange={(e) => setPlatformMargin(Number(e.target.value))} disabled={isProcessing} /></div></div><div><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isProcessing}/></div></CardContent><CardFooter className="flex justify-end items-center gap-3"><Button variant="destructive" onClick={handleReject} disabled={isProcessing}><XCircle/>Rejeitar</Button><Button onClick={handleApprove} disabled={isProcessing}><CheckCircle/>Aprovar</Button></CardFooter></Card>
    );
};


// =================================================================================================
// 3. LÓGICA DAS TABELAS (Contratos e Utilizadores)
// =================================================================================================
export const contractColumns: ColumnDef<Contract>[] = [
    { accessorKey: "status", header: "Status", cell: ({ row }) => { const s = row.getValue("status") as string; const b = s === 'ACTIVE_SIGNED' ? 'bg-green-100 text-green-800' : s.includes('PENDING') ? 'bg-amber-100 text-amber-800' : 'bg-gray-100'; return <Badge variant="outline" className={cn("capitalize",b)}>{s.replace(/_/g," ").toLowerCase()}</Badge>; }},
    { id: "participants", header: "Participantes", cell: ({ row }) => <div><p className="font-medium">{row.original.doctorName}</p><p className="text-xs text-muted-foreground">{row.original.hospitalName}</p></div>},
    { accessorKey: "shiftDates", header: "Data", cell: ({ row }) => <div>{row.original.shiftDates?.[0]?.toDate()?.toLocaleDateString('pt-BR')}</div> },
    { id: 'values', header: "Valores (H/M/P)", cell: ({ row }) => { const c=row.original; const m=c.hospitalRate-c.doctorRate; return (<div><p>H:<strong>{formatCurrency(c.hospitalRate)}</strong></p><p>M:<strong>{formatCurrency(c.doctorRate)}</strong></p><p>P:<strong>{formatCurrency(m)}</strong></p></div>)}},
    { id: "actions", cell: ({ row }) => <Button variant="ghost" size="sm"><MoreHorizontal/></Button>},
];
type HospitalWithDoctorCount = HospitalProfile & { doctorCount: number };
export const hospitalColumns: ColumnDef<HospitalWithDoctorCount>[] = [
    { accessorKey: "displayName", header: "Nome do Hospital" },
    { accessorKey: "cnpj", header: "CNPJ" },
    { accessorKey: "doctorCount", header: "Médicos Associados" },
    { id: "actions", cell: ({ row }) => <Button variant="ghost" size="sm"><MoreHorizontal/></Button>},
];

// =================================================================================================
// 4. COMPONENTE PRINCIPAL DA PÁGINA
// =================================================================================================

export default function AdminUnifiedPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("verification");
    const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
    const [matches, setMatches] = useState<PotentialMatch[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [hospitalsWithCount, setHospitalsWithCount] = useState<HospitalWithDoctorCount[]>([]);
    const [totalDoctors, setTotalDoctors] = useState(0);
    const [totalHospitals, setTotalHospitals] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    useEffect(() => {
        const fetchAllData = async () => {
            // Listeners em tempo real
            const usersQuery = query(collection(db, "users"), where("documentVerificationStatus", "==", "PENDING_REVIEW"));
            const unsubscribeUsers = onSnapshot(usersQuery, (snap) => setPendingUsers(snap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ uid: doc.id, ...doc.data() } as UserProfile))));
            const matchesQuery = query(collection(db, "potentialMatches"), where("status", "==", "PENDING_BACKOFFICE_REVIEW"), orderBy("createdAt", "desc"));
            const unsubscribeMatches = onSnapshot(matchesQuery, (snap) => setMatches(snap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as PotentialMatch))));
            const contractsQuery = query(collection(db, "contracts"), orderBy("createdAt", "desc"));
            const unsubscribeContracts = onSnapshot(contractsQuery, (snap) => setContracts(snap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as Contract))));
            
            // Busca única para Utilizadores
            try {
                const doctorsQuery = query(collection(db, "users"), where("role", "==", "doctor"));
                const hospitalsQuery = query(collection(db, "users"), where("role", "==", "hospital"));

                // CORREÇÃO: Passando a query correta 'hospitalsQuery' em vez da variável de resultado.
                const [doctorsSnap, hospitalsSnap] = await Promise.all([getDocs(doctorsQuery), getDocs(hospitalsQuery)]);
                
                setTotalDoctors(doctorsSnap.size);
                setTotalHospitals(hospitalsSnap.size);
                
                const hospitalData = hospitalsSnap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ uid: doc.id, ...doc.data() } as HospitalProfile));
                const hospitalsWithCounts = await Promise.all(
                    hospitalData.map(async (h) => {
                        const subColl = collection(db, 'users', h.uid, 'hospitalDoctors');
                        const subSnap = await getDocs(subColl);
                        return { ...h, doctorCount: subSnap.size };
                    })
                );
                setHospitalsWithCount(hospitalsWithCounts);

            } catch (error) {
                console.error("Erro ao buscar dados de utilizadores:", error);
                toast({ title: "Erro ao buscar utilizadores", variant: "destructive" });
            }
            setIsLoading(false);
            return () => { unsubscribeUsers(); unsubscribeMatches(); unsubscribeContracts(); };
        };
        fetchAllData();
    }, [toast]);

    const handleUserVerification = async (userId: string, status: ProfileStatus, notes: string, reasons?: Record<string, string>) => { try { await updateUserVerificationStatus(userId, status, notes, reasons); toast({ title: "Cadastro Atualizado!" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};
    const handleApproveMatch = async (matchId: string, negotiatedRate: number, platformMargin: number, notes?: string) => { try { await approveMatchAndCreateContract(matchId, negotiatedRate, platformMargin, notes); toast({ title: "Match Aprovado!", description: "Contrato enviado." }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};
    const handleRejectMatch = async (matchId: string, adminNotes: string) => { try { await rejectMatchByBackoffice(matchId, adminNotes); toast({ title: "Match Rejeitado" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }};

    const contractsTable = useReactTable({ data: contracts, columns: contractColumns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel() });
    const hospitalsTable = useReactTable({ data: hospitalsWithCount, columns: hospitalColumns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel() });

    return (
      <div className="space-y-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Painel de Controlo</h1>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* CORREÇÃO: Passando 'isLoading' como prop para os StatCards */}
              <StatCard title="Hospitais Ativos" value={totalHospitals} icon={Building} isLoading={isLoading} />
              <StatCard title="Médicos Ativos" value={totalDoctors} icon={User} isLoading={isLoading} />
              <StatCard title="Contratos na Plataforma" value={contracts.length} icon={FileText} isLoading={isLoading} />
              <StatCard title="Ações Pendentes" value={pendingUsers.length + matches.length} icon={ShieldCheck} isLoading={isLoading} description="Verificações + Matches" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="verification">Verificações<Badge variant={pendingUsers.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoading ? '...' : pendingUsers.length}</Badge></TabsTrigger>
                <TabsTrigger value="matches">Matches<Badge variant={pendingUsers.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoading ? '...' : matches.length}</Badge></TabsTrigger>
                <TabsTrigger value="contracts">Contratos</TabsTrigger>
                <TabsTrigger value="users">Utilizadores</TabsTrigger>
            </TabsList>
            
            <TabsContent value="verification"><Card><CardHeader><CardTitle>Cadastros Pendentes</CardTitle></CardHeader><CardContent>{isLoading ? <LoadingState/> : pendingUsers.length === 0 ? <EmptyState title="Nenhum cadastro para verificar" message="." /> : <div className="space-y-4">{pendingUsers.map(user => <UserVerificationCard key={user.uid} user={user} onAction={handleUserVerification} />)}</div>}</CardContent></Card></TabsContent>
            <TabsContent value="matches"><Card><CardHeader><CardTitle>Matches Pendentes</CardTitle></CardHeader><CardContent>{isLoading ? <LoadingState/> : matches.length === 0 ? <EmptyState title="Nenhum match aguardando" message="." /> : <div className="space-y-4">{matches.map(match => <MatchReviewCard key={match.id} match={match} onApproveMatch={handleApproveMatch} onRejectMatch={handleRejectMatch}/>)}</div>}</CardContent></Card></TabsContent>
            <TabsContent value="contracts">
                <Card>
                    <CardHeader><CardTitle>Histórico de Contratos</CardTitle></CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>{contractsTable.getHeaderGroups().map(hg=><TableRow key={hg.id}>{hg.headers.map(h=><TableHead key={h.id}>{flexRender(h.column.columnDef.header,h.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
                                <TableBody>{isLoading ? <TableRow><TableCell colSpan={contractColumns.length} className="h-24 text-center">Carregando...</TableCell></TableRow> : contractsTable.getRowModel().rows.map(row => <TableRow key={row.id}>{row.getVisibleCells().map(cell=><TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</TableCell>)}</TableRow>)}</TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="users">
                <Card>
                    <CardHeader><CardTitle>Hospitais e Médicos Associados</CardTitle></CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                             <Table>
                                <TableHeader>{hospitalsTable.getHeaderGroups().map(hg=><TableRow key={hg.id}>{hg.headers.map(h=><TableHead key={h.id}>{flexRender(h.column.columnDef.header,h.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
                                <TableBody>{isLoading ? <TableRow><TableCell colSpan={hospitalColumns.length} className="h-24 text-center">Carregando...</TableCell></TableRow> : hospitalsTable.getRowModel().rows.map(row => <TableRow key={row.id}>{row.getVisibleCells().map(cell=><TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</TableCell>)}</TableRow>)}</TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
      </div>
    );
}