const https = require('https');
const config = require('./config');

// Naolib API configuration
// Documentation: https://doc.nantesmetropole.fr/naolib
const NAOLIB_API_BASE_URL = 'https://data.nantesmetropole.fr/api/explore/v2.1/catalog/datasets/244400404_tan-arrets/records';

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache
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
    const cacheAge = Math.round((Date.now() - cacheTimestamp) / 1000);
    console.log(`[Bus] ✅ Données récupérées depuis le cache serveur (âge: ${cacheAge}s)`);
    return busCache;
  }
  
  console.log(`[Bus] 🔄 Appel API réel - cache serveur expiré ou inexistant`);

  try {
    // TODO: Configure stop IDs and other parameters
    // For now, return empty data structure
    console.log(`[Bus] 📡 Appel API Naolib (à configurer)`);
    
    // Placeholder - will be implemented when API details are provided
    const result = {
      stops: [],
      lastUpdate: new Date().toISOString(),
    };

    // Update cache
    busCache = result;
    cacheTimestamp = Date.now();
    console.log(`[Bus] 💾 Données mises en cache serveur (durée: ${CACHE_DURATION / 1000 / 60} minutes)`);

    return result;
  } catch (error) {
    // Only log error if it's been more than ERROR_LOG_INTERVAL since last log
    const now = Date.now();
    if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
      console.error('Error fetching bus data:', error.message);
      lastErrorLogTime = now;
    }
    throw error;
  }
}

module.exports = {
  getBusData,
};

