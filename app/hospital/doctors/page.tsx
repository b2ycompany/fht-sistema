// app/hospital/doctors/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
// CORREÇÃO: Importa a nova função de busca e remove a antiga 'getStaffForHospital' se não for mais usada aqui
import { getAssociatedDoctors, type UserProfile } from '@/lib/auth-service'; 
import { useDebounce } from '@/hooks/use-debounce';

// Componentes da UI (sem alterações)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// CORREÇÃO: Importado o 'DialogClose' que estava faltando no seu prompt, mas é bom ter
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Search, Link as LinkIcon, ListFilter, X, KeyRound } from 'lucide-react';

// Interfaces (DoctorSearchResult, etc., sem alterações)
interface DoctorSearchResult {
    uid: string;
    name: string;
    crm: string;
    specialties: string[];
}

// --- Componente CreateDoctorDialog (SEM ALTERAÇÕES, já está correto) ---
// (Vou colapsar por uma questão de espaço, mas o código é o mesmo do seu arquivo original)
const CreateDoctorDialog = ({ onCreationSuccess }: { onCreationSuccess: () => void }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [doctorName, setDoctorName] = useState('');
    const [doctorEmail, setDoctorEmail] = useState('');

    const handleCreateDoctor = async () => {
        if (!doctorName || !doctorEmail) {
            toast({ title: "Campos Incompletos", description: "Nome e e-mail do médico são obrigatórios.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const createFunction = httpsCallable(functions, 'createDoctorUser');
            const result = await createFunction({ name: doctorName, email: doctorEmail });
            const temporaryPassword = (result.data as any).temporaryPassword;

            // Exibe a senha para o gestor
            toast({
                title: "Médico Criado com Sucesso!",
                description: `A senha temporária é: ${temporaryPassword}. Anote e informe ao médico.`,
                duration: 15000, // Tempo aumentado
            });
            onCreationSuccess();
        } catch (error: any) {
            toast({ title: "Erro ao Criar Médico", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Adicionar Novo Médico</DialogTitle>
                <DialogDescription>
                    Cadastre o médico diretamente. A senha inicial será exibida para você repassar a ele. O cadastro ficará pendente de aprovação.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-1.5">
                    <Label htmlFor="name">Nome Completo do Médico</Label>
                    <Input id="name" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr. Nome Sobrenome" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email do Médico</Label>
                    <Input id="email" type="email" value={doctorEmail} onChange={(e) => setDoctorEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleCreateDoctor} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar Cadastro e Gerar Senha
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

// --- Componente AssociateDoctorDialog (SEM ALTERAÇÕES) ---
// (Vou colapsar por uma questão de espaço, mas o código é o mesmo do seu arquivo original)
const AssociateDoctorDialog = ({ onAssociationSuccess }: { onAssociationSuccess: () => void }) => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [specialtiesFilter, setSpecialtiesFilter] = useState<string[]>([]);
    const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
    const [searchResults, setSearchResults] = useState<DoctorSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAssociating, setIsAssociating] = useState<string | null>(null);
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const hospitalId = useAuth().user?.uid;

    useEffect(() => {
        const fetchSpecialties = async () => {
            if (!hospitalId) return;
            try {
                // Esta função busca *todos* os médicos associados para popular os filtros
                const searchFunction = httpsCallable(functions, 'searchAssociatedDoctors'); 
                const result = await searchFunction({ searchTerm: '', specialtiesFilter: [] });
                const doctors = (result.data as any).doctors as DoctorSearchResult[];
                
                const allSpecs = doctors.flatMap(doc => doc.specialties || []);
                const uniqueSpecs = Array.from(new Set(allSpecs)).sort();
                setAvailableSpecialties(uniqueSpecs);
            } catch (error: any) {
                console.error("Erro ao buscar especialidades:", error);
            }
        };
        fetchSpecialties();
    }, [hospitalId]);

    useEffect(() => {
        const handleSearch = async () => {
            if (debouncedSearchTerm.length < 3 && specialtiesFilter.length === 0) {
                setSearchResults([]);
                return;
            }
            setIsLoading(true);
            try {
                const searchFunction = httpsCallable(functions, 'searchAssociatedDoctors');
                const result = await searchFunction({ 
                    searchTerm: debouncedSearchTerm, 
                    specialtiesFilter: specialtiesFilter 
                });
                setSearchResults((result.data as any).doctors);
            } catch (error: any) {
                toast({ title: "Erro na Busca", description: error.message, variant: "destructive" });
                setSearchResults([]);
            } finally {
                setIsLoading(false);
            }
        };
        handleSearch();
    }, [debouncedSearchTerm, specialtiesFilter, toast]);

    const handleAssociate = async (doctorId: string) => {
        setIsAssociating(doctorId);
        try {
            const associateFunction = httpsCallable(functions, 'associateDoctorToUnit');
            await associateFunction({ doctorId });
            toast({ title: "Sucesso!", description: "Médico associado à sua unidade.", className: "bg-green-600 text-white" });
            onAssociationSuccess();
        } catch (error: any) {
            toast({ title: "Erro ao Associar", description: error.message, variant: "destructive" });
        } finally {
            setIsAssociating(null);
        }
    };
    
    return (
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Buscar Médico Vinculado</DialogTitle>
                <DialogDescription>
                    Procure por um médico que já tenha vínculo com a sua unidade.
                </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row gap-2 py-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder="Digite nome, CRM ou email" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-9"
                    />
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="shrink-0">
                            <ListFilter className="mr-2 h-4 w-4" />
                            Filtrar ({specialtiesFilter.length})
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0">
                        <Command>
                            <CommandInput placeholder="Buscar especialidade..." />
                            <CommandEmpty>Nenhuma especialidade encontrada.</CommandEmpty>
                            <CommandGroup>
                                {availableSpecialties.map(spec => (
                                    <CommandItem key={spec} onSelect={() => {
                                        setSpecialtiesFilter(prev => 
                                            prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
                                        );
                                    }}>
                                        <Checkbox
                                            className="mr-2"
                                            checked={specialtiesFilter.includes(spec)}
                                        />
                                        <span>{spec}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
             <div className="flex flex-wrap gap-1 items-center mb-2">
                {specialtiesFilter.map(spec => (
                    <Badge key={spec} variant="secondary">
                        {spec}
                        <button onClick={() => setSpecialtiesFilter(prev => prev.filter(s => s !== spec))} className="ml-1">
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
            </div>
            <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                {isLoading && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}
                
                {!isLoading && searchResults.length > 0 && (
                    searchResults.map(doctor => (
                        <div key={doctor.uid} className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                                <p className="font-semibold">{doctor.name}</p>
                                <p className="text-sm text-muted-foreground">CRM: {doctor.crm || 'Não informado'}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {doctor.specialties.map(spec => <Badge key={spec} variant="outline">{spec}</Badge>)}
                                </div>
                            </div>
                            <Button size="sm" onClick={() => handleAssociate(doctor.uid)} disabled={isAssociating === doctor.uid}>
                                {isAssociating === doctor.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                                Associar
                            </Button>
                        </div>
                    ))
                )}

                {!isLoading && (debouncedSearchTerm.length >= 3 || specialtiesFilter.length > 0) && searchResults.length === 0 && (
                     <p className="text-center text-sm text-muted-foreground py-4">Nenhum resultado encontrado para os filtros aplicados.</p>
                )}
            </div>
        </DialogContent>
    );
};


// --- Componente principal da página (LÓGICA DE BUSCA CORRIGIDA) ---
export default function HospitalDoctorsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [associatedDoctors, setAssociatedDoctors] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAssociateDialogOpen, setIsAssociateDialogOpen] = useState(false);
    const [isCreateDoctorDialogOpen, setIsCreateDoctorDialogOpen] = useState(false);

    // CORREÇÃO: Renomeado e usa a nova função getAssociatedDoctors
    const fetchDoctors = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // Chama a função correta para buscar médicos associados
            const doctors = await getAssociatedDoctors(user.uid); 
            setAssociatedDoctors(doctors);
        } catch (error) {
            console.error("Erro ao buscar médicos associados:", error);
            toast({ title: "Erro ao Carregar Médicos", description: "Não foi possível buscar a lista de médicos associados.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        fetchDoctors();
    }, [fetchDoctors]);

    const handleResetPassword = async (doctorId: string, doctorName: string) => {
        if (!confirm(`Tem certeza que deseja resetar a senha de ${doctorName}? Uma nova senha será gerada.`)) return;
        try {
            const resetFunction = httpsCallable(functions, 'resetDoctorUserPassword');
            const result = await resetFunction({ doctorId });
            const newPassword = (result.data as any).newTemporaryPassword;
            toast({
                title: `Senha de ${doctorName} Resetada!`,
                description: `A nova senha é: ${newPassword}.`,
                duration: 15000,
            });
        } catch (error: any) {
            toast({ title: "Erro ao Resetar Senha", description: error.message, variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6 container mx-auto p-4 sm:p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Gestão de Médicos</h1>
                <div className="flex gap-2">
                    <Dialog open={isAssociateDialogOpen} onOpenChange={setIsAssociateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline"><Search className="mr-2 h-4 w-4" /> Buscar/Associar Médico</Button>
                        </DialogTrigger>
                        <AssociateDoctorDialog onAssociationSuccess={() => {
                            setIsAssociateDialogOpen(false);
                            fetchDoctors(); // Recarrega a lista após associar
                        }} />
                    </Dialog>
                    <Dialog open={isCreateDoctorDialogOpen} onOpenChange={setIsCreateDoctorDialogOpen}>
                        <DialogTrigger asChild>
                            <Button><UserPlus className="mr-2 h-4 w-4" /> Adicionar Novo Médico</Button>
                        </DialogTrigger>
                        <CreateDoctorDialog onCreationSuccess={() => {
                            setIsCreateDoctorDialogOpen(false);
                             // Não precisa recarregar aqui, pois o médico precisa ser aprovado primeiro.
                        }} />
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Médicos Associados à Unidade</CardTitle>
                    <CardDescription>Lista de médicos vinculados à sua unidade.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
                        associatedDoctors.length > 0 ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {associatedDoctors.map(doctor => (
                                    <Card key={doctor.uid} className="flex flex-col">
                                        <CardHeader>
                                            <CardTitle>{doctor.displayName}</CardTitle>
                                            <CardDescription>
                                                {(doctor as any).professionalCrm || 'CRM não informado'}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-grow">
                                            <div className="flex flex-wrap gap-1">
                                                {(doctor as any).specialties?.map((spec: string) => <Badge key={spec} variant="secondary">{spec}</Badge>)}
                                                {(!(doctor as any).specialties || (doctor as any).specialties.length === 0) && <Badge variant="outline">Sem especialidades</Badge>}
                                            </div>
                                        </CardContent>
                                         <div className="p-4 pt-0 mt-auto">
                                            <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => handleResetPassword(doctor.uid, doctor.displayName || 'Médico')}>
                                                <KeyRound className="mr-2 h-4 w-4" />
                                                Resetar Senha
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg">
                                <p className="text-sm text-muted-foreground">Nenhum médico associado a esta unidade ainda.</p>
                                <p className="text-xs text-muted-foreground mt-1">Use 'Buscar/Associar Médico' para adicionar um existente ou 'Adicionar Novo' para cadastrar.</p>
                            </div>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
    );
}