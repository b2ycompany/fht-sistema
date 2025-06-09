// app/dashboard/profile/edit/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, XCircle, AlertTriangle, FileUp, ExternalLink } from "lucide-react";
import { useAuth } from '@/components/auth-provider';
import {
  getCurrentUserData,
  updateDoctorProfileData,
  type DoctorProfile,
  type DoctorProfileUpdatePayload,
  type DoctorDocumentsRef,
  type SpecialistDocumentsRef
} from "@/lib/auth-service";
import { uploadFileToStorage } from '@/lib/storage-service';
import { DOC_LABELS } from '@/lib/constants';

const LoadingState = ({ message = "Carregando..." }: { message?: string }) => ( <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="ml-3">{message}</p></div> );
const ErrorState = ({ message, onRetry }: { message: string, onRetry: () => void }) => ( <div className="text-center p-6"><p className="text-red-600">{message}</p><Button onClick={onRetry} className="mt-4">Tentar Novamente</Button></div> );

const FileUploadField = ({ docKey, label, currentFileUrl, onFileChange }: { docKey: string, label: string, currentFileUrl?: string, onFileChange: (key: string, file: File | null) => void }) => {
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setFileName(file?.name || null);
        onFileChange(docKey, file);
    };

    return (
        <div className="p-3 border rounded-lg bg-gray-50/80">
            <Label htmlFor={docKey} className="text-sm font-medium text-gray-700">{label}</Label>
            <div className="flex items-center gap-3 mt-1.5">
                <Input id={docKey} type="file" onChange={handleFileChange} className="text-xs file:mr-2 file:text-xs file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:font-medium file:text-slate-700 hover:file:bg-slate-200 cursor-pointer" />
                {currentFileUrl && (<a href={currentFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0 flex items-center gap-1">Ver atual <ExternalLink size={12}/></a>)}
            </div>
            {fileName && <p className="text-xs text-green-700 mt-1.5 truncate" title={fileName}>Novo arquivo: {fileName}</p>}
        </div>
    );
};

export default function EditDoctorProfilePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [profile, setProfile] = useState<DoctorProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filesToUpdate, setFilesToUpdate] = useState<Record<string, File | null>>({});
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        setIsLoading(true); setError(null);
        try {
            const data = await getCurrentUserData();
            if (data?.role === 'doctor') {
                setProfile(data as DoctorProfile);
            } else {
                setError("Perfil de médico não encontrado.");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleFileChange = useCallback((key: string, file: File | null) => {
        setFilesToUpdate(prev => ({ ...prev, [key]: file }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.uid || !profile) return;
        if (Object.keys(filesToUpdate).length === 0) {
            toast({ title: "Nenhuma alteração", description: "Nenhum novo documento foi selecionado." });
            return;
        }

        setIsSubmitting(true);
        try {
            const uploadedUrls: Record<string, string> = {};
            for (const key in filesToUpdate) {
                const file = filesToUpdate[key];
                if (file) {
                    const storagePath = `doctor_documents/${user.uid}/${key}_${Date.now()}_${file.name}`;
                    const downloadURL = await uploadFileToStorage(file, storagePath, () => {});
                    uploadedUrls[key] = downloadURL;
                }
            }

            // --- LÓGICA DE ATUALIZAÇÃO CORRIGIDA ---
            const newDocsPayload: Partial<DoctorDocumentsRef> = {};
            const newSpecialistDocsPayload: Partial<SpecialistDocumentsRef> = {};
            
            Object.keys(uploadedUrls).forEach(key => {
                // Verifica se a chave pertence aos documentos de especialista
                if (key in (profile.specialistDocuments || {})) {
                    (newSpecialistDocsPayload as any)[key] = uploadedUrls[key];
                } else {
                    (newDocsPayload as any)[key] = uploadedUrls[key];
                }
            });
            
            const payload: DoctorProfileUpdatePayload = {
                // Mescla os documentos existentes com os novos
                documents: { ...profile.documents, ...newDocsPayload },
                specialistDocuments: { ...profile.specialistDocuments, ...newSpecialistDocsPayload },
                // Define o status para revisão
                documentVerificationStatus: "PENDING_REVIEW",
                adminVerificationNotes: "Documentos reenviados pelo usuário para nova análise."
            };
            
            await updateDoctorProfileData(user.uid, payload);

            toast({ title: "Documentos Enviados!", description: "Seu cadastro foi reenviado para análise." });
            router.push('/dashboard/profile');
            
        } catch (error: any) {
            toast({ title: "Erro ao Enviar", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={fetchProfile} />;
    if (!profile) return <div className="p-4 text-center">Perfil não encontrado.</div>;

    const allDocKeys = [...Object.keys(profile.documents || {}), ...Object.keys(profile.specialistDocuments || {})] as (keyof (DoctorDocumentsRef & SpecialistDocumentsRef))[];

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800">Corrigir Documentação</h1>
            
            {profile.documentVerificationStatus === 'REJECTED_NEEDS_RESUBMISSION' && profile.adminVerificationNotes && (
                 <Card className="bg-red-50 border-red-200">
                    <CardHeader className="flex-row items-center gap-3 space-y-0"><AlertTriangle className="h-6 w-6 text-red-600" /><CardTitle className="text-red-800">Correções Necessárias</CardTitle></CardHeader>
                    <CardContent><p className="font-semibold">Observações do administrador:</p><p className="text-red-700 whitespace-pre-wrap">{profile.adminVerificationNotes}</p></CardContent>
                 </Card>
            )}

            <form onSubmit={handleSubmit}>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Reenviar Documentos</CardTitle>
                        <CardDescription>Envie novamente apenas os documentos solicitados. Os outros serão mantidos.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {allDocKeys.map(key => {
                           const isSpecialistDoc = key in (profile.specialistDocuments || {});
                           const docUrl = isSpecialistDoc ? profile.specialistDocuments?.[key as keyof SpecialistDocumentsRef] : profile.documents?.[key as keyof DoctorDocumentsRef];
                           
                           return (
                               <FileUploadField 
                                   key={key} 
                                   docKey={key}
                                   label={DOC_LABELS[key] || key}
                                   currentFileUrl={docUrl}
                                   onFileChange={handleFileChange}
                               />
                           )
                       })}
                       {allDocKeys.length === 0 && <p className="text-sm text-gray-500 col-span-2">Nenhum documento foi encontrado no seu perfil original.</p>}
                    </CardContent>
                    <CardFooter className="mt-4 flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/profile")} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4"/> Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                            Salvar e Reenviar para Análise
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}