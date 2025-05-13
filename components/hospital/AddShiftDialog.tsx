// components/hospital/AddShiftDialog.tsx
"use client";

import type React from "react";
// --- CORRIGIDO: Hooks importados do React ---
import { useState, useEffect, useMemo, useCallback, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"; // Importações do Dialog
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { addShiftRequirement, type ShiftRequirement } from "@/lib/hospital-shift-service";
import { medicalSpecialties, ServiceTypeRates } from "@/lib/availability-service";

// --- Import Icons ---
import { Plus, Loader2, X, ClipboardList } from "lucide-react";

// --- Tipos e Constantes (Locais ou importadas) ---
const timeOptions = Array.from({ length: 48 }, (_, i) => { const h = Math.floor(i/2); const m = i%2 === 0 ? "00" : "30"; return `${h.toString().padStart(2,"0")}:${m}`; });
const brazilianStates = ["SP", "RJ", "MG", "BA", "AC", "AL", "AP", "AM", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "PA", "PB", "PR", "PE", "PI", "RN", "RS", "RO", "RR", "SC", "SE", "TO" ];
const citiesByState: { [key: string]: string[] } = { "SP": ["São Paulo", "Campinas", "Santos", "Araçariguama", "Guarulhos", "Osasco"], "RJ": ["Rio de Janeiro", "Niterói"], /* ... */ };
const serviceTypesOptions = Object.entries(ServiceTypeRates).map(([v, r]) => ({ value: v, label: v.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ') }));

// --- Componente ---
interface AddShiftDialogProps { onShiftAdded: () => void; }

export const AddShiftDialog: React.FC<AddShiftDialogProps> = ({ onShiftAdded }) => {
    const { toast } = useToast();
    const [dates, setDates] = useState<Date[]>([]);
    const [startTime, setStartTime] = useState("07:00");
    const [endTime, setEndTime] = useState("19:00");
    const [isLoadingAdd, setIsLoadingAdd] = useState(false);
    const [specialtyPopoverOpen, setSpecialtyPopoverOpen] = useState(false);
    const [requiredSpecialties, setRequiredSpecialties] = useState<string[]>([]);
    const [specialtySearchValue, setSpecialtySearchValue] = useState("");
    const [timeError, setTimeError] = useState<string | null>(null);
    const [selectedState, setSelectedState] = useState<string>("");
    const [selectedCity, setSelectedCity] = useState<string>("");
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [selectedServiceType, setSelectedServiceType] = useState<string>("");
    const [offeredRateInput, setOfferedRateInput] = useState<string>("");
    const [notes, setNotes] = useState<string>("");

    // Validação de Horários
    const validateTimes = useCallback((start: string, end: string) => {
        // Permite overnight (ex: 19:00 a 07:00) mas não mesmo horário ou início depois do fim no mesmo dia
        if (start && end && start === end) {
             setTimeError("Horários de início e término não podem ser iguais.");
        } else if (start && end && start > end) { // Verifica se é overnight
            const startHour = parseInt(start.split(':')[0], 10);
            const endHour = parseInt(end.split(':')[0], 10);
            if (endHour >= startHour) { // Se não for overnight (ex: 14:00 a 10:00)
                 setTimeError("Início deve ser anterior ao término para horários no mesmo dia.");
            } else {
                 setTimeError(null); // É overnight, OK
            }
        } else {
            setTimeError(null); // Ordem normal ou um dos campos vazio
        }
    }, []);
    useEffect(() => { validateTimes(startTime, endTime); }, [startTime, endTime, validateTimes]);

    // Atualiza cidades disponíveis ao mudar estado
    useEffect(() => { if (selectedState) setAvailableCities(citiesByState[selectedState] || []); else setAvailableCities([]); setSelectedCity(""); }, [selectedState]);

    // Handlers de Especialidade
    const handleSelectRequiredSpecialty = (specialty: string) => { if (!requiredSpecialties.includes(specialty)) setRequiredSpecialties([...requiredSpecialties, specialty]); setSpecialtySearchValue(""); setSpecialtyPopoverOpen(false); };
    const handleRemoveRequiredSpecialty = (specialtyToRemove: string) => { setRequiredSpecialties(prev => prev.filter((s) => s !== specialtyToRemove)); };
    const filteredSpecialties = useMemo(() => medicalSpecialties.filter(s => typeof s === 'string' && s.toLowerCase().includes(specialtySearchValue.toLowerCase()) && !requiredSpecialties.includes(s)), [specialtySearchValue, requiredSpecialties]);

    // Handler de Submissão do Formulário do Dialog
    const handleAddShiftSubmit = async () => {
        const offeredRate = parseFloat(offeredRateInput.replace(',', '.'));
        // Validações...
        if (dates.length === 0) { toast({title:"Selecione data(s)", variant: "destructive"}); return; }
        if (timeError) { toast({title:"Horário inválido", description: timeError, variant: "destructive"}); return; } // Mostra o erro específico
        if (!selectedServiceType) { toast({title:"Selecione tipo", variant: "destructive"}); return; }
        if (isNaN(offeredRate) || offeredRate <= 0) { toast({title:"Valor hora inválido (>0)", variant: "destructive"}); return; }
        if (!selectedState || !selectedCity) { toast({title:"Selecione local", variant: "destructive"}); return; }

        setIsLoadingAdd(true);
        let successCount = 0;
        let errorCount = 0;
        // Cria uma vaga para cada data selecionada
        const addPromises = dates.map(async (date) => {
            try {
                const shiftData: Omit<ShiftRequirement, "id"|"hospitalId"|"status"|"createdAt"|"updatedAt"> = {
                    date, startTime, endTime, specialtiesRequired: requiredSpecialties, serviceType: selectedServiceType, offeredRate, city: selectedCity, state: selectedState, notes
                };
                await addShiftRequirement(shiftData); // Chama a função do serviço
                successCount++;
            } catch (err:any) {
                errorCount++;
                console.error(`Failed add shift ${date.toLocaleDateString()}:`, err);
                // Mostra um toast por erro para feedback imediato
                toast({ title: `Erro ao Salvar Data ${date.toLocaleDateString()}`, description: err.message || "Erro desconhecido", variant: "destructive"});
            }
        });

        await Promise.all(addPromises); // Espera todas as tentativas terminarem
        setIsLoadingAdd(false);

        if (successCount > 0) {
            toast({ title: "Operação Concluída", description: `${successCount} vaga(s) publicada(s). ${errorCount > 0 ? `${errorCount} falharam.` : ''}`, variant: "default"});
            onShiftAdded(); // Chama o callback para fechar e atualizar a lista na página pai
        } else if (errorCount > 0) {
            // Se só houve erros, o usuário já viu os toasts individuais
            // Poderia adicionar um toast final geral aqui se quisesse
            // toast({ title: "Nenhuma vaga publicada", description: "Ocorreram erros durante o processo.", variant: "destructive"});
        }
        // Se successCount e errorCount forem 0 (nenhuma data selecionada), a validação inicial já tratou.
     };

    // --- JSX do Dialog ---
    return (
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Publicar Nova Vaga de Plantão</DialogTitle>
                <DialogDescription>Preencha os detalhes da vaga. Selecione múltiplos dias no calendário para criar vagas idênticas para cada dia.</DialogDescription>
            </DialogHeader>
            {/* Div com scroll para o conteúdo do formulário */}
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2 pr-5"> {/* Ajustado max-h e padding */}
                 {/* Date */}
                 <div className="space-y-1.5">
                      <Label className="font-medium text-gray-800">Data(s)*</Label>
                      <Calendar
                          mode="multiple"
                          selected={dates}
                          onSelect={(selectedDays) => setDates(selectedDays || [])} // Correção onSelect
                          disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }} // Correção disabled
                          className="p-0 border rounded-md w-auto inline-block shadow-sm"
                          footer={dates.length > 0 ? <p className="text-xs text-blue-700 pt-1">{dates.length} dia(s) selecionado(s).</p> : null} // Footer opcional
                      />
                 </div>
                 {/* Time */}
                 <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                          <Label htmlFor="start-time-modal" className="font-medium text-gray-800">Início*</Label>
                          <Select value={startTime} onValueChange={setStartTime}>
                              <SelectTrigger id="start-time-modal" className={cn("h-9", timeError && "border-red-500")}><SelectValue/></SelectTrigger>
                              <SelectContent>{timeOptions.map(t=><SelectItem key={"st"+t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-1.5">
                          <Label htmlFor="end-time-modal" className="font-medium text-gray-800">Término*</Label>
                          <Select value={endTime} onValueChange={setEndTime}>
                              <SelectTrigger id="end-time-modal" className={cn("h-9", timeError && "border-red-500")}><SelectValue/></SelectTrigger>
                              <SelectContent>{timeOptions.map(t=><SelectItem key={"et"+t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                      </div>
                      {timeError && <p className="text-red-600 text-xs col-span-2 pt-1">{timeError}</p>}
                 </div>
                 {/* Location */}
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                         <Label htmlFor="state-modal" className="font-medium text-gray-800">Estado*</Label>
                         <Select value={selectedState} onValueChange={setSelectedState}>
                             <SelectTrigger id="state-modal" className="h-9"><SelectValue placeholder="UF..."/></SelectTrigger>
                             <SelectContent>{brazilianStates.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                         </Select>
                      </div>
                     <div className="space-y-1.5">
                         <Label htmlFor="city-modal" className="font-medium text-gray-800">Cidade*</Label>
                         <Select value={selectedCity} onValueChange={setSelectedCity} disabled={!selectedState||!availableCities.length}>
                             <SelectTrigger id="city-modal" className="h-9"><SelectValue placeholder={!selectedState?"Selec. Estado":(!availableCities.length?"Sem cidades":"Selecione...")}/></SelectTrigger>
                             <SelectContent>{availableCities.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                         </Select>
                     </div>
                 </div>
                 {/* Service Type & Rate */}
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                         <Label htmlFor="service-type-modal" className="font-medium text-gray-800">Tipo Atend.*</Label>
                         <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
                             <SelectTrigger id="service-type-modal" className="h-9"><SelectValue placeholder="Selecione..."/></SelectTrigger>
                             <SelectContent>{serviceTypesOptions.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                         </Select>
                      </div>
                     <div className="space-y-1.5">
                         <Label htmlFor="offered-rate-modal" className="font-medium text-gray-800">Valor Hora (R$)*</Label>
                         <Input id="offered-rate-modal" type="number" min="0.01" step="0.01" placeholder="150.00" value={offeredRateInput} onChange={(e)=>setOfferedRateInput(e.target.value)} className="h-9"/>
                      </div>
                 </div>
                 {/* Required Specialties */}
                 <div className="space-y-1.5">
                     <Label className="flex items-center gap-1.5 font-medium text-gray-800"><ClipboardList className="h-4 w-4"/>Especialidades Requeridas (Opcional)</Label>
                     <Popover open={specialtyPopoverOpen} onOpenChange={setSpecialtyPopoverOpen}>
                         <PopoverTrigger asChild>
                             <Button variant="outline" className="w-full justify-start font-normal text-muted-foreground h-9">
                                 {requiredSpecialties.length > 0 ? requiredSpecialties.join(', ') : "Nenhuma (clique p/ adicionar)"}
                             </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                             <Command>
                                 <CommandInput placeholder="Buscar..." value={specialtySearchValue} onValueChange={setSpecialtySearchValue}/>
                                 <CommandList>
                                     <CommandEmpty>Nenhuma especialidade encontrada.</CommandEmpty>
                                     <CommandGroup>
                                         {filteredSpecialties.map((s) => (
                                             <CommandItem key={s} value={s} onSelect={() => handleSelectRequiredSpecialty(s)} className="cursor-pointer">{s}</CommandItem>
                                         ))}
                                     </CommandGroup>
                                 </CommandList>
                             </Command>
                         </PopoverContent>
                     </Popover>
                     {requiredSpecialties.length > 0 && (
                         <div className="flex flex-wrap gap-1 mt-2">
                             {requiredSpecialties.map((s) => (
                                 <Badge key={s} variant="secondary" className="bg-gray-100 hover:bg-gray-200">
                                     {s}
                                     <button type="button" onClick={()=>handleRemoveRequiredSpecialty(s)} className="ml-1.5 p-0.5 rounded-full outline-none focus:ring-1 focus:ring-ring hover:bg-gray-300">
                                         <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                     </button>
                                 </Badge>
                             ))}
                         </div>
                     )}
                 </div>
                 {/* Notes */}
                 <div className="space-y-1.5">
                     <Label htmlFor="notes-modal" className="font-medium text-gray-800">Notas Adicionais</Label>
                     <Textarea id="notes-modal" placeholder="Ex: Entrada pela Portaria B, procurar por Enfermeira Maria..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                 </div>
            </div>
           <DialogFooter className="mt-2 pt-4 border-t"> {/* Separador visual */}
               <DialogClose asChild><Button type="button" variant="outline" disabled={isLoadingAdd}>Cancelar</Button></DialogClose>
               <Button type="button" onClick={handleAddShiftSubmit} disabled={isLoadingAdd}>
                   {isLoadingAdd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Publicar Vaga(s)
               </Button>
           </DialogFooter>
        </DialogContent>
    );
};