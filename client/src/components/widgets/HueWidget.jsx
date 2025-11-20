import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HUE_REFRESH_INTERVAL } from '../../constants';
import HueColorModal from '../common/HueColorModal';

function HueWidget() {
  const navigate = useNavigate();
  const [hueData, setHueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isToggling, setIsToggling] = useState(false);
  const [roomName, setRoomName] = useState('Salon');
  const [waveAnimation, setWaveAnimation] = useState(null);
  const [buttonText, setButtonText] = useState(null);
  const [isAdjustingBrightness, setIsAdjustingBrightness] = useState(false);
  const [localBrightness, setLocalBrightness] = useState(null);
  const [showColorModal, setShowColorModal] = useState(false);

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
      <div className="hue-widget">
        <div className="hue-widget-header">
          <h2 className="hue-widget-title">Lumières {roomName}</h2>
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
          <h2 className="hue-widget-title">Lumières {roomName}</h2>
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
          <h2 className="hue-widget-title">Lumières {roomName}</h2>
        </div>
        <div className="hue-widget-content">
          <div className="hue-widget-empty">Aucune donnée disponible</div>
        </div>
      </div>
    );
  }

  const { room, status } = hueData;
  const displayRoomName = room?.name || roomName;

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (isToggling) return;
    
    const currentText = hueData?.status?.anyOn ? 'Éteindre' : 'Allumer';
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

  const handleBrightnessChange = async (e) => {
    e.stopPropagation();
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
    <div className="hue-widget hue-widget-clickable" onClick={() => navigate('/hue')}>
      <div 
        className="hue-widget-header"
        style={status.color && status.anyOn ? { '--hue-color': status.color } : {}}
      >
        <h2 className="hue-widget-title">Lumières {displayRoomName}</h2>
              <div className="hue-widget-header-count">
                 {status.lightsOn} / {status.lightsCount} lumières
               </div>
      </div>
      <div className="hue-widget-content">
        <div className="hue-status">
          <div className="hue-status-main">
            <div 
              className={`hue-status-indicator ${status.allOn ? 'on' : status.anyOn ? 'partial' : 'off'} ${status.anyOn ? 'hue-status-indicator-clickable' : ''}`}
              style={status.color && status.anyOn ? { 
                backgroundColor: status.color
              } : {}}
              onClick={status.anyOn ? (e) => {
                e.stopPropagation();
                setShowColorModal(true);
              } : undefined}
              title={status.allOn ? 'Toutes allumées' : status.anyOn ? 'Partiellement allumées' : 'Toutes éteintes'}
            />
            <div className="hue-status-text">
              <div className="hue-status-state">
                {status.allOn ? 'Toutes allumées' : status.anyOn ? 'Partiellement allumées' : 'Toutes éteintes'}
              </div>
              <div className={`hue-status-brightness ${status.anyOn ? '' : 'hue-status-brightness-hidden'}`}>
                Luminosité: {status.brightness}%
              </div>
            </div>
          </div>
        </div>
        <div 
          className={`hue-brightness-control ${!status.anyOn ? 'hue-brightness-control-disabled' : ''}`} 
          onClick={(e) => e.stopPropagation()}
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
          className={`hue-toggle-button ${waveAnimation ? `hue-toggle-button-${waveAnimation}` : ''}`}
          onClick={handleToggle}
          disabled={isToggling}
          style={status.color && status.anyOn ? { '--hue-color': status.color } : {}}
        >
          {buttonText !== null ? buttonText : (status.anyOn ? 'Éteindre' : 'Allumer')}
        </button>
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

export default HueWidget;

