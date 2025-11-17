import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Helper function to convert XY to RGB (same logic as server)
function xyToRgb(x, y) {
  // Clamp x and y to valid range
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  
  // Avoid division by zero
  if (y === 0) {
    return '#FFFFFF'; // Default to white if invalid
  }
  
  // Convert XY to XYZ (CIE 1931 color space)
  // Using standard D65 white point (x=0.3127, y=0.3290)
  // Y is set to 1.0 for full brightness
  const Y = 1.0;
  const X = (x / y) * Y;
  const Z = ((1.0 - x - y) / y) * Y;
  
  // Convert XYZ to linear RGB using sRGB matrix (D65 white point)
  // Matrix from: http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
  let r = X *  3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  let g = X * -0.9692660 + Y *  1.8760108 + Z *  0.0415560;
  let b = X *  0.0556434 + Y * -0.2040259 + Z *  1.0572252;
  
  // Apply gamma correction (sRGB gamma curve)
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
  
  // Clamp values to 0-1 range, then convert to 0-255
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  b = Math.max(0, Math.min(1, b));
  
  // Convert to 0-255 and round
  const r255 = Math.round(r * 255);
  const g255 = Math.round(g * 255);
  const b255 = Math.round(b * 255);
  
  // Convert to hex
  return `#${r255.toString(16).padStart(2, '0')}${g255.toString(16).padStart(2, '0')}${b255.toString(16).padStart(2, '0')}`;
}

function HueColorModal({ currentColor, currentColorXY, roomName, onClose, onSceneSelect }) {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchScenes = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/hue/room/scenes?room=${roomName || 'Salon'}`);
        const data = await response.json();
        
        if (data.success && data.scenes) {
          // Convert XY colors to hex for display
          const scenesWithHex = data.scenes.map(scene => {
            const primaryHex = scene.color ? xyToRgb(scene.color.x, scene.color.y) : '#FFFFFF';
            // Convert all colors for gradient
            const colorHexes = scene.colors && scene.colors.length > 0
              ? scene.colors.map(c => xyToRgb(c.x, c.y))
              : [primaryHex];
            
            return {
              ...scene,
              hex: primaryHex,
              colorHexes: colorHexes // Array of hex colors for gradient
            };
          });
          setScenes(scenesWithHex);
        } else {
          setError(data.error || 'Failed to fetch scenes');
        }
      } catch (err) {
        setError('Failed to fetch scenes');
        console.error('Error fetching scenes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchScenes();
  }, [roomName]);

  const handleSceneClick = async (scene) => {
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
        onSceneSelect(scene);
        // Close modal after a short delay to show the change
        setTimeout(() => {
          onClose();
        }, 300);
      }
    } catch (err) {
      console.error('Error activating scene:', err);
    }
  };

  // Helper to check if a scene is currently active
  // First check if the API reports it as active, otherwise use color matching
  const isSceneActive = (scene) => {
    // If API reports scene as active, use that (most reliable)
    if (scene.active === true) {
      return true;
    }
    
    // Fallback: compare colors, but only select the closest one
    if (!currentColorXY || !scene.color) return false;
    
    // Calculate XY distance for all scenes and find the closest one
    const allDistances = scenes.map(s => {
      if (!s.color) return { scene: s, distance: Infinity };
      const dist = Math.sqrt(
        Math.pow(currentColorXY.x - s.color.x, 2) +
        Math.pow(currentColorXY.y - s.color.y, 2)
      );
      return { scene: s, distance: dist };
    });
    
    // Find the closest scene
    const closest = allDistances.reduce((min, curr) => 
      curr.distance < min.distance ? curr : min
    );
    
    // Only select if this is the closest scene AND within a reasonable threshold
    // Use a tighter threshold (0.03) to avoid matching multiple scenes
    return scene.id === closest.scene.id && closest.distance < 0.03;
  };

  const modalContent = (
    <div className="hue-color-modal-overlay" onClick={onClose}>
      <div className="hue-color-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hue-color-modal-header">
          <h3>Choisir un scénario</h3>
          <button className="hue-color-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="hue-color-modal-content">
          {loading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              Chargement des scénarios...
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#e74c3c' }}>
              Erreur: {error}
            </div>
          )}
          {!loading && !error && scenes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              Aucun scénario disponible
            </div>
          )}
          {!loading && !error && scenes.length > 0 && (
            <div className="hue-color-grid">
              {scenes.map((scene) => {
                // Create gradient if multiple colors available
                const backgroundStyle = scene.colorHexes && scene.colorHexes.length > 1
                  ? {
                      background: `linear-gradient(135deg, ${scene.colorHexes.join(', ')})`
                    }
                  : {
                      backgroundColor: scene.hex || '#FFFFFF'
                    };
                
                return (
                  <button
                    key={scene.id}
                    className="hue-color-item"
                    style={backgroundStyle}
                    onClick={() => handleSceneClick(scene)}
                    title={scene.name}
                  >
                    <span className="hue-scene-name">{scene.name}</span>
                    {isSceneActive(scene) && (
                      <span className="hue-color-selected">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render modal in a portal to body to avoid positioning issues
  return createPortal(modalContent, document.body);
}

export default HueColorModal;

