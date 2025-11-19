const https = require('https');
const http = require('http');
const config = require('./config');

// Stockage des tokens d'accès Spotify - Multi-utilisateurs
// Structure: { userId: { accessToken, refreshToken, expiryTime, userInfo } }
const spotifyUsers = {};
let activeUserId = null; // ID de l'utilisateur actuellement actif

// Stockage des tokens temporaires pour l'authentification QR
// Structure: { token: { createdAt, expiresAt } }
const qrAuthTokens = {};
const QR_TOKEN_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * Fait une requête HTTP/HTTPS avec timeout
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    const timeout = options.timeout || 10000; // 10 secondes par défaut
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...options.headers
      },
      timeout: timeout
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
      // Améliorer les messages d'erreur pour les erreurs réseau
      if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
        reject(new Error(`Network error: Unable to connect to ${urlObj.hostname}. Please check your internet connection.`));
      } else {
        reject(error);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout: Connection to ${urlObj.hostname} timed out after ${timeout}ms`));
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
    'user-read-currently-playing',
    'user-read-playback-position'
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    show_dialog: 'true' // Afficher le dialogue pour permettre de changer de compte
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Échange le code d'autorisation contre un token d'accès
 * Retourne aussi les infos de l'utilisateur
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

    const accessToken = response.data.access_token;
    const refreshToken = response.data.refresh_token;
    const expiresIn = response.data.expires_in;

    // Récupérer les infos de l'utilisateur
    const userInfo = await getUserInfo(accessToken);

    // Stocker les tokens avec l'ID utilisateur
    const userId = userInfo.id;
    spotifyUsers[userId] = {
      accessToken,
      refreshToken,
      expiryTime: Date.now() + (expiresIn * 1000),
      userInfo: {
        id: userInfo.id,
        displayName: userInfo.display_name || userInfo.id,
        email: userInfo.email,
        images: userInfo.images
      }
    };

    // Définir comme utilisateur actif si c'est le premier
    if (!activeUserId) {
      activeUserId = userId;
    }

    return {
      userId,
      accessToken,
      refreshToken,
      expiresIn,
      userInfo: spotifyUsers[userId].userInfo
    };
  } catch (error) {
    throw new Error(`Failed to exchange code for token: ${error.message}`);
  }
}

/**
 * Récupère les informations de l'utilisateur Spotify
 */
async function getUserInfo(accessToken) {
  try {
    const response = await makeRequest('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get user info: ${error.message}`);
  }
}

/**
 * Rafraîchit le token d'accès pour un utilisateur spécifique
 */
async function refreshAccessToken(userId = null) {
  const targetUserId = userId || activeUserId;
  if (!targetUserId || !spotifyUsers[targetUserId]) {
    throw new Error('User not found or not authenticated');
  }

  const user = spotifyUsers[targetUserId];
  const clientId = config.spotify?.clientId;
  const clientSecret = config.spotify?.clientSecret;

  if (!clientId || !clientSecret || !user.refreshToken) {
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
        refresh_token: user.refreshToken
      }).toString()
    });

    user.accessToken = response.data.access_token;
    if (response.data.refresh_token) {
      user.refreshToken = response.data.refresh_token;
    }
    user.expiryTime = Date.now() + (response.data.expires_in * 1000);

    return user.accessToken;
  } catch (error) {
    // Si le refresh token est invalide, supprimer l'utilisateur
    delete spotifyUsers[targetUserId];
    if (activeUserId === targetUserId) {
      activeUserId = Object.keys(spotifyUsers)[0] || null;
    }
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
}

/**
 * Obtient un token d'accès valide pour un utilisateur (rafraîchit si nécessaire)
 */
async function getValidAccessToken(userId = null) {
  const targetUserId = userId || activeUserId;
  if (!targetUserId || !spotifyUsers[targetUserId]) {
    throw new Error('Not authenticated with Spotify. Please authorize first.');
  }

  const user = spotifyUsers[targetUserId];

  // Rafraîchir le token s'il expire dans moins de 5 minutes
  if (user.expiryTime && Date.now() > (user.expiryTime - 5 * 60 * 1000)) {
    await refreshAccessToken(targetUserId);
  }

  return user.accessToken;
}

/**
 * Fait une requête à l'API Spotify pour un utilisateur spécifique
 */
async function makeSpotifyRequest(endpoint, options = {}) {
  const userId = options.userId || null;
  const token = await getValidAccessToken(userId);

  const url = endpoint.startsWith('http') ? endpoint : `https://api.spotify.com/v1${endpoint}`;

  // Retirer userId des options pour ne pas l'envoyer dans la requête
  const { userId: _, ...requestOptions } = options;

  return makeRequest(url, {
    ...requestOptions,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...requestOptions.headers
    }
  });
}

/**
 * Récupère le morceau actuellement joué pour un utilisateur
 */
async function getCurrentlyPlaying(userId = null) {
  try {
    const response = await makeSpotifyRequest('/me/player/currently-playing', {
      userId,
      timeout: 10000 // 10 secondes
    });
    
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
    // Gestion spécifique des erreurs réseau
    if (error.message.includes('Network error') || error.message.includes('timeout') || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
      throw new Error('Network error: Unable to connect to Spotify. Please check your internet connection.');
    }
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
async function pausePlayback(userId = null) {
  try {
    await makeSpotifyRequest('/me/player/pause', { userId, method: 'PUT' });
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
async function resumePlayback(userId = null) {
  try {
    await makeSpotifyRequest('/me/player/play', { userId, method: 'PUT' });
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
async function skipToNext(userId = null) {
  try {
    await makeSpotifyRequest('/me/player/next', { userId, method: 'POST' });
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
async function skipToPrevious(userId = null) {
  try {
    await makeSpotifyRequest('/me/player/previous', { userId, method: 'POST' });
    return { success: true };
  } catch (error) {
    if (error.message.includes('404')) {
      return { success: false, error: 'No active device found' };
    }
    throw error;
  }
}

/**
 * Récupère la liste des appareils disponibles
 */
async function getDevices(userId = null) {
  try {
    const response = await makeSpotifyRequest('/me/player/devices', {
      userId,
      timeout: 10000 // 10 secondes
    });
    
    if (!response.data || !response.data.devices) {
      return { devices: [] };
    }

    return {
      devices: response.data.devices.map(device => ({
        id: device.id,
        name: device.name,
        type: device.type,
        isActive: device.is_active,
        isRestricted: device.is_restricted,
        volume: device.volume_percent
      }))
    };
  } catch (error) {
    // Gestion spécifique des erreurs réseau
    if (error.message.includes('Network error') || error.message.includes('timeout') || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
      throw new Error('Network error: Unable to connect to Spotify. Please check your internet connection.');
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      const targetUserId = userId || activeUserId;
      if (targetUserId && spotifyUsers[targetUserId]) {
        delete spotifyUsers[targetUserId];
        if (activeUserId === targetUserId) {
          activeUserId = Object.keys(spotifyUsers)[0] || null;
        }
      }
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Transfère la lecture vers un appareil spécifique
 */
async function transferPlayback(deviceId, play = false, userId = null) {
  try {
    await makeSpotifyRequest('/me/player', {
      userId,
      method: 'PUT',
      body: JSON.stringify({
        device_ids: [deviceId],
        play: play
      }),
      timeout: 15000 // 15 secondes pour le transfert d'appareil
    });
    return { success: true };
  } catch (error) {
    // Gestion spécifique des erreurs réseau
    if (error.message.includes('Network error') || error.message.includes('timeout') || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
      throw new Error('Network error: Unable to connect to Spotify. Please check your internet connection.');
    }
    if (error.message.includes('404')) {
      return { success: false, error: 'Device not found or not available' };
    }
    throw error;
  }
}

/**
 * Récupère les playlists de l'utilisateur
 */
async function getUserPlaylists(limit = 50, offset = 0, userId = null) {
  try {
    const response = await makeSpotifyRequest(`/me/playlists?limit=${limit}&offset=${offset}`, {
      userId,
      timeout: 10000
    });
    
    if (!response.data || !response.data.items) {
      return { playlists: [], total: 0 };
    }

    return {
      playlists: response.data.items.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        owner: playlist.owner.display_name,
        image: playlist.images && playlist.images.length > 0 ? playlist.images[0].url : null,
        tracksCount: playlist.tracks.total,
        uri: playlist.uri
      })),
      total: response.data.total,
      limit: response.data.limit,
      offset: response.data.offset
    };
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('403')) {
      const targetUserId = userId || activeUserId;
      if (targetUserId && spotifyUsers[targetUserId]) {
        delete spotifyUsers[targetUserId];
        if (activeUserId === targetUserId) {
          activeUserId = Object.keys(spotifyUsers)[0] || null;
        }
      }
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Récupère les playlists mises en avant par Spotify
 */
async function getFeaturedPlaylists(limit = 50, offset = 0) {
  try {
    const response = await makeSpotifyRequest(`/browse/featured-playlists?limit=${limit}&offset=${offset}`);
    
    if (!response.data || !response.data.playlists || !response.data.playlists.items) {
      return { playlists: [], total: 0 };
    }

    return {
      playlists: response.data.playlists.items.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        owner: playlist.owner.display_name,
        image: playlist.images && playlist.images.length > 0 ? playlist.images[0].url : null,
        tracksCount: playlist.tracks.total,
        uri: playlist.uri
      })),
      total: response.data.playlists.total,
      limit: response.data.playlists.limit,
      offset: response.data.playlists.offset
    };
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('403')) {
      spotifyAccessToken = null;
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Récupère les morceaux d'une playlist
 */
async function getPlaylistTracks(playlistId, limit = 100, offset = 0, userId = null) {
  try {
    const response = await makeSpotifyRequest(`/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`, {
      userId,
      timeout: 10000
    });
    
    if (!response.data || !response.data.items) {
      return { tracks: [], total: 0 };
    }

    return {
      tracks: response.data.items
        .filter(item => item.track && item.track.id) // Filtrer les tracks null
        .map(item => ({
          id: item.track.id,
          name: item.track.name,
          artists: item.track.artists.map(a => a.name).join(', '),
          album: item.track.album.name,
          albumArt: item.track.album.images && item.track.album.images.length > 0 
            ? item.track.album.images[0].url 
            : null,
          duration: item.track.duration_ms,
          uri: item.track.uri
        })),
      total: response.data.total,
      limit: response.data.limit,
      offset: response.data.offset
    };
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('403')) {
      const targetUserId = userId || activeUserId;
      if (targetUserId && spotifyUsers[targetUserId]) {
        delete spotifyUsers[targetUserId];
        if (activeUserId === targetUserId) {
          activeUserId = Object.keys(spotifyUsers)[0] || null;
        }
      }
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Lance une playlist ou un morceau spécifique
 */
async function playPlaylist(playlistUri, deviceId = null, userId = null) {
  try {
    const body = {
      context_uri: playlistUri
    };
    
    if (deviceId) {
      body.device_id = deviceId;
    }

    await makeSpotifyRequest('/me/player/play', {
      userId,
      method: 'PUT',
      body: JSON.stringify(body),
      timeout: 15000
    });
    return { success: true };
  } catch (error) {
    if (error.message.includes('404')) {
      return { success: false, error: 'No active device found' };
    }
    throw error;
  }
}

/**
 * Lance un morceau spécifique
 */
async function playTrack(trackUri, deviceId = null, userId = null) {
  try {
    const body = {
      uris: [trackUri]
    };
    
    if (deviceId) {
      body.device_id = deviceId;
    }

    await makeSpotifyRequest('/me/player/play', {
      userId,
      method: 'PUT',
      body: JSON.stringify(body),
      timeout: 15000
    });
    return { success: true };
  } catch (error) {
    if (error.message.includes('404')) {
      return { success: false, error: 'No active device found' };
    }
    throw error;
  }
}

/**
 * Vérifie si un utilisateur est authentifié
 */
function isAuthenticated(userId = null) {
  const targetUserId = userId || activeUserId;
  return !!(targetUserId && spotifyUsers[targetUserId]);
}

/**
 * Définit les tokens (utilisé après l'authentification OAuth)
 * @deprecated Utiliser exchangeCodeForToken qui gère automatiquement le stockage
 */
function setTokens(accessToken, refreshToken, expiresIn) {
  // Cette fonction est conservée pour compatibilité mais ne devrait plus être utilisée
  // Le stockage se fait maintenant via exchangeCodeForToken
  console.warn('setTokens is deprecated. Use exchangeCodeForToken instead.');
}

/**
 * Récupère la liste de tous les utilisateurs connectés
 */
function getUsers() {
  return Object.keys(spotifyUsers).map(userId => ({
    id: userId,
    displayName: spotifyUsers[userId].userInfo.displayName,
    email: spotifyUsers[userId].userInfo.email,
    images: spotifyUsers[userId].userInfo.images,
    isActive: userId === activeUserId
  }));
}

/**
 * Définit l'utilisateur actif
 */
function setActiveUser(userId) {
  if (!spotifyUsers[userId]) {
    throw new Error('User not found');
  }
  activeUserId = userId;
  return { success: true, activeUserId };
}

/**
 * Supprime un utilisateur
 */
function removeUser(userId) {
  if (!spotifyUsers[userId]) {
    throw new Error('User not found');
  }
  delete spotifyUsers[userId];
  // Si c'était l'utilisateur actif, passer au suivant ou null
  if (activeUserId === userId) {
    activeUserId = Object.keys(spotifyUsers)[0] || null;
  }
  return { success: true, activeUserId };
}

/**
 * Récupère l'utilisateur actif
 */
function getActiveUser() {
  if (!activeUserId || !spotifyUsers[activeUserId]) {
    return null;
  }
  return {
    id: activeUserId,
    ...spotifyUsers[activeUserId].userInfo
  };
}

/**
 * Génère un token temporaire pour l'authentification QR
 */
function generateQRAuthToken() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  
  qrAuthTokens[token] = {
    createdAt: now,
    expiresAt: now + QR_TOKEN_EXPIRY
  };
  
  // Nettoyer les tokens expirés
  cleanupExpiredQRTokens();
  
  return token;
}

/**
 * Vérifie si un token QR est valide
 */
function isValidQRAuthToken(token) {
  cleanupExpiredQRTokens();
  const qrToken = qrAuthTokens[token];
  if (!qrToken) {
    return false;
  }
  if (Date.now() > qrToken.expiresAt) {
    delete qrAuthTokens[token];
    return false;
  }
  return true;
}

/**
 * Consomme un token QR (le supprime après utilisation)
 */
function consumeQRAuthToken(token) {
  if (isValidQRAuthToken(token)) {
    delete qrAuthTokens[token];
    return true;
  }
  return false;
}

/**
 * Nettoie les tokens QR expirés
 */
function cleanupExpiredQRTokens() {
  const now = Date.now();
  Object.keys(qrAuthTokens).forEach(token => {
    if (now > qrAuthTokens[token].expiresAt) {
      delete qrAuthTokens[token];
    }
  });
}

/**
 * Génère l'URL d'authentification avec un token QR
 */
function getQRAuthorizationUrl(qrToken) {
  const clientId = config.spotify?.clientId;
  if (!clientId) {
    throw new Error('Spotify Client ID not configured');
  }

  const redirectUri = config.spotify?.redirectUri || 'http://localhost:5000/api/spotify/callback';
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-read-playback-position',
    'playlist-read-private',
    'playlist-read-collaborative'
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: `${redirectUri}?qr_token=${qrToken}`,
    scope: scopes,
    show_dialog: 'true'
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForToken,
  getCurrentlyPlaying,
  pausePlayback,
  resumePlayback,
  skipToNext,
  skipToPrevious,
  getDevices,
  transferPlayback,
  getUserPlaylists,
  getFeaturedPlaylists,
  getPlaylistTracks,
  playPlaylist,
  playTrack,
  isAuthenticated,
  setTokens,
  getUsers,
  setActiveUser,
  removeUser,
  getActiveUser,
  generateQRAuthToken,
  isValidQRAuthToken,
  consumeQRAuthToken,
  getQRAuthorizationUrl
};

