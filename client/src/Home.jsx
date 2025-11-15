import React, { useState, useEffect } from 'react';
import CalendarWidget from './CalendarWidget';
import { API_URL, REFRESH_INTERVAL, MAX_EVENTS_WIDGET } from './constants';

function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = async () => {
    try {
      setError(null);
      const response = await fetch(API_URL);
      const data = await response.json();
      
      if (data.success) {
        // Limit to MAX_EVENTS_WIDGET for the widget
        setEvents((data.events || []).slice(0, MAX_EVENTS_WIDGET));
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
    fetchEvents();
    const interval = setInterval(() => {
      fetchEvents();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="home">
      <div className="home-left">
        <CalendarWidget events={events} loading={loading} error={error} />
      </div>
      <div className="home-right">
        <div className="home-placeholder">
          <p>Widget à venir</p>
        </div>
      </div>
    </div>
  );
}

export default Home;

