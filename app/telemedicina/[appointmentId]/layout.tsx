// app/dashboard/telemedicina/[appointmentId]/layout.tsx
import React from 'react';

/**
 * Esta função é uma exigência do Next.js para rotas dinâmicas quando
 * usamos o modo 'output: export'. Ao retornar uma lista vazia,
 * informamos ao Next.js que não precisa gerar nenhuma página estática
 * durante o processo de build, pois todas as páginas de consulta
 * serão geradas dinamicamente no momento do acesso.
 */
export async function generateStaticParams() {
  return [];
}

/**
 * Este é o componente de Layout para a página de atendimento.
 * Ele simplesmente recebe e renderiza o conteúdo da página filha (`children`),
 * que será o nosso `page.tsx`.
 */
export default function TelemedicineAppointmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}