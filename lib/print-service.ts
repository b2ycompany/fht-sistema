// lib/print-service.ts
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PrintableWristband } from '@/components/printable/Wristband';

type SeverityLevel = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul' | 'branco';

interface PrintWristbandProps {
  patientName: string;
  dob: string;
  patientId: string;
  severity?: SeverityLevel;
}

/**
 * Dispara a impressão de uma pulseira de paciente.
 * Cria um iframe oculto, renderiza o componente da pulseira dentro dele e chama a impressão.
 */
export const printWristband = (props: PrintWristbandProps) => {
  // 1. Encontra ou cria o iframe de impressão
  let printFrame = document.getElementById('print-iframe') as HTMLIFrameElement;
  if (printFrame) {
    document.body.removeChild(printFrame);
  }

  printFrame = document.createElement('iframe');
  printFrame.id = 'print-iframe';
  printFrame.style.position = 'absolute';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);

  // 2. Obtém o documento do iframe
  const frameDocument = printFrame.contentDocument;
  if (!frameDocument) {
    console.error("Não foi possível acessar o documento do iframe de impressão.");
    return;
  }

  // 3. Cria um ponto de montagem para o React
  const mountPoint = frameDocument.createElement('div');
  frameDocument.body.appendChild(mountPoint);
  
  // 4. Cria a função de callback que será chamada pelo componente
  const handleReadyToPrint = () => {
    try {
      // 5. Chama a impressão do iframe
      printFrame.contentWindow?.print();
    } catch (e) {
      console.error("Erro ao tentar imprimir:", e);
    }
  };

  // 6. Renderiza o componente React dentro do iframe
  const root = createRoot(mountPoint);
  root.render(
    React.createElement(PrintableWristband, { ...props, onReadyToPrint: handleReadyToPrint })
  );
};