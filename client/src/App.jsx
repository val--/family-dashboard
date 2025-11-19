import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Calendar from './components/pages/Calendar';
import Home from './components/pages/Home';
import Electricity from './components/pages/Electricity';
import Weather from './components/pages/Weather';
import Hue from './components/pages/Hue';
import Screensaver from './components/common/Screensaver';
import { useScreensaver } from './hooks/useScreensaver';

import { API_URL, REFRESH_INTERVAL, SCREENSAVER_IDLE_TIME } from './constants';

function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const appRef = useRef(null);
  const navigate = useNavigate();

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

function ElectricityPage() {
  const [electricityData, setElectricityData] = useState(null);
  const [electricityLoading, setElectricityLoading] = useState(true);
  const [electricityError, setElectricityError] = useState(null);
  const appRef = useRef(null);
  const navigate = useNavigate();

  // Enable drag-to-scroll - simplified approach
  useEffect(() => {
    const container = appRef.current;
    if (!container) return;

    // Only handle mouse drag, let native touch scrolling work
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const onMouseDown = (e) => {
      if (e.target.closest('a, button, .electricity-stat-card')) return;
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

  const fetchElectricity = async () => {
    try {
      setElectricityError(null);
      // Request 15 days for the full page
      const response = await fetch('/api/electricity?dailyChartDays=15');
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
    // Fetch immediately on mount
    fetchElectricity();

    // Set up automatic refresh
    const interval = setInterval(() => {
      fetchElectricity();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  if (electricityLoading) {
    return (
      <div className="app">
        <div className="loading">Chargement...</div>
      </div>
    );
  }

  if (electricityError) {
    return (
      <div className="app">
        <div className="error">
          <h2>Erreur</h2>
          <p>{electricityError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app" ref={appRef}>
      <Electricity data={electricityData} loading={electricityLoading} error={electricityError} />
    </div>
  );
}

function WeatherPage() {
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(null);
  const appRef = useRef(null);
  const navigate = useNavigate();

  // Enable drag-to-scroll - simplified approach
  useEffect(() => {
    const container = appRef.current;
    if (!container) return;

    // Only handle mouse drag, let native touch scrolling work
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const onMouseDown = (e) => {
      if (e.target.closest('a, button, .weather-page-hourly-item')) return;
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

  const fetchWeather = async () => {
    try {
      setWeatherError(null);
      const response = await fetch('/api/weather');
      const result = await response.json();
      
      if (result.success) {
        setWeatherData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch weather data');
      }
    } catch (err) {
      console.error('Error fetching weather:', err);
      setWeatherError(err.message || 'Erreur lors du chargement de la météo');
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately on mount
    fetchWeather();

    // Set up automatic refresh
    const interval = setInterval(() => {
      fetchWeather();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app" ref={appRef}>
      <Weather data={weatherData} loading={weatherLoading} error={weatherError} />
    </div>
  );
}

function HuePage() {
  const appRef = useRef(null);
  const navigate = useNavigate();

  // Enable drag-to-scroll - simplified approach
  useEffect(() => {
    const container = appRef.current;
    if (!container) return;

    // Only handle mouse drag, let native touch scrolling work
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const onMouseDown = (e) => {
      if (e.target.closest('a, button, .hue-light-item, .hue-brightness-slider')) return;
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

  return (
    <div className="app" ref={appRef}>
      <Hue />
    </div>
  );
}

function App() {
  // Activer l'écran de veille après le délai d'inactivité configuré
  const { isScreensaverActive, registerActivity } = useScreensaver(SCREENSAVER_IDLE_TIME);

  return (
    <Router>
      {isScreensaverActive && <Screensaver onExit={registerActivity} />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/electricity" element={<ElectricityPage />} />
        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/hue" element={<HuePage />} />
      </Routes>
    </Router>
  );
}

export default App;

