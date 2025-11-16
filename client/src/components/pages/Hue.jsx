import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HUE_REFRESH_INTERVAL } from '../../constants';

function Hue() {
  const navigate = useNavigate();
  const [hueData, setHueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roomName, setRoomName] = useState('Salon');
  const [isToggling, setIsToggling] = useState(false);
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
      <div className="app">
        <div className="loading">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">
          <h2>Erreur</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!hueData) {
    return (
      <div className="app">
        <div className="error">
          <h2>Aucune donnée disponible</h2>
        </div>
      </div>
    );
  }

  const { room, status, lights } = hueData;

  const handleToggle = async () => {
    if (isToggling) return;
    
    // Mémoriser le texte actuel du bouton
    const currentText = hueData?.status?.anyOn ? 'Éteindre toutes les lumières' : 'Allumer toutes les lumières';
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
    <div className="hue-page">
      <div className="hue-page-header">
        <div className="hue-page-header-left">
          <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        </div>
        <h1 className="hue-page-main-title">💡 {room.name}</h1>
        <div className="hue-page-header-right"></div>
      </div>
      <div className="hue-page-content">
        <div className="hue-page-widget">
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
                    Luminosité moyenne: {status.brightness}%
                  </div>
                )}
              </div>
            </div>
            <div className="hue-lights-count">
              {status.lightsOn} / {status.lightsCount} lumières allumée(s)
            </div>
          </div>
          
          <button 
            className={`hue-toggle-button hue-toggle-button-page ${waveAnimation ? `hue-toggle-button-${waveAnimation}` : ''}`}
            onClick={handleToggle}
            disabled={isToggling}
          >
            {buttonText !== null ? buttonText : (status.anyOn ? 'Éteindre toutes les lumières' : 'Allumer toutes les lumières')}
          </button>
          
          {lights && lights.length > 0 && (
            <div className="hue-lights-list">
              {lights.map((light) => (
                <div key={light.id} className="hue-light-item">
                  <div className={`hue-light-indicator ${light.on ? 'on' : 'off'}`}>
                    {light.on ? '●' : '○'}
                  </div>
                  <div className="hue-light-name">{light.name}</div>
                  {light.on && (
                    <div className="hue-light-brightness">{light.brightness}%</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Hue;

