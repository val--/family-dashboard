import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HUE_REFRESH_INTERVAL } from '../../constants';

// Helper function to convert XY to RGB (same logic as server)
function xyToRgb(x, y) {
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  
  if (y === 0) {
    return '#FFFFFF';
  }
  
  const Y = 1.0;
  const X = (x / y) * Y;
  const Z = ((1.0 - x - y) / y) * Y;
  
  let r = X *  3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  let g = X * -0.9692660 + Y *  1.8760108 + Z *  0.0415560;
  let b = X *  0.0556434 + Y * -0.2040259 + Z *  1.0572252;
  
  const gammaCorrection = (val) => {
    if (val <= 0.0031308) {
      return 12.92 * val;
    } else {
      return 1.055 * Math.pow(val, 1.0 / 2.4) - 0.055;
    }
  };
  
  r = gammaCorrection(r);
  g = gammaCorrection(g);
  b = gammaCorrection(b);
  
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  b = Math.max(0, Math.min(1, b));
  
  const r255 = Math.round(r * 255);
  const g255 = Math.round(g * 255);
  const b255 = Math.round(b * 255);
  
  return `#${r255.toString(16).padStart(2, '0')}${g255.toString(16).padStart(2, '0')}${b255.toString(16).padStart(2, '0')}`;
}

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
  const [pendingLights, setPendingLights] = useState({});
  const [localLightBrightness, setLocalLightBrightness] = useState({});
  const [adjustingLightBrightness, setAdjustingLightBrightness] = useState({});
  const [scenes, setScenes] = useState([]);
  const [scenesLoading, setScenesLoading] = useState(true);
  const [scenesError, setScenesError] = useState(null);
  const [activatingScene, setActivatingScene] = useState(null);

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

  const fetchScenes = async () => {
    try {
      setScenesError(null);
      setScenesLoading(true);
      const response = await fetch(`/api/hue/room/scenes?room=${encodeURIComponent(roomName)}`);
      const data = await response.json();
      
      if (data.success && data.scenes) {
        const scenesWithHex = data.scenes.map(scene => {
          const primaryHex = scene.color ? xyToRgb(scene.color.x, scene.color.y) : '#FFFFFF';
          const colorHexes = scene.colors && scene.colors.length > 0
            ? scene.colors.map(c => xyToRgb(c.x, c.y))
            : [primaryHex];
          
          return {
            ...scene,
            hex: primaryHex,
            colorHexes: colorHexes
          };
        });
        setScenes(scenesWithHex);
      } else {
        throw new Error(data.error || 'Failed to fetch scenes');
      }
    } catch (err) {
      setScenesError(err.message || 'Erreur lors du chargement des scénarios');
      console.error('Error fetching scenes:', err);
    } finally {
      setScenesLoading(false);
    }
  };

  useEffect(() => {
    if (roomName) {
      fetchScenes();
    }
  }, [roomName]);

  // Synchroniser la luminosité locale avec les données reçues
  useEffect(() => {
    if (hueData?.lights) {
      hueData.lights.forEach(light => {
        if (!adjustingLightBrightness[light.id] && localLightBrightness[light.id] === undefined) {
          setLocalLightBrightness((prev) => ({
            ...prev,
            [light.id]: light.brightness
          }));
        } else if (!adjustingLightBrightness[light.id] && Math.abs((localLightBrightness[light.id] || 0) - light.brightness) > 5) {
          setLocalLightBrightness((prev) => ({
            ...prev,
            [light.id]: light.brightness
          }));
        }
      });
    }
  }, [hueData, adjustingLightBrightness]);

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
        fetchScenes();
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

  const handleLightBrightnessChange = async (lightId, brightness) => {
    if (!lightId || adjustingLightBrightness[lightId]) return;

    setLocalLightBrightness((prev) => ({ ...prev, [lightId]: brightness }));
    setAdjustingLightBrightness((prev) => ({ ...prev, [lightId]: true }));

    try {
      const response = await fetch('/api/hue/light/brightness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lightId,
          brightness: brightness,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to set light brightness');
      }

      setTimeout(() => {
        fetchHueData();
        fetchScenes();
      }, 300);
    } catch (err) {
      console.error('Error setting light brightness:', err);
      // Revert to original brightness on error
      if (hueData?.lights) {
        const light = hueData.lights.find(l => l.id === lightId);
        if (light) {
          setLocalLightBrightness((prev) => ({ ...prev, [lightId]: light.brightness }));
        }
      }
    } finally {
      setTimeout(() => {
        setAdjustingLightBrightness((prev) => {
          const updated = { ...prev };
          delete updated[lightId];
          return updated;
        });
      }, 500);
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

  const handleSceneClick = async (scene) => {
    if (activatingScene === scene.id) return;
    
    setActivatingScene(scene.id);
    try {
      const response = await fetch('/api/hue/scene/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sceneId: scene.id }),
      });
      
      const result = await response.json();
      if (result.success) {
        setLocalBrightness(null);
        setTimeout(() => {
          fetchHueData();
          fetchScenes();
        }, 800);
      }
    } catch (err) {
      console.error('Error activating scene:', err);
    } finally {
      setTimeout(() => {
        setActivatingScene(null);
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
              <div 
                className={`hue-status-indicator hue-status-indicator-clickable ${status.allOn ? 'on' : status.anyOn ? 'partial' : 'off'}`}
                style={status.color && status.anyOn ? { 
                  backgroundColor: status.color
                } : {}}
                onClick={handleToggle}
                title={status.allOn ? 'Toutes allumées - Cliquer pour éteindre' : status.anyOn ? 'Partiellement allumées - Cliquer pour éteindre' : 'Toutes éteintes - Cliquer pour allumer'}
              >
                {isToggling ? (
                  <span className="hue-status-loading">⋯</span>
                ) : status.anyOn ? (
                  <svg className="hue-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg className="hue-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    <line x1="20" y1="4" x2="4" y2="20"></line>
                  </svg>
                )}
              </div>
              <div className="hue-status-text">
                <div className="hue-status-state">
                  {status.allOn ? 'Toutes allumées' : status.anyOn ? 'Partiellement allumées' : 'Toutes éteintes'}
                </div>
                <div className={`hue-status-brightness ${status.anyOn ? '' : 'hue-status-brightness-hidden'}`}>
                  {status.brightness}%
                </div>
              </div>
              <div className="hue-lights-count">
                {status.lightsOn}/{status.lightsCount}
              </div>
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
          
          <div className="hue-sections-container">
            <div className="hue-scenes-section">
              <h3 className="hue-scenes-title">Scénarios</h3>
              {scenesLoading && (
                <div className="hue-scenes-loading">Chargement des scénarios...</div>
              )}
              {scenesError && (
                <div className="hue-scenes-error">{scenesError}</div>
              )}
              {!scenesLoading && !scenesError && scenes.length === 0 && (
                <div className="hue-scenes-empty">Aucun scénario disponible</div>
              )}
              {!scenesLoading && !scenesError && scenes.length > 0 && (
                <div className="hue-scenes-grid">
                  {scenes.map((scene) => {
                    const backgroundStyle = scene.colorHexes && scene.colorHexes.length > 1
                      ? {
                          background: `linear-gradient(135deg, ${scene.colorHexes.join(', ')})`
                        }
                      : {
                          backgroundColor: scene.hex || '#FFFFFF'
                        };
                    
                    const isActivating = activatingScene === scene.id;
                    
                    return (
                      <button
                        key={scene.id}
                        className={`hue-scene-item ${isActivating ? 'hue-scene-activating' : ''}`}
                        onClick={() => handleSceneClick(scene)}
                        disabled={isActivating}
                        title={scene.name}
                      >
                        <div 
                          className="hue-scene-circle"
                          style={backgroundStyle}
                        >
                          {isActivating && (
                            <span className="hue-scene-loading">⋯</span>
                          )}
                        </div>
                        <span className="hue-scene-name">{scene.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {lights && lights.length > 0 && (
              <div className="hue-lights-section">
                <h3 className="hue-lights-title">Lumières individuelles</h3>
                <div className="hue-lights-list-page">
                {lights.map((light) => {
                  // La propriété light.on indique si la lumière est allumée (true = allumée, false = éteinte)
                  const isLightOn = light.on === true;
                  
                  // Convertir les coordonnées XY en couleur hexadécimale si la lumière est allumée
                  let lightColorHex = null;
                  if (isLightOn && light.color && light.color.xy) {
                    const xy = light.color.xy;
                    // Gérer les deux formats : [x, y] ou {x, y}
                    if (Array.isArray(xy) && xy.length >= 2) {
                      lightColorHex = xyToRgb(xy[0], xy[1]);
                    } else if (xy && typeof xy.x !== 'undefined' && typeof xy.y !== 'undefined') {
                      lightColorHex = xyToRgb(xy.x, xy.y);
                    }
                  }
                  
                  const currentBrightness = localLightBrightness[light.id] !== undefined 
                    ? localLightBrightness[light.id] 
                    : (light.brightness || 0);
                  
                  return (
                    <div key={light.id} className="hue-light-item-page">
                      <div className="hue-light-item-left">
                        <div 
                          className={`hue-light-indicator-page ${isLightOn ? 'on' : 'off'} ${pendingLights[light.id] ? 'hue-light-indicator-loading' : 'hue-light-indicator-clickable'}`}
                          style={lightColorHex ? { backgroundColor: lightColorHex } : {}}
                          onClick={() => !pendingLights[light.id] && handleLightToggle(light.id, !isLightOn)}
                          title={isLightOn ? 'Cliquer pour éteindre' : 'Cliquer pour allumer'}
                        >
                          {pendingLights[light.id] ? (
                            <span className="hue-light-onoff-text">⋯</span>
                          ) : (
                            <span className="hue-light-onoff-text">
                              {isLightOn ? 'ON' : 'OFF'}
                            </span>
                          )}
                        </div>
                        <div className="hue-light-info">
                          <div className="hue-light-name-page">{light.name}</div>
                          {isLightOn && (
                            <div className="hue-light-brightness-page">{currentBrightness}%</div>
                          )}
                        </div>
                      </div>
                      {isLightOn && (
                        <div className="hue-light-brightness-control-page">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={currentBrightness}
                            onChange={(e) => {
                              const newBrightness = parseInt(e.target.value, 10);
                              setLocalLightBrightness((prev) => ({ ...prev, [light.id]: newBrightness }));
                              handleLightBrightnessChange(light.id, newBrightness);
                            }}
                            className="hue-light-brightness-slider-page"
                            disabled={!!adjustingLightBrightness[light.id]}
                            style={lightColorHex ? { '--hue-color': lightColorHex } : {}}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
      
    </div>
  );
}

export default Hue;

