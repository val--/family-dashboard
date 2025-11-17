import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HUE_REFRESH_INTERVAL } from '../../constants';
import HueColorModal from '../common/HueColorModal';

function Hue() {
  const navigate = useNavigate();
  const [hueData, setHueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roomName, setRoomName] = useState('Salon');
  const [isToggling, setIsToggling] = useState(false);
  const [waveAnimation, setWaveAnimation] = useState(null);
  const [buttonText, setButtonText] = useState(null);
  const [isAdjustingBrightness, setIsAdjustingBrightness] = useState(false);
  const [localBrightness, setLocalBrightness] = useState(null);
  const [showColorModal, setShowColorModal] = useState(false);
  const [pendingLights, setPendingLights] = useState({});

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

  useEffect(() => {
    if (hueData?.status?.brightness !== undefined && !isAdjustingBrightness) {
      if (localBrightness === null) {
        setLocalBrightness(hueData.status.brightness);
      } else if (Math.abs(localBrightness - hueData.status.brightness) > 5) {
        setLocalBrightness(hueData.status.brightness);
      }
    }
  }, [hueData, localBrightness, isAdjustingBrightness]);

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
    
    const currentText = hueData?.status?.anyOn ? 'Éteindre toutes les lumières' : 'Allumer toutes les lumières';
    setButtonText(currentText);
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
      setTimeout(() => {
        setIsToggling(false);
        setWaveAnimation(null);
        setButtonText(null);
      }, 1000);
    }
  };

  const handleLightToggle = async (lightId, targetState) => {
    if (!lightId || pendingLights[lightId]) return;

    setPendingLights((prev) => ({ ...prev, [lightId]: true }));
    try {
      const response = await fetch('/api/hue/light/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lightId,
          turnOn: targetState,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to toggle light');
      }

      setTimeout(() => {
        fetchHueData();
      }, 400);
    } catch (err) {
      console.error('Error toggling light:', err);
    } finally {
      setPendingLights((prev) => {
        const updated = { ...prev };
        delete updated[lightId];
        return updated;
      });
    }
  };

  const handleBrightnessChange = async (e) => {
    const newBrightness = parseInt(e.target.value, 10);
    setLocalBrightness(newBrightness);
    setIsAdjustingBrightness(true);
    
    try {
      const response = await fetch('/api/hue/room/brightness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          room: roomName,
          brightness: newBrightness 
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        setTimeout(() => {
          fetchHueData();
        }, 300);
      }
    } catch (err) {
      console.error('Error setting brightness:', err);
      if (hueData?.status?.brightness !== undefined) {
        setLocalBrightness(hueData.status.brightness);
      }
    } finally {
      setTimeout(() => {
        setIsAdjustingBrightness(false);
      }, 500);
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
              <div 
                className={`hue-status-indicator ${status.allOn ? 'on' : status.anyOn ? 'partial' : 'off'} ${status.anyOn ? 'hue-status-indicator-clickable' : ''}`}
                style={status.color && status.anyOn ? { 
                  backgroundColor: status.color
                } : {}}
                onClick={status.anyOn ? () => setShowColorModal(true) : undefined}
                title={status.allOn ? 'Toutes allumées' : status.anyOn ? 'Partiellement allumées' : 'Toutes éteintes'}
              />
              <div className="hue-status-text">
                <div className="hue-status-state">
                  {status.allOn ? 'Toutes allumées' : status.anyOn ? 'Partiellement allumées' : 'Toutes éteintes'}
                </div>
                <div className={`hue-status-brightness ${status.anyOn ? '' : 'hue-status-brightness-hidden'}`}>
                  Luminosité moyenne: {status.brightness}%
                </div>
              </div>
            </div>
            <div className="hue-lights-count">
              {status.lightsOn} / {status.lightsCount} lumières allumée(s)
            </div>
          </div>
          
          <div 
            className={`hue-brightness-control hue-brightness-control-page ${!status.anyOn ? 'hue-brightness-control-disabled' : ''}`}
            style={status.color && status.anyOn ? { '--hue-color': status.color } : {}}
          >
            <label className="hue-brightness-label">
              <span>Luminosité</span>
              <span className="hue-brightness-value">{localBrightness !== null ? localBrightness : (status.brightness || 0)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={localBrightness !== null ? localBrightness : (status.brightness || 0)}
              onChange={handleBrightnessChange}
              className="hue-brightness-slider"
              disabled={isAdjustingBrightness || !status.anyOn}
            />
          </div>
          
          <button 
            className={`hue-toggle-button hue-toggle-button-page ${waveAnimation ? `hue-toggle-button-${waveAnimation}` : ''}`}
            onClick={handleToggle}
            disabled={isToggling}
            style={status.color && status.anyOn ? { '--hue-color': status.color } : {}}
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
                  <button
                    className={`hue-light-toggle ${light.on ? 'on' : 'off'}`}
                    onClick={() => handleLightToggle(light.id, !light.on)}
                    disabled={!!pendingLights[light.id]}
                    type="button"
                  >
                    {pendingLights[light.id]
                      ? '...'
                      : light.on
                        ? 'Éteindre'
                        : 'Allumer'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {showColorModal && (
        <HueColorModal
          currentColor={status.color}
          currentColorXY={status.colorXY}
          roomName={roomName}
          onClose={() => setShowColorModal(false)}
          onSceneSelect={async (scene) => {
            setLocalBrightness(null);
            setTimeout(() => {
              fetchHueData();
            }, 800);
          }}
        />
      )}
    </div>
  );
}

export default Hue;

