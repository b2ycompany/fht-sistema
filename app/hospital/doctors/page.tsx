// app/hospital/doctors/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { getStaffForHospital, type UserProfile } from '@/lib/auth-service';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, UserPlus, Search, Link as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce'; // Importe o hook de debounce

/**
 * Componente de Diálogo para Buscar e Associar Médicos (com busca em tempo real)
 */
const AssociateDoctorDialog = ({ onAssociationSuccess }: { onAssociationSuccess: () => void }) => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAssociating, setIsAssociating] = useState<string | null>(null);

    // Usa o hook useDebounce para evitar chamadas à API em cada tecla pressionada
    const debouncedSearchTerm = useDebounce(searchTerm, 500); // 500ms de espera

    // Este useEffect é acionado sempre que o 'debouncedSearchTerm' muda
    useEffect(() => {
        const handleSearch = async () => {
            // Se o termo for muito curto, limpa os resultados e pára
            if (debouncedSearchTerm.length < 3) {
                setSearchResults([]);
                return;
            }
            setIsLoading(true);
            try {
                const searchFunction = httpsCallable(functions, 'searchPlatformDoctors');
                const result = await searchFunction({ searchTerm: debouncedSearchTerm });
                setSearchResults((result.data as any).doctors);
            } catch (error: any) {
                toast({ title: "Erro na Busca", description: error.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        handleSearch();
    }, [debouncedSearchTerm, toast]); // Dependências do useEffect

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
                <DialogTitle>Associar Médico da Plataforma</DialogTitle>
                <DialogDescription>Procure por um médico já cadastrado na FHT pelo nome, CRM ou email para associá-lo à sua unidade.</DialogDescription>
            </DialogHeader>
            <div className="relative py-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                    placeholder="Digite nome, CRM ou email (mín. 3 caracteres)" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="pl-9" // Padding à esquerda para não sobrepor o ícone
                />
            </div>
            <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                {isLoading && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}
                
                {!isLoading && searchResults.length > 0 && (
                    searchResults.map(doctor => (
                        <div key={doctor.uid} className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                                <p className="font-semibold">{doctor.name}</p>
                                <p className="text-sm text-muted-foreground">CRM: {doctor.crm || 'Não informado'}</p>
                            </div>
                            <Button size="sm" onClick={() => handleAssociate(doctor.uid)} disabled={isAssociating === doctor.uid}>
                                {isAssociating === doctor.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                                Associar
                            </Button>
                        </div>
                    ))
                )}

                {!isLoading && searchResults.length === 0 && debouncedSearchTerm.length >= 3 && (
                     <p className="text-center text-sm text-muted-foreground py-4">Nenhum resultado encontrado.</p>
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
    const [isDialogOpen, setIsDialogOpen] = useState(false);

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
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><UserPlus className="mr-2 h-4 w-4" /> Associar Médico</Button>
                    </DialogTrigger>
                    <AssociateDoctorDialog onAssociationSuccess={() => {
                        setIsDialogOpen(false);
                        fetchAssociatedDoctors();
                    }} />
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Médicos Associados à Unidade</CardTitle>
                    <CardDescription>Esta é a lista de médicos que podem receber agendamentos da sua equipa.</CardDescription>
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
                                <Button variant="link" onClick={() => setIsDialogOpen(true)} className="mt-2">Associar o primeiro médico</Button>
                            </div>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
    );
}