// app/hospital/doctors/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { getStaffForHospital, type UserProfile } from '@/lib/auth-service';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, UserPlus, Search, Link as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Componente de Diálogo para Buscar e Associar Médicos
 * Este componente encapsula a lógica de busca (chamando a Cloud Function 'searchPlatformDoctors')
 * e a lógica de associação (chamando 'associateDoctorToUnit').
 */
const AssociateDoctorDialog = ({ onAssociationSuccess }: { onAssociationSuccess: () => void }) => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAssociating, setIsAssociating] = useState<string | null>(null);

    /**
     * Função para buscar médicos na plataforma.
     * Só é acionada se o termo de busca tiver 3 ou mais caracteres.
     */
    const handleSearch = useCallback(async () => {
        if (searchTerm.length < 3) return;
        setIsLoading(true);
        try {
            const searchFunction = httpsCallable(functions, 'searchPlatformDoctors');
            const result = await searchFunction({ searchTerm });
            // O resultado da função callable vem dentro de `result.data`
            setSearchResults((result.data as any).doctors);
        } catch (error: any) {
            toast({ title: "Erro na Busca", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, toast]);

    /**
     * Função para associar um médico específico à unidade do gestor.
     * @param doctorId - O UID do médico a ser associado.
     */
    const handleAssociate = async (doctorId: string) => {
        setIsAssociating(doctorId);
        try {
            const associateFunction = httpsCallable(functions, 'associateDoctorToUnit');
            await associateFunction({ doctorId });
            toast({ title: "Sucesso!", description: "Médico associado à sua unidade.", className: "bg-green-600 text-white" });
            onAssociationSuccess(); // Chama a função de callback para fechar o modal e atualizar a lista
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
            <div className="flex items-center space-x-2 py-4">
                <Input placeholder="Digite nome, CRM ou email (mín. 3 caracteres)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <Button onClick={handleSearch} disabled={isLoading || searchTerm.length < 3}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
            </div>
            <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                {searchResults.length > 0 ? (
                    searchResults.map(doctor => (
                        <div key={doctor.uid} className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                                <p className="font-semibold">{doctor.name}</p>
                                <p className="text-sm text-muted-foreground">CRM: {doctor.crm}</p>
                            </div>
                            <Button size="sm" onClick={() => handleAssociate(doctor.uid)} disabled={isAssociating === doctor.uid}>
                                {isAssociating === doctor.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                                Associar
                            </Button>
                        </div>
                    ))
                ) : (
                    !isLoading && <p className="text-center text-sm text-muted-foreground py-4">Nenhum resultado encontrado.</p>
                )}
            </div>
        </DialogContent>
    );
};

/**
 * Componente principal da página de Gestão de Médicos.
 * Exibe a lista de médicos já associados e o botão para iniciar o fluxo de associação.
 */
export default function HospitalDoctorsPage() {
    const { user } = useAuth();
    const [associatedDoctors, setAssociatedDoctors] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    /**
     * Busca os médicos e outros funcionários associados ao hospital e filtra apenas os médicos.
     */
    const fetchAssociatedDoctors = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // A função getStaffForHospital pode retornar outros tipos de funcionários,
            // então filtramos para garantir que estamos mostrando apenas médicos.
            const staff = await getStaffForHospital(user.uid);
            setAssociatedDoctors(staff.filter(s => s.userType === 'doctor'));
        } catch (error) {
            console.error("Erro ao buscar médicos associados:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    // Busca os médicos quando o componente é montado ou o usuário muda
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
                        setIsDialogOpen(false); // Fecha o diálogo
                        fetchAssociatedDoctors(); // E atualiza a lista de médicos associados
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
                                                {/* É preciso fazer um type assertion para acessar campos específicos do médico */}
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