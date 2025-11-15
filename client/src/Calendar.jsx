import React, { useState } from 'react';
import { format, isToday, isTomorrow, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

function Calendar({ events }) {
  const [selectedEvent, setSelectedEvent] = useState(null);

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

  // Format date title with first letter capitalized
  const capitalizeFirst = (str) => {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const getDateTitle = (dateISO) => {
    const date = parseISO(dateISO);
    if (isToday(date)) {
      return 'Aujourd\'hui';
    } else if (isTomorrow(date)) {
      return 'Demain';
    } else {
      // Format: "Vendredi 15 Novembre 2024"
      const formatted = format(date, 'EEEE d MMMM yyyy', { locale: fr });
      return capitalizeFirst(formatted);
    }
  };

  return (
    <div className="calendar">
      {sortedDateKeys.map((dateKey, dateIndex) => {
        const dateEvents = eventsByDate[dateKey];
        const dateTitle = getDateTitle(dateKey);
        
        return (
          <div key={dateKey} className="date-section">
            <h1 className="calendar-title">{dateTitle}</h1>
            <ul className="events-list">
              {dateEvents.map((event) => {
                // Format time display with start and end
                let timeDisplay = event.time;
                if (event.endTime && !event.isAllDay) {
                  timeDisplay = `${event.time} – ${event.endTime}`;
                }
                
                    const isSelected = selectedEvent === event.id;
                    
                    return (
                      <li key={event.id}>
                        <div 
                          className={`event-item ${isSelected ? 'event-item-selected' : ''}`}
                          onClick={() => setSelectedEvent(isSelected ? null : event.id)}
                        >
                          <div className="event-time">{timeDisplay}</div>
                          <div className="event-content">
                            <div className="event-title">{event.title}</div>
                            {event.location && (
                              <div className="event-location">{event.location}</div>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="event-details">
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
                          </div>
                        )}
                      </li>
                    );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default Calendar;

