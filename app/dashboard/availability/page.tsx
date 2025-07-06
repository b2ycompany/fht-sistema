// app/dashboard/availability/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, ChangeEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { type SelectMultipleEventHandler } from "react-day-picker";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PopoverClose } from "@radix-ui/react-popover";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";

import { cn, formatCurrency } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase";

import {
  addTimeSlot,
  getTimeSlots,
  deleteTimeSlot,
  updateTimeSlot,
  medicalSpecialties,
  ServiceTypeRates,
  type TimeSlot,
  type TimeSlotFormPayload,
  type TimeSlotUpdatePayload
} from "@/lib/availability-service";

import {
  Plus, Loader2, AlertCircle, Users, DollarSign, Briefcase, ClipboardList, Info, Trash2, CheckCircle, History, X, CalendarDays, FilePenLine, RotateCcw,
  MapPin, Clock, Check, ChevronsUpDown
} from "lucide-react";

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <span className="ml-3 text-sm text-gray-600 mt-3">{message}</span> </div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: React.ReactNode }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full"> <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/> <p className="font-medium text-gray-600 mb-1">Nada por aqui ainda!</p> <p className="max-w-xs">{message}</p> {actionButton && <div className="mt-4">{actionButton}</div>} </div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"> <AlertCircle className="w-12 h-12 text-red-400 mb-4"/> <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p> <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados. Por favor, tente novamente."}</p> {onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4 bg-red-600 hover:bg-red-700 text-white"> <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente </Button> )} </div> ));
ErrorState.displayName = 'ErrorState';

const timeOptions = Array.from({ length: 48 }, (_, i) => { const h = Math.floor(i/2); const m = i%2 === 0 ? "00" : "30"; return `${h.toString().padStart(2,"0")}:${m}`; });
const brazilianStates = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO" ];
const citiesByState: { [key: string]: string[] } = {
  "SP": ["São Paulo", "Campinas", "Guarulhos", "Osasco", "Santo André", "São Bernardo do Campo", "Santos", "Ribeirão Preto", "Sorocaba", "Jundiaí", "Piracicaba", "Bauru", "Franca", "Taubaté", "Limeira", "Barueri", "Cotia", "Itapevi", "Araçariguama"],
  "RJ": ["Rio de Janeiro", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Niterói", "Belford Roxo", "Campos dos Goytacazes", "São João de Meriti", "Petrópolis", "Volta Redonda"],
  "MG": ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Montes Claros", "Ribeirão das Neves", "Uberaba", "Governador Valadares", "Ipatinga"],
};
const serviceTypesOptions = Object.entries(ServiceTypeRates).map(([v, r]) => ({ value: v, label: v.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '), rateExample: r }));

const TimeSlotListItem: React.FC<{ slot: TimeSlot; onEdit: () => void; onDelete: () => void; }> = ({ slot, onEdit, onDelete }) => {
  const slotDate = slot.date instanceof Timestamp ? slot.date.toDate() : null;
  const serviceTypeObj = serviceTypesOptions.find(opt => opt.value === slot.serviceType);
  const serviceTypeLabel = serviceTypeObj?.label || slot.serviceType;
  const canEditOrDelete = slot.status === 'AVAILABLE';
  const statusBadgeVariant = (status?: string): VariantProps<typeof Badge>["variant"] => { switch (status) { case 'AVAILABLE': return 'default'; case 'BOOKED': return 'default'; case 'COMPLETED': return 'default'; default: return 'outline'; } };
  const statusBadgeColorClasses = (status?: string): string => { switch (status) { case 'AVAILABLE': return 'bg-blue-100 text-blue-800'; case 'BOOKED': return 'bg-green-100 text-green-800'; case 'COMPLETED': return 'bg-emerald-100 text-emerald-800'; default: return 'bg-gray-100 text-gray-800'; } }

  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:justify-between border rounded-lg p-4 gap-x-4 gap-y-3 bg-white shadow-xs hover:shadow-sm", !canEditOrDelete && "opacity-70 bg-gray-50")}>
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" />
            <span suppressHydrationWarning>{slotDate ? slotDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Data Inválida"}</span>
            <span className="text-gray-500 font-normal">({slot.startTime} - {slot.endTime})</span>
          </div>
          <Badge variant={statusBadgeVariant(slot.status)} className={cn(statusBadgeColorClasses(slot.status), "capitalize")}>
            {slot.status?.replace(/_/g, ' ').toUpperCase()}
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mt-1 pl-1">
          <div className="flex items-center gap-1.5 truncate">
  <MapPin className="h-3.5 w-3.5 shrink-0 text-purple-500" />
  <span>
  {Array.isArray(slot.cities) && slot.cities.length > 0
    ? slot.cities.join(', ')
    : 'Cidades não informadas'}
  , {slot.state}
</span>
</div>
          <div className="flex items-center gap-1.5 truncate"><Briefcase className="h-3.5 w-3.5 shrink-0 text-cyan-500" /><span>{serviceTypeLabel}</span></div>
          <div className="flex items-center gap-1.5 text-green-600 font-medium sm:col-span-2"><DollarSign className="h-3.5 w-3.5 shrink-0" /><span>{formatCurrency(slot.desiredHourlyRate)}/hora (pretendido)</span></div>
        </div>
        {slot.specialties && slot.specialties.length > 0 && ( <div className="flex flex-wrap items-center gap-1.5 pt-1.5 pl-1"> <span className="text-xs text-gray-500 mr-1 font-medium shrink-0">Especialidades:</span> {slot.specialties.map((s) => (<Badge key={s} variant="outline" className="text-gray-700 text-[11px] px-1.5 py-0.5 font-normal border-blue-200 bg-blue-50">{s}</Badge>))} </div> )}
        {slot.notes && ( <p className="text-xs text-gray-500 pt-1.5 pl-1 italic flex items-start gap-1.5"> <Info className="inline h-3.5 w-3.5 mr-0.5 shrink-0 relative top-0.5"/> <span className="truncate">{slot.notes}</span> </p> )}
      </div>
      <div className="flex items-center space-x-1 shrink-0 mt-2 sm:mt-0 self-end sm:self-center">
        <Button variant="ghost" size="icon" onClick={onEdit} disabled={!canEditOrDelete} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full w-8 h-8" aria-label="Editar Disponibilidade" title={!canEditOrDelete ? "Não é possível editar uma disponibilidade reservada ou finalizada." : "Editar Disponibilidade"}><FilePenLine className="h-4 w-4"/></Button>
        <Button variant="ghost" size="icon" onClick={onDelete} disabled={!canEditOrDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full w-8 h-8" aria-label="Cancelar Disponibilidade" title={!canEditOrDelete ? "Não é possível apagar uma disponibilidade reservada ou finalizada." : "Apagar Disponibilidade"}>
          <Trash2 className="h-4 w-4"/>
        </Button>
      </div>
    </div>
  );
};
TimeSlotListItem.displayName = 'TimeSlotListItem';

const TimeSlotFormDialog: React.FC<{ onFormSubmitted: () => void; initialData?: TimeSlot | null; }> = ({ onFormSubmitted, initialData }) => {
  const { toast } = useToast();
  const isEditing = !!initialData && !!initialData.id;

  const [dates, setDates] = useState<Date[]>(() => isEditing && initialData?.date ? [initialData.date.toDate()] : []);
  const [startTime, setStartTime] = useState(initialData?.startTime || "07:00");
  const [endTime, setEndTime] = useState(initialData?.endTime || "19:00");
  const [desiredRateInput, setDesiredRateInput] = useState<string>(String(initialData?.desiredHourlyRate || ""));
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(initialData?.specialties || []);
  const [selectedState, setSelectedState] = useState<string>(initialData?.state || "");
  const [selectedCities, setSelectedCities] = useState<string[]>(initialData?.cities || []);
  const [selectedServiceType, setSelectedServiceType] = useState<string>(initialData?.serviceType || "");
  const [notes, setNotes] = useState<string>(initialData?.notes || "");
  const [cityPopoverOpen, setCityPopoverOpen] = useState(false);  
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [specialtyPopoverOpen, setSpecialtyPopoverOpen] = useState(false);
  const [specialtySearchValue, setSpecialtySearchValue] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  useEffect(() => { if (initialData?.state) { setAvailableCities(citiesByState[initialData.state] || []); } }, [initialData?.state]);
  const resetFormFields = useCallback(() => { setDates([]); setStartTime("07:00"); setEndTime("19:00"); setDesiredRateInput(""); setSelectedSpecialties([]); setSelectedState(""); setSelectedCities([]); setSelectedServiceType(""); setNotes(""); setTimeError(null); }, []);
  const validateTimes = useCallback((start: string, end: string) => { if (start && end && start === end) { setTimeError("Horário de início não pode ser igual ao de término."); } else { setTimeError(null); } }, []);
  useEffect(() => { validateTimes(startTime, endTime); }, [startTime, endTime, validateTimes]);
  
useEffect(() => {
    if (selectedState) {
        setAvailableCities(citiesByState[selectedState] || []);
        // Se o estado for alterado e não for o estado inicial, limpa a seleção de cidades
        if (!initialData || selectedState !== initialData.state) {
            setSelectedCities([]);
        }
    } else {
        setAvailableCities([]);
        setSelectedCities([]);
    }
}, [selectedState, initialData]);

  const handleSelectSpecialty = (specialty: string) => { if (!selectedSpecialties.includes(specialty)) setSelectedSpecialties(prev => [...prev, specialty]); setSpecialtySearchValue(""); setSpecialtyPopoverOpen(false); };
  const handleRemoveSpecialty = (specialtyToRemove: string) => { setSelectedSpecialties(prev => prev.filter(s => s !== specialtyToRemove)); };
  const filteredSpecialties = useMemo(() => medicalSpecialties.filter(s => typeof s === 'string' && s.toLowerCase().includes(specialtySearchValue.toLowerCase()) && !selectedSpecialties.includes(s)), [specialtySearchValue, selectedSpecialties]);
  const applyQuickTime = (start: string, end: string) => { setStartTime(start); setEndTime(end); };

  const handleSubmit = async () => {
    const desiredHourlyRate = parseFloat(desiredRateInput.replace(',', '.'));
    if (dates.length === 0 && !isEditing) { toast({ title: "Data é obrigatória", variant: "destructive" }); return; }
    if (timeError) { toast({ title: "Horário Inválido", variant: "destructive" }); return; }
    if (!selectedServiceType) { toast({ title: "Tipo de Atendimento Obrigatório", variant: "destructive" }); return; }
    if (isNaN(desiredHourlyRate) || desiredHourlyRate <= 0) { toast({ title: "Valor Hora Inválido", variant: "destructive" }); return; }
    if (!selectedState || selectedCities.length === 0) { toast({ title: "Localização Obrigatória", description: "Selecione o estado e pelo menos uma cidade.", variant: "destructive" }); return; }
    if (selectedSpecialties.length === 0) { toast({ title: "Especialidade Obrigatória", description: "Selecione ao menos uma especialidade.", variant: "destructive" }); return; }

    setIsLoadingSubmit(true);
    const currentUser = auth.currentUser;
    if (!currentUser) { toast({ title: "Usuário não autenticado", variant: "destructive" }); setIsLoadingSubmit(false); return; }

    const isOvernight = startTime > endTime;
    const finalNotes = notes.trim();

    try {
      if (isEditing && initialData?.id) {
        const payload: TimeSlotUpdatePayload = {
          startTime, endTime, isOvernight,
          state: selectedState, cities: selectedCities,
          serviceType: selectedServiceType, specialties: selectedSpecialties,
          desiredHourlyRate,
          ...(finalNotes && { notes: finalNotes }),
        };
        await updateTimeSlot(initialData.id, payload);
        toast({ title: "Disponibilidade Atualizada", variant: "default" });
      } else {
        const creationPromises = dates.map(singleDate => {
          const slotTimestamp = Timestamp.fromDate(singleDate);
          const payload: TimeSlotFormPayload = {
            date: slotTimestamp, startTime, endTime, isOvernight,
            state: selectedState, cities: selectedCities,
            serviceType: selectedServiceType, specialties: selectedSpecialties,
            desiredHourlyRate,
            ...(finalNotes && { notes: finalNotes }),
          };
          return addTimeSlot(payload);
        });
        await Promise.all(creationPromises);
        toast({ title: "Disponibilidade(s) Adicionada(s)!", description: `${dates.length} horário(s) foram salvos.`, variant: "default" });
        if(!isEditing) resetFormFields();
      }
      onFormSubmitted();
    } catch (error: any) { toast({ title: `Erro ao ${isEditing ? 'Atualizar' : 'Salvar'}`, description: error.message, variant: "destructive"}); }
    finally { setIsLoadingSubmit(false); }
  };
  
  const modifiers = { selected: dates, };
  const modifiersClassNames = { selected: 'day-selected-override' };

  return (
    <DialogContent className="sm:max-w-2xl md:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="text-xl">{isEditing ? "Editar Disponibilidade" : "Adicionar Nova Disponibilidade"}</DialogTitle>
        <DialogDescription>
          {isEditing ? "Altere os detalhes da sua disponibilidade. A data original não pode ser alterada." : "Selecione as datas e preencha os detalhes. Uma entrada de disponibilidade será criada para cada data selecionada."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-5 py-4 max-h-[70vh] overflow-y-auto px-1 pr-3 md:pr-4 custom-scrollbar">
          <style>{`.day-selected-override { background-color: #2563eb !important; color: white !important; }`}</style>
          <div className="space-y-2">
            <Label className="font-semibold text-gray-800 flex items-center"><CalendarDays className="h-4 w-4 mr-2 text-blue-600"/>Data(s) da Disponibilidade*</Label>
            <p className="text-xs text-gray-500">{isEditing ? "Data original (não pode ser alterada)." : "Selecione um ou mais dias no calendário."}</p>
            <div className="flex flex-col sm:flex-row gap-2 items-start">
              {isEditing ? (
                  <Calendar mode="single" selected={dates[0]} disabled footer={<p className="text-xs text-gray-700 font-medium p-2 border-t">Data: {dates[0]?.toLocaleDateString('pt-BR')}</p>}/>
              ) : (
                  <Calendar mode="multiple" selected={dates} onSelect={setDates as SelectMultipleEventHandler} disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }} footer={ dates.length > 0 ? <p className="text-xs text-blue-700 font-medium p-2 border-t">{dates.length} dia(s) selecionado(s).</p> : <p className="text-xs text-gray-500 p-2 border-t">Nenhum dia selecionado.</p>} modifiers={modifiers} modifiersClassNames={modifiersClassNames}/>
              )}
              {dates.length > 0 && !isEditing && <Button variant="outline" size="sm" onClick={() => setDates([])} className="text-xs self-start sm:self-end w-full sm:w-auto"><X className="h-3 w-3 mr-1"/> Limpar Datas</Button>}
            </div>
          </div>
          <div className="space-y-2">
              <Label className="font-semibold text-gray-800 flex items-center"><Clock className="h-4 w-4 mr-2 text-blue-600"/>Horário da Disponibilidade*</Label>
              <div className="flex flex-wrap gap-2 mb-3"><Button variant="outline" size="sm" onClick={() => applyQuickTime("07:00", "19:00")} className="text-xs">Diurno (07-19h)</Button><Button variant="outline" size="sm" onClick={() => applyQuickTime("19:00", "07:00")} className="text-xs">Noturno (19-07h)</Button><Button variant="outline" size="sm" onClick={() => applyQuickTime("08:00", "12:00")} className="text-xs">Manhã (08-12h)</Button><Button variant="outline" size="sm" onClick={() => applyQuickTime("13:00", "18:00")} className="text-xs">Tarde (13-18h)</Button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="space-y-1.5"><Label htmlFor="doc-start-time">Horário de Início*</Label><Select value={startTime} onValueChange={setStartTime}><SelectTrigger id="doc-start-time" className={cn("h-9", timeError && "border-red-500 ring-1 ring-red-500")}><SelectValue/></SelectTrigger><SelectContent>{timeOptions.map(t=><SelectItem key={"dst"+t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="doc-end-time">Horário de Término*</Label><Select value={endTime} onValueChange={setEndTime}><SelectTrigger id="doc-end-time" className={cn("h-9", timeError && "border-red-500 ring-1 ring-red-500")}><SelectValue/></SelectTrigger><SelectContent>{timeOptions.map(t=><SelectItem key={"det"+t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>{timeError && <p className="text-red-600 text-xs col-span-1 sm:col-span-2">{timeError}</p>}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="space-y-1.5"><Label htmlFor="doc-state" className="font-semibold text-gray-800 flex items-center"><MapPin className="h-4 w-4 mr-2 text-blue-600"/>Estado de Atuação*</Label><Select value={selectedState} onValueChange={setSelectedState}><SelectTrigger id="doc-state" className="h-9"><SelectValue placeholder="Selecione o UF..."/></SelectTrigger><SelectContent>{brazilianStates.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5">
    <Label className="font-semibold text-gray-800">Cidades de Atuação*</Label>
<Popover open={cityPopoverOpen} onOpenChange={setCityPopoverOpen} modal={false}>
    <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9" disabled={!selectedState || availableCities.length === 0}>
            {selectedCities.length > 0 ? `${selectedCities.length} cidade(s) selecionada(s)` : "Selecione as cidades..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
    </PopoverTrigger>
<PopoverContent className="w-[--radix-popover-trigger-width] p-0">
    <Command>
        <CommandInput placeholder="Buscar cidade..." />
        {/*
          Aplicamos a mesma correção aqui.
        */}
        <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandGroup>
                {availableCities.map((city) => (
                    <CommandItem key={city} value={city} onSelect={() => { const newSelection = selectedCities.includes(city) ? selectedCities.filter(c => c !== city) : [...selectedCities, city]; setSelectedCities(newSelection); }}>
                        <Check className={cn("mr-2 h-4 w-4", selectedCities.includes(city) ? "opacity-100" : "opacity-0")}/>{city}
                    </CommandItem>
                ))}
            </CommandGroup>
        </CommandList>
    </Command>
    <div className="p-2 border-t flex justify-end">
        <Button size="sm" type="button" onClick={() => setCityPopoverOpen(false)}>Confirmar</Button>
    </div>
</PopoverContent>
</Popover>
</div>
</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="space-y-1.5"><Label htmlFor="doc-service-type" className="font-semibold text-gray-800 flex items-center"><Briefcase className="h-4 w-4 mr-2 text-blue-600"/>Tipo de Atendimento*</Label><Select value={selectedServiceType} onValueChange={setSelectedServiceType}><SelectTrigger id="doc-service-type" className="h-9"><SelectValue placeholder="Selecione..."/></SelectTrigger><SelectContent>{serviceTypesOptions.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="doc-desired-rate" className="font-semibold text-gray-800 flex items-center"><DollarSign className="h-4 w-4 mr-2 text-green-600"/>Valor Hora Pretendido (R$)*</Label><Input id="doc-desired-rate" type="number" min="0.01" step="0.01" placeholder="Ex: 100.00" value={desiredRateInput} onChange={(e)=>setDesiredRateInput(e.target.value)} className="h-9"/></div></div>
          <div className="space-y-2"><Label className="font-semibold text-gray-800 flex items-center"><ClipboardList className="h-4 w-4 mr-2 text-blue-600"/>Especialidades Atendidas* <span className="text-xs text-gray-500 ml-1 font-normal">(Selecione ao menos uma)</span></Label><Popover open={specialtyPopoverOpen} onOpenChange={setSpecialtyPopoverOpen}><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal text-muted-foreground h-9 border-dashed hover:border-solid">{selectedSpecialties.length > 0 ? `Selecionadas: ${selectedSpecialties.length}` : "Clique para selecionar especialidades..."}</Button></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command filter={(value, search) => medicalSpecialties.find(s => s.toLowerCase() === value.toLowerCase())?.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}><CommandInput placeholder="Buscar especialidade..." value={specialtySearchValue} onValueChange={setSpecialtySearchValue}/><CommandList><CommandEmpty>Nenhuma.</CommandEmpty><CommandGroup heading={`${filteredSpecialties.length} encontradas`}>{filteredSpecialties.map((s) => (<CommandItem key={s} value={s} onSelect={() => handleSelectSpecialty(s)} className="cursor-pointer hover:bg-accent">{s}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover>{selectedSpecialties.length > 0 && ( <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-dashed"> {selectedSpecialties.map((s) => ( <Badge key={s} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-normal"> {s} <button type="button" onClick={()=>handleRemoveSpecialty(s)} className="ml-1.5 p-0.5 rounded-full outline-none focus:ring-1 focus:ring-blue-500 hover:bg-blue-200"> <X className="h-3 w-3 text-blue-600 hover:text-blue-800" /> </button> </Badge> ))} </div> )}</div>
          <div className="space-y-1.5"><Label htmlFor="doc-notes" className="font-semibold text-gray-800 flex items-center"><Info className="h-4 w-4 mr-2 text-blue-600"/>Notas Adicionais <span className="text-xs text-gray-500 ml-1 font-normal">(Opcional)</span></Label><Textarea id="doc-notes" placeholder="Ex: Preferência por plantões mais tranquilos, etc." value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[80px]"/></div>
      </div>
      <DialogFooter className="mt-2 pt-4 border-t bg-slate-50 -m-6 px-6 pb-4 rounded-b-lg"><DialogClose asChild><Button type="button" variant="outline" disabled={isLoadingSubmit}>Cancelar</Button></DialogClose><Button type="button" onClick={handleSubmit} disabled={isLoadingSubmit || (dates.length === 0 && !isEditing)} className="bg-blue-600 hover:bg-blue-700">{isLoadingSubmit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isLoadingSubmit ? (isEditing ? "Salvando..." : "Adicionando...") : (isEditing ? "Salvar Alterações" : `Adicionar Disponibilidade (${dates.length || 0} Dia(s))`)}</Button></DialogFooter>
    </DialogContent>
  );
};
TimeSlotFormDialog.displayName = 'TimeSlotFormDialog';

export default function AvailabilityPage() {
    const { toast } = useToast();
    const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
    const [editingTimeSlot, setEditingTimeSlot] = useState<TimeSlot | null>(null);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [fetchErrorList, setFetchErrorList] = useState<string | null>(null);

    const fetchDoctorTimeSlots = useCallback(async () => {
        setIsLoadingList(true);
        setFetchErrorList(null);
        try {
            const slots = await getTimeSlots();
            setTimeSlots(slots.sort((a,b) => (a.date.toDate().getTime() - b.date.toDate().getTime()) || a.startTime.localeCompare(b.startTime) ));
        } catch (error: any) {
            const errorMsg = error.message?.includes("query requires an index") ? `Falha ao buscar: Índice do Firestore necessário. ${error.message}` : error.message || "Não foi possível carregar suas disponibilidades.";
            setFetchErrorList(errorMsg);
        } finally {
            setIsLoadingList(false);
        }
    }, []);

    useEffect(() => { fetchDoctorTimeSlots(); }, [fetchDoctorTimeSlots]);

    const handleOpenAddDialog = () => { setEditingTimeSlot(null); setIsFormDialogOpen(true); };
    const handleOpenEditDialog = (slot: TimeSlot) => { setEditingTimeSlot(slot); setIsFormDialogOpen(true); };
    const onFormSubmitted = () => { setIsFormDialogOpen(false); setEditingTimeSlot(null); fetchDoctorTimeSlots(); };
    
    const handleDeleteTimeSlot = async (slotId: string | undefined) => {
        if (!slotId) return;
        if (confirm("Tem certeza que deseja apagar esta disponibilidade? Esta ação não pode ser desfeita.")) {
            try {
                await deleteTimeSlot(slotId);
                toast({ title: "Disponibilidade Removida", description: "O seu horário foi removido com sucesso.", variant: "default" });
                fetchDoctorTimeSlots();
            } catch (error: any) {
                toast({ title: "Erro ao Remover", description: error.message, variant: "destructive" });
            }
        }
    };
    
    return (
        <div className="space-y-6 p-1">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Minha Disponibilidade</h1>
                    <p className="text-gray-600 text-sm sm:text-base mt-1">Cadastre os dias, horários, locais e valores que você está disponível para atender.</p>
                </div>
                <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { setIsFormDialogOpen(isOpen); if (!isOpen) setEditingTimeSlot(null); }}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700" onClick={handleOpenAddDialog}>
                            <Plus className="mr-1.5 h-4 w-4" /> Adicionar Disponibilidade
                        </Button>
                    </DialogTrigger>
                    <TimeSlotFormDialog key={editingTimeSlot ? `edit-${editingTimeSlot.id}` : 'new'} onFormSubmitted={onFormSubmitted} initialData={editingTimeSlot} />
                </Dialog>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Disponibilidades Cadastradas</CardTitle>
                    <CardDescription>Seus horários disponíveis para propostas de plantão.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingList ? ( <LoadingState /> )
                    : fetchErrorList ? ( <ErrorState message={fetchErrorList} onRetry={fetchDoctorTimeSlots} /> )
                    : timeSlots.length === 0 ? ( <EmptyState message="Você ainda não cadastrou nenhuma disponibilidade." actionButton={<Button size="sm" onClick={handleOpenAddDialog} className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1.5 h-4 w-4"/>Cadastrar Primeira Disponibilidade</Button>} /> )
                    : ( <div className="space-y-3"> {timeSlots.map(slot => ( <TimeSlotListItem key={slot.id} slot={slot} onEdit={() => handleOpenEditDialog(slot)} onDelete={() => handleDeleteTimeSlot(slot.id)} /> ))} </div> )}
                </CardContent>
            </Card>
        </div>
    );
}