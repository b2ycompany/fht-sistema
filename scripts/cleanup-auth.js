// cleanup-auth-total.js
const admin = require('firebase-admin');
const readline = require('readline');

// --- CONFIGURAÇÃO ---

// 1. Configure o caminho para a sua chave de serviço
const serviceAccount = require('./serviceAccountKey.json');

// 2. ID do seu projeto Firebase. USADO COMO TRAVA DE SEGURANÇA.
const PROJECT_ID = 'fht-sistema';

// --- FIM DA CONFIGURAÇÃO ---

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/**
 * Busca todos os utilizadores da autenticação, página por página.
 */
async function getAllUsers(nextPageToken) {
    let users = [];
    const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
    
    users = users.concat(listUsersResult.users);
    
    if (listUsersResult.pageToken) {
        const nextUsers = await getAllUsers(listUsersResult.pageToken);
        users = users.concat(nextUsers);
    }
    
    return users;
}

/**
 * Função principal que executa o script.
 */
async function main() {
    console.log(`\n\x1b[31m%s\x1b[0m`, `ATENÇÃO: Este script irá apagar permanentemente TODOS os utilizadores do FIREBASE AUTHENTICATION do projeto '${PROJECT_ID}'.`);
    console.log('\x1b[33m%s\x1b[0m', 'Esta ação não pode ser desfeita.');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(`\nPara confirmar a exclusão de TODOS os utilizadores, por favor digite o ID do projeto ('${PROJECT_ID}'): `, async (answer) => {
        if (answer !== PROJECT_ID) {
            console.error('\x1b[31m', 'ID do projeto incorreto. Operação cancelada.');
            rl.close();
            return;
        }

        try {
            console.log('\nBuscando todos os utilizadores...');
            const allUsers = await getAllUsers();

            if (allUsers.length === 0) {
                console.log('\nNenhum utilizador para apagar. O sistema já está limpo.');
                rl.close();
                return;
            }
            
            console.log(`\nIniciando a exclusão de ${allUsers.length} utilizadores...`);
            
            // Apaga os utilizadores em lotes para evitar sobrecarga
            const deletePromises = allUsers.map(user => admin.auth().deleteUser(user.uid));
            await Promise.all(deletePromises);

            console.log('\n\x1b[32m%s\x1b[0m', 'Limpeza total dos utilizadores de autenticação concluída com sucesso!');

        } catch (error) {
            console.error('\x1b[31m', 'Ocorreu um erro durante a limpeza:', error);
        } finally {
            rl.close();
        }
    });
}

// Inicia o script
main();