import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Capitalize first letter of each word
 */
export const capitalizeFirst = (str) => {
  return str.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

/**
 * Get formatted date title (Aujourd'hui, Demain, or formatted date)
 */
export const getDateTitle = (dateISO) => {
  const date = parseISO(dateISO);
  if (isToday(date)) {
    return 'Aujourd\'hui';
  } else if (isTomorrow(date)) {
    return 'Demain';
  } else {
    const formatted = format(date, 'EEEE d MMMM yyyy', { locale: fr });
    return capitalizeFirst(formatted);
  }
};

/**
 * Generate color scheme based on date hash
 */
export const getColorScheme = (dateISO) => {
  let dateHash = 0;
  if (dateISO) {
    const date = new Date(dateISO);
    dateHash = date.getDate() + date.getMonth() * 31;
  }
  const colors = [
    { border: '#3498db', bg: '#e8f4f8' }, // Blue
    { border: '#2ecc71', bg: '#e8f8f0' }, // Green
    { border: '#e74c3c', bg: '#fdeaea' }, // Red
    { border: '#f39c12', bg: '#fef5e7' }, // Orange
    { border: '#9b59b6', bg: '#f4ecf7' }, // Purple
    { border: '#1abc9c', bg: '#e8f8f5' }, // Turquoise
  ];
  return colors[dateHash % colors.length];
};

/**
 * Get single color for widget (simplified version)
 */
export const getEventColor = (dateISO) => {
  const scheme = getColorScheme(dateISO);
  return scheme.border;
};

