#!/usr/bin/env node

// Script pour vérifier le gamut des ampoules Philips Hue
// Usage: node scripts/check-hue-gamut.js ou npm run check-hue-gamut

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

async function checkGamut() {
  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured in .env file');
    }

    console.log(`🔍 Vérification du gamut des ampoules Hue - Pièce: ${ROOM_NAME}\n`);

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

    // Get all lights
    const lightsUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/light`;
    const lightsData = await makeRequest(lightsUrl);

    if (!lightsData.data || lightsData.data.length === 0) {
      console.log('❌ Aucune ampoule trouvée');
      return;
    }

    // Get grouped_light for the room
    const groupedLightService = room.services?.find(s => s.rtype === 'grouped_light');
    
    if (!groupedLightService) {
      throw new Error(`No grouped_light service found for room "${ROOM_NAME}"`);
    }

    // Get grouped_light details
    const groupedLightUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/grouped_light/${groupedLightService.rid}`;
    const groupedLightResponse = await makeRequest(groupedLightUrl);
    const groupedLight = groupedLightResponse.data?.[0];

    if (!groupedLight) {
      throw new Error(`Grouped light ${groupedLightService.rid} not found`);
    }

    // Get devices to find lights in the room
    const devicesUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/device`;
    const devicesData = await makeRequest(devicesUrl);

    // Find devices in this room
    const roomDeviceIds = new Set();
    
    if (room.services && Array.isArray(room.services)) {
      room.services.forEach(service => {
        if (service.rtype === 'device') {
          roomDeviceIds.add(service.rid);
        }
      });
    }
    
    // Also check devices that reference this room
    if (devicesData.data) {
      devicesData.data.forEach(device => {
        if (device.services && Array.isArray(device.services)) {
          device.services.forEach(service => {
            if (service.rtype === 'room' && service.rid === room.id) {
              roomDeviceIds.add(device.id);
            }
          });
        }
      });
    }

    // Filter lights that belong to room devices
    let roomLights = lightsData.data.filter(light => {
      return roomDeviceIds.has(light.owner?.rid);
    });

    // Method 2: Use API v1 to get group information (which includes light IDs)
    if (roomLights.length === 0) {
      console.log('   Tentative via API v1...');
      
      try {
        const groupedLightIdV1 = groupedLight.id_v1;
        if (groupedLightIdV1) {
          const groupIdMatch = groupedLightIdV1.match(/\/groups\/(\d+)/);
          if (groupIdMatch) {
            const groupId = groupIdMatch[1];
            
            // Use API v1 to get group details
            const v1GroupUrl = `https://${HUE_BRIDGE_IP}/api/${HUE_APP_KEY}/groups/${groupId}`;
            const v1GroupResponse = await makeRequest(v1GroupUrl);
            
            if (v1GroupResponse && v1GroupResponse.lights && Array.isArray(v1GroupResponse.lights)) {
              const v1LightIds = v1GroupResponse.lights;
              
              // Map v1 light IDs to v2 light IDs
              roomLights = lightsData.data.filter(light => {
                if (light.id_v1) {
                  const lightIdMatch = light.id_v1.match(/\/lights\/(\d+)/);
                  if (lightIdMatch) {
                    const lightId = lightIdMatch[1];
                    return v1LightIds.includes(lightId);
                  }
                }
                return false;
              });
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Erreur API v1: ${error.message}`);
      }
    }

    if (roomLights.length === 0) {
      console.log(`❌ Aucune ampoule trouvée dans la pièce "${ROOM_NAME}"`);
      console.log(`   Vérifiez que la pièce contient bien des ampoules dans l'application Hue`);
      return;
    }

    console.log(`✅ ${roomLights.length} ampoule(s) trouvée(s) dans la pièce "${ROOM_NAME}"\n`);

    // Gamut definitions (from Philips Hue API documentation)
    const GAMUT_A = {
      red: { x: 0.704, y: 0.296 },
      green: { x: 0.2151, y: 0.7106 },
      blue: { x: 0.138, y: 0.08 }
    };

    const GAMUT_B = {
      red: { x: 0.675, y: 0.322 },
      green: { x: 0.409, y: 0.518 },
      blue: { x: 0.167, y: 0.04 }
    };

    const GAMUT_C = {
      red: { x: 0.692, y: 0.308 },
      green: { x: 0.17, y: 0.7 },
      blue: { x: 0.153, y: 0.048 }
    };

    const gamuts = {
      A: GAMUT_A,
      B: GAMUT_B,
      C: GAMUT_C
    };

    // Analyze each light in the room
    const gamutCounts = { A: 0, B: 0, C: 0, unknown: 0 };
    const lightsByGamut = { A: [], B: [], C: [], unknown: [] };

    roomLights.forEach(light => {
      const name = light.metadata?.name || light.id;
      const gamut = light.color?.gamut;
      
      if (gamut) {
        // Try to match the gamut with known gamuts
        let matchedGamut = null;
        
        for (const [gamutName, gamutDef] of Object.entries(gamuts)) {
          const redMatch = Math.abs(gamut.red.x - gamutDef.red.x) < 0.01 && 
                          Math.abs(gamut.red.y - gamutDef.red.y) < 0.01;
          const greenMatch = Math.abs(gamut.green.x - gamutDef.green.x) < 0.01 && 
                            Math.abs(gamut.green.y - gamutDef.green.y) < 0.01;
          const blueMatch = Math.abs(gamut.blue.x - gamutDef.blue.x) < 0.01 && 
                           Math.abs(gamut.blue.y - gamutDef.blue.y) < 0.01;
          
          if (redMatch && greenMatch && blueMatch) {
            matchedGamut = gamutName;
            break;
          }
        }
        
        if (matchedGamut) {
          gamutCounts[matchedGamut]++;
          lightsByGamut[matchedGamut].push(name);
        } else {
          gamutCounts.unknown++;
          lightsByGamut.unknown.push({
            name,
            gamut: JSON.stringify(gamut, null, 2)
          });
        }
      } else {
        gamutCounts.unknown++;
        lightsByGamut.unknown.push(name);
      }
    });

    // Display results
    console.log('📊 Résultats par gamut:\n');
    
    for (const [gamutName, count] of Object.entries(gamutCounts)) {
      if (count > 0) {
        console.log(`  ${gamutName === 'unknown' ? '❓' : '✅'} Gamut ${gamutName}: ${count} ampoule(s)`);
        if (lightsByGamut[gamutName].length > 0) {
          lightsByGamut[gamutName].forEach(light => {
            if (typeof light === 'string') {
              console.log(`     - ${light}`);
            } else {
              console.log(`     - ${light.name}`);
              console.log(`       Gamut: ${light.gamut}`);
            }
          });
        }
        console.log('');
      }
    }

    // Determine the most common gamut
    const mostCommon = Object.entries(gamutCounts)
      .filter(([name]) => name !== 'unknown')
      .sort((a, b) => b[1] - a[1])[0];

    if (mostCommon && mostCommon[1] > 0) {
      console.log(`\n🎯 Gamut le plus utilisé: ${mostCommon[0]} (${mostCommon[1]} ampoule(s))`);
      console.log(`\n📝 Coordonnées du gamut ${mostCommon[0]}:`);
      const gamutDef = gamuts[mostCommon[0]];
      console.log(`   Rouge:  x=${gamutDef.red.x}, y=${gamutDef.red.y}`);
      console.log(`   Vert:   x=${gamutDef.green.x}, y=${gamutDef.green.y}`);
      console.log(`   Bleu:   x=${gamutDef.blue.x}, y=${gamutDef.blue.y}`);
    }

    // Show sample light details
    if (roomLights.length > 0) {
      const sampleLight = roomLights[0];
      console.log(`\n📋 Exemple d'ampoule (${sampleLight.metadata?.name || sampleLight.id}):`);
      console.log(`   ID: ${sampleLight.id}`);
      if (sampleLight.color) {
        console.log(`   Color gamut: ${JSON.stringify(sampleLight.color.gamut, null, 2)}`);
        if (sampleLight.color.xy) {
          const xy = sampleLight.color.xy;
          if (typeof xy === 'object' && xy.x !== undefined) {
            console.log(`   Current XY: x=${xy.x}, y=${xy.y}`);
          } else if (Array.isArray(xy)) {
            console.log(`   Current XY: [${xy[0]}, ${xy[1]}]`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

checkGamut();

