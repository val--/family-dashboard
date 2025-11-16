const https = require('https');
const config = require('./config');

const HUE_BRIDGE_IP = config.hue.bridgeIp;
const HUE_APP_KEY = config.hue.appKey;

const CACHE_DURATION = 2 * 1000; // 2 seconds cache (allows real-time updates every 3 seconds)
let hueCache = null;
let cacheTimestamp = null;
let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 5 * 60 * 1000; // Log same error at most once every 5 minutes

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
        if (res.statusCode === 200 || res.statusCode === 207 || res.statusCode === 204) {
          try {
            // 204 No Content doesn't have a body
            if (res.statusCode === 204 || !data) {
              resolve({ success: true });
            } else {
              resolve(JSON.parse(data));
            }
          } catch (error) {
            // If parsing fails but status is success, return success
            if (res.statusCode === 200 || res.statusCode === 207 || res.statusCode === 204) {
              resolve({ success: true });
            } else {
              reject(new Error('Failed to parse Hue API response'));
            }
          }
        } else {
          let errorMessage = `Hue API returned status ${res.statusCode}`;
          try {
            const errorData = JSON.parse(data);
            if (errorData.errors && errorData.errors.length > 0) {
              errorMessage += `: ${errorData.errors.map(e => e.description || e.message).join(', ')}`;
            }
          } catch (e) {
            // Ignore parse error
          }
          reject(new Error(errorMessage));
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

async function getRoomStatus(roomName = 'Salon', debugLog = null) {
  // Check cache
  if (hueCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    if (debugLog) debugLog('📦 Utilisation du cache (données de moins de 5 minutes)');
    return hueCache;
  }

  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured');
    }

    if (debugLog) debugLog('📡 Étape 1: Récupération des rooms...');
    const roomsUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/room`;
    const roomsData = await makeRequest(roomsUrl);
    
    if (debugLog) debugLog(`   ✓ ${roomsData.data?.length || 0} room(s) trouvée(s)`);
    
    // Find the requested room
    const room = roomsData.data?.find(r => 
      r.metadata?.name?.toLowerCase() === roomName.toLowerCase()
    );

    if (!room) {
      throw new Error(`Room "${roomName}" not found`);
    }

    if (debugLog) {
      debugLog(`   ✓ Room "${room.name || room.metadata?.name || 'Unknown'}" trouvée (ID: ${room.id})`);
      if (room.services) {
        debugLog(`   Services de la room: ${room.services.length} service(s)`);
        debugLog(`   Types de services: ${room.services.map(s => s.rtype).join(', ')}`);
        debugLog(`   Détails des services: ${JSON.stringify(room.services.map(s => ({ rtype: s.rtype, rid: s.rid })))}`);
      } else {
        debugLog(`   ⚠️  room.services est undefined ou null`);
      }
    }

    // Find grouped_light service in room.services
    if (debugLog) debugLog('\n📡 Étape 2: Recherche du grouped_light...');
    const groupedLightService = room.services?.find(s => s.rtype === 'grouped_light');
    
    if (!groupedLightService) {
      throw new Error(`No grouped_light service found for room "${roomName}"`);
    }

    if (debugLog) debugLog(`   ✓ Grouped light service trouvé (ID: ${groupedLightService.rid})`);

    // Get grouped_light details
    if (debugLog) debugLog('\n📡 Étape 3: Récupération des détails du grouped_light...');
    const groupedLightUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/grouped_light/${groupedLightService.rid}`;
    const groupedLightResponse = await makeRequest(groupedLightUrl);
    const groupedLight = groupedLightResponse.data?.[0];

    if (!groupedLight) {
      throw new Error(`Grouped light ${groupedLightService.rid} not found`);
    }

    if (debugLog) {
      debugLog(`   ✓ Grouped light récupéré`);
      debugLog(`   Grouped light structure complète: ${JSON.stringify({
        id: groupedLight.id,
        id_v1: groupedLight.id_v1 || null,
        hasServices: !!groupedLight.services,
        servicesCount: groupedLight.services?.length || 0,
        hasOwner: !!groupedLight.owner,
        owner: groupedLight.owner || null,
        on: groupedLight.on?.on,
        brightness: groupedLight.dimming?.brightness,
        hasColor: !!groupedLight.color,
        color: groupedLight.color || null,
        allKeys: Object.keys(groupedLight)
      }, null, 2)}`);
      
      if (groupedLight.services) {
        debugLog(`   ✓ ${groupedLight.services.length} service(s) dans le grouped_light`);
        const lightServices = groupedLight.services.filter(s => s.rtype === 'light');
        if (lightServices.length > 0) {
          debugLog(`   ✓ ${lightServices.length} service(s) de type 'light' trouvé(s)`);
          debugLog(`   IDs des lights dans grouped_light.services: ${lightServices.map(s => s.rid).join(', ')}`);
        } else {
          debugLog(`   ⚠️  Aucun service de type 'light' dans grouped_light.services`);
          debugLog(`   Types de services disponibles: ${groupedLight.services.map(s => s.rtype).join(', ')}`);
        }
      } else {
        debugLog(`   ⚠️  grouped_light.services est undefined ou null`);
      }
      
      if (groupedLight.owner) {
        debugLog(`   Owner du grouped_light: ${JSON.stringify(groupedLight.owner)}`);
      }
    }

    // Try to get all resources to understand the structure
    if (debugLog) debugLog('\n📡 Étape 4a: Récupération de toutes les ressources (pour comprendre la structure)...');
    let allResourcesData = null;
    try {
      const allResourcesUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource`;
      allResourcesData = await makeRequest(allResourcesUrl);
      if (debugLog && allResourcesData.data) {
        debugLog(`   ✓ ${allResourcesData.data.length} ressource(s) trouvée(s) au total`);
        const resourceTypes = {};
        allResourcesData.data.forEach(resource => {
          resourceTypes[resource.type] = (resourceTypes[resource.type] || 0) + 1;
        });
        debugLog(`   Types de ressources: ${JSON.stringify(resourceTypes)}`);
        
        // Check if we can find lights that reference the room or grouped_light
        const allLights = allResourcesData.data.filter(r => r.type === 'light');
        if (debugLog && allLights.length > 0) {
          debugLog(`   Vérification de ${allLights.length} light(s) dans toutes les ressources...`);
          allLights.forEach(light => {
            if (light.services && light.services.length > 0) {
              light.services.forEach(service => {
                if (service.rtype === 'room' && service.rid === room.id) {
                  debugLog(`     ✓ Light "${light.metadata?.name || light.id}" a un service room qui correspond!`);
                }
                if (service.rtype === 'grouped_light' && service.rid === groupedLight.id) {
                  debugLog(`     ✓ Light "${light.metadata?.name || light.id}" a un service grouped_light qui correspond!`);
                }
              });
            }
            if (light.service_id === groupedLight.id) {
              debugLog(`     ✓ Light "${light.metadata?.name || light.id}" a un service_id qui correspond au grouped_light!`);
            }
          });
        }
      }
    } catch (error) {
      if (debugLog) debugLog(`   ⚠️  Impossible de récupérer toutes les ressources: ${error.message}`);
    }

    // Get devices (lights belong to devices, devices belong to room)
    if (debugLog) debugLog('\n📡 Étape 4b: Récupération des devices...');
    const devicesUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/device`;
    const devicesData = await makeRequest(devicesUrl);
    
    if (debugLog) {
      debugLog(`   ✓ ${devicesData.data?.length || 0} device(s) trouvé(s)`);
      // Check all devices for room references
      if (devicesData.data && devicesData.data.length > 0) {
        debugLog(`   Vérification de tous les devices pour des références à la room...`);
        devicesData.data.forEach(device => {
          if (device.services) {
            device.services.forEach(service => {
              if (service.rtype === 'room') {
                debugLog(`     - Device "${device.metadata?.name || device.id}": room=${service.rid} ${service.rid === room.id ? '✓ MATCH SALON!' : ''}`);
              }
            });
          }
        });
      }
    }

    // Get all lights
    if (debugLog) debugLog('\n📡 Étape 5: Récupération de toutes les lights...');
    const lightsUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/light`;
    const lightsData = await makeRequest(lightsUrl);
    
    if (debugLog) {
      debugLog(`   ✓ ${lightsData.data?.length || 0} light(s) trouvée(s)`);
      if (lightsData.data && lightsData.data.length > 0) {
        debugLog(`   Structure complète d'une light (exemple):`);
        const exampleLight = lightsData.data[0];
        debugLog(`     - Nom: ${exampleLight.metadata?.name || 'Unknown'}`);
        debugLog(`     - ID: ${exampleLight.id}`);
        debugLog(`     - Owner: ${JSON.stringify(exampleLight.owner || {})}`);
        debugLog(`     - Service ID: ${exampleLight.service_id || 'N/A'}`);
        debugLog(`     - Services: ${exampleLight.services?.length || 0} service(s)`);
        if (exampleLight.services) {
          debugLog(`     - Types de services: ${exampleLight.services.map(s => s.rtype).join(', ')}`);
          exampleLight.services.forEach(s => {
            if (s.rtype === 'room' || s.rtype === 'grouped_light') {
              debugLog(`       - ${s.rtype}: ${s.rid} ${s.rid === room.id || s.rid === groupedLight.id ? '✓ MATCH!' : ''}`);
            }
          });
        }
        debugLog(`     - Clés disponibles: ${JSON.stringify(Object.keys(exampleLight))}`);
        debugLog(`     - Structure complète (JSON): ${JSON.stringify(exampleLight, null, 2)}`);
      }
    }

    // Find lights in this room
    // Method: Find devices in room, then find lights that belong to those devices
    if (debugLog) debugLog('\n📡 Étape 6: Filtrage des lights de la room...');
    
    let roomLights = [];
    
    // Step 1: Find devices that belong to this room
    // Method 1: Via room.services (devices listed in room)
    if (debugLog) debugLog(`   Recherche des devices dans la room (méthode 1: room.services)...`);
    const roomDeviceIds = new Set();
    
    if (room.services && Array.isArray(room.services)) {
      room.services.forEach(service => {
        if (service.rtype === 'device') {
          roomDeviceIds.add(service.rid);
        }
      });
      
      if (debugLog) {
        debugLog(`   ✓ ${roomDeviceIds.size} device(s) trouvé(s) dans room.services`);
        if (roomDeviceIds.size > 0) {
          debugLog(`   IDs des devices: ${Array.from(roomDeviceIds).join(', ')}`);
        }
      }
    }
    
    // Method 2: Via devices.services (devices that reference this room)
    if (roomDeviceIds.size === 0 && devicesData.data) {
      if (debugLog) debugLog(`   Recherche des devices qui référencent cette room (méthode 2: devices.services)...`);
      
      devicesData.data.forEach(device => {
        if (device.services && Array.isArray(device.services)) {
          device.services.forEach(service => {
            if (service.rtype === 'room' && service.rid === room.id) {
              roomDeviceIds.add(device.id);
              if (debugLog) {
                debugLog(`     ✓ Device "${device.metadata?.name || device.id}" référencé la room`);
              }
            }
          });
        }
      });
      
      if (debugLog) {
        debugLog(`   ✓ ${roomDeviceIds.size} device(s) trouvé(s) qui référencent la room`);
        if (roomDeviceIds.size > 0) {
          debugLog(`   IDs des devices: ${Array.from(roomDeviceIds).join(', ')}`);
        } else {
          debugLog(`   ⚠️  Aucun device ne référence la room "${room.id}"`);
          debugLog(`   Vérification de tous les devices pour voir leurs services room:`);
          devicesData.data.forEach(device => {
            if (device.services) {
              const roomServices = device.services.filter(s => s.rtype === 'room');
              if (roomServices.length > 0) {
                debugLog(`     - ${device.metadata?.name || device.id}: rooms=${roomServices.map(s => s.rid).join(', ')}`);
              }
            }
          });
        }
      }
    }
    
    // Step 2: Find lights that belong to these devices
    if (roomDeviceIds.size > 0 && lightsData.data) {
      if (debugLog) debugLog(`   Recherche des lights appartenant à ces devices...`);
      
      roomLights = lightsData.data.filter(light => {
        const belongsToRoomDevice = roomDeviceIds.has(light.owner?.rid);
        return belongsToRoomDevice;
      });
      
      if (debugLog) {
        debugLog(`   ✓ ${roomLights.length} light(s) trouvée(s) appartenant aux devices de la room`);
        if (roomLights.length > 0) {
          debugLog(`   Lights trouvées: ${roomLights.map(l => `${l.metadata?.name || l.id} (device: ${l.owner?.rid})`).join(', ')}`);
        } else {
          debugLog(`   ⚠️  Aucune light trouvée avec owner.rid dans les devices de la room`);
          debugLog(`   Vérification des owner.rid des lights disponibles:`);
          lightsData.data.slice(0, 5).forEach(light => {
            const belongsToRoom = roomDeviceIds.has(light.owner?.rid);
            debugLog(`     - ${light.metadata?.name || light.id}: owner.rid=${light.owner?.rid || 'N/A'} ${belongsToRoom ? '✓' : '✗'}`);
          });
        }
      }
    }
    
    // Method 4: Check if lights have a service_id that matches the grouped_light
    if (roomLights.length === 0 && lightsData.data) {
      if (debugLog) debugLog(`\n   Méthode 4: Recherche des lights via service_id (grouped_light)...`);
      
      roomLights = lightsData.data.filter(light => {
        return light.service_id === groupedLight.id;
      });
      
      if (debugLog) {
        if (roomLights.length > 0) {
          debugLog(`   ✓ ${roomLights.length} light(s) trouvée(s) via service_id`);
          debugLog(`   Lights trouvées: ${roomLights.map(l => l.metadata?.name || l.id).join(', ')}`);
        } else {
          debugLog(`   ⚠️  Aucune light trouvée via service_id`);
        }
      }
    }
    
    // Method 5: Check if lights have a service that references the room or grouped_light (fallback)
    if (roomLights.length === 0 && lightsData.data) {
      if (debugLog) debugLog(`\n   Méthode 5: Recherche des lights via leurs services (room ou grouped_light)...`);
      
      roomLights = lightsData.data.filter(light => {
        if (light.services && Array.isArray(light.services)) {
          // Check if light has a service that references the room
          const hasRoomService = light.services.some(s => s.rtype === 'room' && s.rid === room.id);
          // Check if light has a service that references the grouped_light
          const hasGroupedLightService = light.services.some(s => s.rtype === 'grouped_light' && s.rid === groupedLight.id);
          return hasRoomService || hasGroupedLightService;
        }
        return false;
      });
      
      if (debugLog) {
        if (roomLights.length > 0) {
          debugLog(`   ✓ ${roomLights.length} light(s) trouvée(s) via leurs services`);
          debugLog(`   Lights trouvées: ${roomLights.map(l => l.metadata?.name || l.id).join(', ')}`);
        } else {
          debugLog(`   ⚠️  Aucune light trouvée via leurs services`);
        }
      }
    }
    
    // Method 6: Use all resources data if available to find lights
    if (roomLights.length === 0 && allResourcesData && allResourcesData.data) {
      if (debugLog) debugLog(`\n   Méthode 6: Recherche dans toutes les ressources...`);
      
      const allLights = allResourcesData.data.filter(r => r.type === 'light');
      roomLights = allLights.filter(light => {
        // Check service_id
        if (light.service_id === groupedLight.id) return true;
        // Check services
        if (light.services && Array.isArray(light.services)) {
          const hasRoomService = light.services.some(s => s.rtype === 'room' && s.rid === room.id);
          const hasGroupedLightService = light.services.some(s => s.rtype === 'grouped_light' && s.rid === groupedLight.id);
          return hasRoomService || hasGroupedLightService;
        }
        return false;
      });
      
      if (debugLog) {
        if (roomLights.length > 0) {
          debugLog(`   ✓ ${roomLights.length} light(s) trouvée(s) dans toutes les ressources`);
          debugLog(`   Lights trouvées: ${roomLights.map(l => l.metadata?.name || l.id).join(', ')}`);
        } else {
          debugLog(`   ⚠️  Aucune light trouvée dans toutes les ressources`);
        }
      }
    }
    
    // Method 7: Try using API v1 to get group information (which includes light IDs)
    if (roomLights.length === 0) {
      if (debugLog) debugLog(`\n   Méthode 7: Tentative via API v1 pour obtenir les lights du groupe...`);
      
      try {
        // Get the grouped_light id_v1 if available
        const groupedLightIdV1 = groupedLight.id_v1;
        if (groupedLightIdV1) {
          // Extract group ID from id_v1 (format: /groups/1)
          const groupIdMatch = groupedLightIdV1.match(/\/groups\/(\d+)/);
          if (groupIdMatch) {
            const groupId = groupIdMatch[1];
            if (debugLog) debugLog(`   Group ID v1 trouvé: ${groupId}`);
            
            // Use API v1 to get group details
            const v1GroupUrl = `https://${HUE_BRIDGE_IP}/api/${HUE_APP_KEY}/groups/${groupId}`;
            const v1GroupResponse = await makeRequest(v1GroupUrl);
            
            if (v1GroupResponse && v1GroupResponse.lights && Array.isArray(v1GroupResponse.lights)) {
              if (debugLog) debugLog(`   ✓ ${v1GroupResponse.lights.length} light(s) trouvée(s) via API v1`);
              
              // Map v1 light IDs to v2 light IDs
              // We need to find lights that have matching id_v1
              const v1LightIds = v1GroupResponse.lights; // e.g., ["1", "2", "3"]
              
              if (lightsData.data) {
                roomLights = lightsData.data.filter(light => {
                  if (light.id_v1) {
                    // Extract light ID from id_v1 (format: /lights/1)
                    const lightIdMatch = light.id_v1.match(/\/lights\/(\d+)/);
                    if (lightIdMatch) {
                      const lightId = lightIdMatch[1];
                      return v1LightIds.includes(lightId);
                    }
                  }
                  return false;
                });
                
                if (debugLog) {
                  if (roomLights.length > 0) {
                    debugLog(`   ✓ ${roomLights.length} light(s) trouvée(s) via mapping v1->v2`);
                    debugLog(`   Lights trouvées: ${roomLights.map(l => l.metadata?.name || l.id).join(', ')}`);
                  } else {
                    debugLog(`   ⚠️  Aucune light trouvée via mapping v1->v2`);
                    debugLog(`   IDs v1 du groupe: ${v1LightIds.join(', ')}`);
                    debugLog(`   IDs v1 des lights disponibles: ${lightsData.data.map(l => {
                      const match = l.id_v1?.match(/\/lights\/(\d+)/);
                      return match ? match[1] : 'N/A';
                    }).join(', ')}`);
                  }
                }
              }
            }
          } else {
            if (debugLog) debugLog(`   ⚠️  Impossible d'extraire le Group ID de id_v1: ${groupedLightIdV1}`);
          }
        } else {
          if (debugLog) debugLog(`   ⚠️  grouped_light n'a pas d'id_v1`);
        }
      } catch (error) {
        if (debugLog) debugLog(`   ⚠️  Erreur lors de l'appel API v1: ${error.message}`);
      }
    }
    
    if (debugLog && roomLights.length === 0) {
      debugLog(`   ⚠️  Aucune light trouvée avec aucune méthode`);
    }

    // Calculate status
    const allOn = roomLights.length > 0 && roomLights.every(light => light.on?.on === true);
    const anyOn = roomLights.some(light => light.on?.on === true);
    const allOff = roomLights.length === 0 || roomLights.every(light => !light.on?.on);
    
    const brightnesses = roomLights
      .filter(light => light.on?.on && light.dimming)
      .map(light => light.dimming.brightness || 0);
    const avgBrightness = brightnesses.length > 0
      ? Math.round(brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length)
      : (groupedLight.dimming?.brightness ? Math.round(groupedLight.dimming.brightness) : 0);

    const lightsCount = roomLights.length > 0 
      ? roomLights.length 
      : (groupedLight.services?.filter(s => s.rtype === 'light').length || 0);
    const lightsOn = roomLights.filter(light => light.on?.on).length;

    // Calculate average color from lights that are on
    // Check if xy is an object {x, y} or an array [x, y]
    const hasValidColor = (light) => {
      if (!light.on?.on || !light.color || !light.color.xy) return false;
      // Check if it's an object with x and y properties
      if (typeof light.color.xy === 'object' && light.color.xy.x !== undefined && light.color.xy.y !== undefined) {
        return true;
      }
      // Check if it's an array
      if (Array.isArray(light.color.xy) && light.color.xy.length >= 2) {
        return true;
      }
      return false;
    };
    
    const lightsWithColor = roomLights.filter(hasValidColor);
    
    // Helper to extract x, y from either format
    const getXY = (xy) => {
      if (typeof xy === 'object' && xy.x !== undefined && xy.y !== undefined) {
        return { x: xy.x, y: xy.y };
      }
      if (Array.isArray(xy) && xy.length >= 2) {
        return { x: xy[0], y: xy[1] };
      }
      return null;
    };
    
    // Also check grouped_light for color (scenarios might set color at group level)
    let avgColor = null;
    
    // First, try to get color from grouped_light (for scenarios)
    if (groupedLight.color && groupedLight.color.xy) {
      const groupedXY = getXY(groupedLight.color.xy);
      if (groupedXY) {
        avgColor = xyToRgb(groupedXY.x, groupedXY.y);
      }
    }
    
    // Fallback: calculate weighted average from individual lights (weighted by brightness)
    // This gives more accurate results when lights have different brightness levels
    if (!avgColor && lightsWithColor.length > 0) {
      let totalWeight = 0;
      const weightedXY = lightsWithColor.reduce((acc, light) => {
        const xy = getXY(light.color.xy);
        if (xy) {
          // Weight by brightness (0-100) to give more importance to brighter lights
          const weight = (light.dimming?.brightness || 100) / 100;
          acc.x += xy.x * weight;
          acc.y += xy.y * weight;
          totalWeight += weight;
        }
        return acc;
      }, { x: 0, y: 0 });
      
      if (totalWeight > 0) {
        weightedXY.x /= totalWeight;
        weightedXY.y /= totalWeight;
        avgColor = xyToRgb(weightedXY.x, weightedXY.y);
      }
    }
    
    // Helper function to convert XY to RGB (improved accuracy for Philips Hue)
    function xyToRgb(x, y) {
      // Clamp x and y to valid range
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      
      // Avoid division by zero
      if (y === 0) {
        return '#FFFFFF'; // Default to white if invalid
      }
      
      // Convert XY to XYZ (CIE 1931 color space)
      // Using standard D65 white point (x=0.3127, y=0.3290)
      // Y is set to 1.0 for full brightness
      const Y = 1.0;
      const X = (x / y) * Y;
      const Z = ((1.0 - x - y) / y) * Y;
      
      // Convert XYZ to linear RGB using sRGB matrix (D65 white point)
      // Matrix from: http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
      let r = X *  3.2404542 + Y * -1.5371385 + Z * -0.4985314;
      let g = X * -0.9692660 + Y *  1.8760108 + Z *  0.0415560;
      let b = X *  0.0556434 + Y * -0.2040259 + Z *  1.0572252;
      
      // Apply gamma correction (sRGB gamma curve)
      const gammaCorrection = (val) => {
        if (val <= 0.0031308) {
          return 12.92 * val;
        } else {
          return 1.055 * Math.pow(val, 1.0 / 2.4) - 0.055;
        }
      };
      
      r = gammaCorrection(r);
      g = gammaCorrection(g);
      b = gammaCorrection(b);
      
      // Clamp values to 0-1 range, then convert to 0-255
      r = Math.max(0, Math.min(1, r));
      g = Math.max(0, Math.min(1, g));
      b = Math.max(0, Math.min(1, b));
      
      // Convert to 0-255 and round
      const r255 = Math.round(r * 255);
      const g255 = Math.round(g * 255);
      const b255 = Math.round(b * 255);
      
      // Convert to hex
      return `#${r255.toString(16).padStart(2, '0')}${g255.toString(16).padStart(2, '0')}${b255.toString(16).padStart(2, '0')}`;
    }

    const result = {
      room: {
        id: room.id,
        name: room.metadata?.name || roomName,
        type: room.type
      },
      status: {
        allOn: roomLights.length > 0 ? allOn : (groupedLight.on?.on === true),
        anyOn: roomLights.length > 0 ? anyOn : (groupedLight.on?.on === true),
        allOff: roomLights.length > 0 ? allOff : (!groupedLight.on?.on),
        brightness: avgBrightness,
        lightsCount,
        lightsOn: roomLights.length > 0 ? lightsOn : (groupedLight.on?.on ? lightsCount : 0),
        color: avgColor,
        colorXY: avgColor ? (() => {
          // Try to get XY from grouped_light first (most accurate)
          if (groupedLight.color && groupedLight.color.xy) {
            const xy = getXY(groupedLight.color.xy);
            if (xy) return xy;
          }
          // Fallback: calculate average XY from individual lights
          if (lightsWithColor.length > 0) {
            let totalWeight = 0;
            const weightedXY = lightsWithColor.reduce((acc, light) => {
              const xy = getXY(light.color.xy);
              if (xy) {
                const weight = (light.dimming?.brightness || 100) / 100;
                acc.x += xy.x * weight;
                acc.y += xy.y * weight;
                totalWeight += weight;
              }
              return acc;
            }, { x: 0, y: 0 });
            if (totalWeight > 0) {
              return {
                x: weightedXY.x / totalWeight,
                y: weightedXY.y / totalWeight
              };
            }
          }
          return null;
        })() : null
      },
      lights: roomLights.map(light => ({
        id: light.id,
        name: light.metadata?.name || 'Unknown',
        on: light.on?.on || false,
        brightness: light.dimming?.brightness || 0,
        color: light.color ? {
          xy: light.color.xy,
          gamut: light.color.gamut
        } : null
      })),
      groupedLight: {
        id: groupedLight.id,
        on: groupedLight.on?.on || false,
        brightness: groupedLight.dimming?.brightness || 0
      },
      lastUpdate: new Date().toISOString()
    };

    // Update cache
    hueCache = result;
    cacheTimestamp = Date.now();

    if (debugLog) debugLog('\n✅ Données récupérées avec succès!');

    return result;
  } catch (error) {
    const now = Date.now();
    if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
      console.error('[Hue] ❌ Erreur lors de la récupération des données:', error.message);
      lastErrorLogTime = now;
    }
    throw error;
  }
}

async function toggleRoomLights(roomName = 'Salon', turnOn = null) {
  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured');
    }

    // Get room and grouped_light
    const roomsUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/room`;
    const roomsData = await makeRequest(roomsUrl);
    
    const room = roomsData.data?.find(r => 
      r.metadata?.name?.toLowerCase() === roomName.toLowerCase()
    );

    if (!room) {
      throw new Error(`Room "${roomName}" not found`);
    }

    const groupedLightService = room.services?.find(s => s.rtype === 'grouped_light');
    
    if (!groupedLightService) {
      throw new Error(`No grouped_light service found for room "${roomName}"`);
    }

    // Get current status to determine toggle action
    const groupedLightUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/grouped_light/${groupedLightService.rid}`;
    const groupedLightResponse = await makeRequest(groupedLightUrl);
    const groupedLight = groupedLightResponse.data?.[0];

    if (!groupedLight) {
      throw new Error(`Grouped light ${groupedLightService.rid} not found`);
    }

    // Determine target state: if turnOn is null, toggle; otherwise use the specified value
    const currentState = groupedLight.on?.on || false;
    const targetState = turnOn !== null ? turnOn : !currentState;

    // Update the grouped_light
    const updateUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/grouped_light/${groupedLightService.rid}`;
    await makeRequest(updateUrl, {
      method: 'PUT',
      body: {
        on: {
          on: targetState
        }
      }
    });

    // Invalidate cache to force refresh
    hueCache = null;
    cacheTimestamp = null;

    return { success: true, turnedOn: targetState };
  } catch (error) {
    console.error('[Hue] ❌ Erreur lors du toggle des lumières:', error.message);
    throw error;
  }
}

async function setRoomBrightness(roomName = 'Salon', brightness) {
  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured');
    }

    // Validate brightness value (0-100)
    const brightnessValue = Math.max(0, Math.min(100, Math.round(brightness)));

    // Get room and grouped_light
    const roomsUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/room`;
    const roomsData = await makeRequest(roomsUrl);
    
    const room = roomsData.data?.find(r => 
      r.metadata?.name?.toLowerCase() === roomName.toLowerCase()
    );

    if (!room) {
      throw new Error(`Room "${roomName}" not found`);
    }

    const groupedLightService = room.services?.find(s => s.rtype === 'grouped_light');
    
    if (!groupedLightService) {
      throw new Error(`No grouped_light service found for room "${roomName}"`);
    }

    // Update the grouped_light brightness
    // If brightness is 0, turn off; if > 0, turn on and set brightness
    const updateUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/grouped_light/${groupedLightService.rid}`;
    await makeRequest(updateUrl, {
      method: 'PUT',
      body: {
        on: {
          on: brightnessValue > 0
        },
        dimming: {
          brightness: brightnessValue
        }
      }
    });

    // Invalidate cache to force refresh
    hueCache = null;
    cacheTimestamp = null;

    return { success: true, brightness: brightnessValue };
  } catch (error) {
    console.error('[Hue] ❌ Erreur lors du réglage de la luminosité:', error.message);
    throw error;
  }
}

async function setRoomColor(roomName = 'Salon', xy) {
  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured');
    }

    if (!xy || typeof xy.x === 'undefined' || typeof xy.y === 'undefined') {
      throw new Error('XY coordinates are required');
    }

    // Get room and grouped_light
    const roomsUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/room`;
    const roomsData = await makeRequest(roomsUrl);
    
    const room = roomsData.data?.find(r => 
      r.metadata?.name?.toLowerCase() === roomName.toLowerCase()
    );

    if (!room) {
      throw new Error(`Room "${roomName}" not found`);
    }

    const groupedLightService = room.services?.find(s => s.rtype === 'grouped_light');
    
    if (!groupedLightService) {
      throw new Error(`No grouped_light service found for room "${roomName}"`);
    }

    // Update the grouped_light color
    const updateUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/grouped_light/${groupedLightService.rid}`;
    await makeRequest(updateUrl, {
      method: 'PUT',
      body: {
        color: {
          xy: {
            x: xy.x,
            y: xy.y
          }
        }
      }
    });

    // Invalidate cache to force refresh
    hueCache = null;
    cacheTimestamp = null;

    return { success: true, color: { x: xy.x, y: xy.y } };
  } catch (error) {
    console.error('[Hue] ❌ Erreur lors du changement de couleur:', error.message);
    throw error;
  }
}

module.exports = {
  getRoomStatus,
  toggleRoomLights,
  setRoomBrightness,
  setRoomColor,
};
