const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://fht-sistema.firebaseio.com` // IMPORTANTE: Substitua pelo ID do seu projeto Firebase
});

const db = admin.firestore();

const specialtiesFilePath = path.join(__dirname, 'data', 'specialties.json');

const uploadSpecialties = async () => {
  console.log('Iniciando o cadastro de especialidades no Firestore...');

  try {
    const fileContent = fs.readFileSync(specialtiesFilePath, 'utf8');
    const specialties = JSON.parse(fileContent);

    if (!Array.isArray(specialties) || specialties.length === 0) {
      console.error('Erro: O ficheiro JSON está vazio ou não é um array.');
      return;
    }

    const batch = db.batch();
    const specialtiesCollection = db.collection('specialties');

    let count = 0;
    for (const specialty of specialties) {
      if (specialty.name && typeof specialty.active === 'boolean') {
        const docId = specialty.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
        const docRef = specialtiesCollection.doc(docId);
        batch.set(docRef, {
            name: specialty.name,
            active: specialty.active,
        });
        count++;
      }
    }
    
    await batch.commit();

    console.log(`\n✅ Sucesso! ${count} especialidades foram cadastradas ou atualizadas.`);

  } catch (error) {
    console.error('❌ ERRO DURANTE O CADASTRO:', error);
    process.exit(1);
  }
};

uploadSpecialties();