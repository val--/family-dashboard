#!/usr/bin/env node

// Script pour vérifier les scénarios (scenes) disponibles dans Philips Hue
// Usage: node scripts/check-hue-scenes.js ou npm run check-hue-scenes

// Charger les variables d'environnement depuis la racine du projet
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const https = require('https');
const config = require('../server/config');

const HUE_BRIDGE_IP = config.hue.bridgeIp;
const HUE_APP_KEY = config.hue.appKey;
const ROOM_NAME = config.hue.roomName || 'Salon';

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
      rejectUnauthorized: false
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 207) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error('Failed to parse Hue API response'));
          }
        } else {
          reject(new Error(`Hue API returned status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function checkScenes() {
  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured in .env file');
    }

    console.log(`🔍 Vérification des scénarios Hue - Pièce: ${ROOM_NAME}\n`);

    // Get room first
    const roomsUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/room`;
    const roomsData = await makeRequest(roomsUrl);
    
    const room = roomsData.data?.find(r => 
      r.metadata?.name?.toLowerCase() === ROOM_NAME.toLowerCase()
    );

    if (!room) {
      throw new Error(`Room "${ROOM_NAME}" not found`);
    }

    console.log(`✅ Pièce "${room.metadata?.name || ROOM_NAME}" trouvée (ID: ${room.id})\n`);

    // Get all scenes
    const scenesUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/scene`;
    const scenesData = await makeRequest(scenesUrl);

    if (!scenesData.data || scenesData.data.length === 0) {
      console.log('❌ Aucun scénario trouvé');
      return;
    }

    console.log(`✅ ${scenesData.data.length} scénario(s) trouvé(s) au total\n`);

    const roomScenes = scenesData.data.filter(scene => {
      if (scene.group && scene.group.rid === room.id) {
        return true;
      }
      if (scene.metadata && scene.metadata.name) {
        return scene.metadata.name.toLowerCase().includes(ROOM_NAME.toLowerCase());
      }
      return false;
    });

    const scenesToShow = roomScenes.length > 0 ? roomScenes : scenesData.data;

    console.log(`📋 ${scenesToShow.length} scénario(s) ${roomScenes.length > 0 ? `pour la pièce "${ROOM_NAME}"` : 'disponibles'}:\n`);

    scenesToShow.forEach((scene, index) => {
      console.log(`${index + 1}. ${scene.metadata?.name || scene.id}`);
      console.log(`   ID: ${scene.id}`);
      if (scene.group) {
        console.log(`   Groupe: ${scene.group.rtype} (ID: ${scene.group.rid})`);
      }
      if (scene.actions && scene.actions.length > 0) {
        console.log(`   Actions: ${scene.actions.length} action(s)`);
        const firstAction = scene.actions[0];
        if (firstAction.target) {
          console.log(`     - Target: ${firstAction.target.rtype} (ID: ${firstAction.target.rid})`);
        }
        if (firstAction.action) {
          if (firstAction.action.on) {
            console.log(`     - État: ${firstAction.action.on.on ? 'ON' : 'OFF'}`);
          }
          if (firstAction.action.dimming) {
            console.log(`     - Luminosité: ${firstAction.action.dimming.brightness}%`);
          }
          if (firstAction.action.color) {
            const xy = firstAction.action.color.xy;
            if (xy) {
              if (typeof xy === 'object' && xy.x !== undefined) {
                console.log(`     - Couleur XY: x=${xy.x}, y=${xy.y}`);
              } else if (Array.isArray(xy)) {
                console.log(`     - Couleur XY: [${xy[0]}, ${xy[1]}]`);
              }
            }
          }
          if (firstAction.action.color_temperature) {
            const mirek = firstAction.action.color_temperature.mirek;
            console.log(`     - Température de couleur (mirek): ${mirek}`);
          }
        }
      }
      if (scene.palette) {
        console.log(`   Palette:`);
        if (scene.palette.color && scene.palette.color.length > 0) {
          console.log(`     - Couleurs XY: ${scene.palette.color.length}`);
        }
        if (scene.palette.color_temperature && scene.palette.color_temperature.length > 0) {
          console.log(`     - Températures de couleur: ${scene.palette.color_temperature.length}`);
          scene.palette.color_temperature.forEach((ct, i) => {
            console.log(`       ${i + 1}. Mirek: ${ct.color_temperature?.mirek || 'N/A'}, Luminosité: ${ct.dimming?.brightness || 'N/A'}%`);
          });
        }
      }
      console.log('');
    });

    if (scenesToShow.length > 0) {
      console.log('📋 Structure complète du premier scénario (exemple):\n');
      console.log(JSON.stringify(scenesToShow[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

checkScenes();

