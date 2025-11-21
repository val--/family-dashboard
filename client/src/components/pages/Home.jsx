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
  const [pullrougeEvents, setPullrougeEvents] = useState([]);
  const [nantesEvents, setNantesEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showGoogleEvents, showNantesEvents, showPullrougeEvents, nantesCategories } = useCalendarFilters();
  
  const [electricityData, setElectricityData] = useState(null);
  const [electricityLoading, setElectricityLoading] = useState(true);
  const [electricityError, setElectricityError] = useState(null);
  const prevCategoriesRef = useRef();
  const isInitialMountRef = useRef(true);
  const fetchEventsInProgressRef = useRef(false);
  
  // Initialize ref on mount
  useEffect(() => {
    prevCategoriesRef.current = JSON.stringify(nantesCategories);
  }, []);

  const fetchEvents = async () => {
    // Éviter les appels en double
    if (fetchEventsInProgressRef.current) {
      console.log('[Home] fetchEvents déjà en cours, ignoré');
      return;
    }
    
    try {
      fetchEventsInProgressRef.current = true;
      setError(null);
      
      // Fetch Google Calendar events (which includes PullRouge events merged by the server)
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

      // Fetch Nantes events with category filter - limité pour la page d'accueil
      // On limite à 7 jours et max 20 événements car on n'affiche que MAX_EVENTS_WIDGET (10) au total
      const initialDateMax = new Date();
      initialDateMax.setDate(initialDateMax.getDate() + 7); // 7 jours seulement pour la page d'accueil
      
      const categoriesParam = nantesCategories === null 
        ? '' // null = no filter, show all
        : `&categories=${encodeURIComponent(JSON.stringify(nantesCategories))}`;
      const nantesResponse = await fetch(`/api/nantes-events?dateMax=${initialDateMax.toISOString()}&limit=20${categoriesParam}`);
      const nantesData = await nantesResponse.json();
      
      if (nantesData.success) {
        const events = nantesData.events || [];
        console.log(`[Home] Chargement Nantes: ${events.length} événements (limité à 7 jours, max 20)`);
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
      fetchEventsInProgressRef.current = false;
    }
  };

  // Merge and filter events based on stored preferences
  // Use useMemo to recalculate when filters or events change
  const events = useMemo(() => {
    // Merge all enabled event types
    let allEvents = [];
    
    if (showGoogleEvents) {
      allEvents = [...allEvents, ...googleEvents];
    }
    
    if (showPullrougeEvents) {
      allEvents = [...allEvents, ...pullrougeEvents];
    }
    
    if (showNantesEvents) {
      allEvents = [...allEvents, ...nantesEvents];
    }
    
    // Sort all events
    allEvents.sort((a, b) => {
      const dateCompare = new Date(a.date || a.start) - new Date(b.date || b.start);
      if (dateCompare !== 0) return dateCompare;
      return new Date(a.start) - new Date(b.start);
    });
    
    // Limit to MAX_EVENTS_WIDGET only if we have too many events
    if (allEvents.length > MAX_EVENTS_WIDGET) {
      allEvents = allEvents.slice(0, MAX_EVENTS_WIDGET);
    }

    return allEvents;
  }, [showGoogleEvents, showPullrougeEvents, showNantesEvents, googleEvents, pullrougeEvents, nantesEvents]);

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
    // Ignorer le premier rendu (déjà géré par le useEffect de montage)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    
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

