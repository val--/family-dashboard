import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer l'écran de veille
 * @param {number} idleTime - Temps d'inactivité en millisecondes avant d'activer l'écran de veille (défaut: 5000ms)
 * @returns {boolean} - true si l'écran de veille doit être affiché, false sinon
 */
export function useScreensaver(idleTime = 5000) {
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const timeoutRef = useRef(null);
  const isScreensaverActiveRef = useRef(false);

  // Synchroniser la ref avec l'état
  useEffect(() => {
    isScreensaverActiveRef.current = isScreensaverActive;
  }, [isScreensaverActive]);

  const resetTimer = useCallback(() => {
    // Réinitialiser le timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Programmer l'activation de l'écran de veille
    timeoutRef.current = setTimeout(() => {
      setIsScreensaverActive(true);
    }, idleTime);
  }, [idleTime]);

  const exitScreensaver = useCallback(() => {
    // Désactiver l'écran de veille et synchroniser la ref immédiatement
    isScreensaverActiveRef.current = false;
    setIsScreensaverActive(false);

    // Réinitialiser le timer sur la frame suivante pour garantir la mise à jour
    requestAnimationFrame(() => {
      resetTimer();
    });
  }, [resetTimer]);

  useEffect(() => {
    // Ne rien écouter lorsque l'écran de veille est actif
    if (isScreensaverActive) {
      return;
    }

    // Événements à écouter pour détecter l'activité
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'touchmove',
      'click',
    ];

    // Ajouter les écouteurs d'événements
    events.forEach((event) => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    // Initialiser le timer
    resetTimer();

    // Nettoyer les écouteurs et le timer au démontage
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [idleTime, resetTimer, isScreensaverActive]);

  return {
    isScreensaverActive,
    registerActivity: exitScreensaver,
  };
}

