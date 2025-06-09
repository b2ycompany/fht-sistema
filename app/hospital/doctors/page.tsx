// app/hospital/doctors/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent, ReactNode, FC, SVGProps } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
    Users as UsersIconPageTitle, UserPlus, Edit3, Trash2, Search, Loader2, AlertTriangle, ClipboardList, RotateCcw
} from "lucide-react";
import {
  getManagedDoctorsForHospital,
  addOrInviteDoctorToHospital,
  updateManagedDoctor,
  type HospitalManagedDoctor,
  type AddDoctorToHospitalPayload
} from "@/lib/hospital-shift-service";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";

// --- COMPONENTES DE ESTADO ---
const LoadingState = React.memo(({ message = "Carregando..." }: { message?: string }) => ( <div className="flex items-center justify-center py-10 text-sm text-gray-500"><Loader2 className="h-6 w-6 animate-spin mr-2"/>{message}</div> ));
LoadingState.displayName = 'LoadingState';
const EmptyState = React.memo(({ message, onActionClick, actionLabel }: { message: string; onActionClick?: () => void; actionLabel?: string; }) => ( <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded-lg"><ClipboardList className="mx-auto h-12 w-12 text-gray-400"/><h3 className="mt-2 text-sm font-semibold text-gray-900">{message}</h3>{onActionClick && actionLabel && (<Button onClick={onActionClick} size="sm" className="mt-4"><UserPlus className="mr-2 h-4 w-4"/>{actionLabel}</Button>)}</div> ));
EmptyState.displayName = 'EmptyState';
const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void; }) => ( <div className="text-center py-10 bg-red-50 p-4 rounded-md border border-red-200"><AlertTriangle className="mx-auto h-10 w-10 text-red-400"/><h3 className="mt-2 text-sm font-semibold text-red-700">{message}</h3>{onRetry && <Button variant="destructive" onClick={onRetry} size="sm" className="mt-3"><RotateCcw className="mr-2 h-4 w-4"/>Tentar Novamente</Button>}</div> ));
ErrorState.displayName = 'ErrorState';

// --- COMPONENTE ITEM DA LISTA ---
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
        <Button variant="outline" size="sm" onClick={() => onEdit(doctor)}>
            <Edit3 className="mr-2 h-4 w-4"/> Editar
        </Button>
      </CardFooter>
    </Card>
  );
};
DoctorListItem.displayName = "DoctorListItem";

// --- COMPONENTE DO MODAL/FORMULÁRIO ---
interface DoctorFormDialogProps {
  initialData?: HospitalManagedDoctor | null;
  onFormSubmitted: () => void;
  onClose: () => void;
}

const DoctorFormDialog: React.FC<DoctorFormDialogProps> = ({ initialData, onFormSubmitted, onClose }) => {
    const { toast } = useToast();
    const isEditing = !!initialData;
    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        crm: initialData?.crm || "",
        email: initialData?.email || "",
        phone: initialData?.phone || "",
        specialties: initialData?.specialties?.join(', ') || "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const hospitalId = auth.currentUser?.uid;

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hospitalId) { toast({ title: "Erro", description: "Hospital não identificado.", variant: "destructive"}); return; }
        if (!formData.name.trim() || !formData.crm?.trim()) { toast({ title: "Campos Obrigatórios", description: "Nome e CRM são obrigatórios.", variant: "destructive"}); return; }
        
        setIsSubmitting(true);
        const specialtiesArray = formData.specialties.split(',').map(s => s.trim()).filter(Boolean);

        try {
            if (isEditing && initialData) {
                const updatePayload: Partial<HospitalManagedDoctor> = {
                   name: formData.name.trim(), crm: formData.crm.trim(),
                   email: formData.email.trim() || undefined, phone: formData.phone.trim() || undefined,
                   specialties: specialtiesArray,
                };
                await updateManagedDoctor(hospitalId, initialData.id, updatePayload);
                toast({ title: "Médico Atualizado!", variant: "default" });
            } else {
                const addPayload: AddDoctorToHospitalPayload = {
                   name: formData.name.trim(), crm: formData.crm.trim(),
                   email: formData.email.trim() || undefined, phone: formData.phone.trim() || undefined,
                   specialties: specialtiesArray, source: 'EXTERNAL', // Sempre externo neste formulário
                };
                await addOrInviteDoctorToHospital(hospitalId, addPayload);
                toast({ title: "Médico Externo Adicionado!", variant: "default" });
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
                <DialogTitle>{isEditing ? "Editar Médico" : "Cadastrar Médico Externo"}</DialogTitle>
                <DialogDescription>
                    {isEditing ? "Atualize os dados do médico." : "Preencha os dados para adicionar um médico à sua gestão."}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-1.5"><Label htmlFor="name">Nome Completo*</Label><Input id="name" name="name" value={formData.name} onChange={handleInputChange} required /></div>
                <div className="space-y-1.5"><Label htmlFor="crm">CRM*</Label><Input id="crm" name="crm" value={formData.crm} onChange={handleInputChange} required placeholder="123456SP" /></div>
                <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} /></div>
                <div className="space-y-1.5"><Label htmlFor="phone">Telefone</Label><Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} /></div>
                <div className="space-y-1.5"><Label htmlFor="specialties">Especialidades</Label><Input id="specialties" name="specialties" value={formData.specialties} onChange={handleInputChange} placeholder="Cardiologia, Pediatria..." /><p className="text-xs text-muted-foreground">Separe por vírgulas.</p></div>
                <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Salvar Alterações" : "Adicionar Médico"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
};
DoctorFormDialog.displayName = "DoctorFormDialog";

// --- PÁGINA PRINCIPAL ---
export default function HospitalDoctorsPage() {
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
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDoctors();
    }, [fetchDoctors]);

    const handleAddDoctor = () => { setEditingDoctor(null); setIsFormOpen(true); };
    const handleEditDoctor = (doctor: HospitalManagedDoctor) => { setEditingDoctor(doctor); setIsFormOpen(true); };
    const onFormSubmitted = () => { setIsFormOpen(false); setEditingDoctor(null); fetchDoctors(); };
    const onDialogClose = () => { setIsFormOpen(false); setEditingDoctor(null); };

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
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" onClick={handleAddDoctor}>
                            <UserPlus className="mr-2 h-4 w-4" /> Adicionar Médico
                        </Button>
                    </DialogTrigger>
                    <DoctorFormDialog key={editingDoctor ? editingDoctor.id : 'new'} initialData={editingDoctor} onFormSubmitted={onFormSubmitted} onClose={onDialogClose} />
                </Dialog>
            </div>

            <div className="relative">
                <Input type="search" placeholder="Buscar por nome, CRM ou especialidade..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            {isLoading && <LoadingState message="Buscando médicos..." />}
            {!isLoading && error && <ErrorState message={error} onRetry={fetchDoctors} />}
            {!isLoading && !error && filteredDoctors.length === 0 && (
                <EmptyState 
                    message={searchTerm ? "Nenhum médico encontrado com sua busca." : "Nenhum médico cadastrado ou associado."}
                    actionLabel="Adicionar seu primeiro médico"
                    onActionClick={handleAddDoctor}
                />
            )}
            {!isLoading && !error && filteredDoctors.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDoctors.map(doctor => (
                        <DoctorListItem key={doctor.id} doctor={doctor} onEdit={handleEditDoctor} />
                    ))}
                </div>
            )}
        </div>
    );
}