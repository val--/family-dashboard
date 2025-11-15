module.exports = {
  calendarId: process.env.CALENDAR_ID || 'YOUR_CALENDAR_ID@group.calendar.google.com',
  timezone: process.env.TIMEZONE || 'Europe/Paris',
  maxEvents: process.env.MAX_EVENTS ? parseInt(process.env.MAX_EVENTS, 10) : null, // null = afficher tous les événements à venir (pas de limite)
  credentialsPath: process.env.CREDENTIALS_PATH || './credentials/service-account.json',
  // MyElectricalData configuration
  myElectricalData: {
    baseUrl: process.env.MYELECTRICALDATA_BASE_URL || 'https://www.myelectricaldata.fr',
    pointDeLivraison: process.env.MYELECTRICALDATA_PDL || 'YOUR_POINT_DE_LIVRAISON',
    token: process.env.MYELECTRICALDATA_TOKEN || 'YOUR_MYELECTRICALDATA_TOKEN',
    useCache: process.env.MYELECTRICALDATA_USE_CACHE !== 'false' // Use /cache/ endpoints to reduce API load
  },
  weather: {
    apiKey: process.env.WEATHER_API_KEY || '',
    city: process.env.WEATHER_CITY || 'Rezé',
    units: process.env.WEATHER_UNITS || 'metric',
    lang: process.env.WEATHER_LANG || 'fr'
  }
};
