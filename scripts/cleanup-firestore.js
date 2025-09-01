// cleanup-firestore.js
const admin = require('firebase-admin');
const readline = require('readline');

// --- CONFIGURAÇÃO ---
// 1. Faça o download da sua chave de serviço no Firebase e coloque o caminho para ela aqui.
// (Firebase Console > Configurações do Projeto > Contas de serviço > Gerar nova chave privada)
const serviceAccount = require('./serviceAccountKey.json');

// 2. ID do seu projeto Firebase. USADO COMO TRAVA DE SEGURANÇA.
const PROJECT_ID = 'fht-sistema';

// 3. REVISE ESTA LISTA! Estas são as coleções que serão COMPLETAMENTE APAGADAS.
const COLLECTIONS_TO_DELETE = [
    'users',
    'patients',
    'serviceQueue',
    'consultations',
    'contracts',
    'shiftRequirements',
    'doctorTimeSlots',
    'potentialMatches',
    'invitations',
    'timeRecords',
    'prescriptions',
    'documents',
    'appointments',
    // Adicione outras coleções de dados de teste aqui se necessário
];

// 4. Coleções que NÃO serão apagadas.
const COLLECTIONS_TO_KEEP = [
    'specialties',
    'settings',
    'mail', // Importante para a extensão de email
    // Adicione outras coleções de configuração aqui
];

// --- FIM DA CONFIGURAÇÃO ---


// Inicializa o Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${PROJECT_ID}.firebaseio.com`
});

const db = admin.firestore();

/**
 * Função recursiva para apagar uma coleção em lotes de 100 documentos.
 */
async function deleteCollection(collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(query, resolve, reject) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // A coleção está vazia
    resolve();
    return;
  }

  // Apaga os documentos em um lote
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Continua o processo
  process.nextTick(() => {
    deleteQueryBatch(query, resolve, reject);
  });
}

/**
 * Função principal que executa o script.
 */
async function main() {
    console.log(`\n\x1b[31m%s\x1b[0m`, `ATENÇÃO: Este script irá apagar permanentemente dados do projeto '${PROJECT_ID}'.`);
    console.log('\x1b[33m%s\x1b[0m', 'Faça um backup antes de continuar.');

    console.log("\nAs seguintes coleções serão APAGADAS:");
    COLLECTIONS_TO_DELETE.forEach(col => console.log(`- ${col}`));
    
    console.log("\nAs seguintes coleções serão MANTIDAS:");
    COLLECTIONS_TO_KEEP.forEach(col => console.log(`- ${col}`));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(`\nPara confirmar, por favor digite o ID do projeto ('${PROJECT_ID}'): `, async (answer) => {
        if (answer !== PROJECT_ID) {
            console.error('\x1b[31m', 'ID do projeto incorreto. Operação cancelada.');
            rl.close();
            return;
        }

        console.log('\nIniciando a limpeza das coleções...');
        try {
            for (const collectionPath of COLLECTIONS_TO_DELETE) {
                console.log(`- Apagando a coleção '${collectionPath}'...`);
                await deleteCollection(collectionPath, 100);
                console.log(`  ... coleção '${collectionPath}' limpa com sucesso.`);
            }
            console.log('\n\x1b[32m%s\x1b[0m', 'Limpeza do banco de dados concluída com sucesso!');
        } catch (error) {
            console.error('\x1b[31m', 'Ocorreu um erro durante a limpeza:', error);
        } finally {
            rl.close();
        }
    });
}

// Inicia o script
main();