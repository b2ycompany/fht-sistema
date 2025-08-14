// lib/daily-service.ts

/**
 * Interface para a resposta esperada da API da Daily.co ao criar uma sala.
 */
interface DailyRoom {
  id: string;
  name: string;
  api_created: boolean;
  privacy: 'public' | 'private';
  url: string;
  created_at: string;
  config: {
    start_video_off: boolean;
    start_audio_off: boolean;
    exp: number; // Timestamp de expiração da sala
  };
}

/**
 * Cria uma nova sala de vídeo na Daily.co com um tempo de expiração.
 * IMPORTANTE: Esta função deve ser executada APENAS no lado do servidor (Server-Side)
 * para proteger a sua chave de API. No Next.js, use-a dentro de API Routes ou Server Actions.
 *
 * @param expirationDate A data e hora em que a sala deve expirar.
 * @returns Uma promessa que resolve com o objeto da sala criada.
 */
export const createDailyRoom = async (expirationDate: Date): Promise<DailyRoom> => {
  // A chave da API é lida das variáveis de ambiente para segurança.
  // NUNCA exponha esta chave no lado do cliente.
  const apiKey = process.env.NEXT_PUBLIC_DAILY_API_KEY;

  if (!apiKey) {
    console.error("[DailyService] Chave da API da Daily.co não configurada.");
    throw new Error("A configuração do serviço de vídeo está incompleta.");
  }

  // Define o tempo de expiração da sala em timestamp Unix (segundos).
  // Adicionamos 2 horas extras após a consulta para dar uma margem.
  const expirationTimestamp = Math.round((expirationDate.getTime() + 2 * 60 * 60 * 1000) / 1000);

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      properties: {
        // 'exp' é uma propriedade da Daily.co para definir a expiração da sala.
        exp: expirationTimestamp,
        // Iniciar com áudio e vídeo desligados para uma melhor experiência do utilizador.
        start_video_off: true,
        start_audio_off: true,
      }
    }),
  };

  try {
    const response = await fetch('https://api.daily.co/v1/rooms', options);
    const room = await response.json();

    if (!response.ok) {
        // Se a resposta não for 'ok', lança um erro com a mensagem da API.
        const errorMessage = room.info || 'Ocorreu um erro desconhecido na API da Daily.co.';
        console.error("[DailyService] Erro da API da Daily:", errorMessage);
        throw new Error(`Falha ao criar sala de vídeo: ${errorMessage}`);
    }
    
    console.log(`[DailyService] Sala de vídeo criada com sucesso: ${room.url}`);
    return room as DailyRoom;

  } catch (error) {
    console.error("[DailyService] Erro ao tentar criar a sala de vídeo:", error);
    // Propaga o erro para que a função que chamou saiba que a operação falhou.
    throw error;
  }
};