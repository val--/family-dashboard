const https = require('https');
const http = require('http');
const config = require('./config');

// Stockage des tokens d'accès Spotify
let spotifyAccessToken = null;
let spotifyRefreshToken = null;
let tokenExpiryTime = null;

/**
 * Fait une requête HTTP/HTTPS
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...options.headers
      }
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: jsonData, headers: res.headers });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: data, headers: res.headers });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Génère l'URL d'autorisation Spotify
 */
function getAuthorizationUrl() {
  const clientId = config.spotify?.clientId;
  if (!clientId) {
    throw new Error('Spotify Client ID not configured');
  }

  const redirectUri = config.spotify?.redirectUri || 'http://localhost:5000/api/spotify/callback';
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    show_dialog: 'false'
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Échange le code d'autorisation contre un token d'accès
 */
async function exchangeCodeForToken(code) {
  const clientId = config.spotify?.clientId;
  const clientSecret = config.spotify?.clientSecret;
  const redirectUri = config.spotify?.redirectUri || 'http://localhost:5000/api/spotify/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Spotify Client ID and Secret not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await makeRequest('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      }).toString()
    });

    spotifyAccessToken = response.data.access_token;
    spotifyRefreshToken = response.data.refresh_token;
    tokenExpiryTime = Date.now() + (response.data.expires_in * 1000);

    return {
      accessToken: spotifyAccessToken,
      refreshToken: spotifyRefreshToken,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    throw new Error(`Failed to exchange code for token: ${error.message}`);
  }
}

/**
 * Rafraîchit le token d'accès
 */
async function refreshAccessToken() {
  const clientId = config.spotify?.clientId;
  const clientSecret = config.spotify?.clientSecret;

  if (!clientId || !clientSecret || !spotifyRefreshToken) {
    throw new Error('Spotify tokens not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await makeRequest('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: spotifyRefreshToken
      }).toString()
    });

    spotifyAccessToken = response.data.access_token;
    if (response.data.refresh_token) {
      spotifyRefreshToken = response.data.refresh_token;
    }
    tokenExpiryTime = Date.now() + (response.data.expires_in * 1000);

    return spotifyAccessToken;
  } catch (error) {
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
}

/**
 * Obtient un token d'accès valide (rafraîchit si nécessaire)
 */
async function getValidAccessToken() {
  if (!spotifyAccessToken) {
    throw new Error('Not authenticated with Spotify. Please authorize first.');
  }

  // Rafraîchir le token s'il expire dans moins de 5 minutes
  if (tokenExpiryTime && Date.now() > (tokenExpiryTime - 5 * 60 * 1000)) {
    await refreshAccessToken();
  }

  return spotifyAccessToken;
}

/**
 * Fait une requête à l'API Spotify
 */
async function makeSpotifyRequest(endpoint, options = {}) {
  const token = await getValidAccessToken();

  const url = endpoint.startsWith('http') ? endpoint : `https://api.spotify.com/v1${endpoint}`;

  return makeRequest(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

/**
 * Récupère le morceau actuellement joué
 */
async function getCurrentlyPlaying() {
  try {
    const response = await makeSpotifyRequest('/me/player/currently-playing');
    
    if (response.statusCode === 204 || !response.data || !response.data.item) {
      return { isPlaying: false, track: null };
    }

    const track = response.data.item;
    // Utiliser la plus grande image disponible (première de la liste)
    let albumArt = null;
    if (track.album.images && track.album.images.length > 0) {
      // Les images sont triées par taille décroissante, prendre la première
      albumArt = track.album.images[0].url;
    }
    
    return {
      isPlaying: response.data.is_playing,
      track: {
        name: track.name,
        artists: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        albumArt: albumArt,
        duration: track.duration_ms,
        progress: response.data.progress_ms || 0,
        uri: track.uri
      }
    };
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('403')) {
      // Token expiré ou invalide
      spotifyAccessToken = null;
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Met en pause la lecture
 */
async function pausePlayback() {
  try {
    await makeSpotifyRequest('/me/player/pause', { method: 'PUT' });
    return { success: true };
  } catch (error) {
    if (error.message.includes('404')) {
      return { success: false, error: 'No active device found' };
    }
    throw error;
  }
}

/**
 * Reprend la lecture
 */
async function resumePlayback() {
  try {
    await makeSpotifyRequest('/me/player/play', { method: 'PUT' });
    return { success: true };
  } catch (error) {
    if (error.message.includes('404')) {
      return { success: false, error: 'No active device found' };
    }
    throw error;
  }
}

/**
 * Passe au morceau suivant
 */
async function skipToNext() {
  try {
    await makeSpotifyRequest('/me/player/next', { method: 'POST' });
    return { success: true };
  } catch (error) {
    if (error.message.includes('404')) {
      return { success: false, error: 'No active device found' };
    }
    throw error;
  }
}

/**
 * Passe au morceau précédent
 */
async function skipToPrevious() {
  try {
    await makeSpotifyRequest('/me/player/previous', { method: 'POST' });
    return { success: true };
  } catch (error) {
    if (error.message.includes('404')) {
      return { success: false, error: 'No active device found' };
    }
    throw error;
  }
}

/**
 * Vérifie si l'utilisateur est authentifié
 */
function isAuthenticated() {
  return !!spotifyAccessToken;
}

/**
 * Définit les tokens (utilisé après l'authentification OAuth)
 */
function setTokens(accessToken, refreshToken, expiresIn) {
  spotifyAccessToken = accessToken;
  spotifyRefreshToken = refreshToken;
  tokenExpiryTime = Date.now() + (expiresIn * 1000);
}

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForToken,
  getCurrentlyPlaying,
  pausePlayback,
  resumePlayback,
  skipToNext,
  skipToPrevious,
  isAuthenticated,
  setTokens
};

