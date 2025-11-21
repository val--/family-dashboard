import React, { memo } from 'react';
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
 * Memoized to prevent unnecessary re-renders
 */
function EventItemComponent({ event, compact = false, onClick, isSelected = false }) {
  const timeDisplay = formatEventTime(event);
  const colorScheme = getColorScheme(event.date);
  const isHoliday = isSchoolHoliday(event.date || event.start);
  const isNantesEvent = event.source === 'nantes';
  const isPullrougeEvent = event.source === 'pullrouge';

  const baseClasses = compact ? 'event-item-compact' : 'event-item';
  const holidayClass = isHoliday ? 'event-holiday' : '';
  const selectedClass = isSelected ? 'event-item-selected' : '';
  const nantesClass = isNantesEvent ? 'event-nantes' : '';
  const pullrougeClass = isPullrougeEvent ? 'event-pullrouge' : '';

  // Déterminer la couleur de bordure
  let borderColor = '#f1c40f'; // Jaune par défaut pour calendrier familial
  if (isNantesEvent && event.type) {
    // Pour les événements Nantes, utiliser la couleur de la catégorie
    const categoryName = event.type.split(',')[0].trim();
    borderColor = getCategoryColor(categoryName);
  } else if (isNantesEvent) {
    // Si événement Nantes sans catégorie, garder le rouge
    borderColor = '#e74c3c';
  } else if (isPullrougeEvent) {
    // Pour les événements PullRouge, utiliser le rose
    borderColor = '#e91e63';
  }

  return (
    <div
      className={`${baseClasses} ${holidayClass} ${selectedClass} ${nantesClass} ${pullrougeClass}`}
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

// Memoize component to prevent unnecessary re-renders
export const EventItem = memo(EventItemComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.event.id === nextProps.event.id &&
    prevProps.event.title === nextProps.event.title &&
    prevProps.event.time === nextProps.event.time &&
    prevProps.event.location === nextProps.event.location &&
    prevProps.compact === nextProps.compact &&
    prevProps.isSelected === nextProps.isSelected
  );
});

