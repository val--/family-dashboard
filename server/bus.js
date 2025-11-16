const https = require('https');
const config = require('./config');

// Naolib API configuration
// Documentation: https://data.nantesmetropole.fr/explore/dataset/244400404_api-temps-reel-tan/information/
const NAOLIB_API_BASE_URL = 'https://open.tan.fr/ewp';

const CACHE_DURATION = 1 * 60 * 1000; // 1 minute cache (horaires de bus nécessitent des mises à jour fréquentes)
let busCache = null;
let cacheTimestamp = null;
let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 5 * 60 * 1000; // Log same error at most once every 5 minutes

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Family-Dashboard/1.0',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error('Failed to parse bus data'));
          }
        } else {
          let errorMessage = `Naolib API returned status ${res.statusCode}`;
          try {
            const errorData = JSON.parse(data);
            if (errorData.message) {
              errorMessage += `: ${errorData.message}`;
            }
          } catch (e) {
            // Ignore parse error, use default message
          }
          reject(new Error(errorMessage));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function getBusData() {
  // Check cache
  if (busCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return busCache;
  }

  try {
    const stopId = config.bus.stopId;
    const stopName = config.bus.stopName;
    
    if (!stopId) {
      throw new Error('BUS_STOP_ID not configured');
    }

    const url = `${NAOLIB_API_BASE_URL}/tempsattente.json/${stopId}`;
    const rawData = await makeRequest(url);
    const departures = Array.isArray(rawData) ? rawData : [];
    
    console.log(`[Bus] 📊 ${departures.length} départs bruts reçus de l'API`);
    
    // Formater les données pour le frontend
    const formattedDepartures = departures
      .filter(departure => {
        const hasTime = departure.temps !== undefined && departure.temps !== '';
        if (!hasTime) {
          console.log(`[Bus] ⚠️  Départ filtré (pas de temps):`, { line: departure.ligne?.numLigne, direction: departure.terminus, temps: departure.temps });
        }
        return hasTime;
      })
      .map(departure => {
        const line = departure.ligne?.numLigne || 'N/A';
        const direction = departure.terminus || 'N/A';
        
        // Formater le temps d'attente
        let time;
        if (departure.temps && departure.temps !== '') {
          if (departure.temps === 'A l\'approche' || departure.temps === 'A l\'arrivée' || 
              departure.temps.toLowerCase().includes('approche') || 
              departure.temps.toLowerCase().includes('arrivée')) {
            time = 'Départ proche';
          } else if (departure.temps.includes('mn')) {
            time = `Dans ${departure.temps}`;
          } else {
            time = `Dans ${departure.temps}`;
          }
        } else {
          time = departure.horaire || 'Horaire non disponible';
        }
        
        return {
          line,
          direction,
          time,
          isRealTime: departure.tempsReel === 'true' || departure.tempsReel === true,
          platform: departure.arret?.codeArret || null,
        };
      })
      .sort((a, b) => {
        if (a.time === 'Départ proche') return -1;
        if (b.time === 'Départ proche') return 1;
        
        const extractMinutes = (timeStr) => {
          const match = timeStr.match(/(\d+)\s*mn/);
          return match ? parseInt(match[1]) : 999;
        };
        
        return extractMinutes(a.time) - extractMinutes(b.time);
      });

    console.log(`[Bus] ✅ ${formattedDepartures.length} départs formatés après filtrage`);
    if (formattedDepartures.length === 0 && departures.length > 0) {
      console.log(`[Bus] ⚠️  Tous les départs ont été filtrés. Départs bruts:`, JSON.stringify(departures, null, 2));
    }

    const result = {
      stopId: stopId,
      stopName: stopName,
      departures: formattedDepartures,
      lastUpdate: new Date().toISOString(),
    };

    // Update cache
    busCache = result;
    cacheTimestamp = Date.now();

    return result;
  } catch (error) {
    // Only log error if it's been more than ERROR_LOG_INTERVAL since last log
    const now = Date.now();
    if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
      console.error('[Bus] ❌ Erreur lors de la récupération des données:', error.message);
      lastErrorLogTime = now;
    }
    throw error;
  }
}

module.exports = {
  getBusData,
};

