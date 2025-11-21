import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseISO, startOfDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { CALENDAR_TITLE, MAX_DATES_WIDGET, MAX_EVENTS_PER_DATE_WIDGET } from '../../constants';
import { getDateTitle, isSchoolHoliday } from '../../utils';
import { EventItem } from '../common/EventItem';

function CalendarWidget({ events, loading, error, onRefresh }) {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleHeaderClick = () => {
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
    <div className="calendar-widget-header" onClick={handleHeaderClick} style={{ cursor: 'pointer' }}>
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
      <div className="calendar-widget">
        {renderHeader()}
        <div className="calendar-widget-content">
          <div className="calendar-widget-loading">Chargement...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-widget">
        {renderHeader()}
        <div className="calendar-widget-content">
          <div className="calendar-widget-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="calendar-widget">
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

  const handleSeeMore = (e) => {
    e.stopPropagation();
    navigate('/calendar');
  };

  // Find the selected event object
  const selectedEventObj = selectedEvent ? events.find(e => e.id === selectedEvent) : null;

  return (
    <div className="calendar-widget">
      {renderHeader()}
      <div className="calendar-widget-content">
        {sortedDateKeys.map((dateKey) => {
          const dateEvents = eventsByDate[dateKey];
          const dateTitle = getDateTitle(dateKey);

          return (
            <div key={dateKey} className="calendar-widget-date-section">
              <h3 className="calendar-widget-date-title">{dateTitle}</h3>
              <ul className="events-list events-list-compact">
                {dateEvents.map((event) => {
                  const isSelected = selectedEvent === event.id;
                  return (
                    <li key={event.id}>
                      <EventItem 
                        event={event} 
                        compact={true}
                        isSelected={isSelected}
                        onClick={() => setSelectedEvent(isSelected ? null : event.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="calendar-widget-footer">
        <button 
          className="calendar-widget-see-more" 
          onClick={handleSeeMore}
        >
          Voir plus
        </button>
      </div>
      {selectedEventObj && (
        <div className="event-modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className={`event-modal ${selectedEventObj.image ? 'event-modal-with-image' : ''}`} onClick={(e) => e.stopPropagation()}>
            <button className="event-modal-close" onClick={() => setSelectedEvent(null)}>×</button>
            {selectedEventObj.image ? (
              <div className="event-modal-layout">
                <div className="event-modal-image-container">
                  <img src={selectedEventObj.image} alt={selectedEventObj.title} loading="lazy" />
                </div>
                <div className="event-modal-content-container">
                  <div className="event-modal-header">
                    <h2 className="event-modal-title">{selectedEventObj.title}</h2>
                  </div>
                  <div className="event-modal-content">
                    <div className="event-details-section">
                      <div className="event-details-label">Date</div>
                      <div className="event-details-value">
                        {format(parseISO(selectedEventObj.date || selectedEventObj.start), 'EEEE d MMMM yyyy', { locale: fr })}
                      </div>
                    </div>
                    <div className="event-details-section">
                      <div className="event-details-label">Horaires</div>
                      <div className="event-details-value">
                        {selectedEventObj.isAllDay ? (
                          <span>Toute la journée</span>
                        ) : selectedEventObj.end ? (
                          <span>
                            {format(parseISO(selectedEventObj.start), 'HH:mm', { locale: fr })} – {format(parseISO(selectedEventObj.end), 'HH:mm', { locale: fr })}
                          </span>
                        ) : (
                          <span>
                            {format(parseISO(selectedEventObj.start), 'HH:mm', { locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedEventObj.description && (
                      <div className="event-details-section">
                        <div className="event-details-label">Description</div>
                        <div className="event-details-value event-description-text">{selectedEventObj.description}</div>
                      </div>
                    )}
                    {selectedEventObj.location && (
                      <div className="event-details-section">
                        <div className="event-details-label">Lieu</div>
                        <div className="event-details-value">{selectedEventObj.location}</div>
                      </div>
                    )}
                    {selectedEventObj.source === 'nantes' && selectedEventObj.type && (
                      <div className="event-details-section">
                        <div className="event-details-label">Type</div>
                        <div className="event-details-value">{selectedEventObj.type}</div>
                      </div>
                    )}
                    {selectedEventObj.source === 'nantes' && selectedEventObj.organizer && (
                      <div className="event-details-section">
                        <div className="event-details-label">Organisateur</div>
                        <div className="event-details-value">{selectedEventObj.organizer}</div>
                      </div>
                    )}
                    {selectedEventObj.source === 'pullrouge' && selectedEventObj.priceInfo && (
                      <div className="event-details-section">
                        <div className="event-details-label">Prix / Infos</div>
                        <div className="event-details-value">{selectedEventObj.priceInfo}</div>
                      </div>
                    )}
                    {selectedEventObj.source === 'nantes' && selectedEventObj.url && (
                      <div className="event-details-section">
                        <div className="event-details-label">Plus d'infos</div>
                        <div className="event-details-value">
                          <div className="event-modal-qr">
                            <p className="event-modal-qr-label">Scanner pour plus d'informations :</p>
                            <div className="event-modal-qr-code">
                              <QRCodeSVG
                                value={selectedEventObj.url}
                                size={200}
                                level="M"
                                includeMargin={true}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {isSchoolHoliday(selectedEventObj.date || selectedEventObj.start) && (
                      <div className="event-details-section event-details-notes">
                        <div className="event-details-label">Notes</div>
                        <div className="event-details-value">Pendant les vacances scolaires !</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="event-modal-header">
                  <h2 className="event-modal-title">{selectedEventObj.title}</h2>
                </div>
                <div className="event-modal-content">
                  <div className="event-details-section">
                    <div className="event-details-label">Date</div>
                    <div className="event-details-value">
                      {format(parseISO(selectedEventObj.date || selectedEventObj.start), 'EEEE d MMMM yyyy', { locale: fr })}
                    </div>
                  </div>
                  <div className="event-details-section">
                    <div className="event-details-label">Horaires</div>
                    <div className="event-details-value">
                      {selectedEventObj.isAllDay ? (
                        <span>Toute la journée</span>
                      ) : selectedEventObj.end ? (
                        <span>
                          {format(parseISO(selectedEventObj.start), 'HH:mm', { locale: fr })} – {format(parseISO(selectedEventObj.end), 'HH:mm', { locale: fr })}
                        </span>
                      ) : (
                        <span>
                          {format(parseISO(selectedEventObj.start), 'HH:mm', { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedEventObj.description && (
                    <div className="event-details-section">
                      <div className="event-details-label">Description</div>
                      <div className="event-details-value event-description-text">{selectedEventObj.description}</div>
                    </div>
                  )}
                  {selectedEventObj.location && (
                    <div className="event-details-section">
                      <div className="event-details-label">Lieu</div>
                      <div className="event-details-value">{selectedEventObj.location}</div>
                    </div>
                  )}
                  {selectedEventObj.source === 'nantes' && selectedEventObj.type && (
                    <div className="event-details-section">
                      <div className="event-details-label">Type</div>
                      <div className="event-details-value">{selectedEventObj.type}</div>
                    </div>
                  )}
                  {selectedEventObj.source === 'nantes' && selectedEventObj.organizer && (
                    <div className="event-details-section">
                      <div className="event-details-label">Organisateur</div>
                      <div className="event-details-value">{selectedEventObj.organizer}</div>
                    </div>
                  )}
                  {selectedEventObj.source === 'pullrouge' && selectedEventObj.priceInfo && (
                    <div className="event-details-section">
                      <div className="event-details-label">Prix / Infos</div>
                      <div className="event-details-value">{selectedEventObj.priceInfo}</div>
                    </div>
                  )}
                  {selectedEventObj.source === 'nantes' && selectedEventObj.url && (
                    <div className="event-details-section">
                      <div className="event-details-label">Plus d'infos</div>
                      <div className="event-details-value">
                        <div className="event-modal-qr">
                          <p className="event-modal-qr-label">Scanner pour plus d'informations :</p>
                          <div className="event-modal-qr-code">
                            <QRCodeSVG
                              value={selectedEventObj.url}
                              size={200}
                              level="M"
                              includeMargin={true}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {isSchoolHoliday(selectedEventObj.date || selectedEventObj.start) && (
                    <div className="event-details-section event-details-notes">
                      <div className="event-details-label">Notes</div>
                      <div className="event-details-value">Pendant les vacances scolaires !</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarWidget;

