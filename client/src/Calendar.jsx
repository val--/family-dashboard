import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { isSchoolHoliday } from './holidays';
import { CALENDAR_TITLE } from './constants';
import { getDateTitle } from './utils';
import { EventItem, formatEventTime } from './EventItem';

function Calendar({ events }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const navigate = useNavigate();

  if (!events || events.length === 0) {
    return (
      <div className="calendar">
        <h1 className="calendar-title">Aujourd'hui</h1>
        <div className="no-events">
          <p>Aucun événement à venir</p>
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

  // Get date keys sorted
  const sortedDateKeys = Object.keys(eventsByDate).sort();

  return (
    <div className="calendar">
      <div className="calendar-header">
        <div className="calendar-header-left">
          <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        </div>
        <h1 className="calendar-main-title">{CALENDAR_TITLE}</h1>
        <div className="calendar-legend">
          <div className="calendar-legend-item">
            <div className="calendar-legend-pattern"></div>
            <span className="calendar-legend-text">Vacances scolaires</span>
          </div>
        </div>
      </div>
      {sortedDateKeys.map((dateKey, dateIndex) => {
        const dateEvents = eventsByDate[dateKey];
        const dateTitle = getDateTitle(dateKey);
        const isLastSection = dateIndex === sortedDateKeys.length - 1;
        
        return (
          <div key={dateKey} className="date-section">
            <h1 className="calendar-title">{dateTitle}</h1>
            <ul className="events-list">
              {dateEvents.map((event) => {
                const isSelected = selectedEvent === event.id;
                    
                    return (
                      <li key={event.id}>
                        <EventItem 
                          event={event} 
                          compact={false}
                          isSelected={isSelected}
                          onClick={() => setSelectedEvent(isSelected ? null : event.id)}
                        />
                        {isSelected && (
                          <div className="event-modal-overlay" onClick={() => setSelectedEvent(null)}>
                            <div className="event-modal" onClick={(e) => e.stopPropagation()}>
                              <button className="event-modal-close" onClick={() => setSelectedEvent(null)}>×</button>
                              <div className="event-modal-header">
                                <h2 className="event-modal-title">{event.title}</h2>
                              </div>
                              <div className="event-modal-content">
                                <div className="event-details-section">
                                  <div className="event-details-label">Horaires</div>
                                  <div className="event-details-value">
                                    {event.isAllDay ? (
                                      <span>Toute la journée</span>
                                    ) : event.end ? (
                                      <span>
                                        {format(parseISO(event.start), 'HH:mm', { locale: fr })} – {format(parseISO(event.end), 'HH:mm', { locale: fr })}
                                      </span>
                                    ) : (
                                      <span>
                                        {format(parseISO(event.start), 'HH:mm', { locale: fr })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {event.description && (
                                  <div className="event-details-section">
                                    <div className="event-details-label">Description</div>
                                    <div className="event-details-value event-description-text">{event.description}</div>
                                  </div>
                                )}
                                {event.location && (
                                  <div className="event-details-section">
                                    <div className="event-details-label">Lieu</div>
                                    <div className="event-details-value">{event.location}</div>
                                  </div>
                                )}
                                {isSchoolHoliday(event.date || event.start) && (
                                  <div className="event-details-section event-details-notes">
                                    <div className="event-details-label">Notes</div>
                                    <div className="event-details-value">Pendant les vacances scolaires !</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    );
              })}
            </ul>
            {isLastSection && (
              <div className="calendar-end-message">
                <p>Rien d'autre pour le moment !</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Calendar;

