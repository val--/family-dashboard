import React, { useRef, useEffect } from 'react';
import Home from '../pages/Home';

/**
 * Composant pour gérer la navigation horizontale entre les pages du dashboard
 * Swipe désactivé - navigation par boutons uniquement
 */
function DashboardPages() {
  const containerRef = useRef(null);

  // Mettre à jour la position lors du changement de page
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transform = `translateX(0%)`;
    }
  }, []);

  return (
    <div className="dashboard-pages">
      <div className="dashboard-pages-container" ref={containerRef}>
        <div className="dashboard-page">
          <Home />
        </div>
      </div>
    </div>
  );
}

export default DashboardPages;

