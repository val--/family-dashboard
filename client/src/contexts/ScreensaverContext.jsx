import { createContext, useContext } from 'react';

// Contexte pour partager la fonction d'activation du screensaver
export const ScreensaverContext = createContext(null);

export const useScreensaverContext = () => {
  const context = useContext(ScreensaverContext);
  return context;
};


