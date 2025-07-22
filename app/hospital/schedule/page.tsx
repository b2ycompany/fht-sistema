// app/hospital/schedule/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { type Contract } from '@/lib/contract-service';
// ADICIONADO: Importação para buscar os dados do perfil do usuário logado
import { getCurrentUserData, type HospitalProfile } from '@/lib/auth-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CalendarDays, Clock, User, ClipboardList, AlertTriangle, RotateCcw } from 'lucide-react';

// --- Interfaces e Tipos ---
type TelemedicineShift = Pick<Contract, 'id' | 'doctorId' | 'doctorName' | 'shiftDates' | 'startTime' | 'endTime'>;

// --- Componentes de Estado ---
const LoadingState = () => <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
const EmptyState = () => <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed"><ClipboardList className="w-12 h-12 text-gray-400 mb-4"/><p className="font-medium text-gray-600 mb-1">Nenhum plantão de telemedicina disponível</p><p>Crie um novo plantão do tipo "Telemedicina" e aprove o contrato para que ele apareça aqui.</p></div>;
const ErrorState = ({ onRetry }: { onRetry: () => void }) => <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed"><AlertTriangle className="w-12 h-12 text-red-400 mb-4"/><p className="font-semibold text-red-700 mb-1">Erro ao carregar plantões</p><Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"><RotateCcw className="mr-2 h-4 w-4" />Tentar Novamente</Button></div>;

// --- Página Principal de Agendamento ---
export default function SchedulePage() {
    // CORRIGIDO: Removido 'hospitalData' da desestruturação do useAuth
    const { user } = useAuth();
    const { toast } = useToast();

    const [shifts, setShifts] = useState<TelemedicineShift[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState<TelemedicineShift | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estado do formulário
    const [patientName, setPatientName] = useState('');
    const [patientId, setPatientId] = useState('');
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [medicalHistory, setMedicalHistory] = useState('');

    const fetchShifts = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);
        try {
            const contractsRef = collection(db, "contracts");
            const q = query(
                contractsRef,
                where("hospitalId", "==", user.uid),
                where("status", "==", "ACTIVE_SIGNED"),
                where("serviceType", "==", "Telemedicina")
            );
            const snapshot = await getDocs(q);
            const availableShifts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as TelemedicineShift[];
            setShifts(availableShifts);
        } catch (err) {
            console.error("Erro ao buscar plantões de telemedicina:", err);
            setError("Falha ao buscar os plantões disponíveis.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    const openScheduleDialog = (shift: TelemedicineShift) => {
        setSelectedShift(shift);
        // Resetar formulário
        setPatientName('');
        setPatientId('');
        setChiefComplaint('');
        setMedicalHistory('');
        setIsDialogOpen(true);
    };

    const handleScheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // CORRIGIDO: Removida a verificação do 'hospitalData' que não existe aqui
        if (!selectedShift || !patientName || !chiefComplaint || !user) {
            toast({ title: "Campos obrigatórios", description: "Nome do paciente e queixa principal são necessários.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            // ADICIONADO: Busca os dados do perfil do hospital para obter o nome
            const hospitalProfile = await getCurrentUserData() as HospitalProfile | null;
            if (!hospitalProfile || !hospitalProfile.displayName) {
                throw new Error("Não foi possível obter os dados do hospital para o agendamento.");
            }

            const consultationsRef = collection(db, "consultations");
            await addDoc(consultationsRef, {
                patientName,
                patientId,
                chiefComplaint,
                medicalHistorySummary: medicalHistory,
                contractId: selectedShift.id,
                doctorId: selectedShift.doctorId,
                hospitalId: user.uid,
                // CORRIGIDO: Usa o nome do perfil do hospital que foi buscado
                hospitalName: hospitalProfile.displayName,
                status: "SCHEDULED",
                createdAt: serverTimestamp(),
            });

            toast({ title: "Consulta Agendada!", description: `${patientName} foi agendado(a) com Dr(a). ${selectedShift.doctorName}.`, variant: 'success' });
            setIsDialogOpen(false);
            // Opcional: remover o turno da lista para não agendar duas vezes, ou desabilitar o botão.
            // Por simplicidade, vamos apenas fechar o modal.
            
        } catch (err: any) {
            console.error("Erro ao agendar consulta:", err);
            toast({ title: "Erro no Agendamento", description: err.message || "Não foi possível salvar a consulta. Tente novamente.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold">Agendamento de Telemedicina</h1>
            <p className="text-gray-600">Selecione um plantão disponível para agendar a consulta de um paciente.</p>

            <Card>
                <CardHeader>
                    <CardTitle>Plantões Disponíveis para Agendamento</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading && <LoadingState />}
                    {error && <ErrorState onRetry={fetchShifts} />}
                    {!isLoading && !error && shifts.length === 0 && <EmptyState />}
                    {!isLoading && !error && shifts.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {shifts.map(shift => (
                                <Card key={shift.id} className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="text-md">Dr(a). {shift.doctorName}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm space-y-2 flex-grow">
                                        <div className="flex items-center gap-2"><CalendarDays size={14} className="text-gray-500" /><span>{shift.shiftDates[0].toDate().toLocaleDateString('pt-BR')}</span></div>
                                        <div className="flex items-center gap-2"><Clock size={14} className="text-gray-500" /><span>{shift.startTime} - {shift.endTime}</span></div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button className="w-full" onClick={() => openScheduleDialog(shift)}>Agendar Paciente</Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Agendar Paciente</DialogTitle>
                        <DialogDescription>
                            Preencha os dados do paciente para o plantão de Dr(a). {selectedShift?.doctorName}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleScheduleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="patientName" className="text-right">Nome*</Label>
                                <Input id="patientName" value={patientName} onChange={e => setPatientName(e.target.value)} className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="patientId" className="text-right">CPF/ID</Label>
                                <Input id="patientId" value={patientId} onChange={e => setPatientId(e.target.value)} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="chiefComplaint" className="text-right pt-2">Queixa Principal*</Label>
                                <Textarea id="chiefComplaint" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="medicalHistory" className="text-right pt-2">Histórico</Label>
                                <Textarea id="medicalHistory" value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)} className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmar Agendamento
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}