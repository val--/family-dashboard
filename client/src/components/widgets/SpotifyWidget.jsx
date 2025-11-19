import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Widget Spotify pour afficher le morceau actuellement joué
 * et contrôler la lecture (play/pause, suivant)
 */
function SpotifyWidget() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [track, setTrack] = useState(null);
  const [lastPlayedTrack, setLastPlayedTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isStartingPlayback, setIsStartingPlayback] = useState(false);
  const [devices, setDevices] = useState([]);
  const [showDevices, setShowDevices] = useState(false);
  const [activeDeviceId, setActiveDeviceId] = useState(null);
  const [volume, setVolume] = useState(50);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [playlistSortBy, setPlaylistSortBy] = useState('default'); // 'default' (ordre d'ajout), 'name'
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Vérifier l'authentification et récupérer le statut
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/spotify/status');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch Spotify status');
      }

      setIsAuthenticated(data.authenticated);
      
      if (data.authenticated) {
        setIsPlaying(data.isPlaying);
        setTrack(data.track);
        // Si on a récupéré un track, on n'est plus en train de lancer
        if (data.track) {
          setIsStartingPlayback(false);
        }
        // Mettre à jour le dernier morceau joué si fourni
        if (data.lastPlayedTrack) {
          setLastPlayedTrack(data.lastPlayedTrack);
        }
        // Mettre à jour l'utilisateur connecté si fourni
        if (data.currentUser) {
          setCurrentUser(data.currentUser);
        }
      }
    } catch (err) {
      console.error('Erreur lors de la récupération du statut Spotify:', err);
      setError(err.message);
      setIsAuthenticated(false);
      setIsStartingPlayback(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Authentification Spotify
  const handleAuth = async () => {
    try {
      const response = await fetch('/api/spotify/auth');
      const data = await response.json();
      
      if (data.success && data.authUrl) {
        // Ouvrir la fenêtre d'authentification
        const authWindow = window.open(data.authUrl, 'spotify-auth', 'width=500,height=600');

        // Écouter les messages de la fenêtre popup
        const messageHandler = (event) => {
          if (event.data === 'spotify-auth-success') {
            fetchStatus();
            window.removeEventListener('message', messageHandler);
          }
        };
        window.addEventListener('message', messageHandler);

        // Vérifier périodiquement si l'authentification a réussi
        const checkInterval = setInterval(async () => {
          if (authWindow.closed) {
            clearInterval(checkInterval);
            window.removeEventListener('message', messageHandler);
            // Vérifier une dernière fois le statut
            await fetchStatus();
            return;
          }
          
          // Vérifier le statut d'authentification
          await fetchStatus();
          if (isAuthenticated) {
            clearInterval(checkInterval);
            window.removeEventListener('message', messageHandler);
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
          }
        }, 2000);

        // Arrêter de vérifier après 5 minutes
        setTimeout(() => {
          clearInterval(checkInterval);
          window.removeEventListener('message', messageHandler);
        }, 5 * 60 * 1000);
      }
    } catch (err) {
      console.error('Erreur lors de l\'authentification Spotify:', err);
      setError(err.message);
    }
  };


  // Contrôles de lecture
  const handlePlay = async () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    try {
      // Si aucun morceau n'est en cours mais qu'on a un dernier morceau joué, le relancer
      if (!track && lastPlayedTrack) {
        const response = await fetch('/api/spotify/play/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackUri: lastPlayedTrack.uri, deviceId: activeDeviceId })
        });
        const data = await response.json();
        
        if (data.success) {
          setIsStartingPlayback(true);
          // Attendre un peu avant de rafraîchir le statut
          setTimeout(async () => {
            await fetchStatus();
            setTimeout(async () => {
              await fetchStatus();
              setIsTransitioning(false);
            }, 2000);
          }, 1500);
        } else {
          setError(data.error || 'Failed to play track');
          setIsTransitioning(false);
          setIsStartingPlayback(false);
        }
      } else {
        // Reprendre la lecture normale
        const response = await fetch('/api/spotify/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await response.json();
        
        if (data.success) {
          setIsPlaying(true);
          // Rafraîchir le statut après un court délai
          setTimeout(async () => {
            await fetchStatus();
            setIsTransitioning(false);
          }, 500);
        } else {
          setError(data.error || 'Failed to resume playback');
          setIsTransitioning(false);
        }
      }
    } catch (err) {
      console.error('Erreur lors de la reprise:', err);
      setError(err.message);
      setIsTransitioning(false);
      setIsStartingPlayback(false);
    }
  };

  const handlePause = async () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    try {
      const response = await fetch('/api/spotify/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      
      if (data.success) {
        setIsPlaying(false);
        // Rafraîchir le statut après un court délai
        setTimeout(async () => {
          await fetchStatus();
          setIsTransitioning(false);
        }, 500);
      } else {
        setError(data.error || 'Failed to pause playback');
        setIsTransitioning(false);
      }
    } catch (err) {
      console.error('Erreur lors de la pause:', err);
      setError(err.message);
      setIsTransitioning(false);
    }
  };

  const handleNext = async () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    try {
      const response = await fetch('/api/spotify/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      
      if (data.success) {
        // Rafraîchir le statut après un court délai
        setTimeout(async () => {
          await fetchStatus();
          setIsTransitioning(false);
        }, 1000);
      } else {
        setError(data.error || 'Failed to skip to next track');
        setIsTransitioning(false);
      }
    } catch (err) {
      console.error('Erreur lors du passage au suivant:', err);
      setError(err.message);
      setIsTransitioning(false);
    }
  };

  const handlePrevious = async () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    try {
      const response = await fetch('/api/spotify/previous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      
      if (data.success) {
        // Rafraîchir le statut après un court délai
        setTimeout(async () => {
          await fetchStatus();
          setIsTransitioning(false);
        }, 1000);
      } else {
        setError(data.error || 'Failed to skip to previous track');
        setIsTransitioning(false);
      }
    } catch (err) {
      console.error('Erreur lors du passage au précédent:', err);
      setError(err.message);
      setIsTransitioning(false);
    }
  };

  // Récupérer les appareils disponibles
  const fetchDevices = useCallback(async () => {
    try {
      const url = '/api/spotify/devices';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.devices) {
        setDevices(data.devices);
        const activeDevice = data.devices.find(d => d.isActive);
        if (activeDevice) {
          setActiveDeviceId(activeDevice.id);
          if (activeDevice.volume !== undefined && activeDevice.volume !== null) {
            setVolume(activeDevice.volume);
          }
        }
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des appareils:', err);
    }
  }, []);

  // Transférer la lecture vers un appareil
  const handleTransferDevice = async (deviceId) => {
    try {
      setIsTransitioning(true);
      const response = await fetch('/api/spotify/transfer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, play: isPlaying })
      });
      const data = await response.json();

      if (data.success) {
        setActiveDeviceId(deviceId);
        setShowDevices(false);
        // Rafraîchir le statut après un court délai
        setTimeout(async () => {
          await fetchStatus();
          await fetchDevices();
          setIsTransitioning(false);
        }, 500);
      } else {
        setError(data.error || 'Failed to transfer playback');
        setIsTransitioning(false);
      }
    } catch (err) {
      console.error('Erreur lors du transfert:', err);
      setError(err.message);
      setIsTransitioning(false);
    }
  };

  // Récupérer les playlists de l'utilisateur (avec pagination pour récupérer toutes les playlists)
  const fetchPlaylists = useCallback(async () => {
    try {
      setLoadingPlaylists(true);
      let allPlaylists = [];
      let offset = 0;
      const limit = 50; // Limite maximale par requête
      let hasMore = true;

      // Récupérer toutes les playlists par pagination
      while (hasMore) {
        const url = `/api/spotify/playlists?limit=${limit}&offset=${offset}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.success && data.playlists) {
          allPlaylists = [...allPlaylists, ...data.playlists];
          
          // Vérifier s'il y a plus de playlists à récupérer
          if (data.playlists.length < limit || allPlaylists.length >= data.total) {
            hasMore = false;
          } else {
            offset += limit;
          }
        } else {
          hasMore = false;
        }
      }

      setPlaylists(allPlaylists);
    } catch (err) {
      console.error('Erreur lors de la récupération des playlists:', err);
      setError(err.message);
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  // Récupérer les morceaux d'une playlist
  const fetchPlaylistTracks = useCallback(async (playlistId) => {
    try {
      setLoadingPlaylists(true);
      const url = `/api/spotify/playlists/${playlistId}/tracks?limit=100`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.tracks) {
        setPlaylistTracks(data.tracks);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des morceaux:', err);
      setError(err.message);
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  // Lancer une playlist
  const handlePlayPlaylist = async (playlistUri) => {
    try {
      setIsTransitioning(true);
      setIsStartingPlayback(true);
      const response = await fetch('/api/spotify/play/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistUri, deviceId: activeDeviceId })
      });
      const data = await response.json();

      if (data.success) {
        setShowPlaylists(false);
        setSelectedPlaylist(null);
        // Attendre un peu plus longtemps pour que Spotify démarre la lecture
        setTimeout(async () => {
          await fetchStatus();
          // Si toujours pas de track après 2 secondes, réessayer une fois
          setTimeout(async () => {
            await fetchStatus();
            setIsTransitioning(false);
          }, 2000);
        }, 1500);
      } else {
        setError(data.error || 'Failed to play playlist');
        setIsTransitioning(false);
        setIsStartingPlayback(false);
      }
    } catch (err) {
      console.error('Erreur lors de la lecture de la playlist:', err);
      setError(err.message);
      setIsTransitioning(false);
      setIsStartingPlayback(false);
    }
  };

  // Lancer un morceau
  const handlePlayTrack = async (trackUri) => {
    try {
      setIsTransitioning(true);
      setIsStartingPlayback(true);
      const response = await fetch('/api/spotify/play/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackUri, deviceId: activeDeviceId })
      });
      const data = await response.json();

      if (data.success) {
        setShowPlaylists(false);
        setSelectedPlaylist(null);
        // Attendre un peu plus longtemps pour que Spotify démarre la lecture
        setTimeout(async () => {
          await fetchStatus();
          // Si toujours pas de track après 2 secondes, réessayer une fois
          setTimeout(async () => {
            await fetchStatus();
            setIsTransitioning(false);
          }, 2000);
        }, 1500);
      } else {
        setError(data.error || 'Failed to play track');
        setIsTransitioning(false);
        setIsStartingPlayback(false);
      }
    } catch (err) {
      console.error('Erreur lors de la lecture du morceau:', err);
      setError(err.message);
      setIsTransitioning(false);
      setIsStartingPlayback(false);
    }
  };

  // Ouvrir la modale des playlists
  const handleOpenPlaylists = () => {
    setShowPlaylists(true);
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
    fetchPlaylists();
  };

  // Sélectionner une playlist
  const handleSelectPlaylist = (playlist) => {
    setSelectedPlaylist(playlist);
    fetchPlaylistTracks(playlist.id);
  };

  // Trier les playlists selon le critère sélectionné
  const sortedPlaylists = React.useMemo(() => {
    if (!playlists || playlists.length === 0) return [];
    
    const sorted = [...playlists];
    switch (playlistSortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
        break;
      case 'default':
      default:
        // Garder l'ordre d'ajout (ordre original de l'API)
        break;
    }
    return sorted;
  }, [playlists, playlistSortBy]);

  // Gérer le changement de tri
  const handleSortChange = (sortBy) => {
    setPlaylistSortBy(sortBy);
    setShowSortMenu(false);
  };

  // Gérer le changement de volume
  const handleVolumeChange = async (newVolume) => {
    setVolume(newVolume);
    
    if (!activeDeviceId) return;
    
    try {
      const response = await fetch('/api/spotify/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volumePercent: newVolume, deviceId: activeDeviceId })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set volume');
      }
    } catch (err) {
      console.error('Erreur lors du changement de volume:', err);
      // Ne pas afficher d'erreur à l'utilisateur pour le volume
    }
  };

  // Fermer le menu des appareils et le menu de tri en cliquant en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDevices && !event.target.closest('.spotify-widget-device-selector')) {
        setShowDevices(false);
      }
      if (showSortMenu && !event.target.closest('.spotify-widget-playlists-sort')) {
        setShowSortMenu(false);
      }
    };

    if (showDevices || showSortMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDevices, showSortMenu]);

  // Charger le statut au montage
  useEffect(() => {
    fetchStatus();
    fetchDevices();
  }, [fetchStatus, fetchDevices]);

  // Rafraîchir périodiquement
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      fetchDevices();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchStatus, fetchDevices]);

  if (loading) {
    return (
      <div className="spotify-widget">
        <div className="spotify-widget-content">
          <div className="spotify-widget-loading">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="spotify-widget">
        <div className="spotify-widget-content">
          <div className="spotify-widget-not-authenticated">
            <div className="spotify-widget-icon">🎵</div>
            <p>Connectez-vous à Spotify</p>
            <button onClick={handleAuth} className="spotify-widget-auth-button">
              Se connecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="spotify-widget">
        <div className="spotify-widget-content">
          <div className="spotify-widget-error">
            <p>Erreur: {error}</p>
            <button onClick={fetchStatus} className="spotify-widget-retry-button">
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!track) {
    // Si on est en train de lancer une lecture, afficher un message de chargement
    if (isStartingPlayback) {
      return (
        <div className="spotify-widget">
          <div className="spotify-widget-content">
            <div className="spotify-widget-no-track">
              <div className="spotify-widget-loading">Lancement en cours...</div>
            </div>
          </div>
        </div>
      );
    }

    // Afficher le dernier morceau joué s'il existe
    const displayTrack = lastPlayedTrack;
    
    if (!displayTrack) {
      return (
        <div className="spotify-widget">
          <div className="spotify-widget-content">
            <div className="spotify-widget-no-track">
              <div className="spotify-widget-icon">🎵</div>
              <p>Aucun morceau en cours de lecture</p>
              <p className="spotify-widget-hint">Lancez un morceau sur Spotify</p>
            </div>
          </div>
        </div>
      );
    }

    // Afficher le dernier morceau joué avec les contrôles
    return (
      <React.Fragment>
        <div className={`spotify-widget ${isTransitioning ? 'spotify-widget-transitioning' : ''}`}>
          {currentUser && (
            <div className="spotify-widget-user-selector">
              <div className="spotify-widget-user-button" style={{ cursor: 'default' }}>
                {currentUser.images && currentUser.images.length > 0 ? (
                  <img src={currentUser.images[0].url} alt={currentUser.displayName} className="spotify-widget-user-avatar" />
                ) : (
                  <div className="spotify-widget-user-avatar-placeholder">
                    {currentUser.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="spotify-widget-user-name">{currentUser.displayName || 'Utilisateur'}</span>
              </div>
            </div>
          )}
          <div className="spotify-widget-content">
            {displayTrack.albumArt && (
              <div className="spotify-widget-album-art">
                <img src={displayTrack.albumArt} alt={displayTrack.album} />
              </div>
            )}
            
            <div className="spotify-widget-info">
              <div className="spotify-widget-track-name">{displayTrack.name}</div>
              <div className="spotify-widget-artist">{displayTrack.artists}</div>
              <div className="spotify-widget-album">{displayTrack.album}</div>
            </div>

            {devices.length > 0 && (
              <div className="spotify-widget-device-selector">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDevices(!showDevices);
                  }}
                  className="spotify-widget-device-button"
                  disabled={isTransitioning}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                  {devices.find(d => d.id === activeDeviceId)?.name || 'Sélectionner un appareil'}
                </button>
                {showDevices && (
                  <div className="spotify-widget-devices-list">
                    {devices.map(device => (
                      <button
                        key={device.id}
                        onClick={() => handleTransferDevice(device.id)}
                        className={`spotify-widget-device-item ${device.id === activeDeviceId ? 'active' : ''}`}
                        disabled={isTransitioning || device.id === activeDeviceId}
                      >
                        <span className="spotify-widget-device-name">{device.name}</span>
                        <span className="spotify-widget-device-type">{device.type}</span>
                        {device.id === activeDeviceId && (
                          <span className="spotify-widget-device-active">●</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="spotify-widget-controls">
              <button
                onClick={handlePrevious}
                disabled={isTransitioning || !activeDeviceId}
                className="spotify-widget-control-button spotify-widget-previous"
                aria-label="Morceau précédent"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>
              <button
                onClick={handlePlay}
                disabled={isTransitioning || !activeDeviceId}
                className="spotify-widget-control-button spotify-widget-play-pause"
                aria-label="Lecture"
              >
                {isTransitioning ? (
                  <div className="spotify-widget-button-spinner"></div>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              <button
                onClick={handleNext}
                disabled={isTransitioning || !activeDeviceId}
                className="spotify-widget-control-button spotify-widget-next"
                aria-label="Morceau suivant"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </button>
            </div>
          </div>

      {/* Bouton pour ouvrir les playlists */}
      <button
        onClick={handleOpenPlaylists}
        className="spotify-widget-playlists-button"
        disabled={isTransitioning}
        aria-label="Ouvrir les playlists"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zm3-10h13v2H7zm0 5h13v2H7zm0 5h13v2H7z"/>
        </svg>
      </button>

      {/* Slider de volume */}
      {activeDeviceId && (
        <div className="spotify-widget-volume-slider">
          <div className="spotify-widget-volume-icon">
            {volume === 0 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : volume < 50 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </div>
          <div className="spotify-widget-volume-track">
            <div 
              className="spotify-widget-volume-fill" 
              style={{ height: `${volume}%` }}
            ></div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
              className="spotify-widget-volume-input"
              aria-label="Volume"
              disabled={!activeDeviceId}
            />
          </div>
        </div>
      )}
    </div>
    </React.Fragment>
    );
  }

  return (
    <React.Fragment>
    <div className={`spotify-widget ${isTransitioning ? 'spotify-widget-transitioning' : ''}`}>
      {/* Sélecteur d'utilisateur */}
      {currentUser && (
        <div className="spotify-widget-user-selector">
          <div className="spotify-widget-user-button" style={{ cursor: 'default' }}>
            {currentUser.images && currentUser.images.length > 0 ? (
              <img src={currentUser.images[0].url} alt={currentUser.displayName} className="spotify-widget-user-avatar" />
            ) : (
              <div className="spotify-widget-user-avatar-placeholder">
                {currentUser.displayName?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <span className="spotify-widget-user-name">{currentUser.displayName || 'Utilisateur'}</span>
          </div>
        </div>
      )}
      <div className="spotify-widget-content">
        {track.albumArt && (
          <div className="spotify-widget-album-art">
            <img src={track.albumArt} alt={track.album} />
          </div>
        )}
        
        <div className="spotify-widget-info">
          <div className="spotify-widget-track-name">{track.name}</div>
          <div className="spotify-widget-artist">{track.artists}</div>
          <div className="spotify-widget-album">{track.album}</div>
        </div>

        {devices.length > 0 && (
          <div className="spotify-widget-device-selector">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDevices(!showDevices);
              }}
              className="spotify-widget-device-button"
              disabled={isTransitioning}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
              {devices.find(d => d.id === activeDeviceId)?.name || 'Sélectionner un appareil'}
            </button>
            {showDevices && (
              <div className="spotify-widget-devices-list">
                {devices.map(device => (
                  <button
                    key={device.id}
                    onClick={() => handleTransferDevice(device.id)}
                    className={`spotify-widget-device-item ${device.id === activeDeviceId ? 'active' : ''}`}
                    disabled={isTransitioning || device.id === activeDeviceId}
                  >
                    <span className="spotify-widget-device-name">{device.name}</span>
                    <span className="spotify-widget-device-type">{device.type}</span>
                    {device.id === activeDeviceId && (
                      <span className="spotify-widget-device-active">●</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="spotify-widget-controls">
          <button
            onClick={handlePrevious}
            disabled={isTransitioning || !activeDeviceId}
            className="spotify-widget-control-button spotify-widget-previous"
            aria-label="Morceau précédent"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={isTransitioning || !activeDeviceId}
            className="spotify-widget-control-button spotify-widget-play-pause"
            aria-label={isPlaying ? 'Pause' : 'Lecture'}
          >
            {isTransitioning ? (
              <div className="spotify-widget-button-spinner"></div>
            ) : isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          <button
            onClick={handleNext}
            disabled={isTransitioning || !activeDeviceId}
            className="spotify-widget-control-button spotify-widget-next"
            aria-label="Morceau suivant"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Bouton pour ouvrir les playlists */}
      <button
        onClick={handleOpenPlaylists}
        className="spotify-widget-playlists-button"
        disabled={isTransitioning}
        aria-label="Ouvrir les playlists"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zm3-10h13v2H7zm0 5h13v2H7zm0 5h13v2H7z"/>
        </svg>
      </button>

      {/* Slider de volume */}
      {activeDeviceId && (
        <div className="spotify-widget-volume-slider">
          <div className="spotify-widget-volume-icon">
            {volume === 0 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : volume < 50 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </div>
          <div className="spotify-widget-volume-track">
            <div 
              className="spotify-widget-volume-fill" 
              style={{ height: `${volume}%` }}
            ></div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
              className="spotify-widget-volume-input"
              aria-label="Volume"
              disabled={!activeDeviceId}
            />
          </div>
        </div>
      )}
    </div>

    {/* Modale des playlists - rendue via portail */}
    {showPlaylists && createPortal(
      <div 
        className="spotify-widget-playlists-modal" 
        onClick={() => setShowPlaylists(false)}
      >
        <div className="spotify-widget-playlists-content" onClick={(e) => e.stopPropagation()}>
          <div className="spotify-widget-playlists-header">
            <h2>Mes playlists</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {!selectedPlaylist && (
                <div className="spotify-widget-playlists-sort" style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSortMenu(!showSortMenu);
                    }}
                    className="spotify-widget-playlists-sort-button"
                    aria-label="Trier les playlists"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>
                    </svg>
                  </button>
                  {showSortMenu && (
                    <div className="spotify-widget-playlists-sort-menu">
                      <button
                        onClick={() => handleSortChange('default')}
                        className={playlistSortBy === 'default' ? 'active' : ''}
                      >
                        Par ordre d'ajout
                      </button>
                      <button
                        onClick={() => handleSortChange('name')}
                        className={playlistSortBy === 'name' ? 'active' : ''}
                      >
                        Par nom (A-Z)
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowPlaylists(false)}
                className="spotify-widget-playlists-close"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
          </div>

          {!selectedPlaylist ? (
            <div className="spotify-widget-playlists-list">
              {loadingPlaylists ? (
                <div className="spotify-widget-playlists-loading">Chargement...</div>
              ) : sortedPlaylists.length === 0 ? (
                <div className="spotify-widget-playlists-empty">Aucune playlist trouvée</div>
              ) : (
                sortedPlaylists.map(playlist => (
                  <div
                    key={playlist.id}
                    className="spotify-widget-playlist-item"
                    onClick={() => handleSelectPlaylist(playlist)}
                  >
                    {playlist.image && (
                      <img src={playlist.image} alt={playlist.name} className="spotify-widget-playlist-image" />
                    )}
                    <div className="spotify-widget-playlist-info">
                      <div className="spotify-widget-playlist-name">{playlist.name}</div>
                      <div className="spotify-widget-playlist-meta">
                        {playlist.owner} • {playlist.tracksCount} morceaux
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="spotify-widget-playlist-header">
                {selectedPlaylist.image && (
                  <img src={selectedPlaylist.image} alt={selectedPlaylist.name} className="spotify-widget-playlist-header-image" />
                )}
                <div className="spotify-widget-playlist-header-info">
                  <h3>{selectedPlaylist.name}</h3>
                  <p>{selectedPlaylist.owner} • {selectedPlaylist.tracksCount} morceaux</p>
                  <button
                    onClick={() => handlePlayPlaylist(selectedPlaylist.uri)}
                    className="spotify-widget-playlist-play-button"
                    disabled={isTransitioning}
                  >
                    ▶ Lire
                  </button>
                </div>
                <button
                  onClick={() => {
                    setSelectedPlaylist(null);
                    setPlaylistTracks([]);
                  }}
                  className="spotify-widget-playlist-back"
                >
                  ← Retour
                </button>
              </div>

              <div className="spotify-widget-playlist-tracks">
                {loadingPlaylists ? (
                  <div className="spotify-widget-playlists-loading">Chargement...</div>
                ) : playlistTracks.length === 0 ? (
                  <div className="spotify-widget-playlists-empty">Aucun morceau</div>
                ) : (
                  playlistTracks.map(track => (
                    <div
                      key={track.id}
                      className="spotify-widget-track-item"
                      onClick={() => handlePlayTrack(track.uri)}
                    >
                      {track.albumArt && (
                        <img src={track.albumArt} alt={track.album} className="spotify-widget-track-image" />
                      )}
                      <div className="spotify-widget-track-info">
                        <div className="spotify-widget-track-name">{track.name}</div>
                        <div className="spotify-widget-track-artist">{track.artists}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>,
      document.body
    )}

  </React.Fragment>
  );
}

export default SpotifyWidget;

