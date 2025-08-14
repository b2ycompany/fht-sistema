// scripts/seed-protocols.js

// Importa as bibliotecas necessárias: 'firebase-admin' para conectar ao Firebase
// e 'fs' (File System) e 'path' para ler os ficheiros locais.
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Carrega a chave de serviço que você descarregou. O script procura por ela nesta mesma pasta.
const serviceAccount = require('./serviceAccountKey.json');

// Inicializa a aplicação do Firebase Admin com as credenciais da sua chave
// e a URL do seu banco de dados Firestore.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://fht-sistema.firebaseio.com` // IMPORTANTE: Substitua pelo ID do seu projeto Firebase
});

// Obtém uma referência à instância do banco de dados Firestore.
const db = admin.firestore();

// Define o caminho para a pasta onde estão os seus ficheiros JSON de protocolos.
const protocolsDir = path.join(__dirname, 'protocols');

/**
 * Função principal que lê os ficheiros e os envia para o Firestore.
 */
const uploadProtocols = async () => {
  console.log('Iniciando o upload de protocolos...');

  try {
    // Lê todos os nomes de ficheiro dentro da pasta 'protocols'.
    const files = fs.readdirSync(protocolsDir);

    // Percorre cada ficheiro encontrado.
    for (const file of files) {
      // Verifica se o ficheiro é um .json para evitar erros.
      if (path.extname(file) === '.json') {
        const filePath = path.join(protocolsDir, file);
        
        // Lê o conteúdo do ficheiro JSON.
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Converte o conteúdo de texto para um objeto JavaScript.
        const protocolData = JSON.parse(fileContent);
        
        // Usa o nome do ficheiro (sem a extensão .json) como o ID do documento no Firestore.
        // Ex: "ASD_screening_v1.json" vira o ID "ASD_screening_v1".
        const docId = path.basename(file, '.json');

        // Define a referência para o documento na coleção 'diagnosticProtocols'.
        const docRef = db.collection('diagnosticProtocols').doc(docId);

        // Envia os dados para o Firestore. O .set() cria o documento se não existir
        // ou o substitui completamente se já existir. Perfeito para o nosso caso.
        await docRef.set(protocolData);

        console.log(`✅ Protocolo '${docId}' carregado com sucesso!`);
      }
    }
    console.log('\nUpload de todos os protocolos concluído com sucesso! 🎉');
  } catch (error) {
    console.error('❌ ERRO DURANTE O UPLOAD:', error);
    process.exit(1); // Encerra o script em caso de erro.
  }
};

// Executa a função.
uploadProtocols();