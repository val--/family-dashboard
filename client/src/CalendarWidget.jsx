import React from 'react';
import { useNavigate } from 'react-router-dom';
import { parseISO, startOfDay } from 'date-fns';
import { CALENDAR_TITLE, MAX_DATES_WIDGET, MAX_EVENTS_PER_DATE_WIDGET } from './constants';
import { getDateTitle } from './utils';
import { EventItem } from './EventItem';

function CalendarWidget({ events, loading, error }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/calendar');
  };

  if (loading) {
    return (
      <div className="calendar-widget" onClick={handleClick}>
        <div className="calendar-widget-header">
          <h2 className="calendar-widget-title">{CALENDAR_TITLE}</h2>
        </div>
        <div className="calendar-widget-content">
          <div className="calendar-widget-loading">Chargement...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-widget" onClick={handleClick}>
        <div className="calendar-widget-header">
          <h2 className="calendar-widget-title">{CALENDAR_TITLE}</h2>
        </div>
        <div className="calendar-widget-content">
          <div className="calendar-widget-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="calendar-widget" onClick={handleClick}>
        <div className="calendar-widget-header">
          <h2 className="calendar-widget-title">{CALENDAR_TITLE}</h2>
        </div>
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
      <div className="calendar-widget-header">
        <h2 className="calendar-widget-title">{CALENDAR_TITLE}</h2>
      </div>
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

