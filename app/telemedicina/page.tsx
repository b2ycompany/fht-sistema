// app/telemedicina/page.tsx (Versão com Fluxo Iniciado)
"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stethoscope, Loader2, AlertTriangle, User, Calendar, Clock, ArrowLeft } from "lucide-react"; // Adicionado Ícones
import Logo from "@/public/logo-fht.svg";
import { getTelemedicineSpecialties } from '@/lib/telemedicine-service';
import { useToast } from "@/hooks/use-toast"; // Importar useToast
import { useRouter } from 'next/navigation'; // Importar useRouter
import { httpsCallable } from 'firebase/functions'; // Para chamar a função de agendar
import { functions } from '@/lib/firebase'; // Para chamar a função de agendar

// Tipos para as etapas do fluxo
type TelemedicineStep = 'selectSpecialty' | 'patientInfo' | 'selectTime' | 'confirm';

// Interface simples para os dados do paciente
interface PatientInfoData {
    name: string;
    cpf: string;
    dob: string; // Data de nascimento
    phone: string;
    email?: string; // Opcional
}

// --- COMPONENTE DO FORMULÁRIO DE DADOS DO PACIENTE ---
const PatientInfoForm: React.FC<{
    selectedSpecialty: string;
    onBack: () => void;
    onConfirm: (patientData: PatientInfoData) => void;
}> = ({ selectedSpecialty, onBack, onConfirm }) => {
    const [patientData, setPatientData] = useState<PatientInfoData>({ name: '', cpf: '', dob: '', phone: '', email: '' });
    const [isLoading, setIsLoading] = useState(false); // Para futuro submit

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPatientData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Adicionar validação dos campos
        console.log("Dados do Paciente:", patientData);
        setIsLoading(true);
        // Simula um tempo de processamento antes de ir para a próxima etapa
        setTimeout(() => {
            onConfirm(patientData);
            setIsLoading(false);
        }, 1000);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border">
            <Button variant="ghost" onClick={onBack} className="mb-4 text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Especialidades
            </Button>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Informações do Paciente</h2>
            <p className="text-center text-muted-foreground mb-6">Consulta para: <span className="font-semibold capitalize">{selectedSpecialty.toLowerCase()}</span></p>

            <div className="space-y-1.5">
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" name="name" value={patientData.name} onChange={handleChange} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="cpf">CPF</Label>
                    {/* // TODO: Adicionar máscara de CPF aqui */}
                    <Input id="cpf" name="cpf" value={patientData.cpf} onChange={handleChange} required placeholder="000.000.000-00" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="dob">Data de Nascimento</Label>
                    <Input id="dob" name="dob" type="date" value={patientData.dob} onChange={handleChange} required />
                </div>
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone (com DDD)</Label>
                {/* // TODO: Adicionar máscara de telefone */}
                <Input id="phone" name="phone" type="tel" value={patientData.phone} onChange={handleChange} required placeholder="(11) 99999-9999"/>
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="email">Email (Opcional)</Label>
                <Input id="email" name="email" type="email" value={patientData.email} onChange={handleChange} placeholder="email@exemplo.com"/>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
                {isLoading ? "A processar..." : "Ver Horários Disponíveis"}
            </Button>
        </form>
    );
};

// --- COMPONENTE DE SELEÇÃO DE HORÁRIO (Placeholder) ---
const TimeSelection: React.FC<{
    selectedSpecialty: string;
    patientData: PatientInfoData;
    onBack: () => void;
    onConfirm: (selectedTime: Date) => void;
}> = ({ selectedSpecialty, patientData, onBack, onConfirm }) => {
    const [isLoading, setIsLoading] = useState(false);
    // TODO: Buscar horários disponíveis para a especialidade
    const availableTimes: Date[] = [ new Date(Date.now() + 3600 * 1000 * 2), new Date(Date.now() + 3600 * 1000 * 4)]; // Exemplo estático

    const handleSelectTime = (time: Date) => {
         console.log("Horário Selecionado:", time);
         setIsLoading(true);
         // Simula confirmação
         setTimeout(() => {
             onConfirm(time);
             setIsLoading(false);
         }, 1000);
    };

    return (
         <div className="space-y-4 max-w-lg mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border">
            <Button variant="ghost" onClick={onBack} className="mb-4 text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Dados do Paciente
            </Button>
             <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Escolha um Horário</h2>
             <p className="text-center text-muted-foreground mb-6">Disponibilidade para <span className="font-semibold capitalize">{selectedSpecialty.toLowerCase()}</span></p>
             <p className="text-center text-sm">Paciente: {patientData.name}</p>

             {isLoading ? <Loader2 className='mx-auto h-6 w-6 animate-spin' /> : (
                <div className="space-y-3">
                    <Label>Próximos horários disponíveis:</Label>
                    {availableTimes.length > 0 ? (
                        availableTimes.map((time, index) => (
                            <Button key={index} variant="outline" className="w-full justify-start" onClick={() => handleSelectTime(time)}>
                                <Clock className="mr-2 h-4 w-4" />
                                {time.toLocaleDateString('pt-BR')} às {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </Button>
                        ))
                    ) : (
                        <p className="text-muted-foreground text-center">Nenhum horário encontrado para esta especialidade no momento.</p>
                    )}
                </div>
             )}
         </div>
    );
};

// --- COMPONENTE DE CONFIRMAÇÃO (Placeholder) ---
const ConfirmationStep: React.FC<{
    selectedSpecialty: string;
    patientData: PatientInfoData;
    selectedTime: Date;
    appointmentId: string | null; // ID retornado pelo backend
    isLoading: boolean;
    error: string | null;
}> = ({ selectedSpecialty, patientData, selectedTime, appointmentId, isLoading, error }) => {
    return (
         <div className="space-y-4 max-w-lg mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border text-center">
             <h2 className="text-2xl font-bold text-gray-900 mb-6">Agendamento</h2>
             {isLoading && <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600 mb-4" />}
             {error && <p className="text-red-600 bg-red-50 p-3 rounded border border-red-200">{error}</p>}
             {appointmentId && !error && (
                <div className='space-y-4'>
                    <p className="text-green-600 font-semibold text-lg">Consulta agendada com sucesso!</p>
                    <Card className='text-left'>
                        <CardHeader><CardTitle className='text-base'>Detalhes</CardTitle></CardHeader>
                        <CardContent className='text-sm space-y-2'>
                            <p><span className='font-semibold'>Paciente:</span> {patientData.name}</p>
                            <p><span className='font-semibold'>Especialidade:</span> <span className="capitalize">{selectedSpecialty.toLowerCase()}</span></p>
                            <p><span className='font-semibold'>Data/Hora:</span> {selectedTime.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}</p>
                             {/* // TODO: Mostrar link da sala se disponível */}
                             {/* <p><span className='font-semibold'>Link da Sala:</span> <a href="..." target="_blank">Entrar</a></p> */}
                            <p className='text-xs text-muted-foreground pt-2'>Você receberá um lembrete por email/SMS.</p>
                        </CardContent>
                    </Card>
                    <Link href="/dashboard/agenda"> {/* Ou outra página relevante */}
                        <Button variant="outline">Ver meus agendamentos</Button>
                    </Link>
                </div>
             )}
         </div>
    );
};


// --- COMPONENTE PRINCIPAL DA PÁGINA DE TELEMEDICINA ---
export default function TelemedicinePortalPage() {
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(true);
  const [errorSpecialties, setErrorSpecialties] = useState<string | null>(null);

  // Estados para controlar o fluxo
  const [currentStep, setCurrentStep] = useState<TelemedicineStep>('selectSpecialty');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [patientData, setPatientData] = useState<PatientInfoData | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [createdAppointmentId, setCreatedAppointmentId] = useState<string | null>(null);

  const { toast } = useToast();
  const router = useRouter(); // Para redirecionamento futuro, se necessário
  const createAppointment = httpsCallable(functions, 'createAppointment'); // Referência da função de agendar

  // Busca especialidades ao carregar
  useEffect(() => {
    const fetchSpecialties = async () => {
      setIsLoadingSpecialties(true);
      setErrorSpecialties(null);
      try {
        const data = await getTelemedicineSpecialties();
        setSpecialties(data);
      } catch (err: any) {
        setErrorSpecialties(err.message || "Não foi possível conectar ao servidor.");
      } finally {
        setIsLoadingSpecialties(false);
      }
    };
    fetchSpecialties();
  }, []);

  // Função chamada ao clicar numa especialidade
  const handleSpecialtySelect = (specialty: string) => {
    console.log("Especialidade Selecionada:", specialty); // Log para confirmar clique
    setSelectedSpecialty(specialty);
    setCurrentStep('patientInfo'); // Avança para a próxima etapa
    // Rola a tela para o topo, se necessário
    window.scrollTo({ top: document.getElementById('flow-section')?.offsetTop || 0, behavior: 'smooth' });
  };

  // Função chamada após preencher dados do paciente
  const handlePatientInfoConfirm = (data: PatientInfoData) => {
    setPatientData(data);
    setCurrentStep('selectTime'); // Avança para seleção de horário
    window.scrollTo({ top: document.getElementById('flow-section')?.offsetTop || 0, behavior: 'smooth' });
  };

  // Função chamada após selecionar o horário
  const handleTimeConfirm = async (time: Date) => {
    setSelectedTime(time);
    setCurrentStep('confirm'); // Avança para a confirmação (e chamada do backend)
    setIsBooking(true);
    setBookingError(null);
    setCreatedAppointmentId(null);
    window.scrollTo({ top: document.getElementById('flow-section')?.offsetTop || 0, behavior: 'smooth' });

    // Chama a função de backend para criar o agendamento
    if (patientData) {
        try {
            // TODO: Buscar o doctorId correto para a especialidade/horário
            const placeholderDoctorId = "DOCTOR_ID_PLACEHOLDER"; // Substituir pela lógica real
            const placeholderDoctorName = "Dr. Exemplo"; // Substituir pela lógica real

            const payload = {
                patientName: patientData.name,
                // patientId: ? // Adicionar se tiver ID do paciente
                doctorId: placeholderDoctorId,
                doctorName: placeholderDoctorName,
                specialty: selectedSpecialty,
                appointmentDate: time, // Passa o objeto Date
                type: 'Telemedicina' as const
            };

            const result = await createAppointment(payload);
            const appointmentId = (result.data as any).appointmentId;

            if (!appointmentId) throw new Error("ID do agendamento não retornado pelo servidor.");

            setCreatedAppointmentId(appointmentId);
            toast({ title: "Agendamento Confirmado!" });

        } catch(error: any) {
             console.error("Erro ao criar agendamento:", error);
             setBookingError(error.message || "Não foi possível concluir o agendamento.");
             toast({ title: "Erro no Agendamento", description: error.message, variant: "destructive" });
        } finally {
            setIsBooking(false);
        }
    } else {
        setBookingError("Dados do paciente não encontrados.");
        setIsBooking(false);
    }
  };

  // Funções para voltar etapas
  const goBackToSpecialties = () => {
    setSelectedSpecialty('');
    setPatientData(null);
    setSelectedTime(null);
    setCurrentStep('selectSpecialty');
  };
  const goBackToPatientInfo = () => {
      setSelectedTime(null);
      setCurrentStep('patientInfo');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header (sem alterações) */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/">
            <Image src={Logo} alt="FHT Soluções Hospitalares" width={160} height={60} />
          </Link>
          <nav className="flex gap-4">
            <Link href="/login"><Button variant="ghost" className="text-blue-600 hover:text-blue-700">Entrar</Button></Link>
            <Link href="/dashboard"><Button className="bg-blue-600 hover:bg-blue-700 text-white px-6">Área do Médico</Button></Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Seção de Banner (sem alterações) */}
        <section className="bg-gradient-to-r from-blue-100 via-white to-blue-50 py-20">
          <div className="container mx-auto px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">Portal de Telemedicina FHT</h1>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">Cuidado e tecnologia ao seu alcance. Selecione a especialidade desejada para ver os próximos passos.</p>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 🔹 SEÇÃO DO FLUXO (RENDERIZAÇÃO CONDICIONAL DA ETAPA ATUAL) 🔹 */}
        {/* ================================================================= */}
        <section id="flow-section" className="py-20 bg-white">
          <div className="container mx-auto px-6">

            {/* Etapa 1: Selecionar Especialidade */}
            {currentStep === 'selectSpecialty' && (
              <>
                <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Nossas Especialidades Disponíveis</h2>
                {isLoadingSpecialties && <div className="flex justify-center py-8"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>}
                {errorSpecialties && <div className="text-center py-8 text-red-600 bg-red-50 p-4 rounded-lg border border-red-200"><AlertTriangle className="mx-auto h-8 w-8 mb-2" /><p className="font-semibold">Erro ao carregar especialidades.</p><p className="text-sm">{errorSpecialties}</p></div>}
                {!isLoadingSpecialties && !errorSpecialties && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {specialties.length > 0 ? (
                        specialties.map((specialty) => (
                          // <<< ADICIONADO onClick AQUI >>>
                          <Card key={specialty} onClick={() => handleSpecialtySelect(specialty)} className="group hover:border-blue-600 hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
                            <CardContent className="p-6 flex flex-col items-center text-center">
                              <div className="bg-blue-100 p-4 rounded-full mb-4 transition-colors duration-300 group-hover:bg-blue-600"><Stethoscope className="h-8 w-8 text-blue-600 transition-colors duration-300 group-hover:text-white" /></div>
                              <h3 className="text-lg font-semibold text-gray-800 capitalize">{specialty.toLowerCase()}</h3>
                            </CardContent>
                          </Card>
                        ))
                    ) : (<p className="col-span-full text-center text-muted-foreground">Nenhuma especialidade disponível.</p>)}
                  </div>
                )}
              </>
            )}

            {/* Etapa 2: Informações do Paciente */}
            {currentStep === 'patientInfo' && (
              <PatientInfoForm
                selectedSpecialty={selectedSpecialty}
                onBack={goBackToSpecialties}
                onConfirm={handlePatientInfoConfirm}
              />
            )}

            {/* Etapa 3: Selecionar Horário */}
            {currentStep === 'selectTime' && patientData && (
                 <TimeSelection
                    selectedSpecialty={selectedSpecialty}
                    patientData={patientData}
                    onBack={goBackToPatientInfo}
                    onConfirm={handleTimeConfirm}
                 />
            )}

             {/* Etapa 4: Confirmação */}
            {currentStep === 'confirm' && patientData && selectedTime && (
                <ConfirmationStep
                    selectedSpecialty={selectedSpecialty}
                    patientData={patientData}
                    selectedTime={selectedTime}
                    appointmentId={createdAppointmentId}
                    isLoading={isBooking}
                    error={bookingError}
                />
            )}

          </div>
        </section>
      </main>

      {/* Footer (sem alterações) */}
      <footer className="bg-blue-700 text-white py-10 mt-auto">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm">© {new Date().getFullYear()} FHT Soluções Hospitalares. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}