#!/usr/bin/env node

// Script pour récupérer les informations des appareils Philips Hue
// Usage: node scripts/fetch-hue-devices.js ou npm run fetch-hue-devices
// Documentation: https://developers.meethue.com/develop/hue-api-v2/getting-started/

// Charger les variables d'environnement depuis la racine du projet
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const https = require('https');

const HUE_BRIDGE_IP = process.env.HUE_BRIDGE_IP || '192.168.1.222';
const HUE_APP_KEY = process.env.HUE_APP_KEY || ''; // Application key for Hue API v2

console.log('💡 Récupération des appareils Philips Hue\n');
console.log('Configuration:');
console.log(`  - Bridge IP: ${HUE_BRIDGE_IP}`);
console.log(`  - App Key: ${HUE_APP_KEY ? HUE_APP_KEY.substring(0, 10) + '...' : 'NON CONFIGURÉE'}\n`);

if (!HUE_APP_KEY) {
  console.error('❌ ERREUR: HUE_APP_KEY n\'est pas configurée dans le fichier .env');
  console.error('\nPour obtenir une clé d\'application:');
  console.error('1. Appuyez sur le bouton de liaison de votre bridge Hue');
  console.error('2. Envoyez une requête POST à https://' + HUE_BRIDGE_IP + '/api');
  console.error('   avec le body: {"devicetype": "family-dashboard#device"}');
  console.error('3. Copiez la "username" retournée dans votre .env comme HUE_APP_KEY');
  console.error('\nPour l\'API v2, vous pouvez aussi utiliser:');
  console.error('   POST https://' + HUE_BRIDGE_IP + '/clip/v2/resource');
  console.error('   avec header: {"hue-application-key": "votre-clé"}');
  process.exit(1);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'hue-application-key': HUE_APP_KEY,
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

        if (res.statusCode === 200 || res.statusCode === 207) {
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

async function fetchDevices() {
  try {
    const url = `https://${HUE_BRIDGE_IP}/clip/v2/resource/device`;
    console.log('🔍 Récupération des appareils...\n');
    
    const data = await makeRequest(url);
    
    // Analyse des données
    if (data.data && Array.isArray(data.data)) {
      console.log('\n📊 Analyse:');
      console.log(`  - Nombre d'appareils trouvés: ${data.data.length}\n`);
      
      data.data.forEach((device, index) => {
        console.log(`Appareil ${index + 1}:`);
        console.log(`  - ID: ${device.id}`);
        console.log(`  - Type: ${device.type || 'N/A'}`);
        console.log(`  - Nom: ${device.metadata?.name || 'N/A'}`);
        console.log(`  - Fabricant: ${device.product_data?.manufacturer_name || 'N/A'}`);
        console.log(`  - Modèle: ${device.product_data?.model_id || 'N/A'}`);
        if (device.services) {
          console.log(`  - Services: ${device.services.length} service(s)`);
          device.services.forEach((service, sIndex) => {
            console.log(`    ${sIndex + 1}. ${service.rtype} (${service.rid})`);
          });
        }
        console.log('');
      });
    } else {
      console.log('\n⚠️  Format de réponse inattendu');
      console.log('Clés disponibles:', Object.keys(data));
    }
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la récupération des appareils:', error.message);
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('\n💡 Vérifiez que:');
      console.error('  1. Votre HUE_APP_KEY est correcte');
      console.error('  2. Vous avez appuyé sur le bouton de liaison du bridge récemment');
      console.error('  3. Votre bridge est accessible sur le réseau');
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.error('\n💡 Vérifiez que:');
      console.error('  1. Votre bridge Hue est allumé et connecté au réseau');
      console.error('  2. L\'adresse IP (HUE_BRIDGE_IP) est correcte');
      console.error('  3. Vous êtes sur le même réseau que le bridge');
    }
    process.exit(1);
  }
}

// Fonction pour tester la connexion au bridge
async function testConnection() {
  try {
    const url = `https://${HUE_BRIDGE_IP}/clip/v2/resource`;
    console.log('🔍 Test de connexion au bridge...\n');
    
    const data = await makeRequest(url);
    
    console.log('✅ Connexion réussie!');
    console.log('Endpoints disponibles:', Object.keys(data.data || {}));
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
  }
}

// Exécuter le script
async function main() {
  // Test de connexion d'abord
  await testConnection();
  
  // Ensuite récupérer les appareils
  await fetchDevices();
}

main();

