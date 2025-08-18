const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// --- IMPORTANTE: COLOQUE O EMAIL DO SEU ADMINISTRADOR AQUI ---
const adminEmail = "admin@fht.com";
// ---------------------------------------------------------

if (!adminEmail || !adminEmail.includes('@')) {
    console.error("ERRO: Por favor, edite este ficheiro e adicione o email do seu administrador na variável 'adminEmail'.");
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const setAdminClaim = async (email) => {
    try {
        console.log(`A procurar o utilizador com o email: ${email}...`);
        const user = await admin.auth().getUserByEmail(email);

        if (user.customClaims && user.customClaims.role === 'admin') {
            console.log(`✅ O utilizador ${email} já tem a permissão de 'admin'. Nenhuma ação necessária.`);
            return;
        }

        console.log(`A aplicar a permissão 'admin' ao utilizador ${user.uid}...`);
        await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
        
        console.log(`\n🎉 Sucesso! O utilizador ${email} agora tem permissões de administrador.`);
        console.log("IMPORTANTE: Por favor, faça logout e login novamente na aplicação para que as novas permissões tenham efeito.");

    } catch (error) {
        console.error("❌ ERRO AO DEFINIR PERMISSÃO DE ADMIN:", error);
        process.exit(1);
    }
};

setAdminClaim(adminEmail);