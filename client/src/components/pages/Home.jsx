import React, { useState, useEffect, useMemo, useRef } from 'react';
import CalendarWidget from '../widgets/CalendarWidget';
import ElectricityWidget from '../widgets/ElectricityWidget';
import WeatherWidget from '../widgets/WeatherWidget';
import NewsTicker from '../widgets/NewsTicker';
import BusWidget from '../widgets/BusWidget';
import { API_URL, REFRESH_INTERVAL, MAX_EVENTS_WIDGET } from '../../constants';
import { useCalendarFilters } from '../../hooks/useCalendarFilters';

function Home() {
  const [googleEvents, setGoogleEvents] = useState([]);
  const [nantesEvents, setNantesEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showGoogleEvents, showNantesEvents, nantesCategories } = useCalendarFilters();
  
  const [electricityData, setElectricityData] = useState(null);
  const [electricityLoading, setElectricityLoading] = useState(true);
  const [electricityError, setElectricityError] = useState(null);
  const prevCategoriesRef = useRef();
  
  // Initialize ref on mount
  useEffect(() => {
    prevCategoriesRef.current = JSON.stringify(nantesCategories);
  }, []);

  const fetchEvents = async () => {
    try {
      setError(null);
      
      // Fetch Google Calendar events
      const googleResponse = await fetch(API_URL);
      const googleData = await googleResponse.json();
      
      if (googleData.success) {
        setGoogleEvents(googleData.events || []);
      } else {
        throw new Error(googleData.message || 'Failed to fetch Google Calendar events');
      }

      // Fetch Nantes events with category filter
      // null = show all, [] = show none, [cat1, cat2] = show specific
      const categoriesParam = nantesCategories === null 
        ? '' // null = no filter, show all
        : `?categories=${encodeURIComponent(JSON.stringify(nantesCategories))}`;
      const nantesResponse = await fetch(`/api/nantes-events${categoriesParam}`);
      const nantesData = await nantesResponse.json();
      
      if (nantesData.success) {
        const events = nantesData.events || [];
        setNantesEvents(events);
      } else {
        console.warn('Failed to fetch Nantes events:', nantesData.message);
        setNantesEvents([]);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err.message || 'Erreur lors du chargement des événements');
    } finally {
      setLoading(false);
    }
  };

  // Merge and filter events based on stored preferences
  // Use useMemo to recalculate when filters or events change
  const events = useMemo(() => {
    // If both types are enabled, try to include at least some from each
    let allEvents = [];
    
    if (showGoogleEvents && showNantesEvents) {
      // Sort each type separately first
      const sortedGoogle = [...googleEvents].sort((a, b) => {
        const dateCompare = new Date(a.date || a.start) - new Date(b.date || b.start);
        if (dateCompare !== 0) return dateCompare;
        return new Date(a.start) - new Date(b.start);
      });
      
      const sortedNantes = [...nantesEvents].sort((a, b) => {
        const dateCompare = new Date(a.date || a.start) - new Date(b.date || b.start);
        if (dateCompare !== 0) return dateCompare;
        return new Date(a.start) - new Date(b.start);
      });
      
      // Merge all events from both types, then sort
      allEvents = [...sortedGoogle, ...sortedNantes].sort((a, b) => {
        const dateCompare = new Date(a.date || a.start) - new Date(b.date || b.start);
        if (dateCompare !== 0) return dateCompare;
        return new Date(a.start) - new Date(b.start);
      });
      
      // Limit to MAX_EVENTS_WIDGET only if we have too many events
      if (allEvents.length > MAX_EVENTS_WIDGET) {
        allEvents = allEvents.slice(0, MAX_EVENTS_WIDGET);
      }
    } else if (showGoogleEvents) {
      // Only Google Calendar: show ALL events (up to 1 year, no limit in widget)
      allEvents = [...googleEvents].sort((a, b) => {
        const dateCompare = new Date(a.date || a.start) - new Date(b.date || b.start);
        if (dateCompare !== 0) return dateCompare;
        return new Date(a.start) - new Date(b.start);
      });
      // No limit for Google Calendar events - show all
    } else if (showNantesEvents) {
      // Only Nantes events: show all (limited by API to 20)
      allEvents = [...nantesEvents].sort((a, b) => {
        const dateCompare = new Date(a.date || a.start) - new Date(b.date || b.start);
        if (dateCompare !== 0) return dateCompare;
        return new Date(a.start) - new Date(b.start);
      });
      // No limit for Nantes events - show all
    }

    return allEvents;
  }, [showGoogleEvents, showNantesEvents, googleEvents, nantesEvents]);

  const fetchElectricity = async () => {
    try {
      setElectricityError(null);
      // Request 7 days for the widget (default)
      // Add timestamp to prevent browser cache (but keep server cache for 10 minutes)
      const response = await fetch(`/api/electricity?_t=${Date.now()}`);
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

  // Refetch events when category filter or showNantesEvents changes
  useEffect(() => {
    const currentCategoriesStr = JSON.stringify(nantesCategories);
    const prevCategoriesStr = prevCategoriesRef.current;
    
    console.log('[Home] useEffect triggered:', {
      current: nantesCategories,
      currentStr: currentCategoriesStr,
      prevStr: prevCategoriesStr,
      showNantesEvents,
      changed: currentCategoriesStr !== prevCategoriesStr
    });
    
    // Only refetch if categories actually changed
    if (currentCategoriesStr !== prevCategoriesStr) {
      prevCategoriesRef.current = currentCategoriesStr;
      if (showNantesEvents) {
        console.log('[Home] Fetching events with categories:', nantesCategories);
        fetchEvents();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nantesCategories, showNantesEvents]);

  return (
    <div className="home-container">
      <WeatherWidget />
      <div className="home">
        <div className="home-left">
          <div className="home-left-top">
            <CalendarWidget 
              events={events} 
              loading={loading} 
              error={error}
              onRefresh={fetchEvents}
            />
          </div>
        </div>
        <div className="home-right">
          <div className="home-right-top">
            <ElectricityWidget 
              data={electricityData} 
              loading={electricityLoading} 
              error={electricityError}
              compact={true}
            />
          </div>
          <div className="home-right-bottom">
            <BusWidget />
          </div>
        </div>
      </div>
      <NewsTicker />
    </div>
  );
}

export default Home;

