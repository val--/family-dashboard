import React, { useState, useEffect } from 'react';
import CalendarWidget from './CalendarWidget';
import ElectricityWidget from './ElectricityWidget';
import { API_URL, REFRESH_INTERVAL, MAX_EVENTS_WIDGET } from './constants';

function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [electricityData, setElectricityData] = useState(null);
  const [electricityLoading, setElectricityLoading] = useState(true);
  const [electricityError, setElectricityError] = useState(null);

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

  const fetchElectricity = async () => {
    try {
      setElectricityError(null);
      // Request 7 days for the widget (default)
      const response = await fetch('/api/electricity');
      const result = await response.json();
      
      if (result.success) {
        setElectricityData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch electricity data');
      }
    } catch (err) {
      console.error('Error fetching electricity:', err);
      setElectricityError(err.message || 'Erreur lors du chargement des données électriques');
    } finally {
      setElectricityLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchElectricity();
    
    const eventsInterval = setInterval(() => {
      fetchEvents();
    }, REFRESH_INTERVAL);

    const electricityInterval = setInterval(() => {
      fetchElectricity();
    }, REFRESH_INTERVAL);

    return () => {
      clearInterval(eventsInterval);
      clearInterval(electricityInterval);
    };
  }, []);

  return (
    <div className="home">
      <div className="home-left">
        <CalendarWidget events={events} loading={loading} error={error} />
      </div>
      <div className="home-right">
        <ElectricityWidget 
          data={electricityData} 
          loading={electricityLoading} 
          error={electricityError}
          compact={true}
        />
      </div>
    </div>
  );
}

export default Home;

