import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Calendar from './components/pages/Calendar';
import DashboardPages from './components/common/DashboardPages';
import Electricity from './components/pages/Electricity';
import Weather from './components/pages/Weather';
import Hue from './components/pages/Hue';
import SpotifyPage from './components/pages/SpotifyPage';
import Screensaver from './components/common/Screensaver';
import { useScreensaver } from './hooks/useScreensaver';
import { useSimpleDragScroll } from './hooks/useSimpleDragScroll';
import { useCalendarFilters } from './hooks/useCalendarFilters';
import { ScreensaverContext } from './contexts/ScreensaverContext';

import { API_URL, REFRESH_INTERVAL, SCREENSAVER_IDLE_TIME } from './constants';

function CalendarPage() {
  const [googleEvents, setGoogleEvents] = useState([]);
  const [pullrougeEvents, setPullrougeEvents] = useState([]);
  const [nantesEvents, setNantesEvents] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const { showGoogleEvents, showNantesEvents, showPullrougeEvents, nantesCategories, toggleGoogleEvents, toggleNantesEvents, togglePullrougeEvents, toggleNantesCategory, setNantesCategories } = useCalendarFilters();
  const appRef = useSimpleDragScroll('a, button, .event-item');
  const prevCategoriesRef = useRef();
  
  // Initialize ref on mount
  useEffect(() => {
    prevCategoriesRef.current = JSON.stringify(nantesCategories);
  }, []);

  const fetchEvents = async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Fetch Google Calendar events (which includes PullRouge events merged by the server)
      setLoadingStep('Chargement de l\'agenda familial...');
      const googleResponse = await fetch(API_URL);
      const googleData = await googleResponse.json();
      
      if (googleData.success) {
        const allEvents = googleData.events || [];
        // Separate Google Calendar events from PullRouge events
        const googleOnlyEvents = allEvents.filter(event => !event.source || event.source !== 'pullrouge');
        const pullrougeEvents = allEvents.filter(event => event.source === 'pullrouge');
        setGoogleEvents(googleOnlyEvents);
        setPullrougeEvents(pullrougeEvents);
      } else {
        throw new Error(googleData.message || 'Failed to fetch Google Calendar events');
      }

      // Fetch Nantes events with category filter
      // null = show all, [] = show none, [cat1, cat2] = show specific
      setLoadingStep('Chargement des événements Nantes...');
      const categoriesParam = nantesCategories === null 
        ? '' // null = no filter, show all
        : `?categories=${encodeURIComponent(JSON.stringify(nantesCategories))}`;
      const nantesResponse = await fetch(`/api/nantes-events${categoriesParam}`);
      const nantesData = await nantesResponse.json();
      
      if (nantesData.success) {
        setNantesEvents(nantesData.events || []);
      } else {
        console.warn('Failed to fetch Nantes events:', nantesData.message);
        setNantesEvents([]);
      }
      
      setLoadingStep('Finalisation...');
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err.message || 'Erreur lors du chargement des événements');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/nantes-events/categories');
      const data = await response.json();
      if (data.success) {
        setAvailableCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    // Fetch categories on mount
    fetchCategories();
    
    // Fetch immediately on mount
    fetchEvents();

    // Set up automatic refresh every 10 minutes
    const interval = setInterval(() => {
      fetchEvents();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Refetch events when category filter changes
  useEffect(() => {
    const currentCategoriesStr = JSON.stringify(nantesCategories);
    const prevCategoriesStr = prevCategoriesRef.current;
    
    // Only refetch if categories actually changed
    if (currentCategoriesStr !== prevCategoriesStr) {
      prevCategoriesRef.current = currentCategoriesStr;
      if (showNantesEvents) {
        fetchEvents();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nantesCategories, showNantesEvents]);

  // Merge and filter events based on checkboxes - memoized for performance
  const allEvents = useMemo(() => {
    const merged = [
      ...(showGoogleEvents ? googleEvents : []),
      ...(showPullrougeEvents ? pullrougeEvents : []),
      ...(showNantesEvents ? nantesEvents : [])
    ];
    
    // Sort by date first, then by start time
    return merged.sort((a, b) => {
      const dateCompare = new Date(a.date || a.start) - new Date(b.date || b.start);
      if (dateCompare !== 0) return dateCompare;
      return new Date(a.start) - new Date(b.start);
    });
  }, [showGoogleEvents, showPullrougeEvents, showNantesEvents, googleEvents, pullrougeEvents, nantesEvents]);

  if (loading) {
    return (
      <div className="app" ref={appRef}>
        <div className="calendar">
          <div className="calendar-loading">
            <div className="calendar-loading-spinner"></div>
            <div className="calendar-loading-message">
              {loadingStep || 'Chargement de l\'agenda...'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app" ref={appRef}>
        <div className="calendar">
          <div className="calendar-error">
            <div className="calendar-error-icon">⚠️</div>
            <div className="calendar-error-title">Oups, une erreur est survenue</div>
            <div className="calendar-error-message">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app" ref={appRef}>
      <Calendar 
        events={allEvents} 
        showGoogleEvents={showGoogleEvents}
        showNantesEvents={showNantesEvents}
        showPullrougeEvents={showPullrougeEvents}
        onToggleGoogleEvents={toggleGoogleEvents}
        onToggleNantesEvents={toggleNantesEvents}
        onTogglePullrougeEvents={togglePullrougeEvents}
        availableCategories={availableCategories}
        selectedCategories={nantesCategories}
        onToggleCategory={toggleNantesCategory}
        onSetCategories={setNantesCategories}
      />
    </div>
  );
}

function ElectricityPage() {
  const [electricityData, setElectricityData] = useState(null);
  const [electricityLoading, setElectricityLoading] = useState(true);
  const [electricityError, setElectricityError] = useState(null);
  const appRef = useSimpleDragScroll('a, button, .electricity-stat-card');

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
  const appRef = useSimpleDragScroll('a, button, .weather-page-hourly-item');

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
  const appRef = useSimpleDragScroll('a, button, .hue-light-item, .hue-brightness-slider');
  const navigate = useNavigate();

  return (
    <div className="app" ref={appRef}>
      <Hue />
    </div>
  );
}

function SpotifyPageWrapper() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('spotify-page');
    return () => {
      document.body.classList.remove('spotify-page');
    };
  }, []);

  return (
    <div className="app app-spotify">
      <button 
        className="spotify-back-button" 
        onClick={() => navigate('/')}
        aria-label="Retour à l'accueil"
      >
      </button>
      <SpotifyPage />
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  // Activer l'écran de veille après le délai d'inactivité configuré
  // Ne pas activer le screensaver sur la page Spotify
  const shouldDisableScreensaver = location.pathname === '/spotify';
  const { isScreensaverActive, registerActivity, activateScreensaver } = useScreensaver(
    shouldDisableScreensaver ? null : SCREENSAVER_IDLE_TIME
  );

  return (
    <ScreensaverContext.Provider value={{ activateScreensaver }}>
      {isScreensaverActive && <Screensaver onExit={registerActivity} />}
      <Routes>
        <Route path="/" element={<DashboardPages />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/electricity" element={<ElectricityPage />} />
        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/hue" element={<HuePage />} />
        <Route path="/spotify" element={<SpotifyPageWrapper />} />
      </Routes>
    </ScreensaverContext.Provider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

