// app/hospital/doctors/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent, ReactNode, FC, SVGProps } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"; // Adicionado
import { Badge, type BadgeProps } from "@/components/ui/badge"; // Adicionado
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
    Users as UsersIconPageTitle, UserPlus, Edit3, Trash2, ExternalLink, Search, Loader2, AlertTriangle, ClipboardList, RotateCcw, InfoIcon 
} from "lucide-react"; // Adicionados ícones faltantes
import {
  getManagedDoctorsForHospital,
  addOrInviteDoctorToHospital,
  updateManagedDoctor,
  type HospitalManagedDoctor,
  type AddDoctorToHospitalPayload
} from "@/lib/hospital-shift-service";
import { cn } from "@/lib/utils";
import { medicalSpecialties } from "@/lib/availability-service";
import { auth } from "@/lib/firebase";

// --- COMPONENTES DE ESTADO ---
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex items-center justify-center py-10 text-sm text-gray-500"><Loader2 className="h-6 w-6 animate-spin mr-2"/>{message}</div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message, onActionClick, actionLabel }: { message: string; onActionClick?: () => void; actionLabel?: string; }) => ( <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded-lg"><ClipboardList className="mx-auto h-12 w-12 text-gray-400"/><h3 className="mt-2 text-sm font-semibold text-gray-900">{message}</h3>{onActionClick && actionLabel && (<Button onClick={onActionClick} size="sm" className="mt-4"><UserPlus className="mr-2 h-4 w-4"/>{actionLabel}</Button>)}</div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void; }) => ( <div className="text-center py-10 bg-red-50 p-4 rounded-md border border-red-200"><AlertTriangle className="mx-auto h-10 w-10 text-red-400"/><h3 className="mt-2 text-sm font-semibold text-red-700">{message}</h3>{onRetry && <Button variant="destructive" onClick={onRetry} size="sm" className="mt-3"><RotateCcw className="mr-2 h-4 w-4"/>Tentar Novamente</Button>}</div> ));
ErrorState.displayName = 'ErrorState';


interface DoctorListItemProps {
  doctor: HospitalManagedDoctor;
  onEdit: (doctor: HospitalManagedDoctor) => void;
}

const DoctorListItem: React.FC<DoctorListItemProps> = ({ doctor, onEdit }) => {
  const getStatusBadgeStyle = (status?: HospitalManagedDoctor['status']): { variant: BadgeProps["variant"], className?: string } => {
    switch (status) {
      case 'ACTIVE_PLATFORM': return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-300' };
      case 'ACTIVE_EXTERNAL': return { variant: 'secondary', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'INVITED': case 'PENDING_ASSOCIATION': return { variant: 'secondary', className: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'INACTIVE': return { variant: 'outline', className: 'bg-gray-200 text-gray-600' };
      default: return { variant: 'outline', className: '' };
    }
  };
  const statusBadgeInfo = getStatusBadgeStyle(doctor.status);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{doctor.name}</CardTitle>
          <Badge variant={statusBadgeInfo.variant} className={cn("capitalize text-xs px-2 py-0.5", statusBadgeInfo.className)}>
            {doctor.status.replace(/_/g, ' ').toLowerCase()}
          </Badge>
        </div>
        {doctor.crm && <CardDescription className="text-xs">CRM: {doctor.crm}</CardDescription>}
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        {doctor.specialties && doctor.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {doctor.specialties.map(spec => <Badge key={spec} variant="outline" className="text-xs font-normal">{spec}</Badge>)}
          </div>
        )}
        {doctor.email && <p className="text-xs text-gray-600">Email: {doctor.email}</p>}
        {doctor.phone && <p className="text-xs text-gray-600">Telefone: {doctor.phone}</p>}
        <p className="text-xs text-gray-500 pt-1">Origem: <span className={cn(doctor.source === 'PLATFORM' ? "font-medium text-blue-600" : "font-medium text-slate-600")}>{doctor.source === 'PLATFORM' ? 'Plataforma' : 'Externo'}</span></p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 border-t pt-3 pb-3 px-4">
        <Button variant="outline" size="sm" onClick={() => onEdit(doctor)} disabled={doctor.source === 'PLATFORM' && doctor.status === 'ACTIVE_PLATFORM'}>
            <Edit3 className="mr-2 h-4 w-4"/> {doctor.source === 'PLATFORM' && doctor.status === 'ACTIVE_PLATFORM' ? "Ver Detalhes" : "Editar"}
        </Button>
      </CardFooter>
    </Card>
  );
};
DoctorListItem.displayName = "DoctorListItem";

interface DoctorFormDialogProps {
  initialData?: HospitalManagedDoctor | null;
  onFormSubmitted: () => void;
}

const DoctorFormDialog: React.FC<DoctorFormDialogProps> = ({ initialData, onFormSubmitted }) => {
    const { toast } = useToast();
    const isEditing = !!initialData && !!initialData.id;
    
    const [name, setName] = useState(initialData?.name || "");
    const [crm, setCrm] = useState(initialData?.crm || "");
    const [email, setEmail] = useState(initialData?.email || "");
    const [phone, setPhone] = useState(initialData?.phone || "");
    const [specialtiesInput, setSpecialtiesInput] = useState(initialData?.specialties?.join(', ') || "");
    const [source, setSource] = useState<'PLATFORM' | 'EXTERNAL'>(initialData?.source || 'EXTERNAL');
    const [status, setStatus] = useState<HospitalManagedDoctor['status']>(() => {
        if (initialData) { return initialData.status; }
        return 'ACTIVE_EXTERNAL';
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const hospitalId = auth.currentUser?.uid;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hospitalId) { toast({ title: "Erro", description: "Hospital não identificado.", variant: "destructive"}); return; }
        if (!name.trim() || !crm?.trim()) { toast({ title: "Campos Obrigatórios", description: "Nome e CRM são obrigatórios.", variant: "destructive"}); return; }
        if (source === 'PLATFORM' && !isEditing && (!email || !/\S+@\S+\.\S+/.test(email))) { toast({ title: "Email Inválido", description: "Para convidar, um email válido é necessário.", variant: "destructive"}); return; }

        setIsSubmitting(true);
        const specialtiesArray = specialtiesInput.split(',').map(s => s.trim()).filter(s => s);

        try {
            if (isEditing && initialData) {
                 const updatePayload: Partial<HospitalManagedDoctor> = {
                    name: name.trim(), crm: crm.trim(),
                    email: email.trim() || undefined, phone: phone.trim() || undefined,
                    specialties: specialtiesArray,
                    status: status, 
                 };
                await updateManagedDoctor(hospitalId, initialData.id, updatePayload);
                toast({ title: "Médico Atualizado!", variant: "default" });
            } else {
                const addPayload: AddDoctorToHospitalPayload = {
                    name: name.trim(), crm: crm.trim(),
                    email: email.trim() || undefined, phone: phone.trim() || undefined,
                    specialties: specialtiesArray, source,
                };
                await addOrInviteDoctorToHospital(hospitalId, addPayload);
                toast({ title: source === 'PLATFORM' ? "Convite Enviado/Médico Associado!" : "Médico Externo Adicionado!", variant: "default" });
            }
            onFormSubmitted();
        } catch (error: any) {
            toast({ title: "Erro ao Salvar", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>{isEditing ? "Editar Médico" : (source === 'PLATFORM' ? "Convidar/Associar Médico da Plataforma" : "Cadastrar Médico Externo")}</DialogTitle>
                <DialogDescription>
                    {isEditing ? "Atualize os dados do médico." : (source === 'PLATFORM' ? "Insira o CRM ou Email para buscar e associar/convidar." : "Preencha os dados para adicionar um médico à sua gestão.")}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"> <Label htmlFor="form-source">Origem</Label>
                        <Select value={source} onValueChange={(v) => setSource(v as 'PLATFORM' | 'EXTERNAL')} disabled={isEditing}>
                            <SelectTrigger id="form-source"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="EXTERNAL">Externo (Cadastrar Manualmente)</SelectItem>
                                <SelectItem value="PLATFORM">Da Plataforma (Buscar/Convidar)</SelectItem>
                            </SelectContent>
                        </Select>
                         {isEditing && <p className="text-xs text-muted-foreground mt-1">Origem não pode ser alterada.</p>}
                    </div>
                     { (source === 'EXTERNAL' || (isEditing && initialData?.source === 'EXTERNAL')) && (
                        <div className="space-y-1.5"><Label htmlFor="form-statusExternal">Status</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as HospitalManagedDoctor['status'])}>
                                <SelectTrigger id="form-statusExternal"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE_EXTERNAL">Ativo</SelectItem>
                                    <SelectItem value="INACTIVE">Inativo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                     { (source === 'PLATFORM' || (isEditing && initialData?.source === 'PLATFORM')) && (
                        <div className="space-y-1.5"><Label htmlFor="form-statusPlatform">Status</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as HospitalManagedDoctor['status'])} disabled={status === 'ACTIVE_PLATFORM' && isEditing}>
                                <SelectTrigger id="form-statusPlatform"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE_PLATFORM" disabled>Ativo na Plataforma</SelectItem>
                                    <SelectItem value="INVITED">Convidado</SelectItem>
                                    <SelectItem value="PENDING_ASSOCIATION">Associação Pendente</SelectItem>
                                    <SelectItem value="INACTIVE">Inativo (na sua gestão)</SelectItem>
                                </SelectContent>
                            </Select>
                             {status === 'ACTIVE_PLATFORM' && isEditing && <p className="text-xs text-muted-foreground mt-1">Status "Ativo na Plataforma" é gerenciado pelo sistema.</p>}
                        </div>
                    )}
                </div>

                <div className="space-y-1.5"><Label htmlFor="form-name">Nome Completo*</Label><Input id="form-name" value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required /></div>
                <div className="space-y-1.5"><Label htmlFor="form-crm">CRM*</Label><Input id="form-crm" value={crm} onChange={(e: ChangeEvent<HTMLInputElement>) => setCrm(e.target.value)} required placeholder={source === 'PLATFORM' ? "CRM para busca na plataforma" : "CRM do médico"} /></div>
                <div className="space-y-1.5"><Label htmlFor="form-email">Email {source === 'PLATFORM' && !isEditing ? '(para convite/busca)*' : '(Opcional)'}</Label><Input id="form-email" type="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder={source === 'PLATFORM' && !isEditing ? "Email para busca/convite" : ""} /></div>
                <div className="space-y-1.5"><Label htmlFor="form-phone">Telefone (Opcional)</Label><Input id="form-phone" value={phone} onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="form-specialties">Especialidades (separadas por vírgula)</Label><Input id="form-specialties" value={specialtiesInput} onChange={(e: ChangeEvent<HTMLInputElement>) => setSpecialtiesInput(e.target.value)} /></div>
                
                <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Salvar Alterações" : (source === 'PLATFORM' ? "Buscar/Convidar" : "Adicionar Médico")}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};
DoctorFormDialog.displayName = "DoctorFormDialog";


export default function HospitalDoctorsPage() {
  const { toast } = useToast();
  const [doctors, setDoctors] = useState<HospitalManagedDoctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<HospitalManagedDoctor | null>(null);

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const data = await getManagedDoctorsForHospital();
      setDoctors(data);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar médicos.");
      toast({ title: "Erro ao Carregar Médicos", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const handleAddOrInviteDoctor = () => { setEditingDoctor(null); setIsFormOpen(true); };
  const handleEditDoctor = (doctor: HospitalManagedDoctor) => { setEditingDoctor(doctor); setIsFormOpen(true); };
  const onDoctorFormSubmitted = () => { setIsFormOpen(false); setEditingDoctor(null); fetchDoctors(); };

  const filteredDoctors = doctors.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.crm?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.specialties && doc.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
          <UsersIconPageTitle size={28} /> Gestão de Médicos
        </h1>
        <Dialog open={isFormOpen} onOpenChange={(isOpen: boolean) => { setIsFormOpen(isOpen); if (!isOpen) setEditingDoctor(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={handleAddOrInviteDoctor}>
              <UserPlus className="mr-2 h-4 w-4" /> Adicionar / Convidar Médico
            </Button>
          </DialogTrigger>
          <DoctorFormDialog key={editingDoctor ? editingDoctor.id : 'new'} initialData={editingDoctor} onFormSubmitted={onDoctorFormSubmitted} />
        </Dialog>
      </div>

      <div className="relative">
        <Input 
            type="search" 
            placeholder="Buscar médico por nome, CRM ou especialidade..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>

      {isLoading && <LoadingState message="Buscando médicos..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={fetchDoctors} />}
      {!isLoading && !error && filteredDoctors.length === 0 && (
        <EmptyState 
            message={searchTerm ? "Nenhum médico encontrado com sua busca." : "Nenhum médico cadastrado ou associado ainda."}
            actionLabel="Adicionar Primeiro Médico"
            onActionClick={handleAddOrInviteDoctor}
        />
      )}
      {!isLoading && !error && filteredDoctors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDoctors.map(doctor => (
            <DoctorListItem
              key={doctor.id}
              doctor={doctor}
              onEdit={handleEditDoctor}
            />
          ))}
        </div>
      )}
    </div>
  );
}