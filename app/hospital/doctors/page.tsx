"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { getStaffForHospital, type UserProfile } from '@/lib/auth-service';
import { useDebounce } from '@/hooks/use-debounce';

// Componentes da UI
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Search, Link as LinkIcon, ListFilter, X } from 'lucide-react';

// Interface para os resultados da busca
interface DoctorSearchResult {
    uid: string;
    name: string;
    crm: string;
    specialties: string[];
}


// --- NOVO Componente do Diálogo de CONVITE de Médico ---
const InviteDoctorDialog = ({ onInvitationSuccess }: { onInvitationSuccess: () => void }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [doctorEmail, setDoctorEmail] = useState('');

    const handleInviteDoctor = async () => {
        if (!doctorEmail) {
            toast({ title: "Campo Incompleto", description: "O e-mail do médico é obrigatório.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const inviteFunction = httpsCallable(functions, 'sendDoctorInvitation');
            await inviteFunction({ doctorEmail });
            toast({ title: "Sucesso!", description: `Convite enviado para ${doctorEmail}. O médico receberá um e-mail para se cadastrar.`, className: "bg-green-600 text-white" });
            onInvitationSuccess();
        } catch (error: any) {
            toast({ title: "Erro ao Enviar Convite", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Convidar Novo Médico</DialogTitle>
                <DialogDescription>
                    Insira o e-mail do médico para enviar um convite de cadastro. Após o cadastro e aprovação, ele será vinculado à sua unidade.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email do Médico</Label>
                    <Input id="email" type="email" value={doctorEmail} onChange={(e) => setDoctorEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleInviteDoctor} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar Convite
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};


/**
 * Componente de Diálogo para Buscar e Associar Médicos Vinculados
 */
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

/**
 * Componente principal da página de Gestão de Médicos.
 */
export default function HospitalDoctorsPage() {
    const { user } = useAuth();
    const [associatedDoctors, setAssociatedDoctors] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAssociateDialogOpen, setIsAssociateDialogOpen] = useState(false);
    const [isInviteDoctorDialogOpen, setIsInviteDoctorDialogOpen] = useState(false);

    const fetchAssociatedDoctors = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const staff = await getStaffForHospital(user.uid);
            setAssociatedDoctors(staff.filter(s => s.userType === 'doctor'));
        } catch (error) {
            console.error("Erro ao buscar médicos associados:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchAssociatedDoctors();
    }, [fetchAssociatedDoctors]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Gestão de Médicos</h1>
                <div className="flex gap-2">
                    {/* Botão para buscar/associar médico JÁ VINCULADO */}
                    <Dialog open={isAssociateDialogOpen} onOpenChange={setIsAssociateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline"><Search className="mr-2 h-4 w-4" /> Buscar Médico</Button>
                        </DialogTrigger>
                        <AssociateDoctorDialog onAssociationSuccess={() => {
                            setIsAssociateDialogOpen(false);
                            fetchAssociatedDoctors();
                        }} />
                    </Dialog>
                    {/* Botão para CONVIDAR novo médico */}
                    <Dialog open={isInviteDoctorDialogOpen} onOpenChange={setIsInviteDoctorDialogOpen}>
                        <DialogTrigger asChild>
                            <Button><UserPlus className="mr-2 h-4 w-4" /> Convidar Novo Médico</Button>
                        </DialogTrigger>
                        <InviteDoctorDialog onInvitationSuccess={() => {
                            setIsInviteDoctorDialogOpen(false);
                            // Não precisa de recarregar a lista, pois o médico precisa de se cadastrar e ser aprovado.
                        }} />
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Médicos Associados à Unidade</CardTitle>
                    <CardDescription>Esta é a lista de médicos que já têm vínculo com a sua unidade e foram aprovados.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
                        associatedDoctors.length > 0 ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {associatedDoctors.map(doctor => (
                                    <Card key={doctor.uid}>
                                        <CardHeader>
                                            <CardTitle>{doctor.displayName}</CardTitle>
                                            <CardDescription>
                                                {(doctor as any).professionalCrm || 'CRM não informado'}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-1">
                                                {(doctor as any).specialties?.map((spec: string) => <Badge key={spec} variant="secondary">{spec}</Badge>)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-sm text-muted-foreground">Nenhum médico associado a esta unidade.</p>
                            </div>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
    );
}