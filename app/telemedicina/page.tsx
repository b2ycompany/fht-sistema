// app/telemedicina/page.tsx (Versão Completa com Máscaras e Agenda Real)
"use client";

import React, { useState, useEffect, useCallback } from 'react'; // <<< IMPORTADO O useCallback
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stethoscope, Loader2, AlertTriangle, User, Calendar, Clock, ArrowLeft } from "lucide-react";
import Logo from "@/public/logo-fht.svg";
import { getTelemedicineSpecialties } from '@/lib/telemedicine-service';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { IMaskInput } from 'react-imask'; // Importa a máscara

// Tipos
type TelemedicineStep = 'selectSpecialty' | 'patientInfo' | 'selectTime' | 'confirm';

interface PatientInfoData {
    name: string;
    cpf: string;
    dob: string;
    phone: string;
    email: string; // <<< TORNADO OBRIGATÓRIO
    cep: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
}

interface AvailableSlot {
    id: string;
    doctorId: string;
    doctorName: string;
    date: string; // ISO String
    startTime: string;
    endTime: string;
}

// --- Componente do Formulário de Paciente (Enriquecido e com Máscaras) ---
const PatientInfoForm: React.FC<{
    selectedSpecialty: string;
    onBack: () => void;
    onConfirm: (patientData: PatientInfoData, patientId: string) => void;
}> = ({ selectedSpecialty, onBack, onConfirm }) => {
    const { toast } = useToast();
    const [patientData, setPatientData] = useState<PatientInfoData>({
        name: '', cpf: '', dob: '', phone: '', email: '',
        cep: '', street: '', number: '', neighborhood: '', city: '', state: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isCepLoading, setIsCepLoading] = useState(false);
    const findOrCreatePatient = httpsCallable(functions, 'users-findOrCreatePatient'); // Ajuste para o nome exportado (grupo users)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPatientData(prev => ({ ...prev, [name]: value }));
    };

    // Função para buscar CEP
    const handleCepBlur = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;
        setIsCepLoading(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            if (!response.ok) throw new Error("CEP não encontrado");
            const data = await response.json();
            if (data.erro) throw new Error("CEP não encontrado");
            setPatientData(prev => ({
                ...prev,
                street: data.logradouro, // <<< CORREÇÃO (era logouro)
                neighborhood: data.bairro,
                city: data.localidade,
                state: data.uf,
            }));
        } catch (error: any) {
            toast({ title: "Erro ao buscar CEP", description: error.message, variant: "destructive" });
        } finally {
            setIsCepLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validação extra para email
        if (!patientData.email) {
            toast({ title: "Email Obrigatório", description: "O email é necessário para o agendamento.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            // Remove máscaras antes de enviar
            const payload = {
                ...patientData,
                cpf: patientData.cpf.replace(/\D/g, ''),
                phone: patientData.phone.replace(/\D/g, ''),
                cep: patientData.cep.replace(/\D/g, ''),
            };

            const result = await findOrCreatePatient(payload);
            const { patientId } = (result.data as { patientId: string });

            if (!patientId) throw new Error("Não foi possível obter o ID do paciente.");

            onConfirm(patientData, patientId);
            
        } catch (error: any) {
            console.error("Erro ao chamar findOrCreatePatient:", error);
            toast({ title: "Erro no Cadastro", description: (error as Error).message, variant: "destructive" });
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border">
            <Button variant="ghost" onClick={onBack} className="mb-2 text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Especialidades
            </Button>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Informações do Paciente</h2>
            <p className="text-center text-muted-foreground mb-6">Consulta para: <span className="font-semibold capitalize">{selectedSpecialty.toLowerCase()}</span></p>

            <Card className="p-4"><CardTitle className="text-lg mb-4">Dados Pessoais</CardTitle><CardContent className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="name">Nome Completo *</Label><Input id="name" name="name" value={patientData.name} onChange={handleChange} required /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label htmlFor="cpf">CPF *</Label>
                        <IMaskInput as={Input as any} mask="000.000.000-00" id="cpf" name="cpf" value={patientData.cpf} onAccept={(value) => setPatientData(prev => ({...prev, cpf: value.toString()}))} required placeholder="000.000.000-00" />
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="dob">Data de Nascimento *</Label>
                        <IMaskInput as={Input as any} mask="00/00/0000" id="dob" name="dob" value={patientData.dob} onAccept={(value) => setPatientData(prev => ({...prev, dob: value.toString()}))} required placeholder="DD/MM/AAAA" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label htmlFor="phone">Telefone (com DDD) *</Label>
                        <IMaskInput as={Input as any} mask="[(00)] 00000-0000" id="phone" name="phone" value={patientData.phone} onAccept={(value) => setPatientData(prev => ({...prev, phone: value.toString()}))} required placeholder="(11) 99999-9999"/>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="email">Email *</Label><Input id="email" name="email" type="email" value={patientData.email} onChange={handleChange} required placeholder="email@exemplo.com"/></div>
                </div>
            </CardContent></Card>

            <Card className="p-4"><CardTitle className="text-lg mb-4">Endereço</CardTitle><CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 md:col-span-1"><Label htmlFor="cep">CEP *</Label>
                        <IMaskInput as={Input as any} mask="00000-000" id="cep" name="cep" value={patientData.cep} onAccept={(value) => setPatientData(prev => ({...prev, cep: value.toString()}))} onBlur={(e) => handleCepBlur(e.target.value)} required placeholder="00000-000"/>
                    </div>
                    {isCepLoading && <div className="md:col-span-2 flex items-end pb-2"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 md:col-span-2"><Label htmlFor="street">Rua *</Label><Input id="street" name="street" value={patientData.street} onChange={handleChange} required /></div>
                    <div className="space-y-1.5 md:col-span-1"><Label htmlFor="number">Nº *</Label><Input id="number" name="number" value={patientData.number} onChange={handleChange} required /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label htmlFor="neighborhood">Bairro *</Label><Input id="neighborhood" name="neighborhood" value={patientData.neighborhood} onChange={handleChange} required /></div>
                    <div className="space-y-1.5"><Label htmlFor="city">Cidade *</Label><Input id="city" name="city" value={patientData.city} onChange={handleChange} required /></div>
                </div>
            </CardContent></Card>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading || isCepLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
                {isLoading ? "A processar..." : "Ver Horários Disponíveis"}
            </Button>
        </form>
    );
};

// --- Componente de Seleção de Horário (com Agenda Real) ---
const TimeSelection: React.FC<{
    selectedSpecialty: string;
    patientData: PatientInfoData;
    onBack: () => void;
    onConfirm: (selectedSlot: AvailableSlot, time: Date) => void;
}> = ({ selectedSpecialty, patientData, onBack, onConfirm }) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    // <<< CORREÇÃO: Função movida para useCallback para evitar recriação e looping infinito >>>
    const getAvailableSlots = useCallback(
        httpsCallable(functions, 'scheduling-getAvailableSlotsForSpecialty'),
        [] // Dependências vazias, a função é criada apenas uma vez
    );

    useEffect(() => {
        const fetchSlots = async () => {
            setIsLoading(true);
            try {
                const result = await getAvailableSlots({ specialty: selectedSpecialty });
                const { slots } = result.data as { slots: AvailableSlot[] };
                setAvailableSlots(slots);
            } catch (error: any) {
                console.error("Erro ao buscar horários:", error);
                toast({ title: "Erro ao Buscar Horários", description: error.message, variant: "destructive" });
                if (error.message.includes("precisa de um índice")) {
                    toast({ title: "Atenção (Admin)", description: "Um índice do Firestore é necessário para buscar horários. Crie-o clicando no link no console do navegador (F12).", variant: "destructive", duration: 10000});
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchSlots();
    }, [selectedSpecialty, toast, getAvailableSlots]); // Agora 'getAvailableSlots' é estável

    const handleConfirm = () => {
        if (!selectedSlot) return;
        setIsConfirming(true);
        const dateTimeString = `${selectedSlot.date.split('T')[0]}T${selectedSlot.startTime}:00`;
        const finalDateTime = new Date(dateTimeString);
        setTimeout(() => {
            onConfirm(selectedSlot, finalDateTime);
            setIsConfirming(false);
        }, 500);
    };

    return (
         <div className="space-y-4 max-w-lg mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border">
            <Button variant="ghost" onClick={onBack} className="mb-4 text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Dados do Paciente
            </Button>
             <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Escolha um Horário</h2>
             <p className="text-center text-muted-foreground mb-6">Disponibilidade para <span className="font-semibold capitalize">{selectedSpecialty.toLowerCase()}</span></p>
             <p className="text-center text-sm">Paciente: {patientData.name}</p>

             {isLoading ? <div className="flex justify-center py-8"><Loader2 className='mx-auto h-8 w-8 animate-spin' /></div> : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    <Label>Próximos horários disponíveis:</Label>
                    {availableSlots.length > 0 ? (
                        availableSlots.map((slot) => {
                            const slotDate = new Date(slot.date);
                            const displayTime = `${slotDate.toLocaleDateString('pt-BR')} das ${slot.startTime} às ${slot.endTime}`;
                            const isSelected = selectedSlot?.id === slot.id;
                            
                            return (
                                <Button
                                    key={slot.id}
                                    variant={isSelected ? "default" : "outline"}
                                    className="w-full justify-start h-auto py-3"
                                    onClick={() => setSelectedSlot(slot)}
                                >
                                    <Clock className="mr-3 h-4 w-4" />
                                    <div className="flex flex-col items-start">
                                        <span className="font-semibold">{displayTime}</span>
                                        <span className="text-xs font-normal">{slot.doctorName}</span>
                                    </div>
                                </Button>
                            );
                        })
                    ) : (
                        <p className="text-muted-foreground text-center py-4">Nenhum horário de telemedicina encontrado para esta especialidade no momento.</p>
                    )}
                </div>
             )}

             <Button onClick={handleConfirm} className="w-full" disabled={!selectedSlot || isConfirming}>
                {isConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Agendamento"}
             </Button>
         </div>
    );
};

// --- Componente de Confirmação (Corrigido para usar selectedSlot) ---
const ConfirmationStep: React.FC<{
    selectedSpecialty: string;
    patientData: PatientInfoData;
    selectedSlot: AvailableSlot; // <<< Corrigido
    appointmentId: string | null;
    isLoading: boolean;
    error: string | null;
}> = ({ selectedSpecialty, patientData, selectedSlot, appointmentId, isLoading, error }) => {
    
    // Recria a data/hora selecionada para exibição
    const slotDate = new Date(selectedSlot.date);
    const displayTime = `${slotDate.toLocaleDateString('pt-BR', { dateStyle: 'long' })} das ${selectedSlot.startTime} às ${selectedSlot.endTime}`;

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
                            <p><span className='font-semibold'>Médico(a):</span> {selectedSlot.doctorName}</p>
                            <p><span className='font-semibold'>Data/Hora:</span> {displayTime}</p>
                             {/* // TODO: Mostrar link da sala se disponível */}
                             {/* <p><span className='font-semibold'>Link da Sala:</span> <a href="..." target="_blank">Entrar</a></p> */}
                            <p className='text-xs text-muted-foreground pt-2'>Você receberá um lembrete por email.</p>
                        </CardContent>
                    </Card>
                    <Link href="/"> {/* Volta para a home do portal */}
                        <Button variant="outline">Voltar ao Início</Button>
                    </Link>
                </div>
             )}
         </div>
    );
};


// --- COMPONENTE PRINCIPAL DA PÁGINA (com fluxo corrigido) ---
export default function TelemedicinePortalPage() {
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(true);
  const [errorSpecialties, setErrorSpecialties] = useState<string | null>(null);

  // Estados para controlar o fluxo
  const [currentStep, setCurrentStep] = useState<TelemedicineStep>('selectSpecialty');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [patientData, setPatientData] = useState<PatientInfoData | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null); // <<< Novo
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null); // <<< Novo
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [createdAppointmentId, setCreatedAppointmentId] = useState<string | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  // Ajuste para o nome exportado (grupo scheduling)
  const createAppointment = httpsCallable(functions, 'scheduling-createAppointment'); 

  // Busca especialidades
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
    console.log("Especialidade Selecionada:", specialty);
    setSelectedSpecialty(specialty);
    setCurrentStep('patientInfo');
    window.scrollTo({ top: document.getElementById('flow-section')?.offsetTop || 0, behavior: 'smooth' });
  };

  // Função chamada após preencher dados do paciente
  const handlePatientInfoConfirm = (data: PatientInfoData, newPatientId: string) => {
    setPatientData(data);
    setPatientId(newPatientId); // <<< Salva o ID do paciente
    setCurrentStep('selectTime');
    window.scrollTo({ top: document.getElementById('flow-section')?.offsetTop || 0, behavior: 'smooth' });
  };

  // <<< CORREÇÃO: Lógica para chamar o backend sem placeholder >>>
  const handleTimeConfirm = async (slot: AvailableSlot, time: Date) => {
    setSelectedSlot(slot); // <<< Salva o slot inteiro
    setSelectedTime(time);
    setCurrentStep('confirm');
    setIsBooking(true);
    setBookingError(null);
    setCreatedAppointmentId(null);
    window.scrollTo({ top: document.getElementById('flow-section')?.offsetTop || 0, behavior: 'smooth' });

    if (patientData && patientId && slot) {
        try {
            const payload = {
                patientName: patientData.name,
                patientId: patientId, // Passa o ID do paciente
                doctorId: slot.doctorId, // Passa o ID real do médico
                doctorName: slot.doctorName, // Passa o nome real do médico
                specialty: selectedSpecialty,
                appointmentDate: time.toISOString(), // Envia como string ISO
                type: 'Telemedicina' as const
            };
            console.log("Enviando payload para createAppointment:", payload);
            
            const result = await createAppointment(payload);
            
            const appointmentId = (result.data as any).appointmentId;
            if (!appointmentId) throw new Error("ID do agendamento não retornado pelo servidor.");
            setCreatedAppointmentId(appointmentId);
            toast({ title: "Agendamento Confirmado!" });
        } catch(error: any) {
             console.error("Erro ao criar agendamento:", error);
             setBookingError((error as Error).message || "Não foi possível concluir o agendamento.");
             toast({ title: "Erro no Agendamento", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsBooking(false);
        }
    } else {
        setBookingError("Dados do paciente, ID ou horário estão faltando.");
        setIsBooking(false);
    }
  };

  // Funções de "Voltar"
  const goBackToSpecialties = () => {
    setSelectedSpecialty('');
    setPatientData(null);
    setPatientId(null);
    setSelectedSlot(null);
    setSelectedTime(null);
    setCurrentStep('selectSpecialty');
  };
  const goBackToPatientInfo = () => {
      setSelectedSlot(null);
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
            {currentStep === 'confirm' && patientData && selectedSlot && (
                <ConfirmationStep
                    selectedSpecialty={selectedSpecialty}
                    patientData={patientData}
                    selectedSlot={selectedSlot}
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