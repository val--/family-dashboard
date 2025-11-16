#!/usr/bin/env node

// Script pour créer une clé d'application (App Key) pour l'API Philips Hue v2
// Usage: node scripts/create-hue-app-key.js
// Documentation: https://developers.meethue.com/develop/hue-api-v2/getting-started/

// Charger les variables d'environnement depuis la racine du projet
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const https = require('https');
const readline = require('readline');

const HUE_BRIDGE_IP = process.env.HUE_BRIDGE_IP || '192.168.1.222';

console.log('🔑 Création d\'une clé d\'application Philips Hue\n');
console.log('Configuration:');
console.log(`  - Bridge IP: ${HUE_BRIDGE_IP}\n`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      rejectUnauthorized: false // Hue bridge uses self-signed certificates
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            console.error('❌ Erreur lors du parsing JSON:', error.message);
            console.error('Réponse brute:', data);
            reject(new Error('Failed to parse response'));
          }
        } else {
          let errorMessage = `Hue API returned status ${res.statusCode}`;
          try {
            const errorData = JSON.parse(data);
            if (errorData.errors && errorData.errors.length > 0) {
              errorMessage += `: ${errorData.errors.map(e => e.description || e.message).join(', ')}`;
            } else if (errorData.message) {
              errorMessage += `: ${errorData.message}`;
            }
          } catch (e) {
            errorMessage += `: ${data}`;
          }
          reject(new Error(errorMessage));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erreur réseau:', error.message);
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function createAppKey() {
  return new Promise((resolve) => {
    console.log('⚠️  IMPORTANT: Avant de continuer, vous DEVEZ appuyer sur le bouton');
    console.log('   physique de votre bridge Hue (le bouton rond au centre).\n');
    
    rl.question('Avez-vous appuyé sur le bouton du bridge ? (oui/non): ', async (answer) => {
      if (answer.toLowerCase() !== 'oui' && answer.toLowerCase() !== 'o' && answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('\n❌ Veuillez appuyer sur le bouton du bridge et relancer le script.');
        rl.close();
        process.exit(1);
      }

      console.log('\n⏳ Création de la clé d\'application...\n');
      console.log('ℹ️  Utilisation de l\'API v1 pour créer la clé (nécessaire pour l\'API v2)\n');

      try {
        // L'API v1 est utilisée pour créer la clé d'application
        // Cette clé fonctionnera ensuite avec l'API v2
        const urlV1 = `https://${HUE_BRIDGE_IP}/api`;
        const bodyV1 = {
          devicetype: 'family-dashboard#device'
        };

        const dataV1 = await makeRequest(urlV1, {
          method: 'POST',
          body: bodyV1
        });

        if (Array.isArray(dataV1) && dataV1.length > 0) {
          const result = dataV1[0];
          if (result.success && result.success.username) {
            const appKey = result.success.username;
            console.log('🎉 Clé d\'application créée avec succès!\n');
            console.log('═══════════════════════════════════════════════════════');
            console.log('Ajoutez cette ligne dans votre fichier .env :');
            console.log(`HUE_APP_KEY=${appKey}`);
            console.log('═══════════════════════════════════════════════════════\n');
            console.log('💡 Cette clé fonctionne avec l\'API v1 et v2 de Philips Hue.\n');
          } else if (result.error) {
            console.log('\n❌ Erreur:', result.error.description || result.error.message);
            if (result.error.type === 101) {
              console.log('\n💡 Le bouton du bridge n\'a pas été pressé ou le délai a expiré.');
              console.log('   Relancez le script et appuyez sur le bouton AVANT de répondre "oui".');
              console.log('   Vous avez environ 30 secondes après avoir appuyé sur le bouton.');
            } else if (result.error.type === 1) {
              console.log('\n💡 Le lien n\'a pas été établi. Appuyez sur le bouton du bridge et réessayez.');
            }
          } else {
            console.log('\n⚠️  Format de réponse inattendu.');
            console.log('Vérifiez la réponse ci-dessus.');
          }
        } else {
          console.log('\n⚠️  Format de réponse inattendu.');
          console.log('La réponse devrait être un tableau. Réponse reçue:', typeof dataV1);
        }

        rl.close();
        resolve();
      } catch (error) {
        console.error('\n❌ Erreur lors de la création de la clé:', error.message);
        
        if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
          console.error('\n💡 Vérifiez que:');
          console.error('  1. Votre bridge Hue est allumé et connecté au réseau');
          console.error('  2. L\'adresse IP (HUE_BRIDGE_IP) est correcte');
          console.error('  3. Vous êtes sur le même réseau que le bridge');
        } else if (error.message.includes('101')) {
          console.error('\n💡 Le bouton du bridge n\'a pas été pressé ou le délai a expiré.');
          console.error('   Relancez le script et appuyez sur le bouton AVANT de répondre "oui".');
        }
        
        rl.close();
        process.exit(1);
      }
    });
  });
}

// Exécuter le script
createAppKey();

