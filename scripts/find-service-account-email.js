/**
 * Script pour trouver l'email du Service Account dans le fichier credentials
 * Usage: node scripts/find-service-account-email.js
 */

const fs = require('fs');
const path = require('path');

const credentialsPath = path.join(__dirname, '../credentials/service-account.json');

if (!fs.existsSync(credentialsPath)) {
  console.error('❌ Fichier credentials/service-account.json introuvable!');
  console.log('\nAssurez-vous que le fichier JSON du Service Account est placé dans:');
  console.log(credentialsPath);
  process.exit(1);
}

try {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  
  if (!credentials.client_email) {
    console.error('❌ Le fichier JSON ne contient pas de champ "client_email"');
    process.exit(1);
  }

  console.log('✅ Email du Service Account trouvé:');
  console.log('\n📧', credentials.client_email);
  console.log('\n📋 Copiez cet email et utilisez-le pour partager votre calendrier Google:');
  console.log('   1. Ouvrez Google Calendar');
  console.log('   2. Allez dans les paramètres du calendrier "famille"');
  console.log('   3. Cliquez sur "Add people" dans "Share with specific people"');
  console.log('   4. Collez l\'email ci-dessus');
  console.log('   5. Sélectionnez "See all event details" comme permission');
  console.log('   6. Cliquez sur "Send"\n');
  
} catch (error) {
  console.error('❌ Erreur lors de la lecture du fichier:', error.message);
  process.exit(1);
}

