// app/hospital/patients/[patientId]/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getPatientById, type Patient } from '@/lib/patient-service';
import { getConsultationsForPatient, type Consultation } from '@/lib/consultation-service'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // <-- CORREÇÃO ADICIONADA AQUI
import { Loader2, AlertTriangle, ArrowLeft, User, Calendar, Stethoscope, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Função para formatar a data de YYYY-MM-DD para DD/MM/YYYY
const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Não informada';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
};


export default function PatientDetailPage() {
    const params = useParams();
    const patientId = params.patientId as string;

    const [patient, setPatient] = useState<Patient | null>(null);
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!patientId) return;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const patientData = await getPatientById(patientId);
                if (!patientData) {
                    throw new Error("Paciente não encontrado.");
                }
                const consultationsData = await getConsultationsForPatient(patientId);
                setPatient(patientData);
                setConsultations(consultationsData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [patientId]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        return <div className="text-center text-red-600 p-8"><AlertTriangle className="mx-auto h-12 w-12 mb-4" /><p>{error}</p></div>;
    }

    if (!patient) {
        return <div>Paciente não encontrado.</div>;
    }

    return (
        <div className="space-y-6">
            <Link href="/hospital/patients" className="flex items-center text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para a lista de pacientes
            </Link>

            <div className="flex items-center justify-between">
                <h1 className="text-2xl md:text-3xl font-bold flex items-center"><User className="mr-3 h-8 w-8" />{patient.name}</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Dados Demográficos</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><p className="font-semibold">CPF</p><p>{patient.cpf || 'Não informado'}</p></div>
                    <div><p className="font-semibold">Data de Nascimento</p><p>{formatDate(patient.dob)}</p></div>
                    <div><p className="font-semibold">Telefone</p><p>{patient.phone || 'Não informado'}</p></div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Consultas</CardTitle>
                </CardHeader>
                <CardContent>
                    {consultations.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhuma consulta registrada para este paciente.</p>
                    ) : (
                        <div className="space-y-4">
                            {consultations.map(consult => (
                                <div key={consult.id} className="p-4 border rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold flex items-center"><Calendar className="mr-2 h-4 w-4 text-gray-500" />{consult.createdAt.toDate().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            <p className="text-sm text-gray-600 flex items-center mt-1"><Stethoscope className="mr-2 h-4 w-4 text-gray-500" />Atendido por: Dr(a). {consult.doctorName}</p>
                                        </div>
                                        <Badge variant={consult.serviceType === 'Telemedicina' ? 'default' : 'secondary'}>{consult.serviceType}</Badge>
                                    </div>
                                    <Separator className="my-3" />
                                    <div>
                                        <h4 className="font-semibold text-sm">Queixa Principal</h4>
                                        <p className="text-sm text-gray-800">{consult.chiefComplaint}</p>
                                    </div>
                                     {consult.clinicalEvolution && (
                                        <div className="mt-2">
                                            <h4 className="font-semibold text-sm">Evolução Clínica</h4>
                                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{consult.clinicalEvolution}</p>
                                        </div>
                                    )}
                                    {consult.prescriptions && consult.prescriptions.length > 0 && (
                                        <div className="mt-3">
                                            <Button size="sm" variant="outline"><FileText className="mr-2 h-4 w-4" />Ver Receitas ({consult.prescriptions.length})</Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}