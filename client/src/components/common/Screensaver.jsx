import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { REFRESH_INTERVAL } from '../../constants';

/**
 * Composant d'écran de veille
 * Affiche un écran noir avec l'heure au centre
 */
function Screensaver({ onExit }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const shouldExitRef = useRef(false);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [spotifyTrack, setSpotifyTrack] = useState(null);
  const [hasActiveDevice, setHasActiveDevice] = useState(false);

  useEffect(() => {
    // Mettre à jour l'heure chaque seconde
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timeInterval);
    };
  }, []);

  // Formater l'heure
  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Formater la date
  const formatDate = (date) => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('fr-FR', options);
  };

  const fetchWeather = useCallback(async () => {
    try {
      const response = await fetch('/api/weather');
      if (!response.ok) {
        throw new Error('Weather fetch failed');
      }
      const result = await response.json();
      if (result.success && result.data?.current) {
        const current = result.data.current;
        setWeatherInfo({
          temp: current.temp,
          icon: current.icon,
          city: result.data.city,
        });
      } else {
        setWeatherInfo(null);
      }
    } catch (error) {
      console.error('Erreur météo écran de veille:', error);
      setWeatherInfo(null);
    }
  }, []);

  const fetchSpotifyStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/status');
      if (!response.ok) {
        throw new Error('Spotify fetch failed');
      }
      const result = await response.json();
      if (result.success && result.authenticated) {
        // Vérifier s'il y a un device actif
        try {
          const devicesResponse = await fetch('/api/spotify/devices');
          const devicesData = await devicesResponse.json();
          if (devicesData.success && devicesData.devices) {
            const activeDevice = devicesData.devices.find(d => d.isActive);
            const hasActive = !!activeDevice;
            setHasActiveDevice(hasActive);
            
            // N'afficher le morceau que si un device est actif
            if (hasActive) {
              // Utiliser le morceau actuel (même en pause) ou le dernier morceau joué
              const track = result.track || result.lastPlayedTrack;
              if (track) {
                setSpotifyTrack({
                  artist: track.artists,
                  name: track.name,
                  isPlaying: result.isPlaying || false,
                });
              } else {
                setSpotifyTrack(null);
              }
            } else {
              setSpotifyTrack(null);
            }
          } else {
            setHasActiveDevice(false);
            setSpotifyTrack(null);
          }
        } catch (err) {
          console.error('Error fetching devices:', err);
          setHasActiveDevice(false);
          setSpotifyTrack(null);
        }
      } else {
        setHasActiveDevice(false);
        setSpotifyTrack(null);
      }
    } catch (error) {
      console.error('Erreur Spotify écran de veille:', error);
      setHasActiveDevice(false);
      setSpotifyTrack(null);
    }
  }, []);

  const handlePlayPause = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
    }
    if (!spotifyTrack) return;

    const wasPlaying = spotifyTrack.isPlaying;
    const endpoint = wasPlaying ? '/api/spotify/pause' : '/api/spotify/play';
    
    // Mettre à jour l'état local immédiatement pour un feedback visuel instantané
    setSpotifyTrack(prev => prev ? { ...prev, isPlaying: !prev.isPlaying } : null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        // En cas d'erreur, restaurer l'état précédent
        setSpotifyTrack(prev => prev ? { ...prev, isPlaying: wasPlaying } : null);
        const data = await response.json();
        console.error('Erreur lors du play/pause:', data.error || 'Unknown error');
      } else {
        // Rafraîchir le statut après un court délai pour s'assurer de la synchronisation
        setTimeout(() => {
          fetchSpotifyStatus();
        }, 500);
      }
    } catch (error) {
      console.error('Erreur lors du play/pause:', error);
      // En cas d'erreur, restaurer l'état précédent
      setSpotifyTrack(prev => prev ? { ...prev, isPlaying: wasPlaying } : null);
    }
    return false;
  };

  useEffect(() => {
    fetchWeather();
    fetchSpotifyStatus();
    const weatherInterval = setInterval(fetchWeather, REFRESH_INTERVAL);
    const spotifyInterval = setInterval(fetchSpotifyStatus, 5000); // Rafraîchir Spotify toutes les 5 secondes
    return () => {
      clearInterval(weatherInterval);
      clearInterval(spotifyInterval);
    };
  }, [fetchWeather, fetchSpotifyStatus]);

  useEffect(() => {
    const stopEvent = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }
      return false;
    };

    // Vérifier si le clic provient d'un élément interactif (play/pause ou texte Spotify)
    const isInteractiveElement = (target) => {
      return target.closest('.screensaver-spotify-play-pause') || 
             target.closest('.screensaver-spotify-text');
    };

    const handlePointerDownCapture = (event) => {
      // Ne pas intercepter les clics sur les éléments interactifs
      if (isInteractiveElement(event.target)) {
        return;
      }
      stopEvent(event);
      shouldExitRef.current = true;
      return false;
    };

    const handlePointerUpCapture = (event) => {
      // Ne pas intercepter les clics sur les éléments interactifs
      if (isInteractiveElement(event.target)) {
        return;
      }
      stopEvent(event);
      if (shouldExitRef.current) {
        shouldExitRef.current = false;
        if (onExit) {
          // Utiliser setTimeout pour s'assurer que l'événement est complètement traité
          setTimeout(() => {
            onExit();
          }, 0);
        }
      }
      return false;
    };

    const handleClickCapture = (event) => {
      // Ne pas intercepter les clics sur les éléments interactifs
      if (isInteractiveElement(event.target)) {
        return;
      }
      stopEvent(event);
      return false;
    };

    const handleMouseDownCapture = (event) => {
      // Ne pas intercepter les clics sur les éléments interactifs
      if (isInteractiveElement(event.target)) {
        return;
      }
      stopEvent(event);
      shouldExitRef.current = true;
      return false;
    };

    const handleMouseUpCapture = (event) => {
      // Ne pas intercepter les clics sur les éléments interactifs
      if (isInteractiveElement(event.target)) {
        return;
      }
      stopEvent(event);
      if (shouldExitRef.current) {
        shouldExitRef.current = false;
        if (onExit) {
          setTimeout(() => {
            onExit();
          }, 0);
        }
      }
      return false;
    };

    const handleTouchStartCapture = (event) => {
      // Ne pas intercepter les clics sur les éléments interactifs
      if (isInteractiveElement(event.target)) {
        return;
      }
      stopEvent(event);
      shouldExitRef.current = true;
      return false;
    };

    const handleTouchEndCapture = (event) => {
      // Ne pas intercepter les clics sur les éléments interactifs
      if (isInteractiveElement(event.target)) {
        return;
      }
      stopEvent(event);
      if (shouldExitRef.current) {
        shouldExitRef.current = false;
        if (onExit) {
          setTimeout(() => {
            onExit();
          }, 0);
        }
      }
      return false;
    };

    const handleKeyDownCapture = (event) => {
      stopEvent(event);
      if (onExit) {
        onExit();
      }
      return false;
    };

    // Bloquer tous les types d'événements en phase de capture
    window.addEventListener('pointerdown', handlePointerDownCapture, true);
    window.addEventListener('pointerup', handlePointerUpCapture, true);
    window.addEventListener('click', handleClickCapture, true);
    window.addEventListener('mousedown', handleMouseDownCapture, true);
    window.addEventListener('mouseup', handleMouseUpCapture, true);
    window.addEventListener('touchstart', handleTouchStartCapture, true);
    window.addEventListener('touchend', handleTouchEndCapture, true);
    window.addEventListener('keydown', handleKeyDownCapture, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDownCapture, true);
      window.removeEventListener('pointerup', handlePointerUpCapture, true);
      window.removeEventListener('click', handleClickCapture, true);
      window.removeEventListener('mousedown', handleMouseDownCapture, true);
      window.removeEventListener('mouseup', handleMouseUpCapture, true);
      window.removeEventListener('touchstart', handleTouchStartCapture, true);
      window.removeEventListener('touchend', handleTouchEndCapture, true);
      window.removeEventListener('keydown', handleKeyDownCapture, true);
    };
  }, [onExit]);

  return (
    <div className="screensaver">
      <div className="screensaver-content">
        <div className="screensaver-time">{formatTime(currentTime)}</div>
        <div className="screensaver-date">{formatDate(currentTime)}</div>
      </div>
      {weatherInfo && (
        <div className="screensaver-weather" aria-live="polite">
          {weatherInfo.icon && (
            <img
              src={`https://openweathermap.org/img/wn/${weatherInfo.icon}@2x.png`}
              alt=""
              className="screensaver-weather-icon"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          <div className="screensaver-weather-text">
            <span className="screensaver-weather-city">{weatherInfo.city}</span>
            <span className="screensaver-weather-temp">
              {Math.round(weatherInfo.temp)}°
            </span>
          </div>
        </div>
      )}
      {spotifyTrack && (
        <div 
          className="screensaver-spotify screensaver-spotify-clickable" 
          aria-live="polite"
        >
          <svg 
            className="screensaver-spotify-icon screensaver-spotify-play-pause" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="currentColor"
            onClick={handlePlayPause}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
              }
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
              }
            }}
          >
            {spotifyTrack.isPlaying ? (
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            ) : (
              <path d="M8 5v14l11-7z"/>
            )}
          </svg>
          <span 
            className="screensaver-spotify-text"
            onClick={(e) => {
              e.stopPropagation();
              if (onExit) {
                onExit();
              }
              navigate('/spotify');
            }}
          >
            {spotifyTrack.artist} - {spotifyTrack.name}
          </span>
        </div>
      )}
    </div>
  );
}

export default Screensaver;
