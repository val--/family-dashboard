import { useEffect, useRef } from 'react';

/**
 * Hook simple pour activer le drag-to-scroll vertical avec la souris
 * @param {string|string[]} ignoreSelectors - Sélecteurs CSS à ignorer (ex: 'a, button, .event-item')
 * @returns {React.RefObject} - Référence à attacher au conteneur
 */
export function useSimpleDragScroll(ignoreSelectors = 'a, button') {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Convertir ignoreSelectors en tableau si c'est une string
    const selectors = Array.isArray(ignoreSelectors) 
      ? ignoreSelectors 
      : ignoreSelectors.split(',').map(s => s.trim());

    // Only handle mouse drag, let native touch scrolling work
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const onMouseDown = (e) => {
      // Vérifier si le clic est sur un élément à ignorer
      const shouldIgnore = selectors.some(selector => {
        try {
          return e.target.closest(selector);
        } catch (err) {
          // Si le sélecteur est invalide, on l'ignore
          return false;
        }
      });

      if (shouldIgnore) return;

      isDragging = true;
      startY = e.clientY;
      startScrollTop = container.scrollTop;
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaY = e.clientY - startY;
      container.scrollTop = startScrollTop - deltaY;
      e.preventDefault();
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        container.style.cursor = '';
        container.style.userSelect = '';
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [ignoreSelectors]);

  return containerRef;
}




