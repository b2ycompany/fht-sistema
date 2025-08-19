// app/hospital/shifts/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, ChangeEvent, ReactNode } from "react";
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { type SelectMultipleEventHandler, type Modifiers } from "react-day-picker";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CitySelector } from "@/components/ui/city-selector"; 

import { cn, formatCurrency, formatPercentage, formatHours } from "@/lib/utils";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp, orderBy,getCountFromServer } from "firebase/firestore";

import {
  addShiftRequirement,
  deleteShiftRequirement,
  updateShiftRequirement,
  type ShiftRequirement,
  type ShiftFormPayload,
  type ShiftUpdatePayload,
} from "@/lib/hospital-shift-service";
import { medicalSpecialties, ServiceTypeRates } from "@/lib/availability-service";

import {
  Plus, Loader2, Users, DollarSign, Briefcase, ClipboardList, Info, Trash2, CheckCircle, History, X, CalendarDays, TrendingUp, WalletCards, MapPin, Target, Clock, Hourglass, RotateCcw, FilePenLine,
  AlertCircle, Eye, XCircle, Check, ChevronsUpDown
} from "lucide-react";
import { KPICard } from "@/components/hospital/KPICard";

type ButtonVariant = VariantProps<typeof Button>["variant"];
const timeOptions = Array.from({ length: 48 }, (_, i) => { const h = Math.floor(i/2); const m = i%2 === 0 ? "00" : "30"; return `${h.toString().padStart(2,"0")}:${m}`; });
const brazilianStates = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO" ];
const citiesByState: { [key: string]: string[] } = {
  "SP": ["São Paulo", "Campinas", "Guarulhos", "Osasco", "Santo André", "São Bernardo do Campo", "Santos", "Ribeirão Preto", "Sorocaba", "Jundiaí", "Piracicaba", "Bauru", "Franca", "Taubaté", "Limeira", "Barueri", "Cotia", "Itapevi", "Araçariguama"],
  "RJ": ["Rio de Janeiro", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Niterói", "Belford Roxo", "Campos dos Goytacazes", "São João de Meriti", "Petrópolis", "Volta Redonda"],
  "MG": ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Montes Claros", "Ribeirão das Neves", "Uberaba", "Governador Valadares", "Ipatinga"],
};
const serviceTypesOptions = Object.entries(ServiceTypeRates).map(([v, r]) => ({ value: v, label: v.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '), rateExample: r }));

const LoadingState = React.memo(({ message = "Carregando dados..." }: { message?: string }) => ( <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <span className="ml-3 text-sm text-gray-600 mt-3">{message}</span> </div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message, actionButton }: { message: string; actionButton?: React.ReactNode }) => ( <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full"> <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/> <p className="font-medium text-gray-600 mb-1">Nada por aqui ainda!</p> <p className="max-w-xs">{message}</p> {actionButton && <div className="mt-4">{actionButton}</div>} </div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => ( <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full"> <AlertCircle className="w-12 h-12 text-red-400 mb-4"/> <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p> <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados."}</p> {onRetry && ( <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4"> <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente </Button> )} </div> ));
ErrorState.displayName = 'ErrorState';

// --- DIÁLOGO (sem alterações) ---
interface AddShiftDialogProps { onShiftSubmitted: () => void; initialData?: ShiftRequirement | null; }
const AddShiftDialog: React.FC<AddShiftDialogProps> = ({ onShiftSubmitted, initialData }) => {
  const { toast } = useToast();
  const isEditing = !!initialData && !!initialData.id;
  const [dates, setDates] = useState<Date[]>(() => initialData?.dates?.map(ts => ts.toDate()) || []);
  const [startTime, setStartTime] = useState(initialData?.startTime || "07:00");
  const [endTime, setEndTime] = useState(initialData?.endTime || "19:00");
  const [numberOfVacancies, setNumberOfVacancies] = useState<string>(String(initialData?.numberOfVacancies || "1"));
  const [requiredSpecialties, setRequiredSpecialties] = useState<string[]>(initialData?.specialtiesRequired || []);
  const [selectedState, setSelectedState] = useState<string>(initialData?.state || "");
  const [selectedCities, setSelectedCities] = useState<string[]>(initialData?.cities || []);
  const [selectedServiceType, setSelectedServiceType] = useState<string>(initialData?.serviceType || "");
  const [offeredRateInput, setOfferedRateInput] = useState<string>(String(initialData?.offeredRate || ""));
  const [notes, setNotes] = useState<string>(initialData?.notes || "");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [specialtyPopoverOpen, setSpecialtyPopoverOpen] = useState(false);
  const [specialtySearchValue, setSpecialtySearchValue] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const modifiers = { selected: dates };
  const modifiersStyles = { selected: { backgroundColor: '#2563eb', color: 'white', borderRadius: '0.375rem', }, };
  const applyQuickTime = (start: string, end: string) => { setStartTime(start); setEndTime(end); };
  const resetFormFields = useCallback(() => { setDates([]); setStartTime("07:00"); setEndTime("19:00"); setNumberOfVacancies("1"); setRequiredSpecialties([]); setSpecialtySearchValue(""); setTimeError(null); setSelectedState(""); setSelectedCities([]); setAvailableCities([]); setSelectedServiceType(""); setOfferedRateInput(""); setNotes(""); }, []);
  const validateTimes = useCallback((start: string, end: string) => { if (start && end && start === end ) { setTimeError("Início não pode ser igual ao término."); } else { setTimeError(null); } }, []);
  useEffect(() => { validateTimes(startTime, endTime); }, [startTime, endTime, validateTimes]);
  useEffect(() => { if (selectedState) { setAvailableCities(citiesByState[selectedState] || []); if (!initialData || selectedState !== initialData.state) { setSelectedCities([]); } } else { setAvailableCities([]); setSelectedCities([]); } }, [selectedState, initialData]);
  const handleSelectRequiredSpecialty = (specialty: string) => { if (!requiredSpecialties.includes(specialty)) setRequiredSpecialties((prev: string[]) => [...prev, specialty]); setSpecialtySearchValue(""); setSpecialtyPopoverOpen(false); };
  const handleRemoveRequiredSpecialty = (specialtyToRemove: string) => { setRequiredSpecialties((prev: string[]) => prev.filter((s: string) => s !== specialtyToRemove)); };
  const filteredSpecialties = useMemo(() => medicalSpecialties.filter(s => typeof s === 'string' && s.toLowerCase().includes(specialtySearchValue.toLowerCase()) && !requiredSpecialties.includes(s)), [specialtySearchValue, requiredSpecialties]);
  const handleSubmitForm = async () => { const offeredRate = parseFloat(offeredRateInput.replace(',', '.')); const numVacancies = parseInt(numberOfVacancies, 10); if (dates.length === 0 && !isEditing) { toast({title:"Datas são obrigatórias", variant: "destructive"}); return; } if (timeError) { toast({title:"Horário Inválido", variant: "destructive"}); return; } if (!selectedServiceType) { toast({title:"Tipo de Atendimento Obrigatório", variant: "destructive"}); return; } if (isNaN(offeredRate) || offeredRate <= 0) { toast({title:"Valor Hora Inválido", variant: "destructive"}); return; } if (isNaN(numVacancies) || numVacancies <= 0) { toast({title:"Nº de Profissionais Inválido", variant: "destructive"}); return; } if (!selectedState || selectedCities.length === 0) { toast({title:"Localização Obrigatória", description: "Selecione o estado e pelo menos uma cidade.", variant: "destructive"}); return; } setIsLoadingSubmit(true); const currentUser = auth.currentUser; if (!currentUser) { toast({ title: "Usuário não autenticado", variant: "destructive"}); setIsLoadingSubmit(false); return; } const isOvernightShift = startTime > endTime; const finalNotes = notes.trim(); try { if (isEditing && initialData?.id) { const updatePayload: ShiftUpdatePayload = { startTime, endTime, isOvernight: isOvernightShift, state: selectedState, cities: selectedCities, serviceType: selectedServiceType, specialtiesRequired: requiredSpecialties, offeredRate, numberOfVacancies: numVacancies, ...(finalNotes ? { notes: finalNotes } : { notes: "" }), }; await updateShiftRequirement(initialData.id, updatePayload); toast({ title: "Demanda Atualizada!", variant: "default" }); } else { const dateTimestamps: Timestamp[] = dates.map(date => Timestamp.fromDate(date)); const createPayload: ShiftFormPayload = { publishedByUID: currentUser.uid, dates: dateTimestamps, startTime, endTime, isOvernight: isOvernightShift, state: selectedState, cities: selectedCities, serviceType: selectedServiceType, specialtiesRequired: requiredSpecialties, offeredRate, numberOfVacancies: numVacancies, ...(finalNotes && { notes: finalNotes }), }; await addShiftRequirement(createPayload); toast({ title: "Demanda Publicada!", variant: "default" }); if(!isEditing) resetFormFields(); } onShiftSubmitted(); } catch (err:any) { toast({ title: `Erro ao ${isEditing ? 'Salvar' : 'Publicar'}`, description: err.message, variant: "destructive"}); } finally { setIsLoadingSubmit(false); } };
  return ( <DialogContent className="sm:max-w-2xl md:max-w-3xl"> <DialogHeader><DialogTitle className="text-xl">{isEditing ? "Editar Demanda" : "Publicar Nova Demanda"}</DialogTitle><DialogDescription>{isEditing ? "Altere os detalhes. Datas não são editáveis." : "Defina os critérios. Uma demanda será criada para cada data selecionada."}</DialogDescription></DialogHeader><DialogClose asChild><Button variant="ghost" size="icon" className="absolute top-4 right-4"><X className="h-4 w-4" /><span className="sr-only">Fechar</span></Button></DialogClose><div className="grid gap-5 py-4 max-h-[70vh] overflow-y-auto px-1 pr-3 md:pr-4"><div className="space-y-2"><Label className="font-semibold text-gray-800 flex items-center"><CalendarDays/>Data(s)*</Label><p className="text-xs text-gray-500">{isEditing ? "Original (não editável)." : "Selecione."}</p><div className="flex flex-col sm:flex-row gap-2 items-start">{isEditing ? ( <Calendar mode="single" selected={dates[0]} disabled footer={ dates[0] ? <p>{dates[0]?.toLocaleDateString('pt-BR')}</p> : null} /> ) : ( <Calendar mode="multiple" selected={dates} onSelect={setDates as SelectMultipleEventHandler} disabled={{ before: new Date(new Date().setHours(0,0,0,0))}} footer={ dates.length > 0 ? <p>{dates.length} dia(s)</p> : <p>Nenhum dia</p>} modifiers={modifiers} modifiersStyles={modifiersStyles}/> )}{dates.length > 0 && !isEditing && <Button variant="outline" size="sm" onClick={() => setDates([])}><X/> Limpar</Button>}</div></div><div className="space-y-2"><Label className="font-semibold text-gray-800 flex items-center"><Clock/>Horário*</Label><div className="flex flex-wrap gap-2 mb-3"><Button variant="outline" size="sm" onClick={() => applyQuickTime("07:00", "19:00")}>Diurno</Button><Button variant="outline" size="sm" onClick={() => applyQuickTime("19:00", "07:00")}>Noturno</Button><Button variant="outline" size="sm" onClick={() => applyQuickTime("08:00", "12:00")}>Manhã</Button><Button variant="outline" size="sm" onClick={() => applyQuickTime("13:00", "18:00")}>Tarde</Button><Button variant="outline" size="sm" onClick={() => applyQuickTime("00:00", "23:30")}>24h</Button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label htmlFor="sTime">Início*</Label><Select value={startTime} onValueChange={setStartTime}><SelectTrigger id="sTime" className={cn(timeError && "border-red-500")}><SelectValue/></SelectTrigger><SelectContent>{timeOptions.map(t=><SelectItem key={"s"+t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="eTime">Término*</Label><Select value={endTime} onValueChange={setEndTime}><SelectTrigger id="eTime" className={cn(timeError && "border-red-500")}><SelectValue/></SelectTrigger><SelectContent>{timeOptions.map(t=><SelectItem key={"e"+t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>{timeError && <p className="text-red-600 col-span-2">{timeError}</p>}</div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label htmlFor="state-m" className="font-semibold text-gray-800 flex items-center"><MapPin/>Estado*</Label><Select value={selectedState} onValueChange={setSelectedState}><SelectTrigger id="state-m"><SelectValue placeholder="UF..."/></SelectTrigger><SelectContent>{brazilianStates.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="city-m" className="font-semibold text-gray-800">Cidades*</Label><CitySelector selectedState={selectedState} availableCities={availableCities} selectedCities={selectedCities} onConfirm={setSelectedCities} /></div></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"><div><Label htmlFor="serv-type-m" className="font-semibold text-gray-800 flex items-center"><Briefcase/>Tipo*</Label><Select value={selectedServiceType} onValueChange={setSelectedServiceType}><SelectTrigger id="serv-type-m"><SelectValue placeholder="Selecione..."/></SelectTrigger><SelectContent>{serviceTypesOptions.map(o=><SelectItem key={o.value} value={o.value}>{o.label} <span className="text-xs text-gray-500">({formatCurrency(o.rateExample)}/h)</span></SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="rate-m" className="font-semibold text-gray-800 flex items-center"><DollarSign/>Valor/Hora (R$)*</Label><Input id="rate-m" type="number" min="1" step="any" placeholder="150.00" value={offeredRateInput} onChange={e=>setOfferedRateInput(e.target.value)}/></div><div><Label htmlFor="vac-m" className="font-semibold text-gray-800 flex items-center"><Users/>Profissionais*</Label><Input id="vac-m" type="number" min="1" step="1" placeholder="1" value={numberOfVacancies} onChange={e=>setNumberOfVacancies(e.target.value)}/></div></div><div className="space-y-2"><Label className="font-semibold text-gray-800 flex items-center"><ClipboardList/>Especialidades (Opcional)</Label><Popover open={specialtyPopoverOpen} onOpenChange={setSpecialtyPopoverOpen}><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start font-normal h-9">{requiredSpecialties.length?requiredSpecialties.join(', '):"Selecione..."}</Button></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput value={specialtySearchValue} onValueChange={setSpecialtySearchValue}/><CommandList><CommandEmpty>Nenhuma.</CommandEmpty><CommandGroup>{filteredSpecialties.map(s=>(<CommandItem key={s} value={s} onSelect={()=>handleSelectRequiredSpecialty(s)}>{s}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover>{requiredSpecialties.length > 0 && ( <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t">{requiredSpecialties.map((s: string)=>(<Badge key={s} variant="secondary">{s}<button type="button" onClick={()=>handleRemoveRequiredSpecialty(s)} className="ml-1.5"><X className="h-3 w-3"/></button></Badge>))}</div> )}</div><div className="space-y-1.5"><Label htmlFor="notes-m" className="font-semibold text-gray-800 flex items-center"><Info/>Notas (Opcional)</Label><Textarea id="notes-m" placeholder="Detalhes adicionais..." value={notes} onChange={e=>setNotes(e.target.value)}/></div></div><DialogFooter className="mt-2 pt-4 border-t bg-slate-50 -m-6 px-6 pb-4 rounded-b-lg"><DialogClose asChild><Button type="button" variant="outline" disabled={isLoadingSubmit}>Cancelar</Button></DialogClose><Button type="button" onClick={handleSubmitForm} disabled={isLoadingSubmit || (dates.length === 0 && !isEditing)} className="bg-blue-600 hover:bg-blue-700">{isLoadingSubmit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isLoadingSubmit ? (isEditing ? "Salvando..." : "Publicando...") : (isEditing ? "Salvar Alterações" : `Publicar Demanda (${dates.length||0} Dia(s))`)}</Button></DialogFooter></DialogContent> );
};
AddShiftDialog.displayName = 'AddShiftDialog';

// --- LIST ITEM (sem alterações) ---
interface ShiftListItemProps { shift: ShiftRequirement; actions?: { label: string; icon: React.ElementType; onClick: () => void; variant?: ButtonVariant; className?: string; disabled?: boolean }[]; }
const ShiftListItem: React.FC<ShiftListItemProps> = React.memo(({ shift, actions }) => {
  const serviceTypeObj = serviceTypesOptions.find(opt => opt.value === shift.serviceType);
  const serviceTypeLabel = serviceTypeObj?.label || shift.serviceType;
  const getDisplayDate = () => { if (!shift.dates || shift.dates.length === 0) return "Datas não especificadas"; const firstDateObj = shift.dates[0] instanceof Timestamp ? shift.dates[0].toDate() : null; let displayStr = firstDateObj ? firstDateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Data inválida"; if (shift.dates.length > 1) { displayStr += ` (e +${shift.dates.length - 1} outro(s) dia(s))`; } return displayStr; };
  const statusLabel = (status?: string): string => { return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Desconhecido'; };
  const getStatusBadgeProps = (status?: ShiftRequirement['status']): { variant: BadgeProps["variant"], className: string } => { switch (status) { case 'OPEN': return { variant: 'default', className: 'bg-blue-100 text-blue-800 border-blue-300' }; case 'FULLY_STAFFED': case 'CONFIRMED': case 'ACTIVE_SIGNED':  case 'COMPLETED': case 'IN_PROGRESS': return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-300' }; case 'PARTIALLY_FILLED': return { variant: 'default', className: 'bg-sky-100 text-sky-800 border-sky-300' }; case 'PENDING_MATCH_REVIEW': case 'PENDING_DOCTOR_ACCEPTANCE': case 'PENDING_HOSPITAL_SIGNATURE': case 'PENDING_CONTRACT_SIGNATURES': return { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' }; case 'CANCELLED_BY_HOSPITAL': case 'EXPIRED': return { variant: 'destructive', className: '' }; default: return { variant: 'outline', className: 'bg-gray-100 text-gray-800 border-gray-300' }; } };
  const statusBadgeInfo = getStatusBadgeProps(shift.status);
  return ( <div className={cn("flex flex-col sm:flex-row items-start sm:justify-between border rounded-lg p-4 gap-x-4 gap-y-3 transition-all duration-300 bg-white shadow-xs hover:shadow-md")}> <div className="flex-1 space-y-2 min-w-0"> <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"> <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"> <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" /> <span suppressHydrationWarning>{getDisplayDate()}</span> <span className="text-gray-500 font-normal">({shift.startTime} - {shift.endTime})</span> </div> <Badge variant={statusBadgeInfo.variant} className={cn("text-xs capitalize self-start sm:self-center", statusBadgeInfo.className)}> {statusLabel(shift.status)} </Badge> </div> <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600 mt-1 pl-1"> <div className="flex items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5 shrink-0 text-purple-500" /><span>{shift.cities.join(', ')}, {shift.state}</span></div> <div className="flex items-center gap-1.5 truncate"><Briefcase className="h-3.5 w-3.5 shrink-0 text-cyan-500" /><span>{serviceTypeLabel}</span></div> <div className="flex items-center gap-1.5 text-green-600 font-medium"><DollarSign className="h-3.5 w-3.5 shrink-0" /><span>{formatCurrency(shift.offeredRate)}/hora</span></div> <div className="flex items-center gap-1.5 text-gray-700 font-medium"><Users className="h-3.5 w-3.5 shrink-0" /><span>{shift.numberOfVacancies ?? 1} profissional(is) por data</span></div> </div> {shift.specialtiesRequired && shift.specialtiesRequired.length > 0 && ( <div className="flex flex-wrap items-center gap-1.5 pt-1.5 pl-1"> <span className="text-xs text-gray-500 mr-1 font-medium shrink-0">Especialidades:</span> {shift.specialtiesRequired.map((s: string) => (<Badge key={s} variant="outline" className="text-gray-700 text-[11px] px-1.5 py-0.5 font-normal border-blue-200 bg-blue-50">{s}</Badge>))} </div> )} {shift.notes && ( <p className="text-xs text-gray-500 pt-1.5 pl-1 italic flex items-start gap-1.5"> <Info className="inline h-3.5 w-3.5 mr-0.5 shrink-0 relative top-0.5"/> <span className="truncate">{shift.notes}</span> </p> )} </div> {actions && actions.length > 0 && ( <div className="flex items-center space-x-1 shrink-0 mt-2 sm:mt-0 self-end sm:self-center"> {actions.map((action: any) => ( <Button key={action.label} variant={action.variant ?? "ghost"} size="icon" onClick={action.onClick} className={cn("h-8 w-8 p-0", action.className)} aria-label={action.label} disabled={action.disabled} title={action.disabled ? "Esta vaga não pode ser alterada." : action.label}> <action.icon className="h-4 w-4"/> </Button> ))} </div> )} </div> );
});
ShiftListItem.displayName = 'ShiftListItem';


// --- COMPONENTE PRINCIPAL DA PÁGINA (COM LÓGICA DE KPI) ---
export default function HospitalShiftsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [openShifts, setOpenShifts] = useState<ShiftRequirement[]>([]);
  const [pendingShifts, setPendingShifts] = useState<ShiftRequirement[]>([]);
  const [confirmedShifts, setConfirmedShifts] = useState<ShiftRequirement[]>([]);
  const [historyShifts, setHistoryShifts] = useState<ShiftRequirement[]>([]);
  
  const [doctorCount, setDoctorCount] = useState<number>(0);
  const [isDoctorCountLoading, setIsDoctorCountLoading] = useState(true);

  type ListStateType = { isLoading: boolean; error: string | null };
  const initialListState: ListStateType = { isLoading: true, error: null };
  const [listStates, setListStates] = useState({
      open: { ...initialListState },
      pending: { ...initialListState },
      confirmed: { ...initialListState },
      history: { ...initialListState },
  });
  const [isAddShiftDialogOpen, setIsAddShiftDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("open");
  const [editingShift, setEditingShift] = useState<ShiftRequirement | null>(null);

  const updateListState = (list: keyof typeof listStates, state: Partial<ListStateType>) => {
      setListStates((prev) => ({ ...prev, [list]: { ...prev[list], ...state } }));
  };

  const fetchShiftsByStatus = useCallback(async (
      status: string | string[],
      setter: React.Dispatch<React.SetStateAction<ShiftRequirement[]>>,
      stateKey: keyof typeof listStates
  ) => {
      updateListState(stateKey, { isLoading: true, error: null });
      const currentUser = auth.currentUser;
      if (!currentUser) { updateListState(stateKey, { isLoading: false, error: "Usuário não autenticado." }); return; }

      try {
          const requirementsRef = collection(db, "shiftRequirements");
          const statusClause = Array.isArray(status) ? where("status", "in", status) : where("status", "==", status);
          const q = query( requirementsRef, where("hospitalId", "==", currentUser.uid), statusClause, orderBy("dates", "asc") );

          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ShiftRequirement));
          setter(data);
          updateListState(stateKey, { isLoading: false });
      } catch (error: any) {
          updateListState(stateKey, { isLoading: false, error: error.message || `Erro ao carregar demandas ${stateKey}.` });
      }
  }, []);
  
  const loadAllInitialData = useCallback(() => {
    fetchShiftsByStatus('OPEN', setOpenShifts, 'open');
    fetchShiftsByStatus(['PENDING_MATCH_REVIEW', 'PENDING_DOCTOR_ACCEPTANCE'], setPendingShifts, 'pending');
    fetchShiftsByStatus('CONFIRMED', setConfirmedShifts, 'confirmed');
    fetchShiftsByStatus(['COMPLETED', 'CANCELLED_BY_HOSPITAL', 'EXPIRED'], setHistoryShifts, 'history');
    
    const fetchDoctorCount = async () => {
        try {
            setIsDoctorCountLoading(true);
            const q = query(collection(db, "users"), where("userType", "==", "doctor"));
            const snapshot = await getCountFromServer(q);
            setDoctorCount(snapshot.data().count);
        } catch (error) {
            console.error("Erro ao buscar contagem de médicos:", error);
            setDoctorCount(0); // fallback
        } finally {
            setIsDoctorCountLoading(false);
        }
    };
    fetchDoctorCount();
  }, [fetchShiftsByStatus]);

  useEffect(() => { loadAllInitialData(); }, [loadAllInitialData]);

  const handleTabChange = (value: string) => { setActiveTab(value); };
  
  const handleOpenEditDialog = (shift: ShiftRequirement) => { setEditingShift(shift); setIsAddShiftDialogOpen(true); };
  const handleOpenAddDialog = () => { setEditingShift(null); setIsAddShiftDialogOpen(true); };
  const handleCancelShift = async (shiftId: string | undefined) => { if (!shiftId) return; try { await deleteShiftRequirement(shiftId); toast({ title: "Demanda Cancelada" }); loadAllInitialData(); } catch (error: any) { toast({ title: "Erro ao Cancelar", description: error.message, variant: "destructive"}); } };
  const onShiftSubmitted = () => { setIsAddShiftDialogOpen(false); setEditingShift(null); setActiveTab("open"); loadAllInitialData(); };

  // --- LÓGICA DE CÁLCULO PARA OS KPIs (COM A CORREÇÃO) ---
  const allShifts = useMemo(() => [...openShifts, ...pendingShifts, ...confirmedShifts, ...historyShifts], [openShifts, pendingShifts, confirmedShifts, historyShifts]);

  const kpiValues = useMemo(() => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
      const recentShifts = allShifts.filter(shift => shift.createdAt && shift.createdAt.toDate() > thirtyDaysAgo);

      const filledStatuses: ShiftRequirement['status'][] = ['FULLY_STAFFED', 'CONFIRMED', 'ACTIVE_SIGNED', 'COMPLETED', 'IN_PROGRESS'];
      const filledCount = recentShifts.filter(s => s.status && filledStatuses.includes(s.status)).length;
      const fillRate = recentShifts.length > 0 ? filledCount / recentShifts.length : 0;

      const shiftsForCost = [...confirmedShifts, ...historyShifts.filter(s => s.status === 'COMPLETED')];
      let totalCost = 0;
      shiftsForCost.forEach(shift => {
          const shiftDate = shift.dates[0]?.toDate();
          if (shiftDate > thirtyDaysAgo) {
            const [startH, startM] = shift.startTime.split(':').map(Number);
            const [endH, endM] = shift.endTime.split(':').map(Number);
            let duration = (endH + endM/60) - (startH + startM/60);
            if (shift.isOvernight || duration < 0) { duration += 24; }
            totalCost += duration * shift.offeredRate * (shift.numberOfVacancies || 1) * shift.dates.length;
          }
      });
      
      const filledShiftsWithTimestamps = recentShifts.filter(s => filledStatuses.includes(s.status!) && s.createdAt && s.updatedAt);
      let totalFillTime = 0;
      if (filledShiftsWithTimestamps.length > 0) {
        totalFillTime = filledShiftsWithTimestamps.reduce((acc, shift) => {
            const diff = shift.updatedAt!.toDate().getTime() - shift.createdAt!.toDate().getTime();
            return acc + diff;
        }, 0);
        const avgFillTimeInMillis = totalFillTime / filledShiftsWithTimestamps.length;
        totalFillTime = avgFillTimeInMillis / (1000 * 60 * 60);
      }
      
      const specialtyCounts: { [key: string]: number } = {};
      allShifts.forEach(shift => {
          shift.specialtiesRequired?.forEach(spec => {
              specialtyCounts[spec] = (specialtyCounts[spec] || 0) + 1;
          });
      });
      const topSpecialty = Object.keys(specialtyCounts).length > 0 
          ? Object.keys(specialtyCounts).reduce((a, b) => specialtyCounts[a] > specialtyCounts[b] ? a : b)
          : 'N/A';

      return {
          fillRate,
          totalCost,
          avgFillTimeInHours: totalFillTime,
          topSpecialty
      };
  }, [allShifts, confirmedShifts, historyShifts]);

  return (
      <div className="flex flex-col gap-6 md:gap-8 p-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Painel de Gerenciamento de Plantões</h1>
          
          <section aria-labelledby="kpi-heading"> <h2 id="kpi-heading" className="sr-only">Visão Geral</h2> <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            <KPICard title="Demandas Abertas" value={openShifts.length} icon={AlertCircle} isLoading={listStates.open.isLoading} description="Aguardando médicos" />
            <KPICard title="Pendentes Ação" value={pendingShifts.length} icon={Hourglass} isLoading={listStates.pending.isLoading} description="Matches/contratos" />
            <KPICard title="Taxa Preenchim. (30d)" value={formatPercentage(kpiValues.fillRate)} icon={Target} isLoading={listStates.history.isLoading} description="Eficiência" />
            <KPICard title="Custo Estimado (30d)" value={formatCurrency(kpiValues.totalCost)} icon={WalletCards} isLoading={listStates.history.isLoading || listStates.confirmed.isLoading} description="Gasto com plantões" />
            <KPICard title="Tempo Médio Preench." value={formatHours(kpiValues.avgFillTimeInHours)} icon={Clock} isLoading={listStates.history.isLoading} description="Agilidade (horas)" />
            <KPICard title="Médicos na Plataforma" value={doctorCount} icon={Users} isLoading={isDoctorCountLoading} description="Total cadastrados" />
            <KPICard title="Top Demanda (Espec.)" value={kpiValues.topSpecialty} icon={TrendingUp} isLoading={listStates.open.isLoading} description="Mais requisitada" />
          </div> </section>

          <section aria-labelledby="shifts-management-heading">
              <h2 id="shifts-management-heading" className="text-xl font-semibold mb-4 mt-4 text-gray-700">Gerenciamento Detalhado de Demandas</h2>
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 border-b pb-3">
                      <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 sm:w-auto shrink-0">
                          <TabsTrigger value="open">Abertas {listStates.open.isLoading ? <Loader2 className="h-3 w-3 animate-spin ml-1.5"/> : `(${openShifts.length})`}</TabsTrigger>
                          <TabsTrigger value="pending">Pendentes {listStates.pending.isLoading ? <Loader2 className="h-3 w-3 animate-spin ml-1.5"/> : `(${pendingShifts.length})`}</TabsTrigger>
                          <TabsTrigger value="confirmed">Confirmados {listStates.confirmed.isLoading ? <Loader2 className="h-3 w-3 animate-spin ml-1.5"/> : `(${confirmedShifts.length})`}</TabsTrigger>
                          <TabsTrigger value="history">Histórico {listStates.history.isLoading ? <Loader2 className="h-3 w-3 animate-spin ml-1.5"/> : `(${historyShifts.length})`}</TabsTrigger>
                      </TabsList>
                      <Dialog open={isAddShiftDialogOpen} onOpenChange={(isOpen: boolean) => { setIsAddShiftDialogOpen(isOpen); if (!isOpen) setEditingShift(null); }}>
                          <DialogTrigger onClick={handleOpenAddDialog} className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white flex items-center" )} >
                              <Plus className="mr-1.5 h-4 w-4" /> Publicar Nova Demanda
                          </DialogTrigger>
                          <AddShiftDialog key={editingShift ? `edit-${editingShift.id}` : 'new-shift'} onShiftSubmitted={onShiftSubmitted} initialData={editingShift} />
                      </Dialog>
                  </div>
                  
                  <TabsContent value="open"> <Card> <CardHeader><CardTitle>Demandas em Aberto</CardTitle></CardHeader> <CardContent> {listStates.open.isLoading ? <LoadingState /> : listStates.open.error ? <ErrorState message={listStates.open.error} onRetry={() => fetchShiftsByStatus('OPEN', setOpenShifts, 'open')}/> : openShifts.length === 0 ? <EmptyState message="Nenhuma demanda aberta." actionButton={<Button size="sm" onClick={handleOpenAddDialog} className="bg-blue-600 hover:bg-blue-700">Publicar Demanda</Button>} /> : <div className="space-y-3">{openShifts.map((req: ShiftRequirement) => (<ShiftListItem key={req.id} shift={req} actions={[{ label: "Editar", icon: FilePenLine, onClick: () => handleOpenEditDialog(req), disabled: req.status !== 'OPEN' },{ label: "Cancelar", icon: Trash2, onClick: () => handleCancelShift(req.id), disabled: req.status !== 'OPEN' }]}/>))}</div> } </CardContent> </Card> </TabsContent>
                  <TabsContent value="pending"> <Card> <CardHeader><CardTitle>Demandas Pendentes</CardTitle></CardHeader> <CardContent> {listStates.pending.isLoading ? <LoadingState /> : listStates.pending.error ? <ErrorState message={listStates.pending.error} onRetry={() => fetchShiftsByStatus(['PENDING_MATCH_REVIEW'], setPendingShifts, 'pending')}/> : pendingShifts.length === 0 ? <EmptyState message="Nenhuma demanda com pendências." /> : <div className="space-y-3">{pendingShifts.map((req: ShiftRequirement) => (<ShiftListItem key={req.id} shift={req} actions={[{ label: "Ver", icon: Eye, onClick: () => {} }]}/>))}</div> } </CardContent> </Card> </TabsContent>
                  <TabsContent value="confirmed"> <Card> <CardHeader><CardTitle>Demandas Confirmadas</CardTitle></CardHeader> <CardContent> {listStates.confirmed.isLoading ? <LoadingState /> : listStates.confirmed.error ? <ErrorState message={listStates.confirmed.error} onRetry={() => fetchShiftsByStatus('CONFIRMED', setConfirmedShifts, 'confirmed')}/> : confirmedShifts.length === 0 ? <EmptyState message="Nenhuma demanda confirmada." /> : <div className="space-y-3">{confirmedShifts.map((req: ShiftRequirement) => (<ShiftListItem key={req.id} shift={req} actions={[{ label: "Ir para Agenda", icon: CalendarDays, onClick: () => router.push('/hospital/schedule'), className: "bg-blue-100 text-blue-700 hover:bg-blue-200" }]}/>))}</div> } </CardContent> </Card> </TabsContent>
                  <TabsContent value="history"> <Card> <CardHeader><CardTitle>Histórico de Demandas</CardTitle></CardHeader> <CardContent> {listStates.history.isLoading ? <LoadingState /> : listStates.history.error ? <ErrorState message={listStates.history.error} onRetry={() => fetchShiftsByStatus(['COMPLETED'], setHistoryShifts, 'history')}/> : historyShifts.length === 0 ? <EmptyState message="Nenhum histórico." /> : <div className="space-y-3">{historyShifts.map((req: ShiftRequirement) => (<ShiftListItem key={req.id} shift={req} />))}</div> } </CardContent> </Card> </TabsContent>
              </Tabs>
          </section>
      </div>
  );
}