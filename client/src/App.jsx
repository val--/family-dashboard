import React, { useState, useEffect, useRef } from 'react';
import Calendar from './Calendar';

// Use Vite proxy in development (works from network too)
// In production, API is served by Express on same domain
const API_URL = '/api/events';

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const appRef = useRef(null);

  // Enable drag-to-scroll - simplified approach
  useEffect(() => {
    const container = appRef.current;
    if (!container) return;

    // Only handle mouse drag, let native touch scrolling work
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const onMouseDown = (e) => {
      if (e.target.closest('a, button, .event-item')) return;
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
  }, []);

  const fetchEvents = async () => {
    try {
      setError(null);
      const response = await fetch(API_URL);
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.events || []);
      } else {
        throw new Error(data.message || 'Failed to fetch events');
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err.message || 'Erreur lors du chargement des événements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately on mount
    fetchEvents();

    // Set up automatic refresh every 10 minutes
    const interval = setInterval(() => {
      fetchEvents();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">
          <h2>Erreur</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app" ref={appRef}>
      <Calendar events={events} />
    </div>
  );
}

export default App;

