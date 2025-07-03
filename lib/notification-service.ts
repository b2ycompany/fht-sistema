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

// Esta função simplesmente adiciona um documento à coleção 'mail',
// que a extensão Trigger Email está a observar.
const sendEmail = async (payload: EmailPayload) => {
    try {
        await addDoc(collection(db, "mail"), payload);
    } catch (error) {
        console.error("Erro ao solicitar envio de email:", error);
        // Numa aplicação real, você poderia adicionar um tratamento de erro mais robusto aqui.
    }
};

// Notificação para o médico quando um contrato está pronto para a sua assinatura
export const sendContractReadyForDoctorEmail = (
    doctorEmail: string,
    doctorName: string,
    hospitalName: string,
    contractId: string
) => {
    const payload: EmailPayload = {
        to: doctorEmail,
        message: {
            subject: `Parabéns, ${doctorName}! Você tem um novo contrato para assinar.`,
            html: `
                <div style="font-family: sans-serif; line-height: 1.6;">
                    <h2>Olá, Dr(a). ${doctorName},</h2>
                    <p>Temos uma excelente notícia! A sua disponibilidade foi aceite pelo hospital <strong>${hospitalName}</strong>.</p>
                    <p>Um novo contrato está aguardando a sua revisão e assinatura na plataforma FHT Gestão.</p>
                    <p>Por favor, aceda ao seu painel para ver os detalhes e assinar o contrato.</p>
                    <a 
                        href="https://www.fhtgestao.com.br/doctor/contracts" 
                        style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 5px; font-size: 16px;"
                    >
                        Ver Contrato
                    </a>
                    <p>Atenciosamente,<br>Equipa FHT Gestão</p>
                </div>
            `,
        },
    };

    sendEmail(payload);
};