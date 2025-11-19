import React, { useState, useEffect, useRef } from 'react';

/**
 * Composant d'écran de veille
 * Affiche un écran noir avec l'heure au centre
 */
function Screensaver({ onExit }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const shouldExitRef = useRef(false);

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

  useEffect(() => {
    const stopEvent = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }
      return false;
    };

    const handlePointerDownCapture = (event) => {
      stopEvent(event);
      shouldExitRef.current = true;
      return false;
    };

    const handlePointerUpCapture = (event) => {
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
      stopEvent(event);
      return false;
    };

    const handleMouseDownCapture = (event) => {
      stopEvent(event);
      shouldExitRef.current = true;
      return false;
    };

    const handleMouseUpCapture = (event) => {
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
      stopEvent(event);
      shouldExitRef.current = true;
      return false;
    };

    const handleTouchEndCapture = (event) => {
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
    </div>
  );
}

export default Screensaver;
