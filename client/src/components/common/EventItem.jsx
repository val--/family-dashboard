import React from 'react';
import { isSchoolHoliday, getColorScheme, getCategoryColor } from '../../utils';

/**
 * Format time display for an event
 */
export const formatEventTime = (event) => {
  if (event.isAllDay) {
    return 'Toute la journée';
  }
  if (event.endTime) {
    return `${event.time} – ${event.endTime}`;
  }
  return event.time;
};

/**
 * Event item component - can be used in both widget and full calendar
 */
export function EventItem({ event, compact = false, onClick, isSelected = false }) {
  const timeDisplay = formatEventTime(event);
  const colorScheme = getColorScheme(event.date);
  const isHoliday = isSchoolHoliday(event.date || event.start);
  const isNantesEvent = event.source === 'nantes';

  const baseClasses = compact ? 'event-item-compact' : 'event-item';
  const holidayClass = isHoliday ? 'event-holiday' : '';
  const selectedClass = isSelected ? 'event-item-selected' : '';
  const nantesClass = isNantesEvent ? 'event-nantes' : '';

  // Déterminer la couleur de bordure
  let borderColor = '#f1c40f'; // Jaune par défaut pour calendrier familial
  if (isNantesEvent && event.type) {
    // Pour les événements Nantes, utiliser la couleur de la catégorie
    const categoryName = event.type.split(',')[0].trim();
    borderColor = getCategoryColor(categoryName);
  } else if (isNantesEvent) {
    // Si événement Nantes sans catégorie, garder le rouge
    borderColor = '#e74c3c';
  }

  return (
    <div
      className={`${baseClasses} ${holidayClass} ${selectedClass} ${nantesClass}`}
      onClick={onClick}
      style={{
        '--event-border-color': borderColor,
        borderLeftColor: isSelected ? 'transparent' : borderColor
      }}
    >
      <div className="event-time">{timeDisplay}</div>
      <div className="event-content">
        <div className="event-title">
          {event.title}
          {isNantesEvent && (
            <>
              <span className={`event-source-badge ${compact ? 'event-source-badge-compact' : ''}`}>Nantes</span>
              {event.type && (() => {
                const categoryName = event.type.split(',')[0].trim();
                const categoryColor = getCategoryColor(categoryName);
                return (
                  <span 
                    className={`event-category-badge ${compact ? 'event-category-badge-compact' : ''}`}
                    style={{ backgroundColor: categoryColor }}
                  >
                    {categoryName}
                  </span>
                );
              })()}
            </>
          )}
        </div>
        {!compact && event.location && (
          <div className="event-location">{event.location}</div>
        )}
      </div>
    </div>
  );
}

