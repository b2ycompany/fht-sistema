// components/profile/ProfileField.tsx
import React from 'react';
import { cn } from '@/lib/utils'; // Import cn se precisar

interface ProfileFieldProps {
  label: string;
  value: string | number | undefined | null;
  isCode?: boolean;
  className?: string; // Permite passar classes extras
}

export const ProfileField: React.FC<ProfileFieldProps> = ({ label, value, isCode = false, className }) => {
  if (value === null || value === undefined || value === '') {
    // Opcional: Renderizar algo como 'Não informado' ou apenas retornar null
    // return <div className={cn("grid grid-cols-3 gap-2 text-sm py-1.5 border-b border-gray-100 last:border-b-0 items-start", className)}><dt className="font-medium text-gray-600 col-span-1 pt-px">{label}</dt><dd className="text-gray-400 italic col-span-2">Não informado</dd></div>;
     return null;
  }
  return (
    <div className={cn("grid grid-cols-3 gap-2 text-sm py-1.5 border-b border-gray-100 last:border-b-0 items-start", className)}>
      <dt className="font-medium text-gray-600 col-span-1 pt-px">{label}</dt>
      <dd className={`text-gray-800 col-span-2 break-words ${isCode ? 'font-mono text-xs bg-gray-100 p-1 rounded' : ''}`}>{value}</dd>
    </div>
  );
};