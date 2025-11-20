import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HUE_REFRESH_INTERVAL } from '../../constants';

function HueCompactWidget() {
  const navigate = useNavigate();
  const [hueData, setHueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isToggling, setIsToggling] = useState(false);
  const [roomName, setRoomName] = useState('Salon');

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

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (isToggling) return;
    
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
        setTimeout(() => {
          fetchHueData();
        }, 500);
      }
    } catch (err) {
      console.error('Error toggling lights:', err);
    } finally {
      setTimeout(() => {
        setIsToggling(false);
      }, 1000);
    }
  };

  const handleColorClick = (e) => {
    e.stopPropagation();
    navigate('/hue');
  };

  if (loading) {
    return (
      <div className="hue-compact-widget">
        <div className="hue-compact-indicator" style={{ backgroundColor: '#95a5a6' }}></div>
        <div className="hue-compact-toggle">-</div>
      </div>
    );
  }

  if (error || !hueData) {
    return (
      <div className="hue-compact-widget">
        <div className="hue-compact-indicator" style={{ backgroundColor: '#95a5a6' }}></div>
        <div className="hue-compact-toggle">-</div>
      </div>
    );
  }

  const { status } = hueData;
  const isOn = status?.anyOn || false;
  const color = status?.color || '#95a5a6';

  return (
    <>
      <div className="hue-compact-widget">
        <div 
          className={`hue-compact-indicator ${isOn ? 'on' : 'off'}`}
          style={{ backgroundColor: isOn ? color : '#95a5a6' }}
          onClick={handleColorClick}
          title="Cliquer pour ouvrir le widget complet"
        ></div>
        <button 
          className="hue-compact-toggle"
          onClick={handleToggle}
          disabled={isToggling}
          title={isOn ? 'Éteindre' : 'Allumer'}
        >
          {isToggling ? '...' : (isOn ? 'ON' : 'OFF')}
        </button>
      </div>

    </>
  );
}

export default HueCompactWidget;

