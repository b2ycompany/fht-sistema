// app/dashboard/agendamento/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getSpecialtiesList, type Specialty } from '@/lib/specialty-service';
import { getAssociatedDoctorsBySpecialty, type UserProfile, type UserType } from '@/lib/auth-service';
import { createTelemedicineAppointment } from '@/lib/appointment-service';
import { useAuth } from '@/components/auth-provider';

export default function AgendamentoPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();

  const [patientName, setPatientName] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState<Date | undefined>();
  const [appointmentTime, setAppointmentTime] = useState('');

  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctors, setDoctors] = useState<UserProfile[]>([]);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(true);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Efeito para buscar a lista de todas as especialidades disponíveis
  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        setIsLoadingSpecialties(true);
        const fetchedSpecialties = await getSpecialtiesList();
        setSpecialties(fetchedSpecialties);
      } catch (error) {
        toast({
          title: "Erro ao Carregar Especialidades",
          description: "Não foi possível buscar a lista de especialidades.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingSpecialties(false);
      }
    };
    fetchSpecialties();
  }, [toast]);

  // Efeito para buscar médicos QUANDO uma especialidade é selecionada
  useEffect(() => {
    // Só prossegue se uma especialidade foi selecionada E se o perfil do usuário (com hospitalId) foi carregado
    if (!selectedSpecialty || !userProfile?.hospitalId) {
      setDoctors([]);
      setSelectedDoctorId('');
      return;
    }

    const fetchDoctors = async () => {
      try {
        setIsLoadingDoctors(true);
        const hospitalId = userProfile.hospitalId!; // Sabemos que existe por causa da verificação acima
        // *** PONTO CHAVE DA ATUALIZAÇÃO ***
        // Chama a nova função que busca médicos por especialidade E associação com o hospital
        const fetchedDoctors = await getAssociatedDoctorsBySpecialty(hospitalId, selectedSpecialty);
        setDoctors(fetchedDoctors);
      } catch (error: any) {
        toast({
          title: "Erro ao Carregar Médicos",
          description: error.message || "Não foi possível buscar os médicos para esta unidade.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingDoctors(false);
      }
    };
    fetchDoctors();
  }, [selectedSpecialty, userProfile, toast]); // Depende da especialidade e do perfil do usuário

  // Função para lidar com o envio do formulário de agendamento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientName || !selectedSpecialty || !selectedDoctorId || !appointmentDate || !appointmentTime || !user) {
      toast({
        title: "Campos Incompletos",
        description: "Por favor, preencha todos os campos para agendar a consulta.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const finalAppointmentDate = new Date(appointmentDate);
      finalAppointmentDate.setHours(hours, minutes, 0, 0);

      const selectedDoctor = doctors.find(doc => doc.uid === selectedDoctorId);
      if (!selectedDoctor) {
          throw new Error("Médico selecionado não encontrado.");
      }

      // Chama o serviço para criar o agendamento no backend
      await createTelemedicineAppointment({
        patientName,
        doctorId: selectedDoctorId,
        doctorName: selectedDoctor.displayName,
        specialty: selectedSpecialty,
        appointmentDate: finalAppointmentDate,
      });

      toast({
        title: "Agendamento Realizado com Sucesso!",
        description: `A consulta para ${patientName} foi agendada.`,
        className: "bg-green-600 text-white",
      });

      // Limpa o formulário após o sucesso
      setPatientName('');
      setSelectedSpecialty('');
      setSelectedDoctorId('');
      setAppointmentDate(undefined);
      setAppointmentTime('');
    } catch (error: any) {
      toast({
        title: "Erro ao Agendar Consulta",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tela de carregamento enquanto o perfil do usuário é verificado
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  // Tela de "Acesso Negado" para usuários sem permissão
  const allowedRoles: UserType[] = ['admin', 'receptionist', 'caravan_admin', 'hospital', 'backoffice'];
  if (!userProfile || !allowedRoles.includes(userProfile.userType)) {
    return (
      <div className="container mx-auto flex h-[calc(100vh-80px)] items-center justify-center p-8 text-center">
        <Card className="w-full max-w-md border-red-500 bg-red-50">
            <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2 text-2xl text-red-700">
                    <ShieldAlert className="h-8 w-8" />
                    Acesso Negado
                </CardTitle>
                <CardDescription className="text-red-600">
                    Você não tem permissão para aceder a esta página.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    Esta funcionalidade é restrita a administradores e pessoal autorizado. Se acredita que isto é um erro, por favor, entre em contato com o suporte do sistema.
                </p>
            </CardContent>
            <CardFooter>
                <Button variant="secondary" className="w-full" onClick={() => router.push('/dashboard')}>
                    Voltar ao Dashboard
                </Button>
            </CardFooter>
        </Card>
      </div>
    );
  }

  // Renderização do formulário de agendamento
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Novo Agendamento de Telemedicina</CardTitle>
            <CardDescription>Preencha os dados abaixo para criar uma nova teleconsulta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="patientName">Nome do Paciente</Label>
              <Input
                id="patientName"
                placeholder="Digite o nome completo do paciente"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="specialty">Especialidade</Label>
                <Select
                  value={selectedSpecialty}
                  onValueChange={setSelectedSpecialty}
                  disabled={isLoadingSpecialties}
                  required
                >
                  <SelectTrigger id="specialty">
                    <SelectValue placeholder={isLoadingSpecialties ? "A carregar..." : "Selecione a especialidade"} />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map(spec => (
                      <SelectItem key={spec.id} value={spec.name}>{spec.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctor">Médico</Label>
                <Select
                  value={selectedDoctorId}
                  onValueChange={setSelectedDoctorId}
                  disabled={!selectedSpecialty || isLoadingDoctors}
                  required
                >
                  <SelectTrigger id="doctor">
                    <SelectValue placeholder={isLoadingDoctors ? "A carregar médicos..." : "Selecione o médico"} />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.length > 0 ? (
                      doctors.map(doc => (
                        <SelectItem key={doc.uid} value={doc.uid}>{doc.displayName}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-doctors" disabled>
                        Nenhum médico associado para esta especialidade
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="appointmentDate">Data da Consulta</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !appointmentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {appointmentDate ? format(appointmentDate, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={appointmentDate}
                      onSelect={setAppointmentDate}
                      initialFocus
                      disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointmentTime">Hora da Consulta</Label>
                <Input
                  id="appointmentTime"
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "A Agendar..." : "Agendar Consulta"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}