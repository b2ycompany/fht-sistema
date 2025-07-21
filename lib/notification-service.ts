// lib/notification-service.ts
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

interface EmailPayload {
    to: string;
    message: {
        subject: string;
        html: string;
    };
}

const sendEmail = async (payload: EmailPayload) => {
    try {
        await addDoc(collection(db, "mail"), payload);
    } catch (error) {
        console.error("Erro ao solicitar envio de email:", error);
    }
};

/**
 * Monta e envia a notificação para o médico quando um contrato está pronto para a sua assinatura.
 * @param doctorEmail - O email do destinatário.
 * @param doctorName - O nome do médico para personalizar a saudação.
 * @param hospitalName - O nome do hospital para dar contexto.
 * @param contractId - O ID do novo contrato, para referência futura ou links diretos.
 */
export const sendContractReadyForDoctorEmail = (
    doctorEmail: string,
    doctorName: string,
    hospitalName: string,
    contractId: string // Parâmetro adicionado
) => {
    if (!doctorEmail) {
        console.warn("Tentativa de enviar email sem um destinatário.");
        return;
    }

    // O link agora pode ser mais específico se desejar, mas por enquanto aponta para a página de contratos.
    const contractLink = `https://www.fhtgestao.com.br/dashboard/contracts`;

    const payload: EmailPayload = {
        to: doctorEmail,
        message: {
            subject: `Parabéns, Dr(a). ${doctorName}! Você tem um novo contrato para assinar.`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #0056b3;">Olá, Dr(a). ${doctorName},</h2>
                    <p>Temos uma excelente notícia! A sua disponibilidade foi aceite pelo hospital <strong>${hospitalName}</strong>.</p>
                    <p>Um novo contrato (ID: ${contractId}) está aguardando a sua revisão e assinatura na plataforma FHT Gestão.</p>
                    <div style="margin: 30px 0;">
                        <a 
                            href="${contractLink}" 
                            style="padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;"
                        >
                            Ver Meus Contratos
                        </a>
                    </div>
                    <p>Atenciosamente,<br><strong>Equipa FHT Gestão</strong></p>
                    <hr>
                    <p style="font-size: 12px; color: #777;">Este é um email automático. Por favor, não responda.</p>
                </div>
            `,
        },
    };

    console.log(`[NotificationService] A preparar para enviar email para: ${doctorEmail}`);
    sendEmail(payload);
};