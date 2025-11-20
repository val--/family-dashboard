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
  },
  news: {
    apiKey: process.env.NEWS_API_KEY || '',
    country: process.env.NEWS_COUNTRY || 'fr', // 2-letter ISO 3166-1 code (fr = France)
    category: process.env.NEWS_CATEGORY || '', // Optional: business, entertainment, general, health, science, sports, technology
    language: process.env.NEWS_LANGUAGE || 'fr', // Language code (fr = French) - only used with /everything endpoint
    useEverything: process.env.NEWS_USE_EVERYTHING !== 'false', // Use /everything endpoint by default (true) to ensure French language filtering
    pageSize: parseInt(process.env.NEWS_PAGE_SIZE || '20', 10)
  },
  bus: {
    stops: process.env.BUS_STOPS ? JSON.parse(process.env.BUS_STOPS) : [
      { stopId: 'LHOU', stopName: 'La Houssais' },
      { stopId: 'TMOU', stopName: 'Trois Moulins' }
    ],
    // Support legacy single stop config
    stopId: process.env.BUS_STOP_ID || 'LHOU',
    stopName: process.env.BUS_STOP_NAME || 'La Houssais'
  },
  hue: {
    bridgeIp: process.env.HUE_BRIDGE_IP || '192.168.1.222',
    appKey: process.env.HUE_APP_KEY || '',
    roomName: process.env.HUE_ROOM_NAME || 'Salon' // Nom de la pièce à contrôler (ex: Salon, Bureau)
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5000/api/spotify/callback'
  }
};
