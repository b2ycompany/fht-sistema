"use client";

import React, { useState, useEffect } from 'react';
import { getProtocolById, type DiagnosticProtocol } from '@/lib/protocol-service';
import { saveAppointmentProtocolAnswers } from '@/lib/appointment-service';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface DiagnosticProtocolProps {
    protocolId: string;
    appointmentId: string;
    initialAnswers?: Record<string, any>;
}

export const DiagnosticProtocolComponent: React.FC<DiagnosticProtocolProps> = ({ protocolId, appointmentId, initialAnswers }) => {
    const { toast } = useToast();
    const [protocol, setProtocol] = useState<DiagnosticProtocol | null>(null);
    const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers || {});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchProtocol = async () => {
            setIsLoading(true);
            try {
                const fetchedProtocol = await getProtocolById(protocolId);
                setProtocol(fetchedProtocol);
            } catch (error) {
                toast({ title: "Erro", description: "Não foi possível carregar as perguntas do protocolo.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchProtocol();
    }, [protocolId, toast]);

    const handleAnswerChange = (questionId: string, value: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };
    
    const handleSaveAnswers = async () => {
        if (Object.keys(answers).length === 0) {
            toast({ title: "Nenhuma resposta", description: "Nenhuma resposta foi alterada para salvar.", variant: "default" });
            return;
        }
        setIsSaving(true);
        try {
            await saveAppointmentProtocolAnswers(appointmentId, answers);
            toast({ title: "Sucesso!", description: "Respostas do protocolo salvas." });
        } catch (error) {
            toast({ title: "Erro ao Salvar", description: "Não foi possível salvar as respostas.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="flex justify-center items-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (!protocol) return <p className="text-red-500 text-center">Protocolo de diagnóstico não encontrado.</p>;

    return (
        <Card className="bg-gray-900/50 border-gray-700">
            <CardHeader>
                <CardTitle>{protocol.title}</CardTitle>
                <CardDescription>{protocol.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {protocol.questions.map((q, index) => (
                    <div key={q.id} className="p-4 border-b border-gray-700 last:border-b-0">
                        <Label className="font-semibold text-base">{index + 1}. {q.text}</Label>
                        <div className="mt-3">
                            {q.type === 'multiple_choice' && q.options && (
                                <RadioGroup value={answers[q.id] || ''} onValueChange={(value) => handleAnswerChange(q.id, value)} className="space-y-2">
                                    {q.options.map(option => (
                                        <div key={option} className="flex items-center space-x-2">
                                            <RadioGroupItem value={option} id={`${q.id}-${option}`} />
                                            <Label htmlFor={`${q.id}-${option}`} className="font-normal cursor-pointer">{option}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            )}
                            {q.type === 'text_input' && (
                                <Textarea
                                    value={answers[q.id] || ''}
                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                    placeholder={q.placeholder || "Digite sua observação..."}
                                    className="bg-gray-900 border-gray-600"
                                />
                            )}
                        </div>
                    </div>
                ))}
                <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveAnswers} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Respostas do Protocolo
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};