import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Home from '../pages/Home';

/**
 * Composant pour gérer la navigation horizontale entre les pages du dashboard
 * Permet de swiper entre la page 1 et la page 2
 */
function DashboardPages() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);

  // Gestion du swipe tactile
  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = startXRef.current;
    isDraggingRef.current = true;
    setIsTransitioning(false);
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    
    currentXRef.current = e.touches[0].clientX;
    const deltaX = currentXRef.current - startXRef.current;
    
    // Empêcher le scroll vertical si on swipe horizontalement
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
    }
    
    if (containerRef.current) {
      const translateX = -currentPage * 100 + (deltaX / window.innerWidth) * 100;
      containerRef.current.style.transform = `translateX(${translateX}%)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    
    isDraggingRef.current = false;
    setIsTransitioning(true);
    
    const deltaX = currentXRef.current - startXRef.current;
    const threshold = window.innerWidth * 0.2; // 20% de la largeur pour déclencher le changement
    
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      } else if (deltaX < 0 && currentPage < 1) {
        // Naviguer vers /spotify au lieu d'afficher HomePage2 directement
        navigate('/spotify');
      } else {
        // Retour à la position actuelle
        if (containerRef.current) {
          containerRef.current.style.transform = `translateX(-${currentPage * 100}%)`;
        }
      }
    } else {
      // Retour à la position actuelle
      if (containerRef.current) {
        containerRef.current.style.transform = `translateX(-${currentPage * 100}%)`;
      }
    }
  };

  // Gestion du swipe à la souris (pour développement/desktop)
  const handleMouseDown = (e) => {
    startXRef.current = e.clientX;
    currentXRef.current = startXRef.current;
    isDraggingRef.current = true;
    setIsTransitioning(false);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    
    currentXRef.current = e.clientX;
    const deltaX = currentXRef.current - startXRef.current;
    
    if (containerRef.current) {
      const translateX = -currentPage * 100 + (deltaX / window.innerWidth) * 100;
      containerRef.current.style.transform = `translateX(${translateX}%)`;
    }
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    
    isDraggingRef.current = false;
    setIsTransitioning(true);
    
    const deltaX = currentXRef.current - startXRef.current;
    const threshold = window.innerWidth * 0.2;
    
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      } else if (deltaX < 0 && currentPage < 1) {
        // Naviguer vers /spotify au lieu d'afficher HomePage2 directement
        navigate('/spotify');
      } else {
        if (containerRef.current) {
          containerRef.current.style.transform = `translateX(-${currentPage * 100}%)`;
        }
      }
    } else {
      if (containerRef.current) {
        containerRef.current.style.transform = `translateX(-${currentPage * 100}%)`;
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Touch events
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Mouse events (pour développement)
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [currentPage]);

  // Mettre à jour la position lors du changement de page
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transform = `translateX(-${currentPage * 100}%)`;
    }
  }, [currentPage]);

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

