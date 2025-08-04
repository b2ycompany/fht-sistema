// app/register/page.tsx
"use client";

import React, {
  useState,
  useMemo,
  ChangeEvent,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIMask } from 'react-imask';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  createAuthUser,
  completeUserRegistration,
  type UserType,
  type DoctorRegistrationPayload,
  type HospitalRegistrationPayload,
  type AddressInfo,
  type PersonalInfo,
  type LegalRepresentativeInfo,
  type DoctorDocumentsRef,
  type SpecialistDocumentsRef,
  type HospitalDocumentsRef,
  type LegalRepDocumentsRef
} from "@/lib/auth-service";
import { uploadFileToStorage } from "@/lib/storage-service";
import { FirebaseError } from "firebase/app";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import {
  Loader2, Check, AlertTriangle, Info, Stethoscope, Building,
  FileUp, XCircleIcon, ExternalLink, CheckCircle, HeartPulse, Briefcase
} from "lucide-react";
import { useAuth as useAuthHook } from "@/components/auth-provider";
import { Checkbox } from "@/components/ui/checkbox";

// --- NOVA: Lista de Especialidades ---
const availableSpecialties = ["Clínica Geral", "Cardiologia", "Pediatria", "Ginecologia", "Oftalmologia", "Dermatologia", "Ortopedia"];

// Interfaces e constantes
interface Credentials { password: string; confirmPassword: string; }
interface HospitalInfo { companyName: string; cnpj: string; stateRegistration?: string; phone: string; email: string; }
interface FileWithProgress { file: File | null; name: string; url?: string; progress: number; isUploading: boolean; error?: string; }
const initialFileState: FileWithProgress = { file: null, name: "", url: undefined, progress: 0, isUploading: false, error: undefined, };
const DOCUMENT_LABELS = { personalRg: "RG Pessoal*", personalCpf: "CPF Pessoal*", professionalCrm: "Carteira Profissional (CRM)*", photo3x4: "Foto 3x4 Recente*", addressProof: "Comprovante de Residência Pessoal*", graduationCertificate: "Certificado de Graduação*", criminalRecordCert: "Certidão Negativa Criminal*", ethicalCert: "Certidão Negativa Ético-Profissional*", debtCert: "Certidão Negativa de Débitos CRM*", cv: "Currículo Vitae (CV)*", rqe: "Registro de Qualificação de Especialista (RQE)*", postGradCert: "Certificado de Pós-Graduação/Residência*", specialistTitle: "Título de Especialista*", recommendationLetter: "Carta de Recomendação (Opcional)", socialContract: "Contrato Social*", cnpjCard: "Cartão CNPJ*", companyAddressProof: "Comprovante de Endereço da Empresa*", repRg: "RG do Responsável*", repCpf: "CPF do Responsável*", repAddressProof: "Comprovante de Residência do Responsável*", } as const;
type AllDocumentKeys = keyof typeof DOCUMENT_LABELS;
type DoctorDocKeys = "personalRg" | "personalCpf" | "professionalCrm" | "photo3x4" | "addressProof" | "graduationCertificate" | "criminalRecordCert" | "ethicalCert" | "debtCert" | "cv";
type SpecialistDocKeys = "rqe" | "postGradCert" | "specialistTitle" | "recommendationLetter";
type HospitalDocKeys = "socialContract" | "cnpjCard" | "companyAddressProof";
type LegalRepDocKeys = "repRg" | "repCpf" | "repAddressProof";
const doctorDocKeysArray: DoctorDocKeys[] = ["personalRg", "personalCpf", "professionalCrm", "photo3x4", "addressProof", "graduationCertificate", "criminalRecordCert", "ethicalCert", "debtCert", "cv"];
const specialistDocKeysArray: SpecialistDocKeys[] = ["rqe", "postGradCert", "specialistTitle", "recommendationLetter"];
const hospitalDocKeysArray: HospitalDocKeys[] = ["socialContract", "cnpjCard", "companyAddressProof"];
const legalRepDocKeysArray: LegalRepDocKeys[] = ["repRg", "repCpf", "repAddressProof"];
type DoctorDocumentsState = Record<DoctorDocKeys, FileWithProgress>;
type SpecialistDocumentsState = Record<SpecialistDocKeys, FileWithProgress>;
type HospitalDocumentsState = Record<HospitalDocKeys, FileWithProgress>;
type LegalRepDocumentsState = Record<LegalRepDocKeys, FileWithProgress>;
const createInitialDocState = <T extends string>(keys: readonly T[], labels: Record<T, string>): Record<T, FileWithProgress> => { return keys.reduce((acc, key) => { acc[key] = { ...initialFileState, name: labels[key].replace('*', '') }; return acc; }, {} as Record<T, FileWithProgress>); };
const initialDoctorDocsStateValue: DoctorDocumentsState = createInitialDocState(doctorDocKeysArray, DOCUMENT_LABELS as any);
const initialSpecialistDocsStateValue: SpecialistDocumentsState = createInitialDocState(specialistDocKeysArray, DOCUMENT_LABELS as any);
const initialHospitalDocsStateValue: HospitalDocumentsState = createInitialDocState(hospitalDocKeysArray, DOCUMENT_LABELS as any);
const initialLegalRepDocsStateValue: LegalRepDocumentsState = createInitialDocState(legalRepDocKeysArray, DOCUMENT_LABELS as any);

const LoadingPage = ({ message = "Carregando..." }: { message?: string }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
    <p className="text-gray-700">{message}</p>
  </div>
);
LoadingPage.displayName = "LoadingPage";

interface StepIndicatorProps { steps: string[]; currentStep: number; }
const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep }) => {
    return (
        <div className="flex items-center justify-between mb-8 relative max-w-full overflow-x-auto pb-2">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-300 transform -translate-y-1/2 -z-10" style={{ width: `calc(100% - ${100 / (steps.length || 1)}%)`, margin: '0 auto' }}>
                <div
                    className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
                    style={{ width: `${(currentStep / Math.max(1, steps.length - 1)) * 100}%` }}
                />
            </div>
            {steps.map((label, index) => (
                <div key={label + index} className="flex flex-col items-center z-10 min-w-[60px] px-1">
                    <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors duration-300 border-2",
                        index === currentStep ? "bg-blue-600 text-white border-blue-700 ring-2 ring-offset-2 ring-blue-600"
                            : index < currentStep ? "bg-blue-600 text-white border-blue-700"
                                : "bg-gray-200 text-gray-600 border-gray-300"
                    )}>
                        {index < currentStep ? <Check size={14} /> : index + 1}
                    </div>
                    <span className={cn(
                        "text-[10px] sm:text-xs mt-1.5 text-center max-w-[70px] break-words leading-tight",
                        index <= currentStep ? "text-blue-700 font-medium" : "text-gray-500"
                    )}>{label}</span>
                </div>
            ))}
        </div>
    );
};

type SummaryData = {
    personalInfo?: PersonalInfo;
    addressInfo?: AddressInfo;
    doctorDocuments?: DoctorDocumentsState;
    isSpecialist?: boolean;
    specialistDocuments?: SpecialistDocumentsState;
    hospitalInfo?: HospitalInfo;
    hospitalAddressInfo?: AddressInfo;
    hospitalDocuments?: HospitalDocumentsState;
    legalRepresentativeInfo?: LegalRepresentativeInfo;
    legalRepDocuments?: LegalRepDocumentsState;
    credentials?: Partial<Credentials>;
};

interface RegistrationSummaryProps {
    role: UserType;
    data: SummaryData;
    onEdit: (stepId: string) => void;
}

const SummaryField: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => {
    if (!value && value !== "" ) return null;
    return (
        <p className="text-sm"><strong className="font-medium text-gray-700">{label}:</strong> <span className="text-gray-600 ml-1 break-words">{value || <span className="italic text-gray-400">Não preenchido</span>}</span></p>
    );
};

const SummaryFileField: React.FC<{ label: string; fileProgress: FileWithProgress | undefined }> = ({ label, fileProgress }) => {
    const displayFileName = fileProgress?.name || "Não enviado";
    const isSent = !!fileProgress?.url;
    const isSelected = !!fileProgress?.file && !fileProgress.url;

    let statusText = <span className="italic text-gray-500">Não enviado</span>;
    let titleText = "Não enviado";

    if (isSent) {
        statusText = <span className="text-green-700 font-medium truncate max-w-[150px] inline-block align-middle" title={displayFileName}>{displayFileName} (Enviado)</span>;
        titleText = displayFileName;
    } else if (isSelected) {
        statusText = <span className="text-blue-700 font-medium truncate max-w-[150px] inline-block align-middle" title={displayFileName}>{displayFileName} (Selecionado)</span>;
        titleText = displayFileName;
    }

    return (
        <p className="text-sm">
            <strong className="font-medium text-gray-700">{label.replace('*', '')}:</strong>
            <span className="text-xs ml-1" title={titleText}>{statusText}</span>
        </p>
    );
};

const RegistrationSummary: React.FC<RegistrationSummaryProps> = ({ role, data, onEdit }) => {
    if (!role || !data || Object.keys(data).length === 0) {
        return (
            <div className="p-4 border-2 border-dashed border-yellow-400 bg-yellow-50 rounded-md">
                <h2 className="text-xl font-bold text-center text-yellow-700 mb-4">Problema ao Carregar Revisão</h2>
                <p className="text-sm text-yellow-600 text-center">
                    Não foi possível carregar os detalhes para revisão.
                </p>
            </div>
        );
    }

    const renderSection = (title: string, stepId: string, children: React.ReactNode) => (
        <div className="mb-4 p-4 border border-gray-200 rounded-lg shadow-sm bg-white relative">
            <Button variant="outline" size="sm" onClick={() => onEdit(stepId)} className="absolute top-2 right-2 text-xs h-6 px-2 z-10">Editar</Button>
            <h3 className="text-base font-semibold mb-3 text-gray-800 border-b pb-1.5">{title}</h3>
            <div className="space-y-1.5">{children}</div>
        </div>
    );

    const formatDoc = (value: string | undefined, type: 'cpf' | 'cnpj' | 'phone' | 'cep' | 'rg') => {
        if (!value) return value;
        const cleanValue = value.replace(/[^\dX]/gi, '');
        if (type === 'cpf' && cleanValue.length === 11) return cleanValue.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (type === 'cnpj' && cleanValue.length === 14) return cleanValue.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
        if (type === 'phone') {
            return cleanValue.length > 10 ? cleanValue.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : cleanValue.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        if (type === 'cep' && cleanValue.length === 8) return cleanValue.replace(/(\d{5})(\d{3})/, '$1-$2');
        if (type === 'rg') { return value; }
        return value;
    };

    return (
        <div className="space-y-4 bg-gray-50 p-4 sm:p-6 rounded-lg animate-fade-in">
            <h2 className="text-xl sm:text-2xl font-bold text-center text-gray-800 mb-4 sm:mb-6">Revise seus Dados</h2>
            {role === 'doctor' && data.personalInfo && data.addressInfo && data.doctorDocuments && data.credentials && (
                <>
                    {renderSection("Dados Pessoais", "personalInfo", (<>
                        <SummaryField label="Nome" value={data.personalInfo.name} />
                        <SummaryField label="Nascimento" value={data.personalInfo.dob} />
                        <SummaryField label="RG" value={data.personalInfo.rg} />
                        <SummaryField label="CPF" value={formatDoc(data.personalInfo.cpf, 'cpf')} />
                        <SummaryField label="Telefone" value={formatDoc(data.personalInfo.phone, 'phone')} />
                        <SummaryField label="Email (Login)" value={data.personalInfo.email} />
                    </>))}
                    {renderSection("Endereço Pessoal", "addressInfo", (<>
                        <SummaryField label="CEP" value={formatDoc(data.addressInfo.cep, 'cep')} />
                        <SummaryField label="Rua" value={data.addressInfo.street} />
                        <SummaryField label="Número" value={data.addressInfo.number} />
                        <SummaryField label="Compl." value={data.addressInfo.complement} />
                        <SummaryField label="Bairro" value={data.addressInfo.neighborhood} />
                        <SummaryField label="Cidade" value={data.addressInfo.city} />
                        <SummaryField label="Estado" value={data.addressInfo.state} />
                    </>))}
                    {data.doctorDocuments && renderSection("Documentos Essenciais", "essentialDocs", (<>
                        {(Object.keys(data.doctorDocuments) as DoctorDocKeys[]).filter(k => DOCUMENT_LABELS[k].includes('*') && ['personalRg','personalCpf','professionalCrm','addressProof','graduationCertificate','photo3x4'].includes(k)).map(key => (
                            <SummaryFileField key={key} label={DOCUMENT_LABELS[key]} fileProgress={data.doctorDocuments![key]} />
                        ))}
                    </>))}
                     {data.doctorDocuments && renderSection("Certidões e CV", "certsAndCvDocs", (<>
                        {(Object.keys(data.doctorDocuments) as DoctorDocKeys[]).filter(k => ['criminalRecordCert','ethicalCert','debtCert','cv'].includes(k)).map(key => (
                            <SummaryFileField key={key} label={DOCUMENT_LABELS[key]} fileProgress={data.doctorDocuments![key]} />
                        ))}
                    </>))}
                    {renderSection("Especialidade", "isSpecialist", (
                        <p className="text-sm"><strong className="font-medium">É especialista com RQE?</strong> <span className="ml-1">{data.isSpecialist ? "Sim" : "Não"}</span></p>
                    ))}
                    {data.isSpecialist && data.specialistDocuments && renderSection("Docs Especialista", "specialistDocs", (<>
                        {(Object.keys(data.specialistDocuments) as SpecialistDocKeys[]).map(key => (
                            <SummaryFileField key={key} label={DOCUMENT_LABELS[key]} fileProgress={data.specialistDocuments![key]} />
                        ))}
                    </>))}
                    {renderSection("Credenciais de Acesso", "credentials", (<>
                        <SummaryField label="Email Acesso" value={data.personalInfo.email} />
                        <p className="text-sm"><strong className="font-medium">Senha:</strong> <span className="ml-1">********</span></p>
                    </>))}
                </>
            )}
            {role === 'hospital' && data.hospitalInfo && data.hospitalAddressInfo && data.hospitalDocuments && data.legalRepresentativeInfo && data.legalRepDocuments && data.credentials && (
                 <>
                    {renderSection("Dados da Empresa", "hospitalInfo", (<>
                        <SummaryField label="Razão Social" value={data.hospitalInfo.companyName} />
                        <SummaryField label="CNPJ" value={formatDoc(data.hospitalInfo.cnpj, 'cnpj')} />
                        <SummaryField label="Insc. Estadual" value={data.hospitalInfo.stateRegistration} />
                        <SummaryField label="Telefone" value={formatDoc(data.hospitalInfo.phone, 'phone')} />
                        <SummaryField label="Email (Login)" value={data.hospitalInfo.email} />
                    </>))}
                    {renderSection("Endereço da Empresa", "hospitalAddress", (<>
                        <SummaryField label="CEP" value={formatDoc(data.hospitalAddressInfo.cep, 'cep')} />
                        <SummaryField label="Rua" value={data.hospitalAddressInfo.street} />
                        <SummaryField label="Número" value={data.hospitalAddressInfo.number} />
                        <SummaryField label="Compl." value={data.hospitalAddressInfo.complement} />
                        <SummaryField label="Bairro" value={data.hospitalAddressInfo.neighborhood} />
                        <SummaryField label="Cidade" value={data.hospitalAddressInfo.city} />
                        <SummaryField label="Estado" value={data.hospitalAddressInfo.state} />
                    </>))}
                    {data.hospitalDocuments && renderSection("Documentos da Empresa", "hospitalDocs", (<>
                        {(Object.keys(data.hospitalDocuments) as HospitalDocKeys[]).map(key => (
                           <SummaryFileField key={key} label={DOCUMENT_LABELS[key]} fileProgress={data.hospitalDocuments![key]} />
                        ))}
                    </>))}
                    {renderSection("Responsável Legal", "legalRepInfo", (<>
                        <SummaryField label="Nome" value={data.legalRepresentativeInfo.name} />
                        <SummaryField label="Nascimento" value={data.legalRepresentativeInfo.dob} />
                        <SummaryField label="RG" value={data.legalRepresentativeInfo.rg} />
                        <SummaryField label="CPF" value={formatDoc(data.legalRepresentativeInfo.cpf, 'cpf')} />
                        <SummaryField label="Telefone" value={formatDoc(data.legalRepresentativeInfo.phone, 'phone')} />
                        <SummaryField label="Email Pessoal" value={data.legalRepresentativeInfo.email} />
                        <SummaryField label="Cargo" value={data.legalRepresentativeInfo.position} />
                    </>))}
                    {data.legalRepDocuments && renderSection("Documentos do Responsável", "legalRepDocs", (<>
                        {(Object.keys(data.legalRepDocuments) as LegalRepDocKeys[]).map(key => (
                            <SummaryFileField key={key} label={DOCUMENT_LABELS[key]} fileProgress={data.legalRepDocuments![key]} />
                        ))}
                    </>))}
                    {renderSection("Credenciais de Acesso", "credentials", (<>
                        <SummaryField label="Email Acesso (Empresa)" value={data.hospitalInfo.email} />
                        <p className="text-sm"><strong className="font-medium">Senha:</strong> <span className="ml-1">********</span></p>
                    </>))}
                </>
            )}
            <p className="text-center text-sm text-gray-600 mt-4">Confira todas as informações antes de finalizar o cadastro.</p>
        </div>
    );
};

interface InputWithIMaskProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onAccept' | 'value' | 'defaultValue'> {
    maskOptions: any;
    onAccept: (value: string, maskRef: any) => void;
    defaultValue?: string;
}
const InputWithIMask: React.FC<InputWithIMaskProps> = ({ maskOptions, onAccept, id, defaultValue, ...rest }) => {
    const { ref } = useIMask(maskOptions, { onAccept });
    return <Input ref={ref as React.RefObject<HTMLInputElement>} id={id} defaultValue={defaultValue} {...rest} />;
};


export default function RegisterPage() {
    const [registrationComplete, setRegistrationComplete] = useState(false);
    const [targetDashboardPath, setTargetDashboardPath] = useState<string | null>(null);
    const [step, setStep] = useState(0);
    const [role, setRole] = useState<UserType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();
    const { user: authUser, loading: authLoading } = useAuthHook();

    // --- NOVOS ESTADOS PARA O CADASTRO INTELIGENTE ---
    const [doctorObjective, setDoctorObjective] = useState<'caravan' | 'match' | null>(null);
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

    const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({ name: "", dob: "", rg: "", cpf: "", phone: "", email: "" });
    const [addressInfo, setAddressInfo] = useState<AddressInfo>({ cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
    const [isSpecialist, setIsSpecialist] = useState<boolean>(false);
    const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo>({ companyName: "", cnpj: "", stateRegistration: "", phone: "", email: ""});
    const [hospitalAddressInfo, setHospitalAddressInfo] = useState<AddressInfo>({ cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
    const [legalRepresentativeInfo, setLegalRepresentativeInfo] = useState<LegalRepresentativeInfo>({ name: "", dob: "", rg: "", cpf: "", phone: "", email: "", position: "" });
    const [credentials, setCredentials] = useState<Credentials>({ password: "", confirmPassword: "" });
    const [doctorDocuments, setDoctorDocuments] = useState<DoctorDocumentsState>(initialDoctorDocsStateValue);
    const [specialistDocuments, setSpecialistDocuments] = useState<SpecialistDocumentsState>(initialSpecialistDocsStateValue);
    const [hospitalDocuments, setHospitalDocuments] = useState<HospitalDocumentsState>(initialHospitalDocsStateValue);
    const [legalRepDocuments, setLegalRepDocuments] = useState<LegalRepDocumentsState>(initialLegalRepDocsStateValue);
    const [isCepLoading, setIsCepLoading] = useState(false);
    const [isHospitalCepLoading, setIsHospitalCepLoading] = useState(false);

    // --- CORREÇÃO: Lógica de redirecionamento para usuário já logado ---
    // Se a autenticação já carregou e existe um usuário, não mostramos o formulário.
    // Em vez disso, redirecionamos para evitar o erro "Cannot update a component while rendering".
    useEffect(() => {
        if (!authLoading && authUser) {
            // Apenas redireciona se estiver na página de registro e já logado.
            // O ideal é que um layout superior gerencie isso, mas um push para a home resolve.
            router.push('/');  
        }
    }, [authLoading, authUser, router]);

    // --- LÓGICA DE ETAPAS ATUALIZADA ---
    const stepsConfig = useMemo(() => {
        if (!role) return [{ id: 'role', label: 'Tipo' }];
        
        if (role === 'doctor') {
            // Se o objetivo ainda não foi definido, mostra a tela de seleção de objetivo
            if (!doctorObjective) {
                return [{ id: 'role', label: 'Tipo' }, { id: 'doctorObjective', label: 'Objetivo' }];
            }

            const baseSteps = [
                { id: 'role', label: 'Tipo' },
                { id: 'doctorObjective', label: 'Objetivo' },
                { id: 'personalInfo', label: 'Dados Pessoais' },
                { id: 'specialties', label: 'Especialidades' }
            ];

            // Se for o fluxo rápido da caravana, pula para a senha
            if (doctorObjective === 'caravan') {
                return [...baseSteps, { id: 'credentials', label: 'Senha' }, { id: 'summary', label: 'Revisão' }];
            }

            // Se for o fluxo completo de match
            const fullMatchSteps = [ ...baseSteps, { id: 'addressInfo', label: 'Endereço' }, { id: 'essentialDocs', label: 'Docs Essenciais' }, { id: 'certsAndCvDocs', label: 'Certidões/CV' }, { id: 'isSpecialist', label: 'Especialidade?' } ];
            const specialistStep = isSpecialist ? [{ id: 'specialistDocs', label: 'Docs Especialista' }] : [];
            return [...fullMatchSteps, ...specialistStep, { id: 'credentials', label: 'Senha' }, { id: 'summary', label: 'Revisão' }];
        }
        
        // Etapas do hospital não mudam
        return [ { id: 'role', label: 'Tipo' }, { id: 'hospitalInfo', label: 'Dados Empresa' }, { id: 'hospitalAddress', label: 'Endereço Empresa' }, { id: 'hospitalDocs', label: 'Docs Empresa' }, { id: 'legalRepInfo', label: 'Responsável' }, { id: 'legalRepDocs', label: 'Docs Responsável' }, { id: 'credentials', label: 'Senha' }, { id: 'summary', label: 'Revisão' } ];
    }, [role, doctorObjective, isSpecialist]);

    const currentStepIndex = step;
    const currentStepConfig = stepsConfig[currentStepIndex];
    const totalSteps = stepsConfig.length;

    useEffect(() => {
        console.log(`[RegisterPage] Step Changed. Index: ${currentStepIndex}, ID: ${currentStepConfig?.id}`);
    }, [currentStepIndex, currentStepConfig]);
    
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isValidCPF = (cpf: string) => /^\d{11}$/.test(cpf.replace(/[^\d]/g, ""));
    const isValidCNPJ = (cnpj: string) => /^\d{14}$/.test(cnpj.replace(/[^\d]/g, ""));
    const isValidCEP = (cep: string) => /^\d{8}$/.test(cep.replace(/[^\d]/g, ""));
    const isValidPhone = (phone: string) => /^\d{10,11}$/.test(phone.replace(/[^\d]/g, ""));
    const isValidRG = (rg: string) => !!rg && rg.replace(/[^\dX.-]/gi, '').length >= 5;
    const isValidDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date) < new Date();
    const isValidPassword = (password: string) => password.length >= 6;
    const isNotEmpty = (value: string | undefined | null) => !!value && value.trim().length > 0;
    const isFileStatePresent = (fileState: FileWithProgress | null | undefined) => !!fileState && (!!fileState.url || !!fileState.file);
    
    const handleInputChangeCallback = useCallback((setState: React.Dispatch<React.SetStateAction<any>>, field: string) =>
        (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            setState((prev: any) => ({ ...prev, [field]: e.target.value }));
    }, []);

    const handleIMaskAcceptCallback = useCallback((setState: React.Dispatch<React.SetStateAction<any>>, field: string) =>
        (value: string, maskRef: any) => {
            setState((prev: any) => ({ ...prev, [field]: value.replace(/[^\d]/g, "") }));
    }, []);

    const updateFileState = useCallback((
        docKey: AllDocumentKeys,
        updater: (prevState: FileWithProgress) => FileWithProgress
    ) => {
        const keyStr = docKey as string;
        if (doctorDocKeysArray.map(String).includes(keyStr)) {
            setDoctorDocuments(prev => ({ ...prev, [docKey as DoctorDocKeys]: updater(prev[docKey as DoctorDocKeys]) }));
        } else if (specialistDocKeysArray.map(String).includes(keyStr)) {
            setSpecialistDocuments(prev => ({ ...prev, [docKey as SpecialistDocKeys]: updater(prev[docKey as SpecialistDocKeys]) }));
        } else if (hospitalDocKeysArray.map(String).includes(keyStr)) {
            setHospitalDocuments(prev => ({ ...prev, [docKey as HospitalDocKeys]: updater(prev[docKey as HospitalDocKeys]) }));
        } else if (legalRepDocKeysArray.map(String).includes(keyStr)) {
            setLegalRepDocuments(prev => ({ ...prev, [docKey as LegalRepDocKeys]: updater(prev[docKey as LegalRepDocKeys]) }));
        }
    }, []);

    const handleFileSelect = useCallback(( e: ChangeEvent<HTMLInputElement>, docKey: AllDocumentKeys ) => {
        const file = e.target.files ? e.target.files[0] : null;
        const originalInputEl = e.target;

        if (!file) {
            updateFileState(docKey, (prev) => ({ ...initialFileState, name: prev.name || DOCUMENT_LABELS[docKey].replace('*','') }));
            originalInputEl.value = '';
            return;
        }

        const maxSizeMB = 5;
        if (file.size > maxSizeMB * 1024 * 1024) {
            toast({ variant: "destructive", title: "Arquivo Muito Grande", description: `O limite é ${maxSizeMB}MB.` });
            originalInputEl.value = '';
            return;
        }
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            toast({ variant: "destructive", title: "Tipo de Arquivo Inválido", description: `Aceitos: PDF, JPG, PNG.` });
            originalInputEl.value = '';
            return;
        }

        updateFileState(docKey, () => ({
            file,
            name: file.name,
            progress: 0,
            isUploading: false,
            url: undefined,
            error: undefined
        }));
    }, [toast, updateFileState]);

    const renderFileInput = useCallback((docKey: AllDocumentKeys) => {
        const labelText = DOCUMENT_LABELS[docKey];
        const isRequired = labelText.includes('*');
        const cleanLabel = labelText.replace('*', '');
        const inputId = `file-${docKey}`;
    
        let fileState: FileWithProgress = { ...initialFileState, name: cleanLabel };
    
        const keyStr = docKey as string;
        if (doctorDocKeysArray.map(String).includes(keyStr) && doctorDocuments[docKey as DoctorDocKeys]) {
            fileState = doctorDocuments[docKey as DoctorDocKeys];
        } else if (specialistDocKeysArray.map(String).includes(keyStr) && specialistDocuments[docKey as SpecialistDocKeys]) {
            fileState = specialistDocuments[docKey as SpecialistDocKeys];
        } else if (hospitalDocKeysArray.map(String).includes(keyStr) && hospitalDocuments[docKey as HospitalDocKeys]) {
            fileState = hospitalDocuments[docKey as HospitalDocKeys];
        } else if (legalRepDocKeysArray.map(String).includes(keyStr) && legalRepDocuments[docKey as LegalRepDocKeys]) {
            fileState = legalRepDocuments[docKey as LegalRepDocKeys];
        }
    
        return (
            <div key={docKey} className="space-y-1.5 border p-3 rounded-md bg-white shadow-sm">
                <Label htmlFor={inputId} className="text-sm font-medium flex justify-between items-center w-full">
                    <span className="flex items-center">
                        {cleanLabel}
                        {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                    </span>
                    {fileState.url && !fileState.isUploading && !fileState.error && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                    {fileState.error && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                    {!fileState.url && !fileState.error && fileState.file && !fileState.isUploading && <FileUp className="h-4 w-4 text-blue-500 shrink-0" />}
                </Label>
                <Input
                    id={inputId}
                    type="file"
                    key={inputId + (fileState.file ? '-selected' : '-empty') + (fileState.url ? '-uploaded' : '')}
                    onChange={(e) => handleFileSelect(e, docKey)}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="block w-full text-xs text-gray-500 cursor-pointer file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={fileState.isUploading || isLoading}
                />
                {fileState.file && !fileState.isUploading && !fileState.url && (
                     <p className="text-xs text-blue-600 truncate" title={fileState.name}>Selecionado: {fileState.name}</p>
                )}
                {fileState.isUploading && (
                    <div className="space-y-1">
                        <Progress value={fileState.progress} className="h-1.5 mt-1" />
                        <p className="text-xs text-gray-500 text-center">Enviando: {fileState.progress}%</p>
                    </div>
                )}
                {fileState.url && !fileState.isUploading && (
                    <div className="text-xs mt-1 flex items-center justify-between">
                        <Link href={fileState.url} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline truncate max-w-[calc(100%-3rem)] flex items-center" title={`Ver ${fileState.name}`}>
                           <ExternalLink size={14} className="mr-1 shrink-0"/> {fileState.name || "Ver arquivo enviado"}
                        </Link>
                        <Button
                            variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                            onClick={() => updateFileState(docKey, (prev) => ({ ...initialFileState, name: prev.name }))}
                            title="Remover arquivo"
                            disabled={isLoading}
                        >
                            <XCircleIcon className="h-4 w-4 text-gray-500 hover:text-red-500"/>
                        </Button>
                    </div>
                )}
                 {fileState.error && <p className="text-xs text-red-500 mt-1 break-all">{fileState.error}</p>}
                 {!fileState.file && !fileState.url && !fileState.error && !fileState.isUploading && (
                     <p className="text-xs text-gray-400 italic">Nenhum arquivo selecionado.</p>
                 )}
            </div>
        );
    }, [doctorDocuments, specialistDocuments, hospitalDocuments, legalRepDocuments, handleFileSelect, updateFileState, isLoading]);

    const handleEditStep = useCallback((stepId: string) => {
        const stepIndex = stepsConfig.findIndex(s => s.id === stepId);
        if (stepIndex !== -1) {
            setStep(stepIndex);
        } else {
            setStep(1);
        }
    }, [stepsConfig]);

    const fetchAddressFromCep = useCallback(async (
        cep: string,
        targetStateSetter: React.Dispatch<React.SetStateAction<AddressInfo>>,
        targetLoadingSetter: React.Dispatch<React.SetStateAction<boolean>>
    ) => {
        const cleanedCep = cep.replace(/\D/g, "");
        if (cleanedCep.length !== 8) {
            if (cleanedCep.length > 0) {
              toast({ variant: "destructive", title: "CEP Inválido", description: "O CEP deve conter 8 números." });
            }
            targetStateSetter(prev => ({ ...prev, cep: cleanedCep, street: "", neighborhood: "", city: "", state: ""}));
            return;
        }

        targetLoadingSetter(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
            if (!response.ok) {
                throw new Error('Falha ao buscar CEP.');
            }
            const data = await response.json();

            if (data.erro) {
                toast({ variant: "destructive", title: "CEP não encontrado", description: "O CEP informado não foi localizado." });
                targetStateSetter(prev => ({ ...prev, cep: cleanedCep, street: "", neighborhood: "", city: "", state: ""}));
            } else {
                targetStateSetter(prev => ({
                    ...prev,
                    cep: cleanedCep,
                    street: data.logradouro || "",
                    neighborhood: data.bairro || "",
                    city: data.localidade || "",
                    state: data.uf || "",
                }));
                toast({ variant: "default", title: "Endereço Encontrado!", description: "Os campos de endereço foram preenchidos." });
                const nextElementId = targetStateSetter === setAddressInfo ? 'number' : 'hosp-number';
                document.getElementById(nextElementId)?.focus();
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro na Busca de CEP", description: error.message || "Não foi possível buscar o endereço." });
        } finally {
            targetLoadingSetter(false);
        }
    }, [toast]);

    const handleNextStep = useCallback(() => {
        let isValid = true;
        let errorTitle = "Campos Inválidos";
        let errorDescription = "Por favor, revise os campos destacados ou obrigatórios.";

        const validate = (condition: boolean, message?: string) => {
            if (!condition) {
                isValid = false;
                if (message && errorDescription === "Por favor, revise os campos destacados ou obrigatórios.") {
                    errorDescription = message;
                }
            }
            return condition;
        };

        switch (currentStepConfig?.id) {
            case 'personalInfo':
                validate(isNotEmpty(personalInfo.name), "Nome completo é obrigatório.");
                validate(isValidDate(personalInfo.dob), "Data de nascimento inválida.");
                validate(isValidRG(personalInfo.rg), "RG inválido.");
                validate(isValidCPF(personalInfo.cpf), "CPF inválido.");
                validate(isValidPhone(personalInfo.phone), "Telefone inválido.");
                validate(isValidEmail(personalInfo.email), "Email de login inválido.");
                break;
            case 'addressInfo':
                validate(isValidCEP(addressInfo.cep.replace(/\D/g, "")), "CEP inválido.");
                validate(isNotEmpty(addressInfo.street), "Rua é obrigatória.");
                validate(isNotEmpty(addressInfo.number), "Número é obrigatório.");
                validate(isNotEmpty(addressInfo.neighborhood), "Bairro é obrigatório.");
                validate(isNotEmpty(addressInfo.city), "Cidade é obrigatória.");
                validate(isNotEmpty(addressInfo.state) && addressInfo.state.length === 2, "UF inválido.");
                break;
            case 'essentialDocs':
                const essentialKeys: DoctorDocKeys[] = ['personalRg', 'personalCpf', 'professionalCrm', 'addressProof', 'graduationCertificate', 'photo3x4'];
                validate(
                    !essentialKeys.some(key => !isFileStatePresent(doctorDocuments[key])),
                    "Todos os documentos essenciais (marcados com *) são obrigatórios."
                );
                break;
            case 'certsAndCvDocs':
                const certKeys: DoctorDocKeys[] = ['criminalRecordCert', 'ethicalCert', 'debtCert', 'cv'];
                validate(
                    !certKeys.some(key => !isFileStatePresent(doctorDocuments[key])),
                    "Todas as certidões e o CV (marcados com *) são obrigatórios."
                );
                break;
            case 'isSpecialist':
                break;
            case 'specialistDocs':
                if (isSpecialist) {
                    const specialistRequiredKeys: SpecialistDocKeys[] = ['rqe', 'postGradCert', 'specialistTitle'];
                    validate(
                        !specialistRequiredKeys.some(key => !isFileStatePresent(specialistDocuments[key])),
                        "Documentos de especialista (RQE, Cert. Pós-Graduação, Título - marcados com *) são obrigatórios."
                    );
                }
                break;
            case 'hospitalInfo':
                validate(isNotEmpty(hospitalInfo.companyName), "Razão Social é obrigatória.");
                validate(isValidCNPJ(hospitalInfo.cnpj), "CNPJ inválido.");
                validate(isValidPhone(hospitalInfo.phone), "Telefone da empresa inválido.");
                validate(isValidEmail(hospitalInfo.email), "Email da empresa inválido.");
                break;
            case 'hospitalAddress':
                validate(isValidCEP(hospitalAddressInfo.cep.replace(/\D/g, "")), "CEP da empresa inválido.");
                validate(isNotEmpty(hospitalAddressInfo.street), "Rua da empresa é obrigatória.");
                validate(isNotEmpty(hospitalAddressInfo.number), "Número da empresa é obrigatório.");
                validate(isNotEmpty(hospitalAddressInfo.neighborhood), "Bairro da empresa é obrigatório.");
                validate(isNotEmpty(hospitalAddressInfo.city), "Cidade da empresa é obrigatória.");
                validate(isNotEmpty(hospitalAddressInfo.state) && hospitalAddressInfo.state.length === 2, "UF da empresa inválido.");
                break;
            case 'hospitalDocs':
                const hospitalRequiredKeys: HospitalDocKeys[] = ['socialContract', 'cnpjCard', 'companyAddressProof'];
                validate(
                    !hospitalRequiredKeys.some(key => !isFileStatePresent(hospitalDocuments[key])),
                    "Documentos da empresa (marcados com *) são obrigatórios."
                );
                break;
            case 'legalRepInfo':
                validate(isNotEmpty(legalRepresentativeInfo.name), "Nome do responsável é obrigatório.");
                validate(isValidDate(legalRepresentativeInfo.dob), "Data de nasc. do responsável inválida.");
                validate(isValidRG(legalRepresentativeInfo.rg), "RG do responsável inválido.");
                validate(isValidCPF(legalRepresentativeInfo.cpf), "CPF do responsável inválido.");
                validate(isValidPhone(legalRepresentativeInfo.phone), "Telefone do responsável inválido.");
                validate(isValidEmail(legalRepresentativeInfo.email), "Email pessoal do responsável inválido.");
                validate(isNotEmpty(legalRepresentativeInfo.position), "Cargo do responsável é obrigatório.");
                break;
            case 'legalRepDocs':
                const legalRepRequiredKeys: LegalRepDocKeys[] = ['repRg', 'repCpf', 'repAddressProof'];
                validate(
                    !legalRepRequiredKeys.some(key => !isFileStatePresent(legalRepDocuments[key])),
                    "Documentos do responsável (marcados com *) são obrigatórios."
                );
                break;
            case 'credentials':
                const loginEmail = role === 'doctor' ? personalInfo.email : hospitalInfo.email;
                if (!validate(isValidEmail(loginEmail), "O email de login parece inválido. Volte e corrija.")) {
                    errorTitle = "Email de Login Inválido";
                } else if (!validate(isValidPassword(credentials.password), "Senha deve ter no mínimo 6 caracteres.")) {
                    errorTitle = "Senha Inválida";
                } else if (!validate(credentials.password === credentials.confirmPassword, "As senhas não coincidem.")) {
                    errorTitle = "Senhas Divergentes";
                }
                break;
            case 'doctorObjective':
                validate(!!doctorObjective, "Você precisa selecionar um objetivo para continuar.");
                break;
            case 'specialties':
                validate(selectedSpecialties.length > 0, "Selecione pelo menos uma especialidade.");
                break;
        }

        if (isValid) {
            if (role === 'doctor' && doctorObjective === 'caravan' && currentStepConfig?.id === 'specialties') {
                const credentialsStepIndex = stepsConfig.findIndex(s => s.id === 'credentials');
                if (credentialsStepIndex !== -1) {
                    setStep(credentialsStepIndex);
                    window.scrollTo(0, 0);
                    return;
                }
            }
            if (step < totalSteps - 1) {
                setStep(s => s + 1);
                window.scrollTo(0, 0);
            }
        } else {
            toast({ variant: "destructive", title: errorTitle, description: errorDescription });
        }
    }, [step, totalSteps, currentStepConfig, role, personalInfo, addressInfo, doctorDocuments, isSpecialist, specialistDocuments, hospitalInfo, hospitalAddressInfo, hospitalDocuments, legalRepresentativeInfo, legalRepDocuments, credentials, toast, doctorObjective, selectedSpecialties, stepsConfig]);

    const handlePrevStep = () => {
        if (role === 'doctor' && doctorObjective === 'caravan' && currentStepConfig?.id === 'credentials') {
             const specialtiesStepIndex = stepsConfig.findIndex(s => s.id === 'specialties');
             if (specialtiesStepIndex !== -1) {
                 setStep(specialtiesStepIndex);
                 window.scrollTo(0,0);
                 return;
             }
        }
        if (step > 0) {
            setStep(s => s - 1);
            window.scrollTo(0, 0);
        }
    };

    const handleSubmit = async () => {
        if (!role || currentStepConfig?.id !== 'summary') {
            toast({ variant: "destructive", title: "Erro ao Finalizar", description: "Não é possível finalizar nesta etapa." });
            return;
        }
        setIsLoading(true);

        const loginEmail = role === 'doctor' ? personalInfo.email : hospitalInfo.email;
        const displayName = role === 'doctor' ? personalInfo.name : hospitalInfo.companyName;

        try {
            toast({ title: "Etapa 1/3: Criando sua conta...", duration: 3000 });
            const firebaseUser = await createAuthUser(loginEmail, credentials.password, displayName);
            const userId = firebaseUser.uid;

            toast({ title: "Etapa 2/3: Enviando documentos...", duration: 3000 });
            const finalDocRefs: {
                documents: Partial<DoctorDocumentsRef>; specialistDocuments: Partial<SpecialistDocumentsRef>;
                hospitalDocs: Partial<HospitalDocumentsRef>; legalRepDocuments: Partial<LegalRepDocumentsRef>;
            } = { documents: {}, specialistDocuments: {}, hospitalDocs: {}, legalRepDocuments: {} };

            const filesToProcess: { docKey: AllDocumentKeys, fileState: FileWithProgress, typePathFragment: string, subFolder?: string }[] = [];

            if (role === 'doctor' && doctorObjective === 'match') {
                doctorDocKeysArray.forEach(key => {
                    if (doctorDocuments[key].file) filesToProcess.push({ docKey: key, fileState: doctorDocuments[key], typePathFragment: "doctor_documents" });
                    else if (doctorDocuments[key].url) (finalDocRefs.documents as any)[key] = doctorDocuments[key].url;
                });
                if (isSpecialist) {
                    specialistDocKeysArray.forEach(key => {
                        if (specialistDocuments[key].file) filesToProcess.push({ docKey: key, fileState: specialistDocuments[key], typePathFragment: "doctor_documents", subFolder: "specialist" });
                        else if (specialistDocuments[key].url) (finalDocRefs.specialistDocuments as any)[key] = specialistDocuments[key].url;
                    });
                }
            } else if (role === 'hospital') {
                hospitalDocKeysArray.forEach(key => {
                    if (hospitalDocuments[key].file) filesToProcess.push({ docKey: key, fileState: hospitalDocuments[key], typePathFragment: "hospital_documents" });
                    else if (hospitalDocuments[key].url) (finalDocRefs.hospitalDocs as any)[key] = hospitalDocuments[key].url;
                });
                legalRepDocKeysArray.forEach(key => {
                    if (legalRepDocuments[key].file) filesToProcess.push({ docKey: key, fileState: legalRepDocuments[key], typePathFragment: "hospital_documents", subFolder: "legal_rep" });
                    else if (legalRepDocuments[key].url) (finalDocRefs.legalRepDocuments as any)[key] = legalRepDocuments[key].url;
                });
            }
            
            let allUploadsSuccessful = true;
            if (filesToProcess.length > 0) {
                const uploadPromises = filesToProcess.map(item => {
                    updateFileState(item.docKey, prev => ({ ...prev, isUploading: true, progress: 0, error: undefined }));
                    const fileName = `${item.docKey}_${Date.now()}_${item.fileState.file!.name}`;
                    const storagePath = item.subFolder ?
                        `${item.typePathFragment}/${userId}/${item.subFolder}/${fileName}` :
                        `${item.typePathFragment}/${userId}/${fileName}`;

                    return uploadFileToStorage(item.fileState.file!, storagePath, (progress) => {
                        updateFileState(item.docKey, prev => ({ ...prev, progress }));
                    }).then(url => {
                        updateFileState(item.docKey, prev => ({ ...prev, url, isUploading: false, file: null, name: prev.name || item.fileState.file!.name }));
                        return { key: item.docKey, url, typePathFragment: item.typePathFragment, subFolder: item.subFolder };
                    }).catch(uploadError => {
                        allUploadsSuccessful = false;
                        const errorMessage = (uploadError as Error).message || "Falha no upload.";
                        updateFileState(item.docKey, prev => ({ ...prev, isUploading: false, error: errorMessage }));
                        toast({ title: `Erro Upload (${DOCUMENT_LABELS[item.docKey].replace('*','')})`, description: errorMessage, variant: "destructive", duration: 7000});
                        return null;
                    });
                });
                const uploadResults = await Promise.all(uploadPromises);
                if (uploadResults.some(r => r === null)) allUploadsSuccessful = false;

                uploadResults.forEach(result => {
                    if (result) {
                        if (result.typePathFragment === "doctor_documents") {
                            if (result.subFolder === "specialist") (finalDocRefs.specialistDocuments as any)[result.key] = result.url;
                            else (finalDocRefs.documents as any)[result.key] = result.url;
                        } else if (result.typePathFragment === "hospital_documents") {
                            if (result.subFolder === "legal_rep") (finalDocRefs.legalRepDocuments as any)[result.key] = result.url;
                            else (finalDocRefs.hospitalDocs as any)[result.key] = result.url;
                        }
                    }
                });
            }

            if (!allUploadsSuccessful) {
                throw new Error("Um ou mais uploads de documentos falharam. Verifique os arquivos e tente novamente.");
            }

            toast({ title: "Etapa 3/3: Finalizando cadastro...", duration: 3000 });
            let registrationData: DoctorRegistrationPayload | HospitalRegistrationPayload;

            if (role === 'doctor') {
                const { name: _pName, email: _pEmail, ...personalDetails } = personalInfo;
                
                const doctorData: DoctorRegistrationPayload = {
                    ...personalDetails,
                    professionalCrm: personalInfo.rg,
                    specialties: selectedSpecialties,
                    isSpecialist: isSpecialist,
                    documents: finalDocRefs.documents,
                    specialistDocuments: isSpecialist ? finalDocRefs.specialistDocuments : {},
                    registrationObjective: doctorObjective || 'match',
                };

                if (doctorObjective === 'match') {
                    doctorData.address = { ...addressInfo, cep: addressInfo.cep.replace(/\D/g, "") };
                }
                
                registrationData = doctorData;

            } else { // Hospital
                const { companyName: _cName, email: _hEmail, ...hospitalDetails } = hospitalInfo;
                registrationData = {
                    ...hospitalDetails,
                    address: { ...hospitalAddressInfo, cep: hospitalAddressInfo.cep.replace(/\D/g, "") },
                    legalRepresentativeInfo: legalRepresentativeInfo,
                    hospitalDocs: finalDocRefs.hospitalDocs,
                    legalRepDocuments: finalDocRefs.legalRepDocuments,
                };
            }
            
            await completeUserRegistration(userId, loginEmail, displayName, role, registrationData);
            
            setRegistrationComplete(true);
            const newDashboardPath = role === 'doctor' ? '/dashboard' : '/hospital/dashboard';
            setTargetDashboardPath(newDashboardPath);

            toast({ variant: "default", title: "Cadastro Realizado!", description: "Redirecionando para o painel...", duration: 3000 });

        } catch (error: any) {
            let title = "Erro no Cadastro";
            let description = error.message || "Ocorreu um erro inesperado.";
            if (error instanceof FirebaseError) {
                switch (error.code) {
                    case 'auth/email-already-in-use': title = "Email já Cadastrado"; description = "Este email já está em uso."; break;
                }
            }
            toast({ variant: "destructive", title: title, description: description, duration: 7000 });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (registrationComplete && targetDashboardPath) {
            router.push(targetDashboardPath);
        }
    }, [registrationComplete, targetDashboardPath, router]);


    const renderCurrentStep = () => {
        if (!currentStepConfig) {
            return <div className="p-4 text-center text-red-500">Erro: Etapa inválida.</div>;
        }
        switch (currentStepConfig.id) {
            case 'role':
                return (
                    <div className="space-y-4 animate-fade-in">
                        <Label className="text-base font-semibold block text-center mb-6">Selecione o tipo de cadastro:</Label>
                        <RadioGroup value={role ?? ""} onValueChange={(value) => { setRole(value as UserType); setStep(s => s + 1); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Label htmlFor="role-doctor" className={cn("flex flex-col items-center justify-center p-6 border rounded-lg cursor-pointer transition-colors hover:bg-blue-50 hover:border-blue-400", role === 'doctor' ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500" : "bg-white border-gray-300")}>
                                <RadioGroupItem value="doctor" id="role-doctor" className="sr-only" />
                                <Stethoscope className={cn("h-10 w-10 mb-3", role === 'doctor' ? "text-blue-700" : "text-gray-500")} />
                                <span className={cn("font-medium", role === 'doctor' ? "text-blue-800" : "text-gray-700")}>Sou Médico(a) / Profissional</span>
                            </Label>
                            <Label htmlFor="role-hospital" className={cn("flex flex-col items-center justify-center p-6 border rounded-lg cursor-pointer transition-colors hover:bg-blue-50 hover:border-blue-400", role === 'hospital' ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500" : "bg-white border-gray-300")}>
                                <RadioGroupItem value="hospital" id="role-hospital" className="sr-only" />
                                <Building className={cn("h-10 w-10 mb-3", role === 'hospital' ? "text-blue-700" : "text-gray-500")} />
                                <span className={cn("font-medium", role === 'hospital' ? "text-blue-800" : "text-gray-700")}>Sou Empresa / Hospital</span>
                            </Label>
                        </RadioGroup>
                        {!role && step === 0 && <p className="text-sm text-red-600 pt-4 text-center">Selecione uma opção para iniciar.</p>}
                    </div>
                );
            case 'doctorObjective':
                return (
                     <div className="space-y-4 animate-fade-in">
                        <Label className="text-base font-semibold block text-center mb-6">Qual seu objetivo principal na plataforma?</Label>
                        <RadioGroup value={doctorObjective ?? ""} onValueChange={(value) => setDoctorObjective(value as 'caravan' | 'match')} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Label htmlFor="objective-caravan" className={cn("flex flex-col items-center justify-center p-6 border rounded-lg cursor-pointer transition-colors hover:bg-blue-50 hover:border-blue-400", doctorObjective === 'caravan' ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500" : "bg-white border-gray-300")}>
                                <RadioGroupItem value="caravan" id="objective-caravan" className="sr-only" />
                                <HeartPulse className={cn("h-10 w-10 mb-3", doctorObjective === 'caravan' ? "text-blue-700" : "text-gray-500")} />
                                <span className={cn("font-medium text-center", doctorObjective === 'caravan' ? "text-blue-800" : "text-gray-700")}>Participar de projetos (Caravana)</span>
                                <span className="text-xs text-gray-500 mt-1">Cadastro rápido e focado.</span>
                            </Label>
                            <Label htmlFor="objective-match" className={cn("flex flex-col items-center justify-center p-6 border rounded-lg cursor-pointer transition-colors hover:bg-blue-50 hover:border-blue-400", doctorObjective === 'match' ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500" : "bg-white border-gray-300")}>
                                <RadioGroupItem value="match" id="objective-match" className="sr-only" />
                                <Briefcase className={cn("h-10 w-10 mb-3", doctorObjective === 'match' ? "text-blue-700" : "text-gray-500")} />
                                <span className={cn("font-medium text-center", doctorObjective === 'match' ? "text-blue-800" : "text-gray-700")}>Buscar oportunidades de plantão</span>
                                <span className="text-xs text-gray-500 mt-1">Cadastro completo para verificação.</span>
                            </Label>
                        </RadioGroup>
                    </div>
                );
            case 'personalInfo':
                return (
                    <form autoComplete="off" onSubmit={(e) => {e.preventDefault(); handleNextStep();}} className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">Dados Pessoais</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="space-y-1"><Label htmlFor="name">Nome Completo*</Label><Input id="name" value={personalInfo.name} onChange={handleInputChangeCallback(setPersonalInfo, 'name')} required /></div>
                            <div className="space-y-1"><Label htmlFor="dob">Nascimento*</Label><Input id="dob" type="date" value={personalInfo.dob} onChange={handleInputChangeCallback(setPersonalInfo, 'dob')} required max={new Date().toISOString().split("T")[0]}/></div>
                            <div className="space-y-1"><Label htmlFor="rg">RG*</Label><Input id="rg" value={personalInfo.rg} onChange={handleInputChangeCallback(setPersonalInfo, 'rg')} required /></div>
                            <div className="space-y-1"><Label htmlFor="cpf">CPF*</Label><InputWithIMask id="cpf" maskOptions={{ mask: '000.000.000-00' }} defaultValue={personalInfo.cpf} onAccept={handleIMaskAcceptCallback(setPersonalInfo, 'cpf')} required placeholder="000.000.000-00" /></div>
                            <div className="space-y-1"><Label htmlFor="phone">Telefone Celular*</Label><InputWithIMask id="phone" maskOptions={{ mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }] }} defaultValue={personalInfo.phone} onAccept={handleIMaskAcceptCallback(setPersonalInfo, 'phone')} required placeholder="(00) 90000-0000" type="tel" /></div>
                            <div className="space-y-1"><Label htmlFor="email">Email (Login)*</Label><Input id="email" type="email" value={personalInfo.email} onChange={handleInputChangeCallback(setPersonalInfo, 'email')} required /></div>
                        </div>
                    </form>
                );
            case 'specialties':
                const handleSpecialtyChange = (specialty: string, checked: boolean) => {
                    setSelectedSpecialties(prev => checked ? [...prev, specialty] : prev.filter(s => s !== specialty));
                };
                return (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">Selecione suas especialidades*</h3>
                        <p className="text-sm text-gray-500">Marque todas as áreas em que você atua. Isto é fundamental para o direcionamento dos pacientes.</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                            {availableSpecialties.map(spec => (
                                <div key={spec} className="flex items-center space-x-2">
                                    <Checkbox id={`spec-${spec}`} checked={selectedSpecialties.includes(spec)} onCheckedChange={(checked) => handleSpecialtyChange(spec, !!checked)} />
                                    <Label htmlFor={`spec-${spec}`} className="font-normal cursor-pointer">{spec}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'addressInfo':
                 return (
                      <form autoComplete="off" onSubmit={(e) => {e.preventDefault(); handleNextStep();}} className="space-y-4 animate-fade-in">
                          <h3 className="text-lg font-semibold border-b pb-2 mb-4">Endereço Pessoal</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                              <div className="space-y-1 md:col-span-1 relative">
                                  <Label htmlFor="cep">CEP*</Label>
                                  <InputWithIMask id="cep" maskOptions={{ mask: '00000-000' }} defaultValue={addressInfo.cep} onAccept={handleIMaskAcceptCallback(setAddressInfo, 'cep')} required placeholder="00000-000" onBlur={(e) => fetchAddressFromCep(e.target.value, setAddressInfo, setIsCepLoading)} disabled={isCepLoading} />
                                  {isCepLoading && <Loader2 className="absolute right-2 top-8 h-5 w-5 animate-spin text-gray-400" />}
                              </div>
                              <div className="space-y-1 md:col-span-2"><Label htmlFor="street">Rua/Avenida*</Label><Input id="street" value={addressInfo.street} onChange={handleInputChangeCallback(setAddressInfo, 'street')} required  disabled={isCepLoading}/></div>
                              <div className="space-y-1"><Label htmlFor="number">Número*</Label><Input id="number" value={addressInfo.number} onChange={handleInputChangeCallback(setAddressInfo, 'number')} required /></div>
                              <div className="space-y-1"><Label htmlFor="complement">Complemento</Label><Input id="complement" value={addressInfo.complement ?? ""} onChange={handleInputChangeCallback(setAddressInfo, 'complement')} /></div>
                              <div className="space-y-1"><Label htmlFor="neighborhood">Bairro*</Label><Input id="neighborhood" value={addressInfo.neighborhood} onChange={handleInputChangeCallback(setAddressInfo, 'neighborhood')} required disabled={isCepLoading}/></div>
                              <div className="space-y-1"><Label htmlFor="city">Cidade*</Label><Input id="city" value={addressInfo.city} onChange={handleInputChangeCallback(setAddressInfo, 'city')} required disabled={isCepLoading}/></div>
                              <div className="space-y-1"><Label htmlFor="state">Estado (UF)*</Label><Input id="state" value={addressInfo.state} onChange={handleInputChangeCallback(setAddressInfo, 'state')} maxLength={2} required placeholder="SP" disabled={isCepLoading}/></div>
                          </div>
                      </form>
                  );
            case 'essentialDocs':
                const essentialDocKeysForRender: DoctorDocKeys[] = ['personalRg', 'personalCpf', 'professionalCrm', 'photo3x4', 'addressProof', 'graduationCertificate'];
                return (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">Documentos Essenciais</h3>
                        <p className="text-xs text-gray-500 mb-3">Formatos: PDF, JPG, PNG. Máx: 5MB.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                            {essentialDocKeysForRender.map(key => renderFileInput(key as AllDocumentKeys))}
                        </div>
                    </div>
                );
            case 'certsAndCvDocs':
                const certsDocKeysForRender: DoctorDocKeys[] = ['criminalRecordCert', 'ethicalCert', 'debtCert', 'cv'];
                return (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">Certidões e Currículo</h3>
                        <p className="text-xs text-gray-500 mb-3">Formatos: PDF, JPG, PNG. Máx: 5MB.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                             {certsDocKeysForRender.map(key => renderFileInput(key as AllDocumentKeys))}
                        </div>
                    </div>
                );
            case 'isSpecialist':
                 return (
                     <div className="space-y-4 animate-fade-in">
                         <h3 className="text-lg font-semibold border-b pb-2 mb-4">Especialidade Médica</h3>
                         <div className="flex items-center space-x-3 p-4 border rounded-md bg-blue-50 border-blue-200 shadow-sm">
                             <Switch id="is-specialist-switch" checked={isSpecialist} onCheckedChange={setIsSpecialist} />
                             <Label htmlFor="is-specialist-switch" className="font-medium text-gray-700 cursor-pointer">Possui Registro de Qualificação de Especialista (RQE)?</Label>
                         </div>
                         {isSpecialist ?
                             <p className="text-sm text-blue-700 mt-2 flex items-start gap-1.5"><Info size={16} className="shrink-0 relative top-0.5"/><span>Na próxima etapa, envie os documentos da sua especialidade.</span></p> :
                             <p className="text-sm text-gray-600 mt-2">Prossiga para definir sua senha.</p>
                         }
                     </div>
                 );
            case 'specialistDocs':
                const specialistDocKeysForRender: SpecialistDocKeys[] = ['rqe', 'postGradCert', 'specialistTitle', 'recommendationLetter'];
                return (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">Documentos de Especialista</h3>
                        <p className="text-xs text-gray-500 mb-3">Envie RQE, Cert. Pós-Graduação, Título. Carta de Recomendação é opcional.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                            {specialistDocKeysForRender.map(key => renderFileInput(key as AllDocumentKeys))}
                        </div>
                    </div>
                );
            case 'hospitalInfo':
                return (
                    <form autoComplete="off" onSubmit={(e) => {e.preventDefault(); handleNextStep();}} className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">Dados da Empresa</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="space-y-1 md:col-span-2"><Label htmlFor="companyName">Razão Social*</Label><Input id="companyName" value={hospitalInfo.companyName} onChange={handleInputChangeCallback(setHospitalInfo, 'companyName')} required /></div>
                            <div className="space-y-1"><Label htmlFor="cnpj">CNPJ*</Label><InputWithIMask id="cnpj" maskOptions={{ mask: '00.000.000/0000-00' }} defaultValue={hospitalInfo.cnpj} onAccept={handleIMaskAcceptCallback(setHospitalInfo, 'cnpj')} required placeholder="00.000.000/0000-00"/></div>
                            <div className="space-y-1"><Label htmlFor="stateRegistration">Inscrição Estadual</Label><Input id="stateRegistration" value={hospitalInfo.stateRegistration ?? ""} onChange={handleInputChangeCallback(setHospitalInfo, 'stateRegistration')} /><p className="text-xs text-gray-500">Deixe em branco se isento.</p></div>
                            <div className="space-y-1"><Label htmlFor="hospitalPhone">Telefone Comercial*</Label><InputWithIMask id="hospitalPhone" maskOptions={{ mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }] }} defaultValue={hospitalInfo.phone} onAccept={handleIMaskAcceptCallback(setHospitalInfo, 'phone')} required placeholder="(00) 0000-0000" type="tel"/></div>
                            <div className="space-y-1"><Label htmlFor="hospitalEmail">Email da Empresa (Login)*</Label><Input id="hospitalEmail" type="email" value={hospitalInfo.email} onChange={handleInputChangeCallback(setHospitalInfo, 'email')} required /></div>
                        </div>
                    </form>
                );
            case 'hospitalAddress':
                 return (
                     <form autoComplete="off" onSubmit={(e) => {e.preventDefault(); handleNextStep();}} className="space-y-4 animate-fade-in">
                         <h3 className="text-lg font-semibold border-b pb-2 mb-4">Endereço da Empresa</h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                             <div className="space-y-1 md:col-span-1 relative">
                                 <Label htmlFor="hosp-cep">CEP*</Label>
                                 <InputWithIMask id="hosp-cep" maskOptions={{ mask: '00000-000' }} defaultValue={hospitalAddressInfo.cep} onAccept={handleIMaskAcceptCallback(setHospitalAddressInfo, 'cep')} required placeholder="00000-000" onBlur={(e) => fetchAddressFromCep(e.target.value, setHospitalAddressInfo, setIsHospitalCepLoading)} disabled={isHospitalCepLoading} />
                                 {isHospitalCepLoading && <Loader2 className="absolute right-2 top-8 h-5 w-5 animate-spin text-gray-400" />}
                             </div>
                             <div className="space-y-1 md:col-span-2"><Label htmlFor="hosp-street">Rua/Avenida*</Label><Input id="hosp-street" value={hospitalAddressInfo.street} onChange={handleInputChangeCallback(setHospitalAddressInfo, 'street')} required disabled={isHospitalCepLoading}/></div>
                             <div className="space-y-1"><Label htmlFor="hosp-number">Número*</Label><Input id="hosp-number" value={hospitalAddressInfo.number} onChange={handleInputChangeCallback(setHospitalAddressInfo, 'number')} required /></div>
                             <div className="space-y-1"><Label htmlFor="hosp-complement">Complemento</Label><Input id="hosp-complement" value={hospitalAddressInfo.complement ?? ""} onChange={handleInputChangeCallback(setHospitalAddressInfo, 'complement')} /></div>
                             <div className="space-y-1"><Label htmlFor="hosp-neighborhood">Bairro*</Label><Input id="hosp-neighborhood" value={hospitalAddressInfo.neighborhood} onChange={handleInputChangeCallback(setHospitalAddressInfo, 'neighborhood')} required disabled={isHospitalCepLoading}/></div>
                             <div className="space-y-1"><Label htmlFor="hosp-city">Cidade*</Label><Input id="hosp-city" value={hospitalAddressInfo.city} onChange={handleInputChangeCallback(setHospitalAddressInfo, 'city')} required disabled={isHospitalCepLoading}/></div>
                             <div className="space-y-1"><Label htmlFor="hosp-state">Estado (UF)*</Label><Input id="hosp-state" value={hospitalAddressInfo.state} onChange={handleInputChangeCallback(setHospitalAddressInfo, 'state')} maxLength={2} required placeholder="SP" disabled={isHospitalCepLoading}/></div>
                         </div>
                     </form>
                 );
            case 'hospitalDocs':
                const hospitalDocKeysForRender: HospitalDocKeys[] = ['socialContract', 'cnpjCard', 'companyAddressProof'];
                return (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">Documentos da Empresa</h3>
                        <p className="text-xs text-gray-500 mb-3">Formatos: PDF, JPG, PNG. Máx: 5MB.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                           {hospitalDocKeysForRender.map(key => renderFileInput(key as AllDocumentKeys))}
                        </div>
                    </div>
                );
            case 'legalRepInfo':
                return (
                    <form autoComplete="off" onSubmit={(e) => {e.preventDefault(); handleNextStep();}} className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">Dados do Responsável Legal</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="space-y-1"><Label htmlFor="repName">Nome Completo*</Label><Input id="repName" value={legalRepresentativeInfo.name} onChange={handleInputChangeCallback(setLegalRepresentativeInfo, 'name')} required /></div>
                            <div className="space-y-1"><Label htmlFor="repDob">Nascimento*</Label><Input id="repDob" type="date" value={legalRepresentativeInfo.dob} onChange={handleInputChangeCallback(setLegalRepresentativeInfo, 'dob')} required max={new Date().toISOString().split("T")[0]}/></div>
                            <div className="space-y-1"><Label htmlFor="repRg">RG*</Label><Input id="repRg" value={legalRepresentativeInfo.rg} onChange={handleInputChangeCallback(setLegalRepresentativeInfo, 'rg')} required /></div>
                            <div className="space-y-1"><Label htmlFor="repCpf">CPF*</Label><InputWithIMask id="repCpf" maskOptions={{ mask: '000.000.000-00' }} defaultValue={legalRepresentativeInfo.cpf} onAccept={handleIMaskAcceptCallback(setLegalRepresentativeInfo, 'cpf')} required placeholder="000.000.000-00"/></div>
                            <div className="space-y-1"><Label htmlFor="repPhone">Telefone*</Label><InputWithIMask id="repPhone" maskOptions={{ mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }] }} defaultValue={legalRepresentativeInfo.phone} onAccept={handleIMaskAcceptCallback(setLegalRepresentativeInfo, 'phone')} required placeholder="(00) 90000-0000" type="tel"/></div>
                            <div className="space-y-1"><Label htmlFor="repEmail">Email Pessoal*</Label><Input id="repEmail" type="email" value={legalRepresentativeInfo.email} onChange={handleInputChangeCallback(setLegalRepresentativeInfo, 'email')} required /></div>
                            <div className="space-y-1 md:col-span-2"><Label htmlFor="repPosition">Cargo na Empresa*</Label><Input id="repPosition" value={legalRepresentativeInfo.position} onChange={handleInputChangeCallback(setLegalRepresentativeInfo, 'position')} required /></div>
                        </div>
                    </form>
                );
            case 'legalRepDocs':
                const legalRepDocKeysForRender: LegalRepDocKeys[] = ['repRg', 'repCpf', 'repAddressProof'];
                return (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">Documentos do Responsável Legal</h3>
                        <p className="text-xs text-gray-500 mb-3">Formatos: PDF, JPG, PNG. Máx: 5MB.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                            {legalRepDocKeysForRender.map(key => renderFileInput(key as AllDocumentKeys))}
                        </div>
                    </div>
                );
            case 'credentials':
                const currentLoginEmail = role === 'doctor' ? personalInfo.email : hospitalInfo.email;
                const isLoginEmailValid = isValidEmail(currentLoginEmail);
                return (
                    <form autoComplete="off" onSubmit={(e) => {e.preventDefault(); handleNextStep();}} className="space-y-4 animate-fade-in">
                        <h3 className="text-lg font-semibold border-b pb-2 mb-4">Crie sua Senha de Acesso</h3>
                        <div className={cn("p-3 rounded-md text-sm mb-4", isLoginEmailValid ? "bg-blue-50 border border-blue-200 text-blue-700" : "bg-red-50 border border-red-200 text-red-700")}>
                            Email para login: <strong className={cn("break-all", !isLoginEmailValid && "font-semibold")}>{currentLoginEmail || "(Email não definido)"}</strong>
                            {!isLoginEmailValid && currentLoginEmail && <span className="ml-2 font-medium">(Inválido!)</span>}
                            {!isLoginEmailValid && <p className="text-xs mt-1">Volte às etapas anteriores para corrigir o email.</p>}
                        </div>
                        <div className="space-y-1"><Label htmlFor="password">Senha*</Label><Input id="password" type="password" value={credentials.password} onChange={handleInputChangeCallback(setCredentials, 'password')} required minLength={6} />
                            <p className="text-xs text-gray-500">Mínimo 6 caracteres. Use letras, números e símbolos.</p>
                        </div>
                        <div className="space-y-1"><Label htmlFor="confirmPassword">Confirme a Senha*</Label><Input id="confirmPassword" type="password" value={credentials.confirmPassword} onChange={handleInputChangeCallback(setCredentials, 'confirmPassword')} required className={cn( credentials.password && credentials.confirmPassword && credentials.password !== credentials.confirmPassword && "border-red-500 ring-1 ring-red-500" )} />
                            {credentials.password && credentials.confirmPassword && credentials.password !== credentials.confirmPassword && <p className="text-xs text-red-600 mt-1">As senhas não coincidem.</p>}
                        </div>
                    </form>
                );
            case 'summary':
                if (!role) return <div className="p-4 text-center text-red-500">Erro: Perfil não definido.</div>;
                const summaryDataToRender: SummaryData = role === 'doctor' ?
                    { personalInfo, addressInfo, doctorDocuments, isSpecialist, specialistDocuments, credentials } :
                    { hospitalInfo, hospitalAddressInfo, hospitalDocuments, legalRepresentativeInfo, legalRepDocuments, credentials };
                return <RegistrationSummary role={role} data={summaryDataToRender} onEdit={handleEditStep} />;
            default:
                return <p>Etapa desconhecida.</p>;
        }
    };

    // --- CORREÇÃO: Nova lógica de carregamento e guarda ---
    // Mostra uma tela de carregamento enquanto a autenticação está sendo verificada
    // ou se um usuário já estiver logado (aguardando o redirecionamento do useEffect).
    if (authLoading || authUser) {
        return <LoadingPage message="Verificando sessão..." />;
    }

    return (
        <div className="container mx-auto px-4 py-8 sm:py-12 max-w-4xl">
             <h1 className="text-2xl sm:text-3xl font-bold text-center mb-3 text-gray-800">Formulário de Cadastro</h1>
             <p className="text-center text-gray-600 text-sm sm:text-base mb-8 sm:mb-10">
                 Siga as etapas para completar seu registro. Já tem conta?{" "}
                 <Link href="/login" className="text-blue-600 hover:underline font-medium">Faça login</Link>
             </p>
             <StepIndicator steps={stepsConfig.map(s => s.label)} currentStep={currentStepIndex} />

             <div className="bg-white p-4 sm:p-6 md:p-8 rounded-lg shadow-xl border border-gray-200 min-h-[350px] relative">
                 {isLoading && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-lg">
                          <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-blue-600" />
                          <p className="mt-4 text-base sm:text-lg font-medium text-gray-700">
                              Processando cadastro...
                          </p>
                          <p className="mt-1 text-sm text-gray-500">Por favor, aguarde um momento...</p>
                      </div>
                 )}
                 <div className={cn("transition-opacity duration-300", isLoading && "opacity-30 pointer-events-none")}>
                     {renderCurrentStep()}
                 </div>
             </div>

             <div className="flex flex-col sm:flex-row justify-between mt-8 sm:mt-10 gap-3 sm:gap-4">
                 <Button
                     variant="outline"
                     onClick={handlePrevStep}
                     disabled={step === 0 || isLoading || isCepLoading || isHospitalCepLoading }
                     className="w-full sm:w-auto px-6 py-3 text-sm sm:text-base"
                 >
                     Voltar
                 </Button>
                 {currentStepConfig?.id === 'summary' ? (
                     <Button
                         onClick={handleSubmit}
                         disabled={isLoading || !role || isCepLoading || isHospitalCepLoading }
                         className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-sm sm:text-base"
                     >
                         {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                         {isLoading ? 'Finalizando...' : 'Confirmar e Finalizar Cadastro'}
                     </Button>
                 ) : (
                     <Button
                         onClick={handleNextStep}
                         disabled={ (currentStepConfig?.id === 'role' && !role) || (currentStepConfig?.id === 'doctorObjective' && !doctorObjective) || isLoading || isCepLoading || isHospitalCepLoading }
                         className="w-full sm:w-auto px-6 py-3 text-sm sm:text-base bg-blue-600 hover:bg-blue-700 text-white"
                     >
                         Próximo
                     </Button>
                 )}
             </div>
        </div>
    );
}