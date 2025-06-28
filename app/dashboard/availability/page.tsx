// app/dashboard/availability/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, ChangeEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { type SelectMultipleEventHandler } from "react-day-picker";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { addTimeSlot, getTimeSlots, deleteTimeSlot, updateTimeSlot, medicalSpecialties, ServiceTypeRates, type TimeSlot, type TimeSlotFormPayload, type TimeSlotUpdatePayload } from "@/lib/availability-service";
import { Plus, Loader2, AlertCircle, Users, DollarSign, Briefcase, ClipboardList, Info, Trash2, CheckCircle, History, X, CalendarDays, Edit3, FilePenLine, RotateCcw, MapPin, Clock } from "lucide-react";

const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <span className="ml-3 text-sm text-gray-600 mt-3">{message}</span> </div> ));
const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: React.ReactNode }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full"> <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/> <p className="font-medium text-gray-600 mb-1">Nada por aqui ainda!</p> <p className="max-w-xs">{message}</p> {actionButton && <div className="mt-4">{actionButton}</div>} </div> ));
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"> <AlertCircle className="w-12 h-12 text-red-400 mb-4"/> <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p> <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados. Por favor, tente novamente."}</p> {onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4 bg-red-600 hover:bg-red-700 text-white"> <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente </Button> )} </div> ));

const timeOptions = Array.from({ length: 48 }, (_, i) => { const h = Math.floor(i/2); const m = i%2 === 0 ? "00" : "30"; return `${h.toString().padStart(2,"0")}:${m}`; });
const brazilianStates = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO" ];
const citiesByState: { [key: string]: string[] } = { "SP": ["São Paulo", "Campinas", "Guarulhos", "Osasco", "Santo André", "São Bernardo do Campo", "Santos", "Ribeirão Preto", "Sorocaba", "Jundiaí", "Piracicaba", "Bauru", "Franca", "Taubaté", "Limeira", "Barueri", "Cotia", "Itapevi", "Araçariguama"], "RJ": ["Rio de Janeiro", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Niterói", "Belford Roxo", "Campos dos Goytacazes", "São João de Meriti", "Petrópolis", "Volta Redonda"], "MG": ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Montes Claros", "Ribeirão das Neves", "Uberaba", "Governador Valadares", "Ipatinga"], };
const serviceTypesOptions = Object.entries(ServiceTypeRates).map(([v, r]) => ({ value: v, label: v.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '), rateExample: r }));

const TimeSlotListItem: React.FC<{ slot: TimeSlot; onEdit: () => void; onDelete: () => void; }> = ({ slot, onEdit, onDelete }) => {
    const slotDate = slot.date instanceof Timestamp ? slot.date.toDate() : null;
    const serviceTypeObj = serviceTypesOptions.find(opt => opt.value === slot.serviceType);
    const serviceTypeLabel = serviceTypeObj?.label || slot.serviceType;
    const canEditOrDelete = slot.status === 'AVAILABLE';
    const statusBadgeVariant = (status?: string): VariantProps<typeof Badge>["variant"] => { switch (status) { case 'AVAILABLE': return 'default'; case 'BOOKED': return 'default'; case 'COMPLETED': return 'default'; default: return 'outline'; } };
    const statusBadgeColorClasses = (status?: string): string => { switch (status) { case 'AVAILABLE': return 'bg-blue-100 text-blue-800'; case 'BOOKED': return 'bg-green-100 text-green-800'; case 'COMPLETED': return 'bg-emerald-100 text-emerald-800'; default: return 'bg-gray-100 text-gray-800'; } }

    return ( <div className={cn("flex flex-col sm:flex-row items-start sm:justify-between border rounded-lg p-4 gap-x-4 gap-y-3 bg-white shadow-xs hover:shadow-sm", !canEditOrDelete && "opacity-70 bg-gray-50")}> <div className="flex-1 space-y-1.5 min-w-0"> <div className="flex items-center justify-between gap-2"> <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"> <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" /> <span suppressHydrationWarning>{slotDate ? slotDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Data Inválida"}</span> <span className="text-gray-500 font-normal">({slot.startTime} - {slot.endTime})</span> </div> <Badge variant={statusBadgeVariant(slot.status)} className={cn(statusBadgeColorClasses(slot.status), "capitalize")}> {slot.status?.replace(/_/g, ' ').toUpperCase()} </Badge> </div> <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mt-1 pl-1"> <div className="flex items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5 shrink-0 text-purple-500" /><span>{slot.city}, {slot.state}</span></div> <div className="flex items-center gap-1.5 truncate"><Briefcase className="h-3.5 w-3.5 shrink-0 text-cyan-500" /><span>{serviceTypeLabel}</span></div> <div className="flex items-center gap-1.5 text-green-600 font-medium sm:col-span-2"><DollarSign className="h-3.5 w-3.5 shrink-0" /><span>{formatCurrency(slot.desiredHourlyRate)}/hora (pretendido)</span></div> </div> {slot.specialties && slot.specialties.length > 0 && ( <div className="flex flex-wrap items-center gap-1.5 pt-1.5 pl-1"> <span className="text-xs text-gray-500 mr-1 font-medium shrink-0">Especialidades:</span> {slot.specialties.map((s) => (<Badge key={s} variant="outline" className="text-gray-700 text-[11px] px-1.5 py-0.5 font-normal border-blue-200 bg-blue-50">{s}</Badge>))} </div> )} {slot.notes && ( <p className="text-xs text-gray-500 pt-1.5 pl-1 italic flex items-start gap-1.5"> <Info className="inline h-3.5 w-3.5 mr-0.5 shrink-0 relative top-0.5"/> <span className="truncate">{slot.notes}</span> </p> )} </div> <div className="flex items-center space-x-1 shrink-0 mt-2 sm:mt-0 self-end sm:self-center"> <Button variant="ghost" size="icon" onClick={onEdit} disabled={!canEditOrDelete} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full w-8 h-8" aria-label="Editar Disponibilidade" title={!canEditOrDelete ? "Não é possível editar uma disponibilidade reservada ou finalizada." : "Editar Disponibilidade"}><FilePenLine className="h-4 w-4"/></Button> <Button variant="ghost" size="icon" onClick={onDelete} disabled={!canEditOrDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full w-8 h-8" aria-label="Cancelar Disponibilidade" title={!canEditOrDelete ? "Não é possível apagar uma disponibilidade reservada ou finalizada." : "Apagar Disponibilidade"}> <Trash2 className="h-4 w-4"/> </Button> </div> </div> );
};

const TimeSlotFormDialog: React.FC<{ onFormSubmitted: () => void; initialData?: TimeSlot | null; }> = ({ onFormSubmitted, initialData }) => {
  const { toast } = useToast();
  const isEditing = !!initialData && !!initialData.id;
  const [dates, setDates] = useState<Date[]>(() => isEditing && initialData?.date ? [initialData.date.toDate()] : []);
  const [startTime, setStartTime] = useState(initialData?.startTime || "07:00");
  const [endTime, setEndTime] = useState(initialData?.endTime || "19:00");
  const [desiredRateInput, setDesiredRateInput] = useState<string>(String(initialData?.desiredHourlyRate || ""));
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(initialData?.specialties || []);
  const [selectedState, setSelectedState] = useState<string>(initialData?.state || "");
  const [selectedCity, setSelectedCity] = useState<string>(initialData?.city || "");
  const [selectedServiceType, setSelectedServiceType] = useState<string>(initialData?.serviceType || "");
  const [notes, setNotes] = useState<string>(initialData?.notes || "");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [specialtyPopoverOpen, setSpecialtyPopoverOpen] = useState(false);
  const [specialtySearchValue, setSpecialtySearchValue] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  useEffect(() => { if (initialData?.state) { setAvailableCities(citiesByState[initialData.state] || []); } }, [initialData?.state]);
  const resetFormFields = useCallback(() => { setDates([]); setStartTime("07:00"); setEndTime("19:00"); setDesiredRateInput(""); setSelectedSpecialties([]); setSelectedState(""); setSelectedCity(""); setSelectedServiceType(""); setNotes(""); setTimeError(null); }, []);
  const validateTimes = useCallback((start: string, end: string) => { if (start && end && start === end) { setTimeError("Horário de início não pode ser igual ao de término."); } else { setTimeError(null); } }, []);
  useEffect(() => { validateTimes(startTime, endTime); }, [startTime, endTime, validateTimes]);
  useEffect(() => { if (selectedState) { if (!initialData || selectedState !== initialData.state) { setAvailableCities(citiesByState[selectedState] || []); setSelectedCity(""); } else if (initialData && selectedState === initialData.state && !selectedCity) { if (citiesByState[selectedState]?.includes(initialData.city)) { setSelectedCity(initialData.city); } } } else { setAvailableCities([]); setSelectedCity(""); } }, [selectedState, initialData]);
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
    if (!selectedState || !selectedCity) { toast({ title: "Localização Obrigatória", variant: "destructive" }); return; }
    if (selectedSpecialties.length === 0) { toast({ title: "Especialidade Obrigatória", description: "Selecione ao menos uma especialidade.", variant: "destructive" }); return; }
    setIsLoadingSubmit(true);
    const currentUser = auth.currentUser;
    if (!currentUser) { toast({ title: "Usuário não autenticado", variant: "destructive" }); setIsLoadingSubmit(false); return; }
    const isOvernight = startTime > endTime;
    const finalNotes = notes.trim();
    try {
      if (isEditing && initialData?.id) {
        const payload: TimeSlotUpdatePayload = { startTime, endTime, isOvernight, state: selectedState, city: selectedCity, serviceType: selectedServiceType, specialties: selectedSpecialties, desiredHourlyRate, ...(finalNotes && { notes: finalNotes }), };
        await updateTimeSlot(initialData.id, payload);
        toast({ title: "Disponibilidade Atualizada", variant: "default" });
      } else {
        const creationPromises = dates.map(singleDate => {
          const slotTimestamp = Timestamp.fromDate(singleDate);
          const payload: TimeSlotFormPayload = { date: slotTimestamp, startTime, endTime, isOvernight, state: selectedState, city: selectedCity, serviceType: selectedServiceType, specialties: selectedSpecialties, desiredHourlyRate, ...(finalNotes && { notes: finalNotes }), };
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
  const modifiers = { selected: dates, }; const modifiersClassNames = { selected: 'day-selected-override' };
  return ( <DialogContent className="sm:max-w-2xl md:max-w-3xl"><DialogHeader><DialogTitle>{isEditing ? "Editar" : "Adicionar"} Disponibilidade</DialogTitle><DialogDescription>{isEditing ? "Altere os detalhes." : "Selecione as datas e preencha os detalhes."}</DialogDescription></DialogHeader><div className="grid gap-5 py-4 max-h-[70vh] overflow-y-auto px-1 pr-3 md:pr-4 custom-scrollbar">{/* ...conteúdo do formulário... */}</div><DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={isLoadingSubmit}>Cancelar</Button></DialogClose><Button type="button" onClick={handleSubmit} disabled={isLoadingSubmit || (dates.length === 0 && !isEditing)}>{isEditing ? "Salvar" : "Adicionar"}</Button></DialogFooter></DialogContent> );
};

export default function AvailabilityPage() {
  const { toast } = useToast();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingTimeSlot, setEditingTimeSlot] = useState<TimeSlot | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [fetchErrorList, setFetchErrorList] = useState<string | null>(null);
  const fetchDoctorTimeSlots = useCallback(async () => { setIsLoadingList(true); setFetchErrorList(null); try { const slots = await getTimeSlots(); setTimeSlots(slots.sort((a,b) => (a.date.toDate().getTime() - b.date.toDate().getTime()) || a.startTime.localeCompare(b.startTime) )); } catch (error: any) { setFetchErrorList(error.message || "Erro"); } finally { setIsLoadingList(false); } }, []);
  useEffect(() => { fetchDoctorTimeSlots(); }, [fetchDoctorTimeSlots]);
  const handleOpenAddDialog = () => { setEditingTimeSlot(null); setIsFormDialogOpen(true); };
  const handleOpenEditDialog = (slot: TimeSlot) => { setEditingTimeSlot(slot); setIsFormDialogOpen(true); };
  const onFormSubmitted = () => { setIsFormDialogOpen(false); setEditingTimeSlot(null); fetchDoctorTimeSlots(); };
  const handleDeleteTimeSlot = async (slotId: string | undefined) => { if (!slotId) return; if (confirm("Tem certeza?")) { try { await deleteTimeSlot(slotId); toast({ title: "Removido" }); fetchDoctorTimeSlots(); } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); } } };
  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl sm:text-3xl font-bold">Minha Disponibilidade</h1><p className="text-gray-600 text-sm sm:text-base mt-1">Cadastre seus horários.</p></div>
        <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { setIsFormDialogOpen(isOpen); if (!isOpen) setEditingTimeSlot(null); }}>
          <DialogTrigger asChild><Button size="sm" onClick={handleOpenAddDialog}><Plus className="mr-1.5 h-4 w-4" /> Adicionar</Button></DialogTrigger>
          <TimeSlotFormDialog key={editingTimeSlot ? `edit-${editingTimeSlot.id}` : 'new'} onFormSubmitted={onFormSubmitted} initialData={editingTimeSlot} />
        </Dialog>
      </div>
      <Card>
        <CardHeader><CardTitle>Disponibilidades Cadastradas</CardTitle><CardDescription>Seus horários para propostas.</CardDescription></CardHeader>
        <CardContent>
          {isLoadingList ? <LoadingState /> : fetchErrorList ? <ErrorState message={fetchErrorList} onRetry={fetchDoctorTimeSlots} /> : timeSlots.length === 0 ? <EmptyState message="Nenhuma disponibilidade cadastrada." actionButton={<Button size="sm" onClick={handleOpenAddDialog}>Cadastrar</Button>} /> : <div className="space-y-3"> {timeSlots.map(slot => ( <TimeSlotListItem key={slot.id} slot={slot} onEdit={() => handleOpenEditDialog(slot)} onDelete={() => handleDeleteTimeSlot(slot.id)} /> ))} </div> }
        </CardContent>
      </Card>
    </div>
  );
}