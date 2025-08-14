import React from 'react';

// Esta função satisfaz a exigência do 'output: export' para rotas dinâmicas.
// Retornando uma lista vazia, dizemos ao Next.js para não gerar nenhuma
// página estática para esta rota durante o build.
export async function generateStaticParams() {
  return [];
}

// O layout simplesmente renderiza a página filha.
export default function TelemedicineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}