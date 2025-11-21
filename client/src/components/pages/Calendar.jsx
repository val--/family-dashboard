import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { isSchoolHoliday, getDateTitle } from '../../utils';
import { CALENDAR_TITLE } from '../../constants';
import { EventItem, formatEventTime } from '../common/EventItem';

function Calendar({ events, showGoogleEvents, showNantesEvents, onToggleGoogleEvents, onToggleNantesEvents, availableCategories = [], selectedCategories = null, onToggleCategory, onSetCategories }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const navigate = useNavigate();
  const categoryFilterRef = useRef(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(event.target)) {
        setShowCategoryFilter(false);
      }
    };

    if (showCategoryFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCategoryFilter]);

  return (
    <div className="calendar">
      <div className="calendar-header">
        <div className="calendar-header-left">
          <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
        </div>
        <h1 className="calendar-main-title">{CALENDAR_TITLE}</h1>
        <div className="calendar-header-right">
          <div className="calendar-filters">
            <label className="calendar-filter-item">
              <input
                type="checkbox"
                checked={showGoogleEvents}
                onChange={onToggleGoogleEvents}
              />
              <span className="calendar-filter-label">Agenda familial</span>
            </label>
            <label className="calendar-filter-item">
              <input
                type="checkbox"
                checked={showNantesEvents}
                onChange={onToggleNantesEvents}
              />
              <span className="calendar-filter-label">Événements Nantes</span>
            </label>
            {showNantesEvents && availableCategories.length > 0 && (
              <div className="calendar-filter-categories" ref={categoryFilterRef}>
                <button
                  className="calendar-filter-categories-toggle"
                  onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                  title="Filtrer par catégorie"
                >
                  {selectedCategories === null 
                    ? `Toutes catégories (${availableCategories.length})`
                    : selectedCategories.length > 0
                    ? `Catégories (${selectedCategories.length}/${availableCategories.length})`
                    : 'Aucune catégorie'}
                  <span className="calendar-filter-categories-arrow">
                    {showCategoryFilter ? '▲' : '▼'}
                  </span>
                </button>
                {showCategoryFilter && (
                  <div className="calendar-filter-categories-dropdown">
                    <div className="calendar-filter-categories-header">
                      <button
                        className="calendar-filter-categories-select-all"
                        onClick={() => {
                          // Si toutes les catégories sont sélectionnées, désélectionner toutes
                          if (selectedCategories !== null && selectedCategories.length === availableCategories.length) {
                            onSetCategories && onSetCategories([]);
                          } else {
                            // Sinon, sélectionner toutes les catégories
                            onSetCategories && onSetCategories([...availableCategories]);
                          }
                        }}
                      >
                        {selectedCategories !== null && selectedCategories.length === availableCategories.length 
                          ? 'Tout désélectionner' 
                          : 'Tout sélectionner'}
                      </button>
                    </div>
                    <div className="calendar-filter-categories-list">
                      {availableCategories.map(category => (
                        <label key={category} className="calendar-filter-category-item">
                          <input
                            type="checkbox"
                            checked={selectedCategories !== null && selectedCategories.includes(category)}
                            onChange={() => onToggleCategory && onToggleCategory(category, availableCategories)}
                          />
                          <span className="calendar-filter-category-label">{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="calendar-legend">
            <div className="calendar-legend-item">
              <div className="calendar-legend-pattern"></div>
              <span className="calendar-legend-text">Vacances scolaires</span>
            </div>
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
                                {event.image && (
                                  <div className="event-modal-image">
                                    <img src={event.image} alt={event.title} />
                                  </div>
                                )}
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
                                {event.source === 'nantes' && event.type && (
                                  <div className="event-details-section">
                                    <div className="event-details-label">Type</div>
                                    <div className="event-details-value">{event.type}</div>
                                  </div>
                                )}
                                {event.source === 'nantes' && event.organizer && (
                                  <div className="event-details-section">
                                    <div className="event-details-label">Organisateur</div>
                                    <div className="event-details-value">{event.organizer}</div>
                                  </div>
                                )}
                                       {event.source === 'nantes' && event.url && (
                                         <div className="event-details-section">
                                           <div className="event-details-label">Plus d'infos</div>
                                           <div className="event-details-value">
                                             <div className="event-modal-qr">
                                               <p className="event-modal-qr-label">Scanner pour plus d'informations :</p>
                                               <div className="event-modal-qr-code">
                                                 <QRCodeSVG
                                                   value={event.url}
                                                   size={200}
                                                   level="M"
                                                   includeMargin={true}
                                                 />
                                               </div>
                                             </div>
                                           </div>
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

