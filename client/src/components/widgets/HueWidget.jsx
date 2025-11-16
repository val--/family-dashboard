import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HUE_REFRESH_INTERVAL } from '../../constants';

function HueWidget() {
  const navigate = useNavigate();
  const [hueData, setHueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isToggling, setIsToggling] = useState(false);
  const [roomName, setRoomName] = useState('Salon');
  const [waveAnimation, setWaveAnimation] = useState(null);
  const [buttonText, setButtonText] = useState(null); // Mémorise le texte pendant l'opération

  // Fetch room name from config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/hue/config');
        const result = await response.json();
        if (result.success && result.roomName) {
          setRoomName(result.roomName);
        }
      } catch (err) {
        console.error('Error fetching Hue config:', err);
      }
    };
    fetchConfig();
  }, []);

  const fetchHueData = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/hue/room?room=${encodeURIComponent(roomName)}`);
      const result = await response.json();
      
      if (result.success) {
        setHueData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch Hue data');
      }
    } catch (err) {
      console.error('Error fetching Hue data:', err);
      setError(err.message || 'Erreur lors du chargement des lumières');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (roomName) {
      fetchHueData();
      
      const interval = setInterval(() => {
        fetchHueData();
      }, HUE_REFRESH_INTERVAL);

      return () => clearInterval(interval);
    }
  }, [roomName]);

  if (loading) {
    return (
      <div className="hue-widget">
        <div className="hue-widget-header">
          <h2 className="hue-widget-title">💡 {roomName}</h2>
        </div>
        <div className="hue-widget-content">
          <div className="hue-widget-loading">Chargement...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hue-widget">
        <div className="hue-widget-header">
          <h2 className="hue-widget-title">💡 {roomName}</h2>
        </div>
        <div className="hue-widget-content">
          <div className="hue-widget-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!hueData) {
    return (
      <div className="hue-widget">
        <div className="hue-widget-header">
          <h2 className="hue-widget-title">💡 {roomName}</h2>
        </div>
        <div className="hue-widget-content">
          <div className="hue-widget-empty">Aucune donnée disponible</div>
        </div>
      </div>
    );
  }

  const { room, status } = hueData;

  const handleToggle = async (e) => {
    e.stopPropagation(); // Prevent navigation when clicking the button
    if (isToggling) return;
    
    // Mémoriser le texte actuel du bouton
    const currentText = hueData?.status?.anyOn ? 'Éteindre' : 'Allumer';
    setButtonText(currentText);
    
    // Determine animation direction based on current state
    const willTurnOn = !hueData?.status?.anyOn;
    setWaveAnimation(willTurnOn ? 'wave-right' : 'wave-left');
    
    setIsToggling(true);
    try {
      const response = await fetch('/api/hue/room/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ room: roomName }),
      });
      
      const result = await response.json();
      if (result.success) {
        // Refresh data after toggle
        setTimeout(() => {
          fetchHueData();
        }, 500);
      }
    } catch (err) {
      console.error('Error toggling lights:', err);
    } finally {
      // Disable button for a fixed duration (1 second)
      setTimeout(() => {
        setIsToggling(false);
        setWaveAnimation(null); // Clear animation after it completes
        setButtonText(null); // Réinitialiser le texte pour utiliser l'état actuel
      }, 1000);
    }
  };

  return (
    <div className="hue-widget hue-widget-clickable" onClick={() => navigate('/hue')}>
      <div className="hue-widget-header">
        <h2 className="hue-widget-title">💡 {room.name}</h2>
      </div>
      <div className="hue-widget-content">
        <div className="hue-status">
          <div className="hue-status-main">
            <div className={`hue-status-indicator ${status.allOn ? 'on' : status.anyOn ? 'partial' : 'off'}`}>
              {status.allOn ? '●' : status.anyOn ? '◐' : '○'}
            </div>
            <div className="hue-status-text">
              <div className="hue-status-state">
                {status.allOn ? 'Toutes allumées' : status.anyOn ? 'Partiellement allumées' : 'Toutes éteintes'}
              </div>
              {status.anyOn && (
                <div className="hue-status-brightness">
                  Luminosité: {status.brightness}%
                </div>
              )}
            </div>
          </div>
          <div className="hue-lights-count">
            {status.lightsOn} / {status.lightsCount} lumières
          </div>
        </div>
        <button 
          className={`hue-toggle-button ${waveAnimation ? `hue-toggle-button-${waveAnimation}` : ''}`}
          onClick={handleToggle}
          disabled={isToggling}
        >
          {buttonText !== null ? buttonText : (status.anyOn ? 'Éteindre' : 'Allumer')}
        </button>
      </div>
    </div>
  );
}

export default HueWidget;

