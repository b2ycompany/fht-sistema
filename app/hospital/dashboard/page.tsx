"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency, formatPercentage, formatHours } from "@/lib/utils";
import { getHospitalDashboardData, type DashboardData } from "@/lib/hospital-shift-service";
import { getContractsForHospital, signContractByHospital, type Contract } from "@/lib/contract-service"; 
import { Loader2, AlertCircle, Users, DollarSign, TrendingUp, WalletCards, Target, Clock, Hourglass, FileSignature, ClipboardList, RotateCcw, PlusCircle } from "lucide-react";
import { useAuth } from '@/components/auth-provider';
import { getCurrentUserData, type HospitalProfile, type UserProfile, getStaffForHospital, createStaffMember, type StaffCreationPayload, type UserType } from '@/lib/auth-service';
import ProfileStatusAlert, { type ProfileStatus } from '@/components/ui/ProfileStatusAlert';
import Link from "next/link";
import { SimpleLineChart } from "@/components/charts/SimpleLineChart";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import { ContractCard } from "@/components/shared/ContractCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { onSnapshot, query, collection, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const LoadingState = memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="mt-3 text-sm text-gray-600">{message}</p></div> ));
const EmptyState = memo(({ title, message }: { title: string, message: string; }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">{title}</p><p>{message}</p></div> ));
const ErrorState = memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="flex flex-col items-center justify-center py-10 min-h-[150px] w-full text-center text-sm text-red-600 bg-red-50/70 rounded-md border border-dashed border-red-300"><AlertCircle className="w-12 h-12 text-red-400 mb-4"/><p className="text-base font-semibold text-red-700 mb-1">Oops!</p><p>{message || "Não foi possível carregar."}</p>{onRetry && <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button>}</div> ));

const KPICard: React.FC<{ title: string; value: string | number; description?: string; icon: React.ElementType; isLoading: boolean; href?: string; }> = ({ title, value, description, icon: Icon, isLoading, href }) => {
    const cardContent = ( <Card className={cn("shadow-sm transition-shadow duration-200 min-w-0", href ? "hover:shadow-md hover:border-primary cursor-pointer" : "")}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-gray-600 truncate pr-2">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground shrink-0" /></CardHeader><CardContent className="pt-0 pb-3 px-3 overflow-hidden">{isLoading ? (<div className="h-8 flex items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>) : (<div className={cn("font-bold text-gray-900", "text-lg md:text-xl lg:text-2xl", "leading-tight")} title={value?.toString()}>{value}</div>)}{description && !isLoading && <p className="text-xs text-muted-foreground pt-1 truncate">{description}</p>}</CardContent></Card> );
    if (href) { return <Link href={href} className="no-underline">{cardContent}</Link>; }
    return cardContent;
};

const NewStaffForm: React.FC<{ hospitalId: string; onStaffAdded: () => void }> = ({ hospitalId, onStaffAdded }) => {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [userType, setUserType] = useState<StaffCreationPayload['userType'] | ''>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!name || !email || !userType) {
            toast({ title: "Campos obrigatórios", description: "Preencha nome, email e a função.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            await createStaffMember({ hospitalId, name, email, userType });
            toast({ title: "Sucesso!", description: `${name} foi adicionado(a) à Equipe. Um email com instruções será enviado.`, className: "bg-green-600 text-white" });
            onStaffAdded();
        } catch (error: any) {
            toast({ title: "Erro ao criar profissional", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    return (
        <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label htmlFor="name">Nome Completo</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="userType">Função</Label><Select value={userType} onValueChange={(value) => setUserType(value as StaffCreationPayload['userType'])}><SelectTrigger><SelectValue placeholder="Selecione uma função..." /></SelectTrigger><SelectContent><SelectItem value="receptionist">Recepcionista</SelectItem><SelectItem value="triage_nurse">Enfermeiro(a) de Triagem</SelectItem><SelectItem value="caravan_admin">Administrativo</SelectItem></SelectContent></Select></div>
            <DialogFooter className="mt-4"><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar Membro</Button></DialogFooter>
        </div>
    );
};

export default function HospitalDashboardPage() {
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
    const [pendingContracts, setPendingContracts] = useState<Contract[]>([]);
    const [staffList, setStaffList] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

    const loadAllData = useCallback(async () => {
        if (!user) { setIsLoading(false); return; }
        setIsLoading(true);
        setError(null);
        try {
            const [profile, specificData, contracts] = await Promise.all([ getCurrentUserData(), getHospitalDashboardData(user.uid), getContractsForHospital(['PENDING_HOSPITAL_SIGNATURE']), ]);
            if (profile?.userType === 'hospital') setHospitalProfile(profile as HospitalProfile);
            setDashboardData(specificData);
            setPendingContracts(contracts);
        } catch (error: any) {
            setError(error.message || "Erro ao carregar dados.");
            toast({ title: "Erro nos Dados", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (!authLoading && user) loadAllData();
        else if (!authLoading && !user) setIsLoading(false);
    }, [user, authLoading, loadAllData]);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "users"), where("hospitalId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
            setStaffList(list);
        }, (err) => {
            setError("Falha ao carregar a Equipe em tempo real.");
        });
        return () => unsubscribe();
    }, [user]);
    
    const handleSignContractOnDashboard = async (contractId: string) => {
        try {
            await signContractByHospital(contractId);
            toast({ title: "Contrato Assinado!", description: "O plantão foi formalizado com sucesso." });
            await loadAllData();
        } catch (err: any) {
            toast({ title: "Erro ao Assinar", description: (err as Error).message, variant: "destructive" });
        }
    };

    if (isLoading && !hospitalProfile) return <div className="p-6"><LoadingState message="A carregar dashboard..." /></div>;
    
    return (
        <div className="flex flex-col gap-6 md:gap-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Visão Geral: {hospitalProfile?.displayName || "Hospital"}</h1>
            {hospitalProfile && <ProfileStatusAlert status={hospitalProfile.documentVerificationStatus as ProfileStatus | undefined} adminNotes={hospitalProfile.adminVerificationNotes} userType="hospital" editProfileLink={"/hospital/profile/edit"}/>}

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                    <TabsTrigger value="contracts">Contratos Pendentes<Badge variant={pendingContracts.length > 0 ? "destructive" : "secondary"} className="ml-2">{isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : pendingContracts.length}</Badge></TabsTrigger>
                    <TabsTrigger value="equipe">Gestão de Equipe<Badge variant="secondary" className="ml-2">{staffList.length}</Badge></TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-4">{/* ... Conteúdo da sua aba "Visão Geral" permanece o mesmo ... */}</TabsContent>

                <TabsContent value="contracts" className="mt-4">{/* ... Conteúdo da sua aba "Contratos" permanece o mesmo ... */}</TabsContent>

                <TabsContent value="equipe" className="mt-4">
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Equipe da Unidade</CardTitle>
                                <CardDescription>Adicione e visualize os profissionais da sua unidade.</CardDescription>
                            </div>
                            <Button onClick={() => setIsStaffModalOpen(true)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Adicionar Membro
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Função</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {staffList.length > 0 ? (
                                        staffList.map(staff => (
                                            <TableRow key={staff.uid}>
                                                <TableCell className="font-medium">{staff.displayName}</TableCell>
                                                <TableCell>{staff.email}</TableCell>
                                                <TableCell className="capitalize">{staff.userType?.replace(/_/g, ' ') || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={3} className="h-24 text-center">Nenhum profissional cadastrado ainda.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar Novo Membro à Equipe</DialogTitle>
                        <DialogDescription>Um convite com uma senha temporária será enviado para o email do profissional.</DialogDescription>
                    </DialogHeader>
                    {user && <NewStaffForm hospitalId={user.uid} onStaffAdded={() => setIsStaffModalOpen(false)} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}