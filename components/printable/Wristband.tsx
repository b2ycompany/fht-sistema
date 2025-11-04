"use client";

import React, { useEffect, useRef } from 'react';
import Barcode from 'react-barcode';

// Define a severidade e suas cores (baseado no Protocolo de Manchester)
type SeverityLevel = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul' | 'branco';

interface WristbandProps {
  patientName: string;
  dob: string; // Data de Nascimento
  patientId: string; // ID único do Firestore
  severity?: SeverityLevel; // Opcional, para a pulseira de triagem
  onReadyToPrint: () => void; // Função para disparar a impressão
}

const severityConfig = {
  vermelho: { text: 'Emergência', color: '#dc2626' }, // bg-red-600
  laranja: { text: 'Muito Urgente', color: '#f97316' }, // bg-orange-500
  amarelo: { text: 'Urgente', color: '#eab308' },     // bg-yellow-500
  verde: { text: 'Pouco Urgente', color: '#22c55e' }, // bg-green-500
  azul: { text: 'Não Urgente', color: '#3b82f6' },  // bg-blue-500
  branco: { text: 'Identificação', color: '#f9fafb' } // bg-gray-50
};

export const PrintableWristband: React.FC<WristbandProps> = ({
  patientName,
  dob,
  patientId,
  severity = 'branco', // Padrão 'branco' para recepção
  onReadyToPrint,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Formata a data de AAAA-MM-DD para DD/MM/AAAA
  const formatDOB = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr; // Retorna original se não estiver no formato esperado
    } catch {
      return dateStr;
    }
  };

  const config = severityConfig[severity] || severityConfig.branco;
  const isTriage = severity !== 'branco';
  const textColor = isTriage ? '#FFFFFF' : '#111827'; // Texto branco para fundos coloridos
  
  // Dispara a impressão quando o componente estiver pronto
  useEffect(() => {
    // Um pequeno timeout para garantir que o código de barras renderizou
    const timer = setTimeout(() => {
      onReadyToPrint();
    }, 500); // 500ms de segurança
    return () => clearTimeout(timer);
  }, [onReadyToPrint]);

  return (
    <div ref={wrapperRef} className="p-0 m-0">
      {/* Estilos de Impressão: 
        Este CSS é a parte mais importante. Ele formata a página *apenas* para a impressão.
        Define o tamanho exato da pulseira (ex: 25cm x 2.5cm). 
        Ajuste 'size' para o tamanho real da sua etiqueta de impressora.
      */}
      <style type="text/css" media="print">
        {`
          @page {
            /* Tamanho da etiqueta da pulseira: 250mm x 25mm */
            size: 250mm 25mm;
            margin: 0;
          }
          body, html {
            margin: 0;
            padding: 0;
            width: 250mm;
            height: 25mm;
            overflow: hidden;
          }
        `}
      </style>
      
      {/* Conteúdo da Pulseira */}
      <div 
        style={{ 
          backgroundColor: config.color, 
          color: textColor,
          width: '250mm',
          height: '25mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10mm',
          fontFamily: 'Arial, sans-serif',
          boxSizing: 'border-box'
        }}
      >
        {/* Identificação do Paciente */}
        <div style={{ textTransform: 'uppercase' }}>
          <div style={{ fontSize: '16pt', fontWeight: 'bold' }}>
            {patientName}
          </div>
          <div style={{ fontSize: '12pt' }}>
            Nasc: {formatDOB(dob)}
          </div>
        </div>

        {/* Nível de Risco (Apenas para Triagem) */}
        {isTriage && (
          <div 
            style={{ 
              fontSize: '20pt', 
              fontWeight: 'bold',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {config.text}
          </div>
        )}

        {/* Código de Barras */}
        <div style={{ height: '20mm', display: 'flex', alignItems: 'center' }}>
          <Barcode 
            value={patientId}
            height={40} // Altura do código de barras em pixels
            width={2} // Largura da barra mais fina
            fontSize={12}
            text={`ID: ${patientId}`}
            background="transparent" // Fundo transparente
            lineColor={textColor} // Cor das barras
            fontOptions="bold"
            textMargin={2}
          />
        </div>
      </div>
    </div>
  );
};