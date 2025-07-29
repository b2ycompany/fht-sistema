// app/dashboard/agenda/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getDoctorAgenda, type AgendaEntry } from '@/lib/agenda-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Calendar, Clock, Hospital, User, Video, LogIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { groupAgendaByDate } from '@/lib/utils';

const AgendaCard: React.FC<{ item: AgendaEntry; onStart: (item: AgendaEntry) => void }> = ({ item, onStart }) => {
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-md flex items-center gap-2"><User size={18}/>{item.patientName}</CardTitle>
                    <Badge variant={item.serviceType === 'Telemedicina' ? 'default' : 'secondary'}>{item.serviceType}</Badge>
                </div>
                <CardDescription className="flex items-center gap-2 pt-1"><Hospital size={14}/>{item.hospitalName}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm flex items-center gap-2">
                <Clock size={14} className="text-gray-500" />
                <span>{item.startTime} - {item.endTime}</span>
            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={() => onStart(item)}>
                    {item.serviceType === 'Telemedicina' ? 
                        <><Video size={16} className="mr-2"/>Iniciar Atendimento Online</> :
                        <><LogIn size={16} className="mr-2"/>Iniciar Atendimento Presencial</>
                    }
                </Button>
            </CardFooter>
        </Card>
    );
};

export default function AgendaPage() {
    const router = useRouter();
    const [agenda, setAgenda] = useState<Record<string, { label: string; items: AgendaEntry[] }>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAgenda = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const agendaData = await getDoctorAgenda();
                setAgenda(groupAgendaByDate(agendaData));
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAgenda();
    }, []);

    const handleStartAppointment = (item: AgendaEntry) => {
        if (item.serviceType === 'Telemedicina') {
            router.push(`/telemedicine/${item.contractId}`);
        } else {
            // ATUALIZADO: Direciona para a nova página de atendimento presencial
            router.push(`/dashboard/atendimento/${item.id}`);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        return <div className="text-center text-red-600 p-8"><AlertTriangle className="mx-auto h-12 w-12 mb-4" /><p>{error}</p></div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold">Minha Agenda</h1>
            
            {Object.keys(agenda).length === 0 ? (
                <p className="text-center text-gray-500 py-10">Nenhuma consulta agendada.</p>
            ) : (
                Object.entries(agenda).sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime()).map(([dateKey, group]) => (
                    <div key={dateKey}>
                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                           <Calendar size={18} /> {group.label}
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                           {group.items.map(item => (
                               <AgendaCard key={item.id} item={item} onStart={handleStartAppointment} />
                           ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}