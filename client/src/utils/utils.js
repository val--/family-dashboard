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

/**
 * Generate a consistent color for a category name
 */
export const getCategoryColor = (categoryName) => {
  if (!categoryName) return '#3498db'; // Default blue
  
  // Simple hash function to convert category name to a number
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Palette of distinct colors
  const colors = [
    '#3498db', // Blue
    '#2ecc71', // Green
    '#e74c3c', // Red
    '#f39c12', // Orange
    '#9b59b6', // Purple
    '#1abc9c', // Turquoise
    '#e67e22', // Dark Orange
    '#16a085', // Dark Turquoise
    '#c0392b', // Dark Red
    '#8e44ad', // Dark Purple
    '#27ae60', // Dark Green
    '#2980b9', // Dark Blue
    '#d35400', // Very Dark Orange
    '#7f8c8d', // Gray
    '#34495e', // Dark Gray
    '#f1c40f', // Yellow
    '#e91e63', // Pink
    '#00bcd4', // Cyan
    '#4caf50', // Light Green
    '#ff9800', // Amber
  ];
  
  // Use absolute value of hash to get index
  return colors[Math.abs(hash) % colors.length];
};

