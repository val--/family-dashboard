import { useEffect, useRef } from 'react';

/**
 * Hook to enable drag-to-scroll functionality
 * Allows scrolling by dragging with mouse or touch
 */
export function useDragScroll() {
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollLeft = useRef(0);
  const scrollTop = useRef(0);
  const lastTouchY = useRef(0);
  const lastTouchX = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Mouse drag scroll
    const handleMouseDown = (e) => {
      // Only start drag if clicking on empty space or non-interactive elements
      if (e.target.closest('.event-item')) {
        return; // Don't interfere with event items
      }
      
      isDragging.current = true;
      startX.current = e.clientX;
      startY.current = e.clientY;
      scrollLeft.current = container.scrollLeft;
      scrollTop.current = container.scrollTop;
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const x = e.clientX;
      const y = e.clientY;
      const walkX = (x - startX.current) * 1.5;
      const walkY = (y - startY.current) * 1.5;
      container.scrollLeft = scrollLeft.current - walkX;
      container.scrollTop = scrollTop.current - walkY;
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        container.style.cursor = '';
        container.style.userSelect = '';
      }
    };

    const handleMouseLeave = () => {
      if (isDragging.current) {
        isDragging.current = false;
        container.style.cursor = '';
        container.style.userSelect = '';
      }
    };

    // Touch drag scroll - only as fallback if native scroll doesn't work
    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartScrollTop = 0;
    let touchStartScrollLeft = 0;
    let isTouchScrolling = false;

    const handleTouchStart = (e) => {
      // Only handle if single touch and not on interactive element
      if (e.touches.length === 1 && !e.target.closest('.event-item')) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        touchStartScrollTop = container.scrollTop;
        touchStartScrollLeft = container.scrollLeft;
        isTouchScrolling = false;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 1 && !e.target.closest('.event-item')) {
        const touch = e.touches[0];
        const deltaY = touchStartY - touch.clientY;
        const deltaX = touchStartX - touch.clientX;
        
        // If movement is significant, enable manual scrolling
        if (Math.abs(deltaY) > 10 || Math.abs(deltaX) > 10) {
          if (!isTouchScrolling) {
            isTouchScrolling = true;
          }
          e.preventDefault();
          container.scrollTop = touchStartScrollTop + deltaY;
          container.scrollLeft = touchStartScrollLeft + deltaX;
        }
      }
    };

    // Mouse events
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseLeave);

    // Touch events - passive: false only when we need to prevent default
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return containerRef;
}

