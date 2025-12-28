import { useEffect, useRef } from 'react';

/**
 * Simple hook to enable vertical drag-to-scroll with the mouse
 * @param {string|string[]} ignoreSelectors - CSS selectors to ignore (e.g.: 'a, button, .event-item')
 * @returns {React.RefObject} - Reference to attach to the container
 */
export function useSimpleDragScroll(ignoreSelectors = 'a, button') {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Convert ignoreSelectors to array if it's a string
    const selectors = Array.isArray(ignoreSelectors) 
      ? ignoreSelectors 
      : ignoreSelectors.split(',').map(s => s.trim());

    // Only handle mouse drag, let native touch scrolling work
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const onMouseDown = (e) => {
      // Check if the click is on an element to ignore
      const shouldIgnore = selectors.some(selector => {
        try {
          return e.target.closest(selector);
        } catch (err) {
          // If the selector is invalid, ignore it
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





