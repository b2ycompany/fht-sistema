// app/hospital/vagas-abertas/page.tsx
"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { type ShiftRequirement, getHospitalShiftRequirements, deleteShiftRequirement } from "@/lib/hospital-shift-service";
import { ShiftListItem } from "@/components/hospital/ShiftListItem";
import { AddShiftDialog } from "@/components/hospital/AddShiftDialog";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/state-indicators";

export default function VagasAbertasPage() {
    const { toast } = useToast();
    const [openShifts, setOpenShifts] = useState<ShiftRequirement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAddShiftDialogOpen, setIsAddShiftDialogOpen] = useState(false);

    const fetchOpenShifts = useCallback(async () => {
        setIsLoading(true); setError(null);
        try {
            const shifts = await getHospitalShiftRequirements();
            setOpenShifts(shifts.sort((a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime)));
        } catch (err: any) { console.error("Error fetching open shifts:", err); setError(err.message || "Erro ao buscar vagas."); toast({ title: "Erro ao Buscar Vagas", description: err.message, variant: "destructive" });
        } finally { setIsLoading(false); }
    }, [toast]);

    useEffect(() => { fetchOpenShifts(); }, [fetchOpenShifts]);

    const handleCancelShift = async (id: string | undefined) => {
        if (!id) return; try { await deleteShiftRequirement(id); toast({ title: "Vaga Cancelada", variant: "default" }); fetchOpenShifts(); } catch (error: any) { toast({ title: "Erro ao Cancelar", description: error.message || "Falha", variant: "destructive"}); }
    };

    const onShiftAdded = () => { setIsAddShiftDialogOpen(false); fetchOpenShifts(); };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Vagas em Aberto</h1>
                <Dialog open={isAddShiftDialogOpen} onOpenChange={setIsAddShiftDialogOpen}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Publicar Nova Vaga</Button></DialogTrigger>
                    <AddShiftDialog onShiftAdded={onShiftAdded} />
                </Dialog>
            </div>

            {isLoading ? ( <LoadingState message="Carregando vagas abertas..." />
            ) : error ? ( <ErrorState message={error} onRetry={fetchOpenShifts} />
            ) : openShifts.length === 0 ? ( <EmptyState message="Nenhuma vaga aberta encontrada." />
            ) : ( <div className="space-y-4">{openShifts.map(req => ( <ShiftListItem key={req.id} shift={req} actions={[{ label: "Cancelar", icon: Trash2, onClick: () => handleCancelShift(req.id), variant: "ghost", className:"text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full w-8 h-8" }]} /> ))}</div>
            )}
        </div>
    );
}