import React, { useState, useEffect, useCallback } from 'react';

/**
 * Widget Spotify pour afficher le morceau actuellement joué
 * et contrôler la lecture (play/pause, suivant)
 */
function SpotifyWidget() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

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
      }
    } catch (err) {
      console.error('Erreur lors de la récupération du statut Spotify:', err);
      setError(err.message);
      setIsAuthenticated(false);
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
      const response = await fetch('/api/spotify/play', { method: 'POST' });
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
    } catch (err) {
      console.error('Erreur lors de la reprise:', err);
      setError(err.message);
      setIsTransitioning(false);
    }
  };

  const handlePause = async () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    try {
      const response = await fetch('/api/spotify/pause', { method: 'POST' });
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
      const response = await fetch('/api/spotify/next', { method: 'POST' });
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
      const response = await fetch('/api/spotify/previous', { method: 'POST' });
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

  // Charger le statut au montage et périodiquement
  useEffect(() => {
    fetchStatus();
    
    // Rafraîchir toutes les 5 secondes
    const interval = setInterval(fetchStatus, 5000);
    
    return () => clearInterval(interval);
  }, [fetchStatus]);

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

  return (
    <div className={`spotify-widget ${isTransitioning ? 'spotify-widget-transitioning' : ''}`}>
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

        <div className="spotify-widget-controls">
          <button
            onClick={handlePrevious}
            disabled={isTransitioning}
            className="spotify-widget-control-button spotify-widget-previous"
            aria-label="Morceau précédent"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={isTransitioning}
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
            disabled={isTransitioning}
            className="spotify-widget-control-button spotify-widget-next"
            aria-label="Morceau suivant"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SpotifyWidget;

