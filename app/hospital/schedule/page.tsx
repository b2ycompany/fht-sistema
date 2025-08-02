// app/hospital/schedule/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';

// Importações do FullCalendar
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction'; 

// Importações de componentes de UI
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Calendar, Clock, User, CheckCircle, XCircle } from 'lucide-react';

// --- Interfaces e Tipos ---
// Interface para o documento da coleção 'timeRecords'
interface TimeRecord {
  id: string;
  contractId: string;
  doctorId: string;
  doctorName: string; 
  hospitalId: string;
  checkInTime: Timestamp;
  checkInPhotoUrl: string;
  checkOutTime?: Timestamp;
  checkOutPhotoUrl?: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
}

// Interface para o evento do calendário
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    record: TimeRecord;
  };
}

// --- Componentes de Estado (Helpers) ---
const LoadingState = () => <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
const ErrorState = ({ onRetry }: { onRetry: () => void }) => <div className="text-center p-10 bg-red-50 rounded-lg"><AlertTriangle className="mx-auto h-12 w-12 text-red-400" /><p className="mt-4 font-semibold text-red-700">Erro ao carregar os registros de ponto.</p><button onClick={onRetry} className="mt-2 text-sm text-red-600 hover:underline">Tentar Novamente</button></div>;

// --- Componente Principal da Página ---
export default function HospitalSchedulePage() {
    const { user } = useAuth();
    const { toast } = useToast();

    // Estados dos dados e UI
    const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<TimeRecord | null>(null);

    // Lógica de busca de dados, agora para 'timeRecords'
    const fetchData = useCallback(async () => {
      if (!user) return;

      setIsLoading(true);
      setError(null);
      try {
        const hospitalId = user.uid;
        // Consulta a coleção 'timeRecords' filtrando pelo ID do hospital
        const recordsQuery = query(collection(db, "timeRecords"), where("hospitalId", "==", hospitalId));
        const recordsSnapshot = await getDocs(recordsQuery);
        
        const fetchedRecords = recordsSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        })) as TimeRecord[];
        
        setTimeRecords(fetchedRecords);

      } catch (err: any) {
        console.error("Erro ao buscar registros de ponto:", err);
        setError("Falha ao carregar os dados. Por favor, tente novamente.");
        toast({ title: "Erro de Carregamento", description: err.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }, [user, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Hook useMemo corrigido para processar 'timeRecords'
    const calendarEvents = useMemo((): CalendarEvent[] => {
        return timeRecords.map(record => {
            // Converte os Timestamps do Firebase para objetos Date do JavaScript
            const startDate = record.checkInTime.toDate();
            // Se houver checkOutTime, usa-o. Se não, o plantão está em andamento, então definimos o fim como a hora atual.
            const endDate = record.checkOutTime ? record.checkOutTime.toDate() : new Date();

            const isCompleted = record.status === 'COMPLETED';

            return {
                id: record.id,
                title: `Dr(a). ${record.doctorName || 'Nome não informado'}`,
                start: startDate,
                end: endDate,
                backgroundColor: isCompleted ? '#34d399' : '#fb923c', // Verde para completo, Laranja para em andamento
                borderColor: isCompleted ? '#059669' : '#f97316',
                extendedProps: {
                    record: record,
                }
            };
        });
    }, [timeRecords]);

    // Manipulador de clique no evento do calendário
    const handleEventClick = (clickInfo: any) => {
        const eventProps = clickInfo.event.extendedProps;
        setSelectedRecord(eventProps.record);
        setIsDetailsOpen(true);
    };

    if (isLoading) return <div className="p-4"><LoadingState /></div>;
    if (error) return <div className="p-4"><ErrorState onRetry={fetchData} /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">Controle de Ponto</h1>
                    <p className="text-muted-foreground">Visualize os registros de check-in e check-out dos médicos.</p>
                </div>
            </div>

            <Card>
                <CardContent className="p-2 sm:p-4">
                     <FullCalendar
                         plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                         initialView="timeGridWeek"
                         headerToolbar={{
                             left: 'prev,next today',
                             center: 'title',
                             right: 'dayGridMonth,timeGridWeek,timeGridDay'
                         }}
                         events={calendarEvents}
                         locale="pt-br"
                         buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' }}
                         eventClick={handleEventClick}
                         allDaySlot={false}
                         slotMinTime="00:00:00"
                         slotMaxTime="24:00:00"
                         contentHeight="auto"
                         eventTimeFormat={{ // Formato de hora mais limpo
                             hour: '2-digit',
                             minute: '2-digit',
                             meridiem: false
                         }}
                     />
                </CardContent>
            </Card>

            {/* Modal de Detalhes do Registro de Ponto */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Detalhes do Registro</DialogTitle>
                        <DialogDescription>
                            Registro de ponto de Dr(a). {selectedRecord?.doctorName}.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedRecord && (
                        <div className="py-4 space-y-4">
                            <div className="flex items-center gap-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <CheckCircle className="h-6 w-6 text-emerald-600" />
                                <div>
                                    <p className="font-semibold">Check-in</p>
                                    <p className="text-sm text-muted-foreground">{selectedRecord.checkInTime.toDate().toLocaleString('pt-BR')}</p>
                                </div>
                                <a href={selectedRecord.checkInPhotoUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-blue-600 hover:underline">Ver Foto</a>
                            </div>

                            {selectedRecord.checkOutTime ? (
                                <div className="flex items-center gap-4 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                                    <XCircle className="h-6 w-6 text-rose-600" />
                                    <div>
                                        <p className="font-semibold">Check-out</p>
                                        <p className="text-sm text-muted-foreground">{selectedRecord.checkOutTime.toDate().toLocaleString('pt-BR')}</p>
                                    </div>
                                    <a href={selectedRecord.checkOutPhotoUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-blue-600 hover:underline">Ver Foto</a>
                                </div>
                            ) : (
                                <div className="text-center p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="font-semibold text-amber-700">Plantão em andamento...</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}