// app/dashboard/checkin/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import { 
    MapPinIcon, LogIn, LogOut, CalendarDays, ClockIcon, AlertTriangle, Loader2,
    ClipboardList, RotateCcw
} from "lucide-react";
import {
  getActiveShiftsForCheckin,
  performCheckin,
  performCheckout,
  type CheckinRecord
} from "@/lib/checkin-service";
import { cn } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const LoadingState = React.memo(({ message = "A carregar os seus plantões..." }: { message?: string }) => (
    <div className="flex flex-col justify-center items-center text-center py-10 min-h-[150px] w-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-sm text-gray-600">{message}</p>
    </div>
));
LoadingState.displayName = 'LoadingState';

const EmptyState = React.memo(({ message }: { message: string; }) => (
    <div className="text-center text-sm text-gray-500 py-10 min-h-[150px] flex flex-col items-center justify-center bg-gray-50/70 rounded-md border border-dashed border-gray-300 w-full">
        <ClipboardList className="w-12 h-12 text-gray-400 mb-4"/>
        <p className="font-medium text-gray-600 mb-1">Nenhum plantão encontrado</p>
        <p className="max-w-xs">{message}</p>
    </div>
));
EmptyState.displayName = 'EmptyState';

const ErrorState = React.memo(({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div className="text-center text-sm text-red-600 py-10 min-h-[150px] flex flex-col items-center justify-center bg-red-50/70 rounded-md border border-dashed border-red-300 w-full">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4"/>
        <p className="font-semibold text-red-700 mb-1 text-base">Oops! Algo deu errado.</p>
        <p className="max-w-md text-red-600">{message || "Não foi possível carregar os dados."}</p>
        {onRetry && (
            <Button variant="destructive" size="sm" onClick={onRetry} className="mt-4">
                <RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente
            </Button>
        )}
    </div>
));
ErrorState.displayName = 'ErrorState';

interface ShiftCheckinItemProps {
  record: CheckinRecord;
  onAction: (recordId: string, actionType: 'checkin' | 'checkout', location: GeolocationPosition) => Promise<void>;
  isActionLoading: string | null;
}

const ShiftCheckinItem: React.FC<ShiftCheckinItemProps> = ({ record, onAction, isActionLoading }) => {
  const { toast } = useToast();
  const shiftDate = record.shiftDate.toDate();
  const isCurrentlyLoading = isActionLoading === record.id;

  const handleAction = (actionType: 'checkin' | 'checkout') => {
    if (isCurrentlyLoading) return;
    if (!navigator.geolocation) {
      toast({ title: "Erro de Geolocalização", description: "O seu navegador não suporta geolocalização.", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => onAction(record.id, actionType, position),
      (error) => {
        toast({ title: "Falha na Geolocalização", description: "Por favor, ative a permissão de localização no seu navegador.", variant: "destructive" });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const canCheckin = record.status === 'SCHEDULED';
  const canCheckout = record.status === 'CHECKED_IN';
  
  const getStatusBadgeProps = (status: CheckinRecord['status']): { variant: BadgeProps["variant"], className: string } => {
    switch (status) {
      case 'SCHEDULED': return { variant: 'outline', className: 'border-blue-300 text-blue-700 bg-blue-50' };
      case 'CHECKED_IN': return { variant: 'default', className: 'bg-green-100 text-green-800 border-green-300' };
      case 'CHECKED_OUT': return { variant: 'secondary', className: 'bg-gray-200 text-gray-700' };
      default: return { variant: 'destructive', className: '' };
    }
  };
  const statusBadgeInfo = getStatusBadgeProps(record.status);

  return (
    <Card className={cn("shadow-sm transition-all", record.status === 'CHECKED_IN' && "border-green-500 ring-2 ring-green-500/50")}>
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle className="text-md mb-1">{record.hospitalName}</CardTitle>
            <Badge variant={statusBadgeInfo.variant} className={cn("capitalize", statusBadgeInfo.className)}>
                {record.status.replace(/_/g, ' ').toLowerCase()}
            </Badge>
        </div>
        <CardDescription className="text-xs">
            <MapPinIcon className="inline h-3 w-3 mr-1 text-gray-500" />
            {record.locationCity}, {record.locationState}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        <div className="flex items-center"><CalendarDays size={14} className="mr-2 text-gray-500"/><strong>Data:</strong><span className="ml-1">{shiftDate.toLocaleDateString('pt-BR')}</span></div>
        <div className="flex items-center"><ClockIcon size={14} className="mr-2 text-gray-500"/><strong>Horário Esperado:</strong><span className="ml-1">{record.expectedStartTime} - {record.expectedEndTime}</span></div>
        {record.checkinAt && <div className="text-xs text-green-700 flex items-center pt-2"><LogIn size={13} className="mr-1.5"/>Check-in realizado às {record.checkinAt.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</div>}
        {record.checkoutAt && <div className="text-xs text-red-700 flex items-center"><LogOut size={13} className="mr-1.5"/>Check-out realizado às {record.checkoutAt.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</div>}
      </CardContent>
      <CardFooter className="flex justify-end gap-2 border-t pt-4">
        {canCheckin && (
          <Button onClick={() => handleAction('checkin')} size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={isCurrentlyLoading}>
            {isCurrentlyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <LogIn className="mr-2 h-4 w-4" /> Fazer Check-in
          </Button>
        )}
        {canCheckout && (
          <Button onClick={() => handleAction('checkout')} size="sm" variant="outline" disabled={isCurrentlyLoading}>
            {isCurrentlyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <LogOut className="mr-2 h-4 w-4" /> Fazer Check-out
          </Button>
        )}
        {record.status === 'CHECKED_OUT' && <Badge variant="default" className="bg-green-100 text-green-800">Plantão Finalizado</Badge>}
      </CardFooter>
    </Card>
  );
};
ShiftCheckinItem.displayName = "ShiftCheckinItem";

export default function DoctorCheckinPage() {
  const { toast } = useToast();
  const [activeShifts, setActiveShifts] = useState<CheckinRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchActiveShifts = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const data = await getActiveShiftsForCheckin();
      setActiveShifts(data);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar plantões.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveShifts();
  }, [fetchActiveShifts]);

  const handleShiftAction = async (recordId: string, actionType: 'checkin' | 'checkout', location: GeolocationPosition) => {
    setActionLoadingId(recordId);
    try {
      const { latitude, longitude } = location.coords;
      if (actionType === 'checkin') {
        await performCheckin(recordId, latitude, longitude);
        toast({ title: "Check-in Realizado!", description: "Seu início de plantão foi registrado." });
      } else {
        await performCheckout(recordId, latitude, longitude);
        toast({ title: "Check-out Realizado!", description: "Seu fim de plantão foi registrado." });
      }
      fetchActiveShifts();
    } catch (err: any) {
      toast({ title: `Erro ao realizar ${actionType}`, description: err.message, variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Check-in / Check-out de Plantões</h1>
      <Card>
        <CardHeader>
            <CardTitle>Seus Próximos Plantões</CardTitle>
            <CardDescription>Realize o check-in ao iniciar e o check-out ao finalizar seus plantões aqui.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading && <LoadingState />}
            {!isLoading && error && <ErrorState message={error} onRetry={fetchActiveShifts} />}
            {!isLoading && !error && activeShifts.length === 0 && <EmptyState message="Você não tem plantões confirmados que requerem check-in/out." />}
            {!isLoading && !error && activeShifts.length > 0 && (
                <div className="space-y-4">
                {activeShifts.map(record => (
                    <ShiftCheckinItem
                        key={record.id}
                        record={record}
                        onAction={handleShiftAction}
                        isActionLoading={actionLoadingId}
                    />
                ))}
                </div>
            )}
        </CardContent>
      </Card>
      <div className="mt-6 p-4 border rounded-lg bg-amber-50 text-amber-800">
          <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 text-amber-600" />
              <div>
                  <h3 className="font-semibold">Importante sobre Geolocalização</h3>
                  <p className="text-xs mt-1">Para realizar o check-in e check-out, seu navegador solicitará permissão para aceder à sua localização. Isto é necessário para validar a sua presença no local do plantão.</p>
              </div>
          </div>
      </div>
    </div>
  );
}