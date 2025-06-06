// components/ProfileStatusAlert.tsx
"use client"; // Necessário se você usar hooks como Link do next/link aqui dentro ou event handlers

import React from 'react';
import { AlertTriangle, CheckCircle, InfoIcon } from 'lucide-react';
import Link from 'next/link'; // Para o link de correção

export type ProfileStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED_NEEDS_RESUBMISSION";

interface ProfileStatusAlertProps {
  status?: ProfileStatus;
  adminNotes?: string;
  userType: "doctor" | "hospital"; // Para customizar links ou mensagens se necessário
  editProfileLink?: string; // Link para a página de edição/reenvio
}

const ProfileStatusAlert: React.FC<ProfileStatusAlertProps> = ({ status, adminNotes, userType, editProfileLink }) => {
  if (!status) {
    // Se o status não estiver definido, não renderiza nada ou uma mensagem padrão
    return null; 
  }

  if (status === 'PENDING_REVIEW') {
    return (
      <div className="p-4 mb-6 text-sm text-blue-700 bg-blue-100 rounded-lg border border-blue-300" role="alert">
        <div className="flex items-center">
          <InfoIcon className="inline w-5 h-5 mr-3 shrink-0" />
          <span className="font-medium">Seu cadastro está em análise.</span>
        </div>
        <p className="mt-1.5 ml-8">Avisaremos assim que o processo de verificação for concluído. Obrigado pela sua paciência!</p>
      </div>
    );
  }

  if (status === 'APPROVED') {
    return (
      <div className="p-4 mb-6 text-sm text-green-700 bg-green-100 rounded-lg border border-green-300" role="alert">
        <div className="flex items-center">
          <CheckCircle className="inline w-5 h-5 mr-3 shrink-0" />
          <span className="font-medium">Seu cadastro foi aprovado!</span>
        </div>
        <p className="mt-1.5 ml-8">Você já pode utilizar todas as funcionalidades da plataforma.</p>
      </div>
    );
  }

  if (status === 'REJECTED_NEEDS_RESUBMISSION') {
    const defaultEditLink = userType === 'doctor' 
        ? "/dashboard/profile/edit" // Exemplo de link para editar perfil do médico
        : "/hospital/profile/edit"; // Exemplo de link para editar perfil do hospital

    const finalEditLink = editProfileLink || defaultEditLink;

    return (
      <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg border border-red-300" role="alert">
        <div className="flex items-center">
          <AlertTriangle className="inline w-5 h-5 mr-3 shrink-0" />
          <span className="font-medium">Seu cadastro precisa de correções.</span>
        </div>
        {adminNotes && (
          <div className="mt-2.5 ml-8">
            <strong className="block mb-1">Observações do Administrador:</strong>
            <p className="whitespace-pre-wrap bg-red-50 p-2 rounded border border-red-200">{adminNotes}</p>
          </div>
        )}
        <p className="mt-2.5 ml-8">
          Por favor, revise as informações e/ou documentos solicitados e faça as correções necessárias.
          <Link href={finalEditLink} className="ml-1 font-semibold text-red-800 hover:text-red-900 underline">
            Clique aqui para corrigir seu cadastro.
          </Link>
        </p>
      </div>
    );
  }

  return null; // Caso o status seja algum valor não esperado
};

ProfileStatusAlert.displayName = "ProfileStatusAlert";
export default ProfileStatusAlert;