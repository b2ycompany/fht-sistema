export interface AnalysisMetrics {
  eyeContactScore: number;
  headMovement: number;
}

export const generateSupportReport = (
  protocolAnswers: Record<string, any>,
  videoMetrics: AnalysisMetrics
): string => {
  let reportSections: string[] = [];

  reportSections.push("RELATÓRIO DE APOIO GERADO POR IA\nData: " + new Date().toLocaleDateString('pt-BR'));
  reportSections.push("------------------------------------");

  let protocolSummary = "Análise do Protocolo de Triagem:\n";
  if (protocolAnswers['q1_eye_contact']) {
    const answer = protocolAnswers['q1_eye_contact'];
    if (answer.includes("Raramente")) {
      protocolSummary += "- O protocolo indica que o contato visual foi raramente ou nunca mantido.\n";
    } else if (answer.includes("inconstante")) {
      protocolSummary += "- O protocolo aponta para um contato visual inconstante.\n";
    }
  }
  if (protocolAnswers['q4_repetitive_movements']) {
    const answer = protocolAnswers['q4_repetitive_movements'];
    if (answer.includes("frequente")) {
      protocolSummary += "- Foram reportados movimentos corporais repetitivos de forma frequente ou intensa.\n";
    } else if (answer.includes("leve")) {
      protocolSummary += "- Foram reportados movimentos corporais repetitivos de forma leve ou ocasional.\n";
    }
  }
  if (protocolAnswers['q5_speech_patterns'] && protocolAnswers['q5_speech_patterns'].length > 2) {
      protocolSummary += `- Observações sobre a fala: ${protocolAnswers['q5_speech_patterns']}\n`;
  }
  reportSections.push(protocolSummary);

  let videoSummary = "Análise Comportamental por Vídeo (Estimativas):\n";
  if (videoMetrics.eyeContactScore < 40) {
    videoSummary += `- O índice de contato visual direto com a câmera foi baixo (${videoMetrics.eyeContactScore.toFixed(0)}%).\n`;
  } else if (videoMetrics.eyeContactScore < 70) {
    videoSummary += `- O índice de contato visual direto com a câmera foi moderado (${videoMetrics.eyeContactScore.toFixed(0)}%).\n`;
  } else {
    videoSummary += `- O índice de contato visual direto com a câmera foi consistente (${videoMetrics.eyeContactScore.toFixed(0)}%).\n`;
  }
  
  if (videoMetrics.headMovement > 1500) {
      videoSummary += `- Foi detetado um alto volume de movimento da cabeça durante a consulta (índice: ${videoMetrics.headMovement.toFixed(0)}).\n`
  } else if (videoMetrics.headMovement > 800) {
      videoSummary += `- O volume de movimento da cabeça foi moderado (índice: ${videoMetrics.headMovement.toFixed(0)}).\n`
  } else {
      videoSummary += `- O volume de movimento da cabeça foi baixo (índice: ${videoMetrics.headMovement.toFixed(0)}).\n`
  }
  reportSections.push(videoSummary);

  reportSections.push("------------------------------------");
  reportSections.push("NOTA: Este relatório é uma ferramenta de apoio baseada em dados observacionais e estimativas de IA. Não substitui a avaliação e o julgamento clínico do profissional de saúde.");

  return reportSections.join('\n');
};