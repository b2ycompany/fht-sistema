// app/dashboard/availability/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2, X, RotateCcw, DollarSign, Briefcase, MapPin, Loader2 } from "lucide-react";
import {
    getTimeSlots,
    addTimeSlot,
    deleteTimeSlot,
    medicalSpecialties,
    ServiceTypeRates,
    type TimeSlot,
} from "@/lib/availability-service";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// --- Constants and Helpers ---

// Service Types (using imported rates)
const serviceTypesOptions = Object.entries(ServiceTypeRates).map(([value, rate]) => ({
    value: value,
    label: value.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    rate: rate,
}));

// Location Data (Replace with actual data source or API call)
const brazilianStates = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const citiesByState: { [key: string]: string[] } = {
    "SP": ["São Paulo", "Campinas", "Guarulhos", "Santos", "São Bernardo do Campo", "Santo André", "Osasco", "Sorocaba", "Ribeirão Preto", "São José dos Campos", "Araçariguama"],
    "RJ": ["Rio de Janeiro", "Niterói", "Duque de Caxias", "São Gonçalo", "Nova Iguaçu"],
    // **TODO: Populate with more states and cities or fetch dynamically**
};

const formatCurrency = (value: number | null | undefined): string => {
    if (value == null) return "R$ -";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// --- Component ---
export default function AvailabilityPage() {
    const { toast } = useToast();
    const [dates, setDates] = useState<Date[]>([]);
    const [startTime, setStartTime] = useState("08:00");
    const [endTime, setEndTime] = useState("18:00");
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [isLoadingAdd, setIsLoadingAdd] = useState(false);
    const [isLoadingDelete, setIsLoadingDelete] = useState<string | null>(null);
    const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [specialtyPopoverOpen, setSpecialtyPopoverOpen] = useState(false);
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
    const [specialtySearchValue, setSpecialtySearchValue] = useState("");
    const [timeError, setTimeError] = useState<string | null>(null);
    const [selectedState, setSelectedState] = useState<string>("");
    const [selectedCity, setSelectedCity] = useState<string>("");
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [selectedServiceType, setSelectedServiceType] = useState<string>("");
    const [selectedHourlyRate, setSelectedHourlyRate] = useState<number | null>(null);

    const fetchTimeSlots = useCallback(async () => {
        console.log("Fetching time slots...");
        setIsLoadingTimeSlots(true);
        setFetchError(null); // Reset error before fetching
        try {
            const slots = await getTimeSlots();
            setTimeSlots(slots);
            console.log("Fetched slots:", slots);
        } catch (error: any) {
            console.error("Error fetching time slots:", error);
            // Display the specific Firestore index error if present
            const description = error.message || "Não foi possível carregar sua disponibilidade.";
             // Check if it's the index error to provide a more specific message potentially
             if (error.message && error.message.includes("query requires an index")) {
                 setFetchError(`Falha ao buscar: Índice do Firestore necessário. ${error.message}`);
             } else {
                setFetchError(description);
             }
            toast({
                title: "Erro ao Carregar Dados",
                description: description, // Show the raw error message in toast
                variant: "destructive",
            });
        } finally {
            setIsLoadingTimeSlots(false);
            console.log("Finished fetching time slots.");
        }
    }, [toast]);

    useEffect(() => {
        fetchTimeSlots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const timeOptions = useMemo(() => {
        return Array.from({ length: 48 }, (_, i) => {
            const hour = Math.floor(i / 2);
            const minute = i % 2 === 0 ? "00" : "30";
            return `${hour.toString().padStart(2, "0")}:${minute}`;
        });
    }, []);

    const filteredSpecialties = useMemo(() => {
        if (!Array.isArray(medicalSpecialties)) return [];
        return medicalSpecialties.filter(
            (specialty) =>
                typeof specialty === 'string' &&
                specialty.toLowerCase().includes(specialtySearchValue.toLowerCase()) &&
                !selectedSpecialties.includes(specialty)
        );
    }, [specialtySearchValue, selectedSpecialties]);

    useEffect(() => {
        if (selectedState) {
            setAvailableCities(citiesByState[selectedState] || []);
        } else {
            setAvailableCities([]);
        }
        setSelectedCity("");
    }, [selectedState]);

    const checkTimeConflict = useCallback((newDate: Date, newStart: string, newEnd: string): boolean => {
        return timeSlots.some((slot) => {
            const slotDateStr = slot.date.toDateString();
            const newDateStr = newDate.toDateString();
            if (slotDateStr !== newDateStr) return false;
            const newStartsBeforeSlotEnds = newStart < slot.endTime;
            const newEndsAfterSlotStarts = newEnd > slot.startTime;
            return newStartsBeforeSlotEnds && newEndsAfterSlotStarts;
        });
    }, [timeSlots]);

    const handleSelectDate = (newDates: Date[] | undefined) => {
        setDates(newDates || []);
    }

    const handleRemoveTimeSlot = async (id: string | undefined) => {
        if (!id || isLoadingDelete) return;
        setIsLoadingDelete(id);
        try {
            await deleteTimeSlot(id);
            setTimeSlots(prevSlots => prevSlots.filter((slot) => slot.id !== id));
            toast({ title: "Disponibilidade removida", description: "Removida com sucesso.", variant: "default" });
        } catch (error: any) {
            console.error("Error removing time slot:", error);
            toast({ title: "Erro ao remover", description: error.message || "Falha ao remover disponibilidade.", variant: "destructive" });
        } finally {
            setIsLoadingDelete(null);
        }
    }

    const handleSelectSpecialty = (specialty: string) => {
        if (!selectedSpecialties.includes(specialty)) {
            setSelectedSpecialties([...selectedSpecialties, specialty]);
        }
        setSpecialtySearchValue("");
        setSpecialtyPopoverOpen(false);
    }

    const handleRemoveSpecialty = (specialtyToRemove: string) => {
        setSelectedSpecialties(prevSpecialties => prevSpecialties.filter((s) => s !== specialtyToRemove));
    }

    const handleServiceTypeChange = (value: string) => {
        const selectedOption = serviceTypesOptions.find(option => option.value === value);
        setSelectedServiceType(value);
        setSelectedHourlyRate(selectedOption ? selectedOption.rate : null);
    }

    const validateTimes = useCallback((start: string, end: string) => {
        if (start && end && start >= end) {
            const isOvernight = end < start;
            if (!isOvernight) {
                 setTimeError("O horário de início deve ser anterior ao horário de término para horários no mesmo dia.");
            } else {
                setTimeError(null); // Allow overnight
            }
        } else {
            setTimeError(null);
        }
    }, []);

    useEffect(() => {
        validateTimes(startTime, endTime);
    }, [startTime, endTime, validateTimes]);

    const applyQuickTime = (start: string, end: string) => {
        setStartTime(start);
        setEndTime(end);
        // validateTimes(start, end); // Validation runs via useEffect
    }

    const resetForm = useCallback(() => {
        setDates([]);
        setStartTime("08:00");
        setEndTime("18:00");
        setSelectedSpecialties([]);
        setSpecialtySearchValue("");
        setTimeError(null);
        setSelectedServiceType("");
        setSelectedHourlyRate(null);
        setSelectedState("");
        setSelectedCity("");
        setAvailableCities([]);
    }, []);

    const handleAddAvailability = async () => {
        if (dates.length === 0) { toast({ title: "Datas não selecionadas", description: "Selecione pelo menos uma data.", variant: "destructive" }); return; }
        if (timeError) { toast({ title: "Erro no Horário", description: timeError, variant: "destructive" }); return; }
        if (!selectedServiceType || selectedHourlyRate === null || selectedHourlyRate < 0) { toast({ title: "Tipo de Atendimento inválido", description: "Selecione o tipo de atendimento e verifique o valor hora.", variant: "destructive" }); return; }
        if (!selectedState || !selectedCity) { toast({ title: "Localização não selecionada", description: "Selecione o estado e a cidade.", variant: "destructive" }); return; }

        setIsLoadingAdd(true);
        let successfulAddCount = 0, conflictDetectedCount = 0, errorOccurredCount = 0;
        const processedDates = new Set<string>();

        const addPromises = dates.map(async (date) => {
            const dateString = date.toLocaleDateString("pt-BR");
            const slotIdentifier = `${dateString}-${startTime}-${endTime}`;
            if (processedDates.has(slotIdentifier)) return;

            if (checkTimeConflict(date, startTime, endTime)) {
                const conflictMsgIdentifier = `conflict-${dateString}`;
                if (!processedDates.has(conflictMsgIdentifier)) {
                    toast({ title: "Conflito de Horário", description: `Horário conflitante: ${dateString} ${startTime}-${endTime}.`, variant: "warning" });
                    conflictDetectedCount++;
                    processedDates.add(conflictMsgIdentifier);
                } return;
            }

            try {
                const newSlotData: Omit<TimeSlot, "id" | "doctorId" | "createdAt" | "updatedAt"> = { date, startTime, endTime, specialties: selectedSpecialties, serviceType: selectedServiceType, hourlyRate: selectedHourlyRate, city: selectedCity, state: selectedState };
                await addTimeSlot(newSlotData);
                successfulAddCount++;
                processedDates.add(slotIdentifier);
            } catch (error: any) {
                 const errorMsgIdentifier = `error-${dateString}`;
                 if (!processedDates.has(errorMsgIdentifier)) {
                    console.error(`Error adding time slot for ${date.toISOString()}:`, error);
                    toast({ title: "Erro ao Adicionar", description: error.message || `Falha ao adicionar para ${dateString}.`, variant: "destructive" });
                    errorOccurredCount++;
                    processedDates.add(errorMsgIdentifier);
                }
            }
        });

        await Promise.all(addPromises);
        setIsLoadingAdd(false);

        if (successfulAddCount > 0) {
            toast({ title: "Operação Concluída", description: `${successfulAddCount} período(s) adicionado(s). Atualizando lista...`, variant: "success" });
            resetForm();
            await fetchTimeSlots();
        } else if (errorOccurredCount === 0 && conflictDetectedCount > 0) {
            // Only show if no other errors happened, as conflicts were already toasted
            toast({ title: "Disponibilidade não adicionada", description: "Conflitos de horário detectados.", variant: "warning" });
        }
    };

    // --- JSX ---
    return (
        <div className="space-y-6 p-4 sm:p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Disponibilidade</h1>
                <p className="text-gray-600 text-sm sm:text-base">Gerencie seus horários, tipos de atendimento, valores e locais para propostas.</p>
            </div>

            {/* Error/Loading States */}
            {fetchError && !isLoadingTimeSlots && (
                 <Card className="border-destructive bg-destructive/10">
                    <CardHeader>
                        <CardTitle className="text-destructive text-lg">Erro ao Carregar Dados</CardTitle>
                        <CardDescription className="text-destructive/90 break-words"> {/* Added break-words */}
                            {fetchError}
                            {fetchError.includes("query requires an index") && (
                                <span className="block mt-2 text-xs"> (A criação do índice no Firestore pode levar alguns minutos após clicar no link.)</span>
                            )}
                            <br/> Por favor, tente
                            <Button variant="link" className="p-0 h-auto ml-1 text-destructive/90 underline" onClick={fetchTimeSlots} disabled={isLoadingTimeSlots}>
                                {isLoadingTimeSlots ? 'Recarregando...' : 'recarregar a lista'}
                            </Button>.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}
            {isLoadingTimeSlots && !fetchError && (
                 <div className="flex justify-center items-center py-10 bg-white rounded-lg shadow-sm border border-blue-100">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="ml-4 text-gray-600">Carregando sua disponibilidade...</p>
                </div>
            )}

            {/* Main Content */}
            {!isLoadingTimeSlots && ( // Render form/list only when not loading initially
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Add Availability Card */}
                    <Card className={cn("border-blue-100 shadow-sm", fetchError && "opacity-50 pointer-events-none")}> {/* Dim form if fetch failed */}
                        <CardHeader>
                            <CardTitle className="text-gray-900 text-lg sm:text-xl">Adicionar Disponibilidade</CardTitle>
                            <CardDescription className="text-gray-600 text-sm">
                                Escolha datas, horários, tipo, valor, local e especialidades (opcional).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Date Selection */}
                            <div>
                                <Label className="text-gray-700 text-sm sm:text-base font-medium">Datas</Label>
                                <p className="text-xs text-gray-500 mb-1">Clique nas datas desejadas.</p>
                                <div className="rounded-md border border-blue-200 bg-white p-1 inline-block">
                                    <Calendar mode="multiple" min={0} selected={dates} onSelect={handleSelectDate} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} className="p-2 text-sm" footer={dates.length > 0 ? <p className="text-xs mt-2 text-blue-700 px-2">{dates.length} data(s) selecionada(s).</p> : <p className="text-xs mt-2 text-gray-500 px-2">Nenhuma data.</p>} />
                                </div>
                            </div>
                            {/* Quick Time Buttons */}
                            <div className="space-y-2">
                                <Label className="text-gray-700 text-sm sm:text-base font-medium">Horários Rápidos</Label>
                                <div className="flex flex-wrap gap-2">
                                     <Button variant="outline" size="sm" onClick={() => applyQuickTime("08:00", "12:00")} className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm">Manhã (08-12)</Button>
                                     <Button variant="outline" size="sm" onClick={() => applyQuickTime("14:00", "18:00")} className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm">Tarde (14-18)</Button>
                                     <Button variant="outline" size="sm" onClick={() => applyQuickTime("19:00", "07:00")} className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm">Noite (19-07)</Button>
                                     <Button variant="outline" size="sm" onClick={() => applyQuickTime("07:00", "19:00")} className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm">Dia (07-19)</Button>
                                </div>
                            </div>
                            {/* Time Selection */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="start-time" className="text-gray-700 text-sm sm:text-base font-medium">Início</Label>
                                    <Select value={startTime} onValueChange={setStartTime}>
                                        {/* CORRECTED className logic */}
                                        <SelectTrigger id="start-time" className={cn("border-blue-200 focus:ring-blue-500 text-sm h-9", timeError && "border-red-500 ring-red-500 focus:ring-red-500")}>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>{timeOptions.map((time) => (<SelectItem key={`start-${time}`} value={time} className="text-sm">{time}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="end-time" className="text-gray-700 text-sm sm:text-base font-medium">Término</Label>
                                    <Select value={endTime} onValueChange={setEndTime}>
                                        {/* CORRECTED className logic */}
                                        <SelectTrigger id="end-time" className={cn("border-blue-200 focus:ring-blue-500 text-sm h-9", timeError && "border-red-500 ring-red-500 focus:ring-red-500")}>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>{timeOptions.map((time) => (<SelectItem key={`end-${time}`} value={time} className="text-sm">{time}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                {timeError && <p className="text-red-600 text-xs sm:text-sm col-span-1 sm:col-span-2 pt-1">{timeError}</p>}
                            </div>
                            {/* Service Type Selection */}
                            <div className="space-y-1.5">
                                 <Label htmlFor="service-type" className="text-gray-700 text-sm sm:text-base font-medium flex items-center">
                                     <Briefcase className="h-4 w-4 mr-1.5 text-blue-600"/> Tipo de Atendimento <span className="text-red-500 ml-1">*</span>
                                  </Label>
                                 <Select value={selectedServiceType} onValueChange={handleServiceTypeChange}>
                                     <SelectTrigger id="service-type" className={cn("border-blue-200 focus:ring-blue-500 text-sm h-9", !selectedServiceType && "text-gray-500")}>
                                         <SelectValue placeholder="Selecione o tipo..." />
                                     </SelectTrigger>
                                     <SelectContent>
                                         <SelectGroup>
                                             <SelectLabel>Tipos Disponíveis</SelectLabel>
                                             {serviceTypesOptions.map((option) => (<SelectItem key={option.value} value={option.value} className="text-sm">{option.label} ({formatCurrency(option.rate)}/hora)</SelectItem>))}
                                              {serviceTypesOptions.length === 0 && <p className="text-xs text-gray-500 p-2">Nenhum tipo.</p>}
                                         </SelectGroup>
                                     </SelectContent>
                                 </Select>
                                 {selectedHourlyRate !== null && (<p className="text-xs text-gray-600 mt-1 flex items-center gap-1"><DollarSign className="h-3.5 w-3.5 text-green-600"/> Valor/hora: <span className="font-medium text-green-700">{formatCurrency(selectedHourlyRate)}</span></p>)}
                            </div>
                            {/* Location Selection */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                     <Label htmlFor="state-select" className="text-gray-700 text-sm sm:text-base font-medium flex items-center">
                                          <MapPin className="h-4 w-4 mr-1.5 text-blue-600"/> Estado <span className="text-red-500 ml-1">*</span>
                                     </Label>
                                     <Select value={selectedState} onValueChange={setSelectedState}>
                                         <SelectTrigger id="state-select" className={cn("border-blue-200 focus:ring-blue-500 text-sm h-9", !selectedState && "text-gray-500")}>
                                             <SelectValue placeholder="Selecione..." />
                                         </SelectTrigger>
                                         <SelectContent>
                                             <SelectGroup><SelectLabel>Estados</SelectLabel>{brazilianStates.map((state) => (<SelectItem key={state} value={state} className="text-sm">{state}</SelectItem>))}</SelectGroup>
                                         </SelectContent>
                                     </Select>
                                </div>
                                <div className="space-y-1.5">
                                     <Label htmlFor="city-select" className="text-gray-700 text-sm sm:text-base font-medium"> Cidade <span className="text-red-500 ml-1">*</span> </Label>
                                     <Select value={selectedCity} onValueChange={setSelectedCity} disabled={!selectedState || availableCities.length === 0}>
                                         <SelectTrigger id="city-select" className={cn("border-blue-200 focus:ring-blue-500 text-sm h-9", !selectedCity && "text-gray-500", (!selectedState || availableCities.length === 0) && "bg-gray-100 cursor-not-allowed")}>
                                             <SelectValue placeholder={!selectedState ? "Escolha Estado" : (availableCities.length === 0 ? "Sem cidades" : "Selecione...")} />
                                         </SelectTrigger>
                                         <SelectContent><SelectGroup><SelectLabel>Cidades em {selectedState}</SelectLabel>{availableCities.map((city) => (<SelectItem key={city} value={city} className="text-sm">{city}</SelectItem>))} {selectedState && availableCities.length === 0 && (<p className="text-xs text-gray-500 p-2">Nenhuma cidade.</p>)}</SelectGroup></SelectContent>
                                     </Select>
                                </div>
                            </div>
                            {/* Specialty Selection */}
                            <div className="space-y-1.5">
                                 <Label className="text-gray-700 text-sm sm:text-base font-medium">Especialidades (Opcional)</Label>
                                 <Popover open={specialtyPopoverOpen} onOpenChange={setSpecialtyPopoverOpen}>
                                      <PopoverTrigger asChild>
                                         <Button variant="outline" className="w-full justify-between border-blue-200 text-gray-700 hover:bg-blue-50 text-sm font-normal h-9">
                                             <span className="truncate pr-2">{selectedSpecialties.length > 0 ? selectedSpecialties.join(', ') : "Selecione..."}</span>
                                             <Plus className="ml-2 h-4 w-4 text-blue-600 shrink-0" />
                                         </Button>
                                     </PopoverTrigger>
                                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 max-h-60 overflow-y-auto"><Command><CommandInput placeholder="Buscar..." value={specialtySearchValue} onValueChange={setSpecialtySearchValue} className="text-sm" /><CommandList><CommandEmpty className="text-sm p-2">Nenhuma encontrada.</CommandEmpty><CommandGroup>{filteredSpecialties.map((specialty) => (<CommandItem key={specialty} value={specialty} onSelect={() => handleSelectSpecialty(specialty)} className="text-sm flex items-center cursor-pointer">{specialty}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                                  </Popover>
                                 {selectedSpecialties.length > 0 && (
                                      <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">{selectedSpecialties.map((specialty) => (<Badge key={specialty} variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200 flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap pl-2 pr-1 py-0.5"><span className="">{specialty}</span><button type="button" onClick={() => handleRemoveSpecialty(specialty)} className="rounded-full hover:bg-blue-300 p-0.5" aria-label={`Remover ${specialty}`}><X className="h-3 w-3" /></button></Badge>))}</div>
                                 )}
                             </div>
                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <Button type="button" className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 text-sm sm:text-base h-9" disabled={isLoadingAdd || !!timeError || dates.length === 0 || !selectedServiceType || selectedHourlyRate === null || !selectedState || !selectedCity} onClick={handleAddAvailability}>
                                     {isLoadingAdd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {isLoadingAdd ? "Adicionando..." : "Adicionar"}
                                 </Button>
                                <Button type="button" variant="outline" className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-100 text-sm sm:text-base flex items-center justify-center gap-2 h-9" onClick={resetForm} disabled={isLoadingAdd}>
                                     <RotateCcw className="h-4 w-4" /> <span className="sm:ml-1">Limpar</span>
                                 </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Registered Availability List Card */}
                    <Card className="border-blue-100 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-gray-900 text-lg sm:text-xl">Disponibilidade Cadastrada</CardTitle>
                            <CardDescription className="text-gray-600 text-sm">
                                Seus horários, tipos, valores e locais registrados.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 max-h-[400px] sm:max-h-[500px] md:max-h-[650px] overflow-y-auto pr-2 border-t border-blue-100 pt-3">
                                {!isLoadingTimeSlots && timeSlots.length === 0 && !fetchError ? ( // Show only if not loading, no error, and list is empty
                                    <p className="text-center text-gray-600 py-6 text-sm">Nenhuma disponibilidade cadastrada.</p>
                                ) : (
                                    timeSlots.map((slot) => {
                                        const serviceTypeLabel = serviceTypesOptions.find(opt => opt.value === slot.serviceType)?.label || slot.serviceType;
                                        const isDeleting = isLoadingDelete === slot.id;
                                        return (
                                             <div key={slot.id} className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-blue-100 pb-3 last:border-0 last:pb-0 gap-2 transition-opacity duration-300", isDeleting && "opacity-50 pointer-events-none")}>
                                                <div className="flex-1 space-y-1.5">
                                                    <p className="font-medium text-gray-900 text-sm sm:text-base" suppressHydrationWarning>{slot.date ? slot.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }) : "Inválida"}</p>
                                                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600"><Clock className="h-3.5 w-3.5 shrink-0" /><span>{slot.startTime} - {slot.endTime}</span></div>
                                                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600"><MapPin className="h-3.5 w-3.5 shrink-0 text-purple-600" /><span>{slot.city}, {slot.state}</span></div>
                                                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600"><Briefcase className="h-3.5 w-3.5 shrink-0 text-blue-600" /><span>{serviceTypeLabel}</span></div>
                                                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600"><DollarSign className="h-3.5 w-3.5 shrink-0 text-green-600" /><span className="font-medium text-green-700">{formatCurrency(slot.hourlyRate)}/hora</span></div>
                                                    {slot.specialties && slot.specialties.length > 0 && (<div className="flex flex-wrap gap-1 pt-1">{slot.specialties.map((specialty) => (<Badge key={specialty} variant="secondary" className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 font-normal">{specialty}</Badge>))}</div>)}
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveTimeSlot(slot.id)} disabled={!!isLoadingDelete} className="text-gray-400 hover:text-red-600 hover:bg-red-50 mt-2 sm:mt-0 shrink-0 rounded-full h-8 w-8" aria-label="Remover">{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>
                                             </div>
                                        );
                                    })
                                )}
                                {/* Loading indicator inside list area is removed, handled by the top-level one */}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}