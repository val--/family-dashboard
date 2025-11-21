// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const calendarService = require('./calendar');
const electricityService = require('./electricity');
const nantesEventsService = require('./nantes-events');
const pullrougeService = require('./pullrouge');
const weatherService = require('./weather');
const newsService = require('./news');
const busService = require('./bus');
const hueService = require('./hue');
const spotifyService = require('./spotify');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? false // In production, static files are served by Express, no CORS needed
    : true, // Allow requests from any origin in development (for network access)
  credentials: true
}));
app.use(express.json());

// API Routes
app.get('/api/events', async (req, res) => {
  try {
    const events = await calendarService.getEvents();
    res.json({ events, success: true });
  } catch (error) {
    console.error('Error in /api/events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch calendar events', 
      message: error.message,
      success: false 
    });
  }
});

// Nantes events API route
app.get('/api/nantes-events', async (req, res) => {
  try {
    // Parse selected categories from query parameter
    const selectedCategories = req.query.categories 
      ? JSON.parse(decodeURIComponent(req.query.categories))
      : null;
    
    const events = await nantesEventsService.getEvents(selectedCategories);
    res.json({ events, success: true });
  } catch (error) {
    console.error('Error in /api/nantes-events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Nantes events', 
      message: error.message,
      success: false 
    });
  }
});

// Nantes events categories API route
app.get('/api/nantes-events/categories', async (req, res) => {
  try {
    const categories = await nantesEventsService.getAvailableCategories();
    res.json({ categories, success: true });
  } catch (error) {
    console.error('Error in /api/nantes-events/categories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Nantes event categories', 
      message: error.message,
      success: false 
    });
  }
});

// PullRouge events API route
app.get('/api/pullrouge-events', async (req, res) => {
  try {
    // Option to clear cache via query parameter
    if (req.query.clearCache === 'true') {
      pullrougeService.clearCache();
    }
    const events = await pullrougeService.getEvents();
    res.json({ events, success: true });
  } catch (error) {
    console.error('Error in /api/pullrouge-events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch PullRouge events', 
      message: error.message,
      success: false 
    });
  }
});

// Electricity API route
app.get('/api/electricity', async (req, res) => {
  try {
    // Option to clear cache via query parameter
    if (req.query.clearCache === 'true') {
      electricityService.clearCache();
    }
    const dailyChartDays = req.query.dailyChartDays ? parseInt(req.query.dailyChartDays, 10) : 7;
    const data = await electricityService.getWidgetData(dailyChartDays);
    res.json({ data, success: true });
  } catch (error) {
    console.error('Error in /api/electricity:', error);
    res.status(500).json({ 
      error: 'Failed to fetch electricity data', 
      message: error.message,
      success: false 
    });
  }
});

// Weather API route
app.get('/api/weather', async (req, res) => {
  try {
    const data = await weatherService.getWeatherData();
    res.json({ data, success: true });
  } catch (error) {
    console.error('Error in /api/weather:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weather data', 
      message: error.message,
      success: false 
    });
  }
});

// News API route
app.get('/api/news', async (req, res) => {
  try {
    const newsType = req.query.type || 'news'; // 'news', 'tech', 'crime', 'entertainment', 'lifestyle', 'world', 'domestic', 'education', 'environment', 'health', 'politics', 'tourism'
    const data = await newsService.getNewsData(newsType);
    res.json({ data, success: true });
  } catch (error) {
    console.error('Error in /api/news:', error);
    res.status(500).json({ 
      error: 'Failed to fetch news data', 
      message: error.message,
      success: false 
    });
  }
});

// Bus API route
app.get('/api/bus', async (req, res) => {
  try {
    const data = await busService.getBusData();
    res.json({ data, success: true });
  } catch (error) {
    console.error('Error in /api/bus:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bus data', 
      message: error.message,
      success: false 
    });
  }
});

// Hue API routes
app.get('/api/hue/room', async (req, res) => {
  try {
    const config = require('./config');
    const roomName = req.query.room || config.hue.roomName;
    const data = await hueService.getRoomStatus(roomName);
    res.json({ data, success: true, roomName: config.hue.roomName });
  } catch (error) {
    console.error('Error in /api/hue/room:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Hue room data', 
      message: error.message,
      success: false 
    });
  }
});

app.get('/api/hue/config', (req, res) => {
  try {
    const config = require('./config');
    res.json({ 
      roomName: config.hue.roomName,
      success: true 
    });
  } catch (error) {
    console.error('Error in /api/hue/config:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Hue config', 
      message: error.message,
      success: false 
    });
  }
});

app.post('/api/hue/room/toggle', async (req, res) => {
  try {
    const config = require('./config');
    const roomName = req.body.room || config.hue.roomName;
    const turnOn = req.body.turnOn !== undefined ? req.body.turnOn : null; // null = toggle
    const result = await hueService.toggleRoomLights(roomName, turnOn);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error in /api/hue/room/toggle:', error);
    res.status(500).json({ 
      error: 'Failed to toggle Hue room lights', 
      message: error.message,
      success: false 
    });
  }
});

app.post('/api/hue/light/toggle', async (req, res) => {
  try {
    const { lightId, turnOn } = req.body || {};

    if (!lightId) {
      return res.status(400).json({
        error: 'Light ID is required',
        success: false
      });
    }

    const result = await hueService.toggleLight(lightId, typeof turnOn === 'boolean' ? turnOn : null);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error in /api/hue/light/toggle:', error);
    res.status(500).json({
      error: 'Failed to toggle Hue light',
      message: error.message,
      success: false
    });
  }
});

app.post('/api/hue/light/brightness', async (req, res) => {
  try {
    const { lightId, brightness } = req.body || {};

    if (!lightId) {
      return res.status(400).json({
        error: 'Light ID is required',
        success: false
      });
    }

    if (brightness === undefined || brightness === null) {
      return res.status(400).json({
        error: 'Brightness value is required',
        success: false
      });
    }

    const result = await hueService.setLightBrightness(lightId, brightness);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error in /api/hue/light/brightness:', error);
    res.status(500).json({
      error: 'Failed to set Hue light brightness',
      message: error.message,
      success: false
    });
  }
});

app.post('/api/hue/room/brightness', async (req, res) => {
  try {
    const config = require('./config');
    const roomName = req.body.room || config.hue.roomName;
    const brightness = req.body.brightness;
    
    if (brightness === undefined || brightness === null) {
      return res.status(400).json({ 
        error: 'Brightness value is required', 
        success: false 
      });
    }
    
    const result = await hueService.setRoomBrightness(roomName, brightness);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error in /api/hue/room/brightness:', error);
    res.status(500).json({ 
      error: 'Failed to set Hue room brightness', 
      message: error.message,
      success: false 
    });
  }
});

app.post('/api/hue/room/color', async (req, res) => {
  try {
    const config = require('./config');
    const roomName = req.body.room || config.hue.roomName;
    const xy = req.body.xy;
    
    if (!xy || typeof xy.x === 'undefined' || typeof xy.y === 'undefined') {
      return res.status(400).json({ 
        error: 'XY coordinates are required', 
        success: false 
      });
    }
    
    const result = await hueService.setRoomColor(roomName, xy);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error in /api/hue/room/color:', error);
    res.status(500).json({ 
      error: 'Failed to set Hue room color', 
      message: error.message,
      success: false 
    });
  }
});

app.get('/api/hue/room/scenes', async (req, res) => {
  try {
    const config = require('./config');
    const roomName = req.query.room || config.hue.roomName;
    const result = await hueService.getRoomScenes(roomName);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error in /api/hue/room/scenes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Hue room scenes', 
      message: error.message,
      success: false 
    });
  }
});

app.post('/api/hue/scene/activate', async (req, res) => {
  try {
    const sceneId = req.body.sceneId;
    
    if (!sceneId) {
      return res.status(400).json({ 
        error: 'Scene ID is required', 
        success: false 
      });
    }
    
    const result = await hueService.activateScene(sceneId);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error in /api/hue/scene/activate:', error);
    res.status(500).json({ 
      error: 'Failed to activate Hue scene', 
      message: error.message,
      success: false 
    });
  }
});


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Spotify API routes
app.get('/api/spotify/auth', (req, res) => {
  try {
    const authUrl = spotifyService.getAuthorizationUrl();
    res.json({ authUrl, success: true });
  } catch (error) {
    console.error('Error generating Spotify auth URL:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

app.get('/api/spotify/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Erreur d'authentification Spotify</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              padding: 20px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Erreur d'authentification Spotify</h1>
            <p>${error}</p>
            <p>Vous pouvez fermer cette fenêtre.</p>
          </div>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Erreur</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              padding: 20px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Erreur</h1>
            <p>Aucun code d'autorisation reçu.</p>
            <p>Vous pouvez fermer cette fenêtre.</p>
          </div>
        </body>
      </html>
    `);
  }

  try {
    const result = await spotifyService.exchangeCodeForToken(code);
    
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Authentification réussie</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #1db954;
              color: white;
            }
            .container {
              text-align: center;
              padding: 20px;
            }
            h1 {
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Authentification Spotify réussie !</h1>
            <p>Connecté en tant que : ${result.userInfo.displayName}</p>
            <p>Vous pouvez maintenant fermer cette fenêtre.</p>
            <script>
              // Notifier la fenêtre parente si elle existe
              if (window.opener) {
                window.opener.postMessage('spotify-auth-success', '*');
              }
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging Spotify code:', error);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Erreur d'authentification</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              padding: 20px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Erreur d'authentification</h1>
            <p>${error.message}</p>
            <p>Vous pouvez fermer cette fenêtre.</p>
          </div>
        </body>
      </html>
    `);
  }
});

app.get('/api/spotify/status', async (req, res) => {
  try {
    if (!spotifyService.isAuthenticated()) {
      return res.json({ authenticated: false, success: true });
    }

    const playback = await spotifyService.getCurrentlyPlaying();
    const currentUser = spotifyService.getCurrentUser();
    
    // Récupérer l'état du player (shuffle, repeat)
    let playerState = { shuffleState: false, repeatState: 'off' };
    try {
      playerState = await spotifyService.getPlayerState();
    } catch (error) {
      // Si l'erreur n'est pas critique, continuer sans l'état du player
      console.error('Error fetching player state:', error);
    }
    
    // Si aucun morceau n'est en cours, récupérer le dernier morceau joué
    let lastPlayedTrack = null;
    if (!playback.track) {
      try {
        lastPlayedTrack = await spotifyService.getRecentlyPlayed(1);
      } catch (error) {
        // Si l'erreur n'est pas critique, continuer sans le dernier morceau
        console.error('Error fetching recently played:', error);
      }
    }
    
    res.json({ 
      ...playback, 
      lastPlayedTrack,
      shuffleState: playerState.shuffleState,
      repeatState: playerState.repeatState,
      authenticated: true, 
      currentUser, 
      success: true 
    });
  } catch (error) {
    console.error('Error fetching Spotify status:', error);
    // Améliorer les messages d'erreur pour les erreurs réseau
    if (error.message.includes('Network error') || error.message.includes('timeout')) {
      res.status(503).json({ error: error.message, success: false });
    } else {
      res.status(500).json({ error: error.message, success: false });
    }
  }
});

app.post('/api/spotify/play', async (req, res) => {
  try {
    const result = await spotifyService.resumePlayback();
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error resuming Spotify playback:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

app.post('/api/spotify/pause', async (req, res) => {
  try {
    const result = await spotifyService.pausePlayback();
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error pausing Spotify playback:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

app.post('/api/spotify/next', async (req, res) => {
  try {
    const result = await spotifyService.skipToNext();
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error skipping to next track:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

app.post('/api/spotify/previous', async (req, res) => {
  try {
    const result = await spotifyService.skipToPrevious();
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error skipping to previous track:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

app.get('/api/spotify/devices', async (req, res) => {
  try {
    if (!spotifyService.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated', success: false });
    }

    const result = await spotifyService.getDevices();
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error fetching Spotify devices:', error);
    // Améliorer les messages d'erreur pour les erreurs réseau
    if (error.message.includes('Network error') || error.message.includes('timeout')) {
      res.status(503).json({ error: error.message, success: false });
    } else {
      res.status(500).json({ error: error.message, success: false });
    }
  }
});

app.put('/api/spotify/transfer', async (req, res) => {
  try {
    if (!spotifyService.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated', success: false });
    }

    const { deviceId, play } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required', success: false });
    }

    const result = await spotifyService.transferPlayback(deviceId, play || false);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error transferring Spotify playback:', error);
    // Améliorer les messages d'erreur pour les erreurs réseau
    if (error.message.includes('Network error') || error.message.includes('timeout')) {
      res.status(503).json({ error: 'Network error: Unable to connect to Spotify. Please check your internet connection.', success: false });
    } else {
      res.status(500).json({ error: error.message, success: false });
    }
  }
});

// Routes playlists (seulement les playlists utilisateur)
app.get('/api/spotify/playlists', async (req, res) => {
  try {
    if (!spotifyService.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated', success: false });
    }

    // Seulement les playlists utilisateur (pas les playlists Spotify)
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await spotifyService.getUserPlaylists(limit, offset);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

app.get('/api/spotify/playlists/:playlistId/tracks', async (req, res) => {
  try {
    if (!spotifyService.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated', success: false });
    }

    const { playlistId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const result = await spotifyService.getPlaylistTracks(playlistId, limit, offset);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

app.post('/api/spotify/play/playlist', async (req, res) => {
  try {
    const { playlistUri, deviceId } = req.body;

    if (!playlistUri) {
      return res.status(400).json({ error: 'Playlist URI is required', success: false });
    }

    const result = await spotifyService.playPlaylist(playlistUri, deviceId);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error playing playlist:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

app.post('/api/spotify/play/track', async (req, res) => {
  try {
    const { trackUri, deviceId } = req.body;

    if (!trackUri) {
      return res.status(400).json({ error: 'Track URI is required', success: false });
    }

    const result = await spotifyService.playTrack(trackUri, deviceId);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error playing track:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

app.post('/api/spotify/shuffle', async (req, res) => {
  try {
    if (!spotifyService.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated', success: false });
    }

    const { state, deviceId } = req.body;

    if (state === undefined || state === null) {
      return res.status(400).json({ error: 'Shuffle state is required', success: false });
    }

    const result = await spotifyService.setShuffle(state === true || state === 'true', deviceId);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error setting shuffle:', error);
    if (error.message.includes('Network error')) {
      res.status(503).json({ error: 'Network error: Unable to connect to Spotify. Please check your internet connection.', success: false });
    } else {
      res.status(500).json({ error: error.message, success: false });
    }
  }
});

app.post('/api/spotify/volume', async (req, res) => {
  try {
    const { volumePercent, deviceId } = req.body;

    if (volumePercent === undefined || volumePercent === null) {
      return res.status(400).json({ error: 'Volume percent is required', success: false });
    }

    const volume = Math.max(0, Math.min(100, parseInt(volumePercent)));
    const result = await spotifyService.setVolume(volume, deviceId);
    res.json({ ...result, success: true });
  } catch (error) {
    console.error('Error setting volume:', error);
    if (error.message.includes('Network error')) {
      res.status(503).json({ error: error.message, success: false });
    } else {
      res.status(500).json({ error: error.message, success: false });
    }
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Initialize PullRouge events refresh on startup and set up periodic refresh
(async () => {
  try {
    console.log('[PullRouge] Initial refresh on startup...');
    await pullrougeService.refreshEvents();
  } catch (error) {
    console.error('[PullRouge] Error during initial refresh:', error);
  }
})();

// Set up periodic refresh every hour (3600000 ms)
setInterval(async () => {
  try {
    console.log('[PullRouge] Periodic refresh...');
    await pullrougeService.refreshEvents();
  } catch (error) {
    console.error('[PullRouge] Error during periodic refresh:', error);
  }
}, 60 * 60 * 1000); // 1 hour

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Accessible on network at: http://<your-ip>:${PORT}`);
});

