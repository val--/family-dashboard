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
    const cacheAge = Math.round((Date.now() - cacheTimestamp) / 1000);
    console.log(`[Bus] ✅ Données récupérées depuis le cache serveur (âge: ${cacheAge}s)`);
    return busCache;
  }
  
  console.log(`[Bus] 🔄 Appel API réel - cache serveur expiré ou inexistant`);

  try {
    const stopId = config.bus.stopId;
    const stopName = config.bus.stopName;
    
    if (!stopId) {
      throw new Error('BUS_STOP_ID not configured');
    }

    const url = `${NAOLIB_API_BASE_URL}/tempsattente.json/${stopId}`;
    console.log(`[Bus] 📡 Appel API Naolib: ${url}`);
    
    const rawData = await makeRequest(url);
    
    // Traiter les données de l'API Naolib
    // L'API retourne un tableau avec les prochains passages
    const departures = Array.isArray(rawData) ? rawData : [];
    
    console.log(`[Bus] 📊 Réponse API: ${departures.length} départs bruts reçus`);
    if (departures.length > 0) {
      console.log(`[Bus] 📋 Premier départ brut:`, JSON.stringify(departures[0], null, 2));
    }
    
    // Formater les données pour le frontend
    const formattedDepartures = departures
      .filter(departure => {
        // Filtrer les départs : garder ceux qui ont un temps d'attente
        // L'API retourne "dernierDepart" comme string "false" ou "true", pas comme boolean
        const hasTime = departure.temps !== undefined && departure.temps !== '';
        
        // Garder tous les départs qui ont un temps d'attente
        return hasTime;
      })
      .map(departure => {
        // Structure: { sens, terminus, temps, tempsReel, ligne: { numLigne, typeLigne }, arret: { codeArret } }
        const line = departure.ligne?.numLigne || 'N/A';
        const direction = departure.terminus || 'N/A';
        // Formater le temps d'attente
        let time;
        if (departure.temps && departure.temps !== '') {
          // Gérer les messages spéciaux pour les départs proches
          if (departure.temps === 'A l\'approche' || departure.temps === 'A l\'arrivée' || 
              departure.temps.toLowerCase().includes('approche') || 
              departure.temps.toLowerCase().includes('arrivée')) {
            time = 'Départ proche';
          } else if (departure.temps.includes('mn')) {
            // Si le temps contient déjà "mn" (ex: "33mn"), ajouter "Dans " devant
            time = `Dans ${departure.temps}`;
          } else {
            // Autre format, ajouter "Dans " devant
            time = `Dans ${departure.temps}`;
          }
        } else {
          // Si temps est vide, utiliser "Horaire non disponible" ou l'horaire théorique si disponible
          time = departure.horaire || 'Horaire non disponible';
        }
        const isRealTime = departure.tempsReel === 'true' || departure.tempsReel === true;
        const platform = departure.arret?.codeArret || null; // LHOU1, LHOU2, etc.
        
        return {
          line: line,
          direction: direction,
          time: time, // Ex: "Dans 33mn", "A l'approche", "Horaire non disponible", etc.
          isRealTime: isRealTime,
          platform: platform,
        };
      })
      .sort((a, b) => {
        // Trier par temps d'attente (si disponible)
        // Les temps peuvent être "Départ proche", "Dans 33mn", etc.
        if (a.time === 'Départ proche') return -1;
        if (b.time === 'Départ proche') return 1;
        
        // Extraire le nombre de minutes du format "Dans Xmn" ou "Xmn"
        const extractMinutes = (timeStr) => {
          const match = timeStr.match(/(\d+)\s*mn/);
          return match ? parseInt(match[1]) : 999;
        };
        
        const timeA = extractMinutes(a.time);
        const timeB = extractMinutes(b.time);
        return timeA - timeB;
      });

    console.log(`[Bus] ✅ ${formattedDepartures.length} départs formatés après filtrage`);
    if (formattedDepartures.length > 0) {
      console.log(`[Bus] 📋 Premier départ formaté:`, JSON.stringify(formattedDepartures[0], null, 2));
    } else {
      console.log(`[Bus] ⚠️  Aucun départ après filtrage - tous les départs bruts:`, JSON.stringify(departures, null, 2));
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
    console.log(`[Bus] 💾 Données mises en cache serveur (${formattedDepartures.length} départs, durée: ${CACHE_DURATION / 1000 / 60} minutes)`);

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

