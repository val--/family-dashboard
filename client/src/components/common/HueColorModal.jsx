import React from 'react';
import { createPortal } from 'react-dom';

// Couleurs basiques avec leurs coordonnées XY CIE 1931 pour Philips Hue
// Coordonnées ajustées pour correspondre aux couleurs réelles des ampoules Hue
// Basées sur le gamut réel des ampoules Hue (gamut B ou C selon le modèle)
// Organisation : teintes naturelles en haut, couleurs fantaisistes en bas
const BASIC_COLORS = [
  // LIGNE 1 : Teintes naturelles (blancs et jaunes)
  // Coordonnées XY ajustées pour le gamut C (éviter les teintes vertes)
  // Gamut C: Rouge(0.692, 0.308), Vert(0.17, 0.7), Bleu(0.153, 0.048)
  { name: 'Blanc froid', xy: { x: 0.3127, y: 0.3290 }, hex: '#F0F8FF' }, // ~6500K D65 (blanc froid, lumière du jour)
  { name: 'Blanc neutre', xy: { x: 0.38, y: 0.38 }, hex: '#FFFFFF' }, // ~4000K (blanc neutre) - ajusté pour gamut C
  { name: 'Blanc chaud', xy: { x: 0.46, y: 0.41 }, hex: '#FFF4E6' }, // ~2700K (blanc chaud) - ajusté pour gamut C
  { name: 'Jaune pâle', xy: { x: 0.48, y: 0.46 }, hex: '#FFFACD' }, // Jaune très doux - ajusté pour gamut C
  { name: 'Jaune', xy: { x: 0.48, y: 0.50 }, hex: '#FFD700' }, // Jaune standard - ajusté pour gamut C
  
  // LIGNE 2 : Teintes naturelles (oranges)
  // Coordonnées XY ajustées pour le gamut C (éviter les teintes vertes)
  { name: 'Orange clair', xy: { x: 0.56, y: 0.40 }, hex: '#FFB84D' }, // Orange doux - ajusté pour gamut C
  { name: 'Orange', xy: { x: 0.58, y: 0.38 }, hex: '#FF8C00' }, // Orange standard - ajusté pour gamut C
  { name: 'Orange foncé', xy: { x: 0.61, y: 0.35 }, hex: '#FF7F00' }, // Orange plus intense - ajusté pour gamut C
  { name: 'Ambre', xy: { x: 0.57, y: 0.39 }, hex: '#FFBF00' }, // Ambre/orange doré - ajusté pour gamut C
  { name: 'Rouge orangé', xy: { x: 0.65, y: 0.32 }, hex: '#FF4500' }, // Transition vers le rouge - ajusté pour gamut C
  
  // LIGNE 3 : Couleurs fantaisistes
  { name: 'Rouge', xy: { x: 0.675, y: 0.322 }, hex: '#FF0000' },
  { name: 'Rose', xy: { x: 0.5573, y: 0.3226 }, hex: '#FF69B4' },
  { name: 'Magenta', xy: { x: 0.381, y: 0.196 }, hex: '#FF00FF' },
  { name: 'Vert', xy: { x: 0.17, y: 0.7 }, hex: '#00FF00' },
  { name: 'Cyan', xy: { x: 0.1532, y: 0.0475 }, hex: '#00FFFF' },
  
  // LIGNE 4 : Couleurs fantaisistes (suite)
  { name: 'Bleu', xy: { x: 0.15, y: 0.06 }, hex: '#0000FF' },
];

function HueColorModal({ currentColor, currentColorXY, onClose, onColorSelect }) {
  const handleColorClick = (color) => {
    onColorSelect(color.xy);
  };

  // Helper to check if a color is currently selected
  // Use XY coordinates if available (more accurate), otherwise fallback to RGB comparison
  // Returns the closest color only (to avoid multiple selections)
  const isColorSelected = (color) => {
    if (!currentColor) return false;
    
    // If we have XY coordinates, compare those directly (most accurate)
    if (currentColorXY && currentColorXY.x !== undefined && currentColorXY.y !== undefined) {
      // Calculate distance for all colors and find the closest one
      const distances = BASIC_COLORS.map(c => {
        const xyDistance = Math.sqrt(
          Math.pow(currentColorXY.x - c.xy.x, 2) +
          Math.pow(currentColorXY.y - c.xy.y, 2)
        );
        return { color: c, distance: xyDistance };
      });
      
      // Find the closest color
      const closest = distances.reduce((min, curr) => 
        curr.distance < min.distance ? curr : min
      );
      
      // Only select if this is the closest color AND within a reasonable threshold
      // Use a tighter threshold (0.02) to avoid matching multiple colors
      return color.name === closest.color.name && closest.distance < 0.02;
    }
    
    // Fallback: RGB distance check (only if XY not available)
    const currentR = parseInt(currentColor.slice(1, 3), 16);
    const currentG = parseInt(currentColor.slice(3, 5), 16);
    const currentB = parseInt(currentColor.slice(5, 7), 16);
    
    // Calculate distance for all colors and find the closest one
    const distances = BASIC_COLORS.map(c => {
      const colorR = parseInt(c.hex.slice(1, 3), 16);
      const colorG = parseInt(c.hex.slice(3, 5), 16);
      const colorB = parseInt(c.hex.slice(5, 7), 16);
      
      const distance = Math.sqrt(
        Math.pow(currentR - colorR, 2) +
        Math.pow(currentG - colorG, 2) +
        Math.pow(currentB - colorB, 2)
      );
      return { color: c, distance };
    });
    
    // Find the closest color
    const closest = distances.reduce((min, curr) => 
      curr.distance < min.distance ? curr : min
    );
    
    // Only select if this is the closest color AND within a reasonable threshold
    return color.name === closest.color.name && closest.distance < 30;
  };

  const modalContent = (
    <div className="hue-color-modal-overlay" onClick={onClose}>
      <div className="hue-color-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hue-color-modal-header">
          <h3>Choisir une couleur</h3>
          <button className="hue-color-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="hue-color-modal-content">
          <div className="hue-color-grid">
            {BASIC_COLORS.map((color, index) => (
              <button
                key={index}
                className="hue-color-item"
                style={{ backgroundColor: color.hex }}
                onClick={() => handleColorClick(color)}
                title={color.name}
              >
                {isColorSelected(color) && (
                  <span className="hue-color-selected">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal in a portal to body to avoid positioning issues
  return createPortal(modalContent, document.body);
}

export default HueColorModal;

