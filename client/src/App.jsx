import React, { useState, useEffect } from 'react';
import Calendar from './Calendar';

const API_URL = import.meta.env.PROD 
  ? '/api/events' 
  : 'http://localhost:5000/api/events';

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    <div className="app">
      <Calendar events={events} />
    </div>
  );
}

export default App;

