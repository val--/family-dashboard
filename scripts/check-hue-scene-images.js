#!/usr/bin/env node

// Script pour vérifier les images des scénarios Hue
// Usage: node scripts/check-hue-scene-images.js ou npm run check-hue-scene-images

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

async function checkSceneImages() {
  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured in .env file');
    }

    console.log(`🔍 Vérification des images des scénarios Hue - Pièce: ${ROOM_NAME}\n`);

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

    // Filter scenes for this room
    const roomScenes = scenesData.data.filter(scene => {
      if (scene.group && scene.group.rid === room.id) {
        return true;
      }
      return false;
    });

    console.log(`✅ ${roomScenes.length} scénario(s) trouvé(s) pour la pièce "${ROOM_NAME}"\n`);

    const sceneWithImage = roomScenes.find(s => s.metadata?.image);
    
    if (!sceneWithImage) {
      console.log('❌ Aucun scénario avec image trouvé');
      return;
    }

    console.log(`📋 Scénario avec image: "${sceneWithImage.metadata.name}"`);
    console.log(`   Image RID: ${sceneWithImage.metadata.image.rid}`);
    console.log(`   Image RType: ${sceneWithImage.metadata.image.rtype}\n`);

    try {
      const imageUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/public_image/${sceneWithImage.metadata.image.rid}`;
      console.log(`📡 Tentative de récupération de l'image: ${imageUrl}\n`);
      
      const imageData = await makeRequest(imageUrl);
      
      console.log('✅ Données de l\'image récupérées:\n');
      console.log(JSON.stringify(imageData, null, 2));
      
      if (imageData.data && imageData.data.length > 0) {
        const image = imageData.data[0];
        console.log('\n📊 Structure de l\'image:');
        console.log(`   ID: ${image.id}`);
        console.log(`   Clés disponibles: ${Object.keys(image).join(', ')}`);
        
        if (image.image) {
          console.log(`   Image data: ${JSON.stringify(image.image, null, 2)}`);
        }
        if (image.url) {
          console.log(`   URL: ${image.url}`);
        }
        if (image.filename) {
          console.log(`   Filename: ${image.filename}`);
        }
        if (image.mime_type) {
          console.log(`   MIME Type: ${image.mime_type}`);
        }
      }
    } catch (error) {
      console.log(`❌ Erreur lors de la récupération de l'image: ${error.message}`);
    }

    console.log('\n📋 Tous les scénarios avec leurs images:\n');
    roomScenes.forEach((scene, index) => {
      console.log(`${index + 1}. ${scene.metadata?.name || scene.id}`);
      if (scene.metadata?.image) {
        console.log(`   ✅ Image disponible: ${scene.metadata.image.rid}`);
      } else {
        console.log(`   ❌ Pas d'image`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

checkSceneImages();

