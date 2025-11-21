import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { isSchoolHoliday, getDateTitle } from '../../utils';
import { CALENDAR_TITLE } from '../../constants';
import { EventItem, formatEventTime } from '../common/EventItem';

function Calendar({ events, showGoogleEvents, showNantesEvents, showPullrougeEvents, onToggleGoogleEvents, onToggleNantesEvents, onTogglePullrougeEvents, availableCategories = [], selectedCategories = null, onToggleCategory, onSetCategories, loadingMoreNantes = false, nantesHasMore = false }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const navigate = useNavigate();
  const categoryFilterRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Memoize events grouping and sorting
  const { eventsByDate, sortedDateKeys } = useMemo(() => {
    if (!events || events.length === 0) {
      return { eventsByDate: {}, sortedDateKeys: [] };
    }

    const grouped = events.reduce((groups, event) => {
      const dateKey = event.date || startOfDay(parseISO(event.start)).toISOString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
      return groups;
    }, {});

    const sorted = Object.keys(grouped).sort();
    return { eventsByDate: grouped, sortedDateKeys: sorted };
  }, [events]);

  // Find selected event object only when needed
  const selectedEventObj = useMemo(() => {
    if (!selectedEvent || !events) return null;
    return events.find(e => e.id === selectedEvent);
  }, [selectedEvent, events]);

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

  // Close dropdown when clicking outside and prevent scroll when open
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(event.target)) {
        setShowCategoryFilter(false);
      }
    };

    if (showCategoryFilter) {
      // Empêcher le scroll quand le dropdown est ouvert
      const appContainer = document.querySelector('.app');
      if (appContainer) {
        appContainer.style.overflow = 'hidden';
      } else {
        // Fallback au body si .app n'existe pas
        document.body.style.overflow = 'hidden';
      }
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        // Réactiver le scroll quand le dropdown est fermé
        if (appContainer) {
          appContainer.style.overflow = '';
        } else {
          document.body.style.overflow = '';
        }
        document.removeEventListener('mousedown', handleClickOutside);
      };
    } else {
      // S'assurer que le scroll est réactivé si le dropdown est fermé
      const appContainer = document.querySelector('.app');
      if (appContainer) {
        appContainer.style.overflow = '';
      } else {
        document.body.style.overflow = '';
      }
    }
  }, [showCategoryFilter]);

  // Handle scroll to show/hide scroll to top button with debounce
  useEffect(() => {
    let appContainer = null;
    let scrollListener = null;

    const handleScroll = () => {
      // Clear previous timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce scroll handler
      scrollTimeoutRef.current = setTimeout(() => {
        let scrollTop = 0;
        
        // Try to find the .app container (parent scroll container)
        if (!appContainer) {
          appContainer = document.querySelector('.app');
        }
        
        if (appContainer) {
          scrollTop = appContainer.scrollTop;
        } else {
          // Fallback to window scroll
          scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        }
        
        setShowScrollTop(scrollTop > 100); // Show button after scrolling 100px
      }, 50); // Debounce de 50ms
    };

    // Wait a bit for the DOM to be ready, then set up scroll listener
    const setupScrollListener = () => {
      appContainer = document.querySelector('.app');
      
      if (appContainer) {
        scrollListener = appContainer;
        appContainer.addEventListener('scroll', handleScroll, { passive: true });
        // Check initial scroll position
        handleScroll();
      } else {
        // Fallback to window scroll
        scrollListener = window;
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
      }
    };

    // Try immediately, then retry after a short delay if needed
    setupScrollListener();
    const timeoutId = setTimeout(() => {
      if (!scrollListener) {
        setupScrollListener();
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (scrollListener) {
        scrollListener.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Scroll to top function - memoized
  const scrollToTop = useCallback(() => {
    // Try to scroll the .app container
    const appContainer = document.querySelector('.app');
    if (appContainer) {
      appContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      // Fallback to window scroll
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, []);

  // Memoize event click handler
  const handleEventClick = useCallback((eventId) => {
    setSelectedEvent(prev => prev === eventId ? null : eventId);
  }, []);

  // Memoize close modal handler
  const handleCloseModal = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button className="back-button" onClick={() => navigate('/')}>← Retour</button>
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
          <label className="calendar-filter-item">
            <input
              type="checkbox"
              checked={showPullrougeEvents}
              onChange={onTogglePullrougeEvents}
            />
            <span className="calendar-filter-label">Concerts</span>
          </label>
          {showNantesEvents && availableCategories.length > 0 && (
            <div className="calendar-filter-categories" ref={categoryFilterRef}>
              <button
                className="calendar-filter-categories-toggle"
                onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                title="Filtrer par catégorie"
              >
                Catégories
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
                          onClick={() => handleEventClick(event.id)}
                        />
                      </li>
                    );
              })}
            </ul>
            {isLastSection && !loadingMoreNantes && !(showNantesEvents && nantesHasMore) && (
              <div className="calendar-end-message">
                <p>Rien d'autre pour le moment !</p>
              </div>
            )}
          </div>
        );
      })}
      {/* Render modal only once, outside the map */}
      {selectedEventObj && (
        <div className="event-modal-overlay" onClick={handleCloseModal}>
          <div className={`event-modal ${selectedEventObj.image ? 'event-modal-with-image' : ''}`} onClick={(e) => e.stopPropagation()}>
            <button className="event-modal-close" onClick={handleCloseModal}>×</button>
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
      {showScrollTop && !selectedEvent && (
        <button 
          className="scroll-to-top-button" 
          onClick={scrollToTop}
          aria-label="Retour en haut"
          title="Retour en haut"
        >
          ↑
        </button>
      )}
      {loadingMoreNantes && showNantesEvents && (
        <div className="calendar-loading-more">
          <div className="calendar-loading-more-spinner"></div>
          <div className="calendar-loading-more-message">Chargement des événements suivants...</div>
        </div>
      )}
    </div>
  );
}

export default Calendar;

