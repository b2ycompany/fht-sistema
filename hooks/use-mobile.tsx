// hooks/use-mobile.tsx
"use client";

import { useState, useEffect } from "react";

// O parâmetro foi removido pois não era utilizado.
export function useMobile(p0: number) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      // A lógica de verificar a largura da janela está perfeita.
      setIsMobile(window.innerWidth < 768);
    };

    // Verificação inicial
    checkIfMobile();

    // Adiciona o listener para redimensionamento
    window.addEventListener("resize", checkIfMobile);

    // Limpa o listener ao desmontar o componente, para evitar leaks de memória
    return () => {
      window.removeEventListener("resize", checkIfMobile);
    };
  }, []); // O array de dependências vazio garante que isto corre apenas uma vez

  return isMobile;
}