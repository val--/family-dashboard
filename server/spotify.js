const https = require('https');
const http = require('http');
const config = require('./config');

// Stockage des tokens d'accès Spotify
let spotifyAccessToken = null;
let spotifyRefreshToken = null;
let tokenExpiryTime = null;
let currentUserInfo = null; // Infos de l'utilisateur connecté

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
    'user-read-playback-position',
    'user-read-recently-played'
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

    // Récupérer les infos de l'utilisateur
    currentUserInfo = await getUserInfo(spotifyAccessToken);

    return {
      accessToken: spotifyAccessToken,
      refreshToken: spotifyRefreshToken,
      expiresIn: response.data.expires_in,
      userInfo: {
        id: currentUserInfo.id,
        displayName: currentUserInfo.display_name || currentUserInfo.id,
        email: currentUserInfo.email,
        images: currentUserInfo.images
      }
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
    const response = await makeSpotifyRequest('/me/player/currently-playing', {
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
      spotifyRefreshToken = null;
      currentUserInfo = null;
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Récupère le dernier morceau joué
 */
async function getRecentlyPlayed(limit = 1) {
  try {
    const response = await makeSpotifyRequest(`/me/player/recently-played?limit=${limit}`, {
      timeout: 10000 // 10 secondes
    });
    
    if (!response.data || !response.data.items || response.data.items.length === 0) {
      return null;
    }

    // Récupérer le premier élément (le plus récent)
    const recentTrack = response.data.items[0].track;
    
    // Utiliser la plus grande image disponible (première de la liste)
    let albumArt = null;
    if (recentTrack.album.images && recentTrack.album.images.length > 0) {
      albumArt = recentTrack.album.images[0].url;
    }
    
    return {
      name: recentTrack.name,
      artists: recentTrack.artists.map(a => a.name).join(', '),
      album: recentTrack.album.name,
      albumArt: albumArt,
      duration: recentTrack.duration_ms,
      uri: recentTrack.uri,
      playedAt: response.data.items[0].played_at
    };
  } catch (error) {
    // Gestion spécifique des erreurs réseau
    if (error.message.includes('Network error') || error.message.includes('timeout') || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
      throw new Error('Network error: Unable to connect to Spotify. Please check your internet connection.');
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      // Token expiré ou invalide
      spotifyAccessToken = null;
      spotifyRefreshToken = null;
      currentUserInfo = null;
      throw new Error('Authentication expired. Please re-authorize.');
    }
    // Si l'erreur n'est pas critique, retourner null plutôt que de throw
    console.error('Error fetching recently played:', error);
    return null;
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
 * Récupère la liste des appareils disponibles
 */
async function getDevices() {
  try {
    const response = await makeSpotifyRequest('/me/player/devices', {
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
      spotifyAccessToken = null;
      spotifyRefreshToken = null;
      currentUserInfo = null;
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Change le volume de l'appareil actif
 */
async function setVolume(volumePercent, deviceId = null) {
  try {
    const params = new URLSearchParams({ volume_percent: volumePercent.toString() });
    if (deviceId) {
      params.append('device_id', deviceId);
    }
    
    await makeSpotifyRequest(`/me/player/volume?${params.toString()}`, {
      method: 'PUT',
      timeout: 10000
    });
    
    return { success: true };
  } catch (error) {
    if (error.message.includes('404')) {
      return { success: false, error: 'No active device found' };
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      spotifyAccessToken = null;
      spotifyRefreshToken = null;
      currentUserInfo = null;
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Récupère l'état du player (shuffle, repeat, etc.)
 */
async function getPlayerState() {
  try {
    const response = await makeSpotifyRequest('/me/player', {
      timeout: 10000
    });
    
    if (response.statusCode === 204 || !response.data) {
      return { shuffleState: false, repeatState: 'off' };
    }
    
    return {
      shuffleState: response.data.shuffle_state || false,
      repeatState: response.data.repeat_state || 'off'
    };
  } catch (error) {
    if (error.message.includes('404')) {
      return { shuffleState: false, repeatState: 'off' };
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      spotifyAccessToken = null;
      spotifyRefreshToken = null;
      currentUserInfo = null;
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Active ou désactive le mode shuffle
 */
async function setShuffle(state, deviceId = null) {
  try {
    const params = new URLSearchParams({ state: state.toString() });
    if (deviceId) {
      params.append('device_id', deviceId);
    }
    
    await makeSpotifyRequest(`/me/player/shuffle?${params.toString()}`, {
      method: 'PUT',
      timeout: 10000
    });
    
    return { success: true };
  } catch (error) {
    if (error.message.includes('404')) {
      return { success: false, error: 'No active device found' };
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      spotifyAccessToken = null;
      spotifyRefreshToken = null;
      currentUserInfo = null;
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Transfère la lecture vers un appareil spécifique
 */
async function transferPlayback(deviceId, play = false) {
  try {
    await makeSpotifyRequest('/me/player', {
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
async function getUserPlaylists(limit = 50, offset = 0) {
  try {
    const response = await makeSpotifyRequest(`/me/playlists?limit=${limit}&offset=${offset}`, {
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
      spotifyAccessToken = null;
      spotifyRefreshToken = null;
      currentUserInfo = null;
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
async function getPlaylistTracks(playlistId, limit = 100, offset = 0) {
  try {
    const response = await makeSpotifyRequest(`/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`, {
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
      spotifyAccessToken = null;
      spotifyRefreshToken = null;
      currentUserInfo = null;
      throw new Error('Authentication expired. Please re-authorize.');
    }
    throw error;
  }
}

/**
 * Lance une playlist ou un morceau spécifique
 */
async function playPlaylist(playlistUri, deviceId = null) {
  try {
    const body = {
      context_uri: playlistUri
    };
    
    if (deviceId) {
      body.device_id = deviceId;
    }

    await makeSpotifyRequest('/me/player/play', {
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
async function playTrack(trackUri, deviceId = null) {
  try {
    const body = {
      uris: [trackUri]
    };
    
    if (deviceId) {
      body.device_id = deviceId;
    }

    await makeSpotifyRequest('/me/player/play', {
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

/**
 * Récupère les informations de l'utilisateur connecté
 */
function getCurrentUser() {
  if (!currentUserInfo) {
    return null;
  }
  return {
    id: currentUserInfo.id,
    displayName: currentUserInfo.display_name || currentUserInfo.id,
    email: currentUserInfo.email,
    images: currentUserInfo.images
  };
}

module.exports = {
  getPlayerState,
  setShuffle,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getCurrentlyPlaying,
  getRecentlyPlayed,
  pausePlayback,
  resumePlayback,
  skipToNext,
  skipToPrevious,
  getDevices,
  transferPlayback,
  setVolume,
  getUserPlaylists,
  getPlaylistTracks,
  playPlaylist,
  playTrack,
  isAuthenticated,
  setTokens,
  getCurrentUser
};

