const https = require('https');
const config = require('./config');

const HUE_BRIDGE_IP = config.hue.bridgeIp;
const HUE_APP_KEY = config.hue.appKey;

const CACHE_DURATION = 2 * 1000;
let hueCache = null;
let cacheTimestamp = null;
let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 5 * 60 * 1000;

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
        if (res.statusCode === 200 || res.statusCode === 207 || res.statusCode === 204) {
          try {
            if (res.statusCode === 204 || !data) {
              resolve({ success: true });
            } else {
              resolve(JSON.parse(data));
            }
          } catch (error) {
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

function mirekToXy(mirek) {
  mirek = Math.max(153, Math.min(500, mirek));
  const kelvin = 1000000 / mirek;
  let x, y;
  
  if (kelvin < 4000) {
    x = -0.2661239 * Math.pow(10, 9) / Math.pow(kelvin, 3) +
        -0.2343580 * Math.pow(10, 6) / Math.pow(kelvin, 2) +
        0.8776956 * Math.pow(10, 3) / kelvin +
        0.179910;
  } else {
    x = -3.0258469 * Math.pow(10, 9) / Math.pow(kelvin, 3) +
        2.1070379 * Math.pow(10, 6) / Math.pow(kelvin, 2) +
        0.2226347 * Math.pow(10, 3) / kelvin +
        0.240390;
  }
  
  y = -3.0 * Math.pow(x, 2) + 2.87 * x - 0.275;
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  
  return { x, y };
}

function xyToRgb(x, y) {
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  
  if (y === 0) {
    return '#FFFFFF';
  }
  
  const Y = 1.0;
  const X = (x / y) * Y;
  const Z = ((1.0 - x - y) / y) * Y;
  
  let r = X *  3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  let g = X * -0.9692660 + Y *  1.8760108 + Z *  0.0415560;
  let b = X *  0.0556434 + Y * -0.2040259 + Z *  1.0572252;
  
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
  
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  b = Math.max(0, Math.min(1, b));
  
  const r255 = Math.round(r * 255);
  const g255 = Math.round(g * 255);
  const b255 = Math.round(b * 255);
  
  return `#${r255.toString(16).padStart(2, '0')}${g255.toString(16).padStart(2, '0')}${b255.toString(16).padStart(2, '0')}`;
}

async function getRoomStatus(roomName = 'Salon', debugLog = null) {
  if (hueCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    if (debugLog) debugLog('📦 Cache utilisé');
    return hueCache;
  }

  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured');
    }

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

    const groupedLightUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/grouped_light/${groupedLightService.rid}`;
    const groupedLightResponse = await makeRequest(groupedLightUrl);
    const groupedLight = groupedLightResponse.data?.[0];

    if (!groupedLight) {
      throw new Error(`Grouped light ${groupedLightService.rid} not found`);
    }

    let allResourcesData = null;
    try {
      const allResourcesUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource`;
      allResourcesData = await makeRequest(allResourcesUrl);
    } catch (error) {
      // Ignore
    }

    const devicesUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/device`;
    const devicesData = await makeRequest(devicesUrl);
    
    const lightsUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/light`;
    const lightsData = await makeRequest(lightsUrl);
    
    let roomLights = [];
    const roomDeviceIds = new Set();
    
    if (room.services && Array.isArray(room.services)) {
      room.services.forEach(service => {
        if (service.rtype === 'device') {
          roomDeviceIds.add(service.rid);
        }
      });
    }
    
    if (roomDeviceIds.size === 0 && devicesData.data) {
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
    
    if (roomDeviceIds.size > 0 && lightsData.data) {
      roomLights = lightsData.data.filter(light => {
        return roomDeviceIds.has(light.owner?.rid);
      });
    }
    
    if (roomLights.length === 0 && lightsData.data) {
      roomLights = lightsData.data.filter(light => {
        return light.service_id === groupedLight.id;
      });
    }
    
    if (roomLights.length === 0 && lightsData.data) {
      roomLights = lightsData.data.filter(light => {
        if (light.services && Array.isArray(light.services)) {
          const hasRoomService = light.services.some(s => s.rtype === 'room' && s.rid === room.id);
          const hasGroupedLightService = light.services.some(s => s.rtype === 'grouped_light' && s.rid === groupedLight.id);
          return hasRoomService || hasGroupedLightService;
        }
        return false;
      });
    }
    
    if (roomLights.length === 0 && allResourcesData && allResourcesData.data) {
      const allLights = allResourcesData.data.filter(r => r.type === 'light');
      roomLights = allLights.filter(light => {
        if (light.service_id === groupedLight.id) return true;
        if (light.services && Array.isArray(light.services)) {
          const hasRoomService = light.services.some(s => s.rtype === 'room' && s.rid === room.id);
          const hasGroupedLightService = light.services.some(s => s.rtype === 'grouped_light' && s.rid === groupedLight.id);
          return hasRoomService || hasGroupedLightService;
        }
        return false;
      });
    }
    
    if (roomLights.length === 0) {
      try {
        const groupedLightIdV1 = groupedLight.id_v1;
        if (groupedLightIdV1) {
          const groupIdMatch = groupedLightIdV1.match(/\/groups\/(\d+)/);
          if (groupIdMatch) {
            const groupId = groupIdMatch[1];
            const v1GroupUrl = `https://${HUE_BRIDGE_IP}/api/${HUE_APP_KEY}/groups/${groupId}`;
            const v1GroupResponse = await makeRequest(v1GroupUrl);
            
            if (v1GroupResponse && v1GroupResponse.lights && Array.isArray(v1GroupResponse.lights)) {
              const v1LightIds = v1GroupResponse.lights;
              
              if (lightsData.data) {
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
        }
      } catch (error) {
        // Ignore
      }
    }

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

    const hasValidColor = (light) => {
      if (!light.on?.on || !light.color || !light.color.xy) return false;
      if (typeof light.color.xy === 'object' && light.color.xy.x !== undefined && light.color.xy.y !== undefined) {
        return true;
      }
      if (Array.isArray(light.color.xy) && light.color.xy.length >= 2) {
        return true;
      }
      return false;
    };
    
    const lightsWithColor = roomLights.filter(hasValidColor);
    
    const getXY = (xy) => {
      if (typeof xy === 'object' && xy.x !== undefined && xy.y !== undefined) {
        return { x: xy.x, y: xy.y };
      }
      if (Array.isArray(xy) && xy.length >= 2) {
        return { x: xy[0], y: xy[1] };
      }
      return null;
    };
    
    let avgColor = null;
    
    if (groupedLight.color && groupedLight.color.xy) {
      const groupedXY = getXY(groupedLight.color.xy);
      if (groupedXY) {
        avgColor = xyToRgb(groupedXY.x, groupedXY.y);
      }
    }
    
    if (!avgColor && lightsWithColor.length > 0) {
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
        weightedXY.x /= totalWeight;
        weightedXY.y /= totalWeight;
        avgColor = xyToRgb(weightedXY.x, weightedXY.y);
      }
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
          if (groupedLight.color && groupedLight.color.xy) {
            const xy = getXY(groupedLight.color.xy);
            if (xy) return xy;
          }
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

    hueCache = result;
    cacheTimestamp = Date.now();

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

    const groupedLightUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/grouped_light/${groupedLightService.rid}`;
    const groupedLightResponse = await makeRequest(groupedLightUrl);
    const groupedLight = groupedLightResponse.data?.[0];

    if (!groupedLight) {
      throw new Error(`Grouped light ${groupedLightService.rid} not found`);
    }

    const currentState = groupedLight.on?.on || false;
    const targetState = turnOn !== null ? turnOn : !currentState;

    const updateUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/grouped_light/${groupedLightService.rid}`;
    await makeRequest(updateUrl, {
      method: 'PUT',
      body: {
        on: {
          on: targetState
        }
      }
    });

    hueCache = null;
    cacheTimestamp = null;

    return { success: true, turnedOn: targetState };
  } catch (error) {
    console.error('[Hue] ❌ Erreur lors du toggle des lumières:', error.message);
    throw error;
  }
}

async function toggleLight(lightId, turnOn = null) {
  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured');
    }

    if (!lightId) {
      throw new Error('Light ID is required');
    }

    let targetState = turnOn;

    if (targetState === null) {
      const lightUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/light/${lightId}`;
      const lightResponse = await makeRequest(lightUrl);
      const light = lightResponse.data?.[0];

      if (!light) {
        throw new Error(`Light ${lightId} not found`);
      }

      targetState = !light.on?.on;
    }

    const updateUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/light/${lightId}`;
    await makeRequest(updateUrl, {
      method: 'PUT',
      body: {
        on: {
          on: !!targetState
        }
      }
    });

    hueCache = null;
    cacheTimestamp = null;

    return { success: true, lightId, on: !!targetState };
  } catch (error) {
    console.error('[Hue] ❌ Erreur lors du toggle d\'une lumière:', error.message);
    throw error;
  }
}

async function setRoomBrightness(roomName = 'Salon', brightness) {
  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured');
    }

    const brightnessValue = Math.max(0, Math.min(100, Math.round(brightness)));

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

    hueCache = null;
    cacheTimestamp = null;

    return { success: true, color: { x: xy.x, y: xy.y } };
  } catch (error) {
    console.error('[Hue] ❌ Erreur lors du changement de couleur:', error.message);
    throw error;
  }
}

async function getRoomScenes(roomName = 'Salon') {
  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured');
    }

    const roomsUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/room`;
    const roomsData = await makeRequest(roomsUrl);
    
    const room = roomsData.data?.find(r => 
      r.metadata?.name?.toLowerCase() === roomName.toLowerCase()
    );

    if (!room) {
      throw new Error(`Room "${roomName}" not found`);
    }

    const scenesUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/scene`;
    const scenesData = await makeRequest(scenesUrl);

    if (!scenesData.data || scenesData.data.length === 0) {
      return { scenes: [] };
    }

    const roomScenes = scenesData.data.filter(scene => {
      if (scene.group && scene.group.rid === room.id) {
        return true;
      }
      return false;
    });

    const scenes = roomScenes.map(scene => {
      let displayColors = [];
      let displayBrightness = 100;
      let primaryColor = null;

      if (scene.palette) {
        if (scene.palette.color && scene.palette.color.length > 0) {
          displayColors = scene.palette.color
            .filter(colorItem => colorItem.color && colorItem.color.xy)
            .map(colorItem => {
              const xy = colorItem.color.xy;
              return typeof xy === 'object' && xy.x !== undefined 
                ? { x: xy.x, y: xy.y }
                : Array.isArray(xy) 
                  ? { x: xy[0], y: xy[1] }
                  : null;
            })
            .filter(xy => xy !== null);
          
          if (displayColors.length > 0) {
            primaryColor = displayColors[0];
            const firstColorItem = scene.palette.color[0];
            if (firstColorItem.dimming && firstColorItem.dimming.brightness !== undefined) {
              displayBrightness = firstColorItem.dimming.brightness;
            }
          }
        }
        
        if (displayColors.length === 0 && scene.palette.color_temperature && scene.palette.color_temperature.length > 0) {
          const firstCT = scene.palette.color_temperature[0];
          if (firstCT.color_temperature && firstCT.color_temperature.mirek !== undefined) {
            const mirek = firstCT.color_temperature.mirek;
            primaryColor = mirekToXy(mirek);
            displayColors = [primaryColor];
            if (firstCT.dimming && firstCT.dimming.brightness !== undefined) {
              displayBrightness = firstCT.dimming.brightness;
            }
          }
        }
      }

      if (!primaryColor && scene.actions && scene.actions.length > 0) {
        const firstAction = scene.actions[0];
        if (firstAction.action) {
          if (firstAction.action.color && firstAction.action.color.xy) {
            const xy = firstAction.action.color.xy;
            primaryColor = typeof xy === 'object' && xy.x !== undefined
              ? { x: xy.x, y: xy.y }
              : Array.isArray(xy)
                ? { x: xy[0], y: xy[1] }
                : null;
            if (primaryColor) {
              displayColors = [primaryColor];
            }
          }
          else if (firstAction.action.color_temperature && firstAction.action.color_temperature.mirek !== undefined) {
            const mirek = firstAction.action.color_temperature.mirek;
            primaryColor = mirekToXy(mirek);
            displayColors = [primaryColor];
          }
          
          if (firstAction.action.dimming && firstAction.action.dimming.brightness !== undefined) {
            displayBrightness = firstAction.action.dimming.brightness;
          }
        }
      }

      const imageRid = scene.metadata?.image?.rid || null;

      return {
        id: scene.id,
        name: scene.metadata?.name || scene.id,
        color: primaryColor,
        colors: displayColors,
        brightness: displayBrightness,
        active: scene.status?.active === 'active',
        imageRid: imageRid
      };
    });

    return { scenes };
  } catch (error) {
    console.error('[Hue] ❌ Erreur lors de la récupération des scénarios:', error.message);
    throw error;
  }
}

async function activateScene(sceneId) {
  try {
    if (!HUE_APP_KEY) {
      throw new Error('HUE_APP_KEY not configured');
    }

    if (!sceneId) {
      throw new Error('Scene ID is required');
    }

    const sceneUrl = `https://${HUE_BRIDGE_IP}/clip/v2/resource/scene/${sceneId}`;
    await makeRequest(sceneUrl, {
      method: 'PUT',
      body: {
        recall: {
          action: 'active'
        }
      }
    });

    hueCache = null;
    cacheTimestamp = null;

    return { success: true, sceneId };
  } catch (error) {
    console.error('[Hue] ❌ Erreur lors de l\'activation du scénario:', error.message);
    throw error;
  }
}

module.exports = {
  getRoomStatus,
  toggleRoomLights,
  toggleLight,
  setRoomBrightness,
  setRoomColor,
  getRoomScenes,
  activateScene,
};


