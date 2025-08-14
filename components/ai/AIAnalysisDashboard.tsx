"use client";

import React, { useState } from 'react';
import type { TelemedicineAppointment } from '@/lib/appointment-service';
import { saveAppointmentAIReport } from '@/lib/appointment-service';
import { DiagnosticProtocolComponent } from './DiagnosticProtocol';
import { RealTimeAnalysis, type AnalysisMetrics } from './RealTimeAnalysis';
import { generateSupportReport } from '@/lib/ai-report-generator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Bot, Loader2, Save } from 'lucide-react';

interface AIAnalysisDashboardProps {
  appointment: TelemedicineAppointment;
  patientVideoTrack: MediaStreamTrack | null;
}

export const AIAnalysisDashboard: React.FC<AIAnalysisDashboardProps> = ({ appointment, patientVideoTrack }) => {
  const { toast } = useToast();
  const [finalVideoMetrics, setFinalVideoMetrics] = useState<AnalysisMetrics | null>(null);
  const [generatedReport, setGeneratedReport] = useState<string>(appointment.aiAnalysisReport || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerateReport = () => {
    if (!appointment.autismProtocolAnswers) {
        toast({ title: "Atenção", description: "Por favor, preencha e salve as respostas do protocolo primeiro.", variant: "destructive"});
        return;
    }
    if (!finalVideoMetrics) {
        toast({ title: "Atenção", description: "Os dados de análise de vídeo ainda não foram finalizados. A análise para quando a chamada é encerrada ou a aba é trocada.", variant: "destructive"});
        return;
    }
    const report = generateSupportReport(appointment.autismProtocolAnswers, finalVideoMetrics);
    setGeneratedReport(report);
    toast({ title: "Relatório Gerado", description: "O resumo da IA foi criado com base nos dados coletados." });
  };

  const handleSaveReport = async () => {
    if(!generatedReport) {
        toast({ title: "Atenção", description: "Nenhum relatório foi gerado para salvar.", variant: "destructive"});
        return;
    };
    setIsSaving(true);
    try {
        await saveAppointmentAIReport(appointment.id, generatedReport);
        toast({ title: "Sucesso", description: "Relatório de apoio da IA salvo no prontuário." });
    } catch (error: any) {
        toast({ title: "Erro", description: error.message, variant: "destructive"});
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 h-full">
      <RealTimeAnalysis videoTrack={patientVideoTrack} onMetricsFinalized={setFinalVideoMetrics} />
      <div className="flex-grow">
          <DiagnosticProtocolComponent 
              protocolId="ASD_screening_v1" 
              appointmentId={appointment.id}
              initialAnswers={appointment.autismProtocolAnswers}
          />
      </div>
      <div className="space-y-3 pt-4 border-t border-gray-700">
        <h3 className="text-lg font-semibold text-white">Relatório Consolidado da IA</h3>
        <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={handleGenerateReport}>
                <Bot className="mr-2 h-4 w-4"/>
                Gerar Relatório de Apoio
            </Button>
            <Button onClick={handleSaveReport} disabled={isSaving || !generatedReport} variant="outline">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Relatório no Prontuário
            </Button>
        </div>
        <div className="space-y-2">
            <Label htmlFor="ai-report-output">Resumo da Análise</Label>
            <Textarea 
                id="ai-report-output"
                value={generatedReport}
                readOnly
                className="bg-gray-950 text-gray-300 font-mono h-56 resize-none"
                placeholder="Clique em 'Gerar Relatório' para ver o resumo da IA aqui..."
            />
        </div>
      </div>
    </div>
  );
};