import React, { useState, useEffect } from 'react';

/**
 * Composant d'écran de veille
 * Affiche un écran noir avec l'heure au centre
 */
function Screensaver() {
  const [currentTime, setCurrentTime] = useState(new Date());

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

  return (
    <div className="screensaver">
      <div className="screensaver-content">
        <div className="screensaver-time">{formatTime(currentTime)}</div>
        <div className="screensaver-date">{formatDate(currentTime)}</div>
      </div>
    </div>
  );
}

export default Screensaver;
