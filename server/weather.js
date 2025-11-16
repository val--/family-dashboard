const https = require('https');
const config = require('./config');

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || '';
const WEATHER_CITY = process.env.WEATHER_CITY || 'Rezé';
const WEATHER_UNITS = process.env.WEATHER_UNITS || 'metric';
const WEATHER_LANG = process.env.WEATHER_LANG || 'fr';

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
let weatherCache = null;
let cacheTimestamp = null;
let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 5 * 60 * 1000; // Log same error at most once every 5 minutes

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error('Failed to parse weather data'));
          }
        } else {
          let errorMessage = `Weather API returned status ${res.statusCode}`;
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
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function getWeatherData() {
  if (!WEATHER_API_KEY) {
    throw new Error('WEATHER_API_KEY is not configured');
  }

  // Check cache
  if (weatherCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    const cacheAge = Math.round((Date.now() - cacheTimestamp) / 1000);
    console.log(`[Météo] ✅ Données récupérées depuis le cache serveur (âge: ${cacheAge}s)`);
    return weatherCache;
  }
  
  console.log(`[Météo] 🔄 Appel API réel - cache serveur expiré ou inexistant`);

  try {
    console.log(`[Météo] 📡 Appel API: forecast (prévisions 5 jours)`);
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(WEATHER_CITY)}&appid=${WEATHER_API_KEY}&units=${WEATHER_UNITS}&lang=${WEATHER_LANG}`;
    
    const forecastData = await makeRequest(url);
    
    // Also get current weather
    console.log(`[Météo] 📡 Appel API: current (météo actuelle)`);
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(WEATHER_CITY)}&appid=${WEATHER_API_KEY}&units=${WEATHER_UNITS}&lang=${WEATHER_LANG}`;
    const currentData = await makeRequest(currentUrl);

    // Process forecast data - group by day and take first forecast of each day
    const dailyForecasts = {};
    forecastData.list.forEach((item) => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toISOString().split('T')[0];
      
      if (!dailyForecasts[dayKey]) {
        dailyForecasts[dayKey] = item;
      }
    });

    // Get next 7 days (including today) - semaine glissante
    const today = new Date();
    const forecasts = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayKey = date.toISOString().split('T')[0];
      
      if (i === 0 && currentData) {
        // Use current weather for today
        forecasts.push({
          date: dayKey,
          temp: Math.round(currentData.main.temp),
          tempMin: Math.round(currentData.main.temp_min),
          tempMax: Math.round(currentData.main.temp_max),
          description: currentData.weather[0].description,
          icon: currentData.weather[0].icon,
          humidity: currentData.main.humidity,
          windSpeed: currentData.wind?.speed || 0,
        });
      } else if (dailyForecasts[dayKey]) {
        const item = dailyForecasts[dayKey];
        forecasts.push({
          date: dayKey,
          temp: Math.round(item.main.temp),
          tempMin: Math.round(item.main.temp_min),
          tempMax: Math.round(item.main.temp_max),
          description: item.weather[0].description,
          icon: item.weather[0].icon,
          humidity: item.main.humidity,
          windSpeed: item.wind?.speed || 0,
        });
      }
    }

    const result = {
      city: forecastData.city.name,
      country: forecastData.city.country,
      current: forecasts[0] || null,
      forecast: forecasts.slice(1, 7), // Next 6 days (total 7 jours avec aujourd'hui)
      hourlyForecast: forecastData.list, // All hourly forecasts for detailed page
    };

    // Update cache
    weatherCache = result;
    cacheTimestamp = Date.now();
    console.log(`[Météo] 💾 Données mises en cache serveur (durée: ${CACHE_DURATION / 1000 / 60} minutes)`);

    return result;
  } catch (error) {
    // Only log error if it's been more than ERROR_LOG_INTERVAL since last log
    const now = Date.now();
    if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
      console.error('Error fetching weather data:', error.message);
      lastErrorLogTime = now;
    }
    throw error;
  }
}

module.exports = {
  getWeatherData,
};

