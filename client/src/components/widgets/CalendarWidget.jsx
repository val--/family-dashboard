import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseISO, startOfDay } from 'date-fns';
import { CALENDAR_TITLE, MAX_DATES_WIDGET, MAX_EVENTS_PER_DATE_WIDGET } from '../../constants';
import { getDateTitle } from '../../utils';
import { EventItem } from '../common/EventItem';

function CalendarWidget({ events, loading, error, onRefresh }) {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleClick = () => {
    navigate('/calendar');
  };

  const handleRefresh = async (e) => {
    e.stopPropagation(); // Prevent navigation to /calendar
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        // Small delay to show the refresh animation
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  const renderHeader = () => (
    <div className="calendar-widget-header">
      <h2 className="calendar-widget-title">{CALENDAR_TITLE}</h2>
      {onRefresh && (
        <button
          className={`calendar-widget-refresh ${isRefreshing ? 'refreshing' : ''}`}
          onClick={handleRefresh}
          title="Rafraîchir"
          aria-label="Rafraîchir le calendrier"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="calendar-widget" onClick={handleClick}>
        {renderHeader()}
        <div className="calendar-widget-content">
          <div className="calendar-widget-loading">Chargement...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-widget" onClick={handleClick}>
        {renderHeader()}
        <div className="calendar-widget-content">
          <div className="calendar-widget-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="calendar-widget" onClick={handleClick}>
        {renderHeader()}
        <div className="calendar-widget-content">
          <div className="calendar-widget-empty">Aucun événement à venir</div>
        </div>
      </div>
    );
  }

  // Group events by date
  const eventsByDate = events.reduce((groups, event) => {
    const dateKey = event.date || startOfDay(parseISO(event.start)).toISOString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(event);
    return groups;
  }, {});

  const sortedDateKeys = Object.keys(eventsByDate).sort().slice(0, MAX_DATES_WIDGET);

  return (
    <div className="calendar-widget" onClick={handleClick}>
      {renderHeader()}
      <div className="calendar-widget-content">
        {sortedDateKeys.map((dateKey) => {
          const dateEvents = eventsByDate[dateKey];
          const dateTitle = getDateTitle(dateKey);

          return (
            <div key={dateKey} className="calendar-widget-date-section">
              <h3 className="calendar-widget-date-title">{dateTitle}</h3>
              <ul className="events-list events-list-compact">
                {dateEvents.slice(0, MAX_EVENTS_PER_DATE_WIDGET).map((event) => (
                  <li key={event.id}>
                    <EventItem event={event} compact={true} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CalendarWidget;

