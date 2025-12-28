import { createContext, useContext } from 'react';

// Context to share the screensaver activation function
export const ScreensaverContext = createContext(null);

export const useScreensaverContext = () => {
  const context = useContext(ScreensaverContext);
  return context;
};




