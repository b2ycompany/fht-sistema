// app/hospital/profile/edit/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, XCircle, AlertTriangle, FileUp, ExternalLink, Building, User } from "lucide-react";
import { useAuth } from '@/components/auth-provider';
import {
  getCurrentUserData,
  updateUserVerificationStatus, // Usaremos a função genérica para o status
  type HospitalProfile,
  type HospitalDocumentsRef,
  type LegalRepDocumentsRef,
} from "@/lib/auth-service";
import { uploadFileToStorage } from '@/lib/storage-service';
import { DOC_LABELS } from '@/lib/constants';
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- Componentes de Estado (Loading, Error) ---
const LoadingState = ({ message = "Carregando..." }: { message?: string }) => ( <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="ml-3">{message}</p></div> );
const ErrorState = ({ message, onRetry }: { message: string, onRetry: () => void }) => ( <div className="text-center p-6"><p className="text-red-600">{message}</p><Button onClick={onRetry} className="mt-4">Tentar Novamente</Button></div> );

// --- Componente de Upload de Arquivo ---
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


export default function EditHospitalProfilePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [profile, setProfile] = useState<HospitalProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filesToUpdate, setFilesToUpdate] = useState<Record<string, File | null>>({});
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        setIsLoading(true); setError(null);
        try {
            const data = await getCurrentUserData();
            if (data?.role === 'hospital') {
                setProfile(data as HospitalProfile);
            } else {
                setError("Perfil de hospital não encontrado.");
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
                    const storagePath = `hospital_documents/${user.uid}/${key}_${Date.now()}_${file.name}`;
                    const downloadURL = await uploadFileToStorage(file, storagePath, () => {});
                    uploadedUrls[key] = downloadURL;
                }
            }
            
            const newHospitalDocs: Partial<HospitalDocumentsRef> = { ...profile.hospitalDocs };
            const newLegalRepDocs: Partial<LegalRepDocumentsRef> = { ...profile.legalRepDocuments };
            
            Object.keys(uploadedUrls).forEach(key => {
                if (key in (profile.legalRepDocuments || {})) {
                    (newLegalRepDocs as any)[key] = uploadedUrls[key];
                } else {
                    (newHospitalDocs as any)[key] = uploadedUrls[key];
                }
            });

            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                hospitalDocs: newHospitalDocs,
                legalRepDocuments: newLegalRepDocs,
            });
            
            await updateUserVerificationStatus(user.uid, "PENDING_REVIEW", "Documentos reenviados pelo hospital para nova análise.");

            toast({ title: "Documentos Enviados!", description: "Seu cadastro foi reenviado para análise." });
            router.push('/hospital/dashboard');
            
        } catch (error: any) {
            toast({ title: "Erro ao Enviar", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={fetchProfile} />;
    if (!profile) return <div className="p-4 text-center">Perfil não encontrado.</div>;
    
    const hospitalDocKeys = Object.keys(profile.hospitalDocs || {}) as (keyof HospitalDocumentsRef)[];
    const legalRepDocKeys = Object.keys(profile.legalRepDocuments || {}) as (keyof LegalRepDocumentsRef)[];

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
                <Card className="shadow-lg mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Building size={18}/> Documentos da Empresa</CardTitle>
                        <CardDescription>Envie novamente os documentos solicitados. Os outros serão mantidos.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {hospitalDocKeys.map(key => (
                           <FileUploadField 
                               key={key} 
                               docKey={key}
                               label={DOC_LABELS[key] || key}
                               currentFileUrl={profile.hospitalDocs?.[key]}
                               onFileChange={handleFileChange}
                           />
                       ))}
                       {hospitalDocKeys.length === 0 && <p className="text-sm text-gray-500 col-span-2">Nenhum documento da empresa foi encontrado no seu perfil.</p>}
                    </CardContent>
                </Card>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><User size={18}/> Documentos do Responsável Legal</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {legalRepDocKeys.map(key => (
                           <FileUploadField 
                               key={key} 
                               docKey={key}
                               label={DOC_LABELS[key] || key}
                               currentFileUrl={profile.legalRepDocuments?.[key]}
                               onFileChange={handleFileChange}
                           />
                       ))}
                       {legalRepDocKeys.length === 0 && <p className="text-sm text-gray-500 col-span-2">Nenhum documento do responsável foi encontrado no seu perfil.</p>}
                    </CardContent>
                </Card>

                <CardFooter className="mt-6 flex justify-end gap-3 pt-6 border-t bg-gray-50 -mx-6 -mb-6 px-6 pb-4 rounded-b-lg">
                    <Button type="button" variant="outline" onClick={() => router.push("/hospital/dashboard")} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4"/> Cancelar</Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                        Salvar e Reenviar para Análise
                    </Button>
                </CardFooter>
            </form>
        </div>
    );
}