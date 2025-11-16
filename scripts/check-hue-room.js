#!/usr/bin/env node

// Script pour vérifier le statut des lumières d'une pièce Philips Hue
// Usage: node scripts/check-hue-room.js [roomName] ou npm run check-hue-room [roomName]
// Par défaut, vérifie le statut du "Salon"

// Charger les variables d'environnement depuis la racine du projet
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Charger le service Hue
const hueService = require('../server/hue');

const ROOM_NAME = process.argv[2] || 'Salon';

// Fonction de log détaillée
function debugLog(message) {
  console.log(message);
}

async function checkRoomStatus() {
  console.log(`💡 Vérification du statut des lumières - ${ROOM_NAME}\n`);
  console.log('Configuration:');
  console.log(`  - Bridge IP: ${process.env.HUE_BRIDGE_IP || '192.168.1.222'}`);
  console.log(`  - App Key: ${process.env.HUE_APP_KEY ? process.env.HUE_APP_KEY.substring(0, 10) + '...' : 'NON CONFIGURÉE'}`);
  console.log(`  - Pièce: ${ROOM_NAME}\n`);

  if (!process.env.HUE_APP_KEY) {
    console.error('❌ ERREUR: HUE_APP_KEY n\'est pas configurée dans le fichier .env');
    console.error('\nPour obtenir une clé d\'application, utilisez:');
    console.error('  npm run create-hue-app-key');
    process.exit(1);
  }

  try {
    const roomData = await hueService.getRoomStatus(ROOM_NAME, debugLog);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RÉSULTATS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log(`📦 PIÈCE: ${roomData.room.name}`);
    console.log(`   ID: ${roomData.room.id}`);
    console.log(`   Type: ${roomData.room.type}`);
    console.log('');

    console.log('💡 STATUT GLOBAL:');
    console.log(`   • Toutes allumées: ${roomData.status.allOn ? '✅ Oui' : '❌ Non'}`);
    console.log(`   • Certaines allumées: ${roomData.status.anyOn ? '✅ Oui' : '❌ Non'}`);
    console.log(`   • Toutes éteintes: ${roomData.status.allOff ? '✅ Oui' : '❌ Non'}`);
    console.log(`   • Luminosité moyenne: ${roomData.status.brightness}%`);
    console.log(`   • Lumières allumées: ${roomData.status.lightsOn} / ${roomData.status.lightsCount}`);
    console.log('');

    if (roomData.lights && roomData.lights.length > 0) {
      console.log('🔆 DÉTAIL DES LUMIÈRES:');
      roomData.lights.forEach((light, index) => {
        const statusIcon = light.on ? '💡' : '⚫';
        const statusText = light.on ? 'ALLUMÉE' : 'ÉTEINTE';
        console.log(`\n   ${index + 1}. ${light.name} (ID: ${light.id})`);
        console.log(`      ${statusIcon} Statut: ${statusText}`);
        if (light.on) {
          console.log(`      🌟 Luminosité: ${light.brightness}%`);
          if (light.color && light.color.xy && Array.isArray(light.color.xy) && light.color.xy.length >= 2) {
            console.log(`      🎨 Couleur: XY(${light.color.xy[0].toFixed(3)}, ${light.color.xy[1].toFixed(3)})`);
          }
        }
      });
      console.log('');
    } else if (roomData.status.lightsCount > 0) {
      console.log(`ℹ️  ${roomData.status.lightsCount} lumière(s) dans cette pièce (détails individuels non disponibles, utilisation du grouped_light).\n`);
    } else {
      console.log('⚠️  Aucune lumière trouvée dans cette pièce.\n');
    }

    if (roomData.groupedLight) {
      console.log('🔗 GROUPED LIGHT:');
      console.log(`   • ID: ${roomData.groupedLight.id}`);
      console.log(`   • Statut: ${roomData.groupedLight.on ? 'ALLUMÉ' : 'ÉTEINT'}`);
      if (roomData.groupedLight.on) {
        console.log(`   • Luminosité: ${roomData.groupedLight.brightness}%`);
      }
      console.log('');
    }

    console.log(`🕐 Dernière mise à jour: ${new Date(roomData.lastUpdate).toLocaleString('fr-FR')}`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERREUR lors de la vérification du statut:', error.message);
    if (error.message.includes('not found')) {
      console.error('\n💡 La pièce spécifiée n\'a pas été trouvée.');
      console.error('   Vérifiez le nom de la pièce (sensible à la casse).');
      console.error('   Utilisez: npm run fetch-hue-devices pour voir les appareils disponibles.');
    } else if (error.message.includes('HUE_APP_KEY')) {
      console.error('\n💡 Vérifiez que HUE_APP_KEY est correctement configurée dans votre .env');
    } else if (error.message.includes('403')) {
      console.error('\n💡 Vérifiez que HUE_APP_KEY est correcte et a les permissions nécessaires.');
    } else if (error.message.includes('Network error') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Assurez-vous que l\'IP du bridge est correcte et que le bridge est allumé.');
    }
    process.exit(1);
  }
}

checkRoomStatus();
