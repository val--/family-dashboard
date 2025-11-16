import React from 'react';
import { isSchoolHoliday, getColorScheme } from '../../utils';

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

  const baseClasses = compact ? 'event-item-compact' : 'event-item';
  const holidayClass = isHoliday ? 'event-holiday' : '';
  const selectedClass = isSelected ? 'event-item-selected' : '';

  return (
    <div
      className={`${baseClasses} ${holidayClass} ${selectedClass}`}
      onClick={onClick}
      style={{
        '--event-border-color': colorScheme.border,
        borderLeftColor: isSelected ? 'transparent' : colorScheme.border
      }}
    >
      <div className="event-time">{timeDisplay}</div>
      <div className="event-content">
        <div className="event-title">{event.title}</div>
        {!compact && event.location && (
          <div className="event-location">{event.location}</div>
        )}
      </div>
    </div>
  );
}

