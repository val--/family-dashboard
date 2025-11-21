// Calendar title used across the application
export const CALENDAR_TITLE = 'Agenda';

// API configuration
export const API_URL = '/api/events';
export const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
export const BUS_REFRESH_INTERVAL = 1 * 60 * 1000; // 1 minute for bus (more frequent updates needed)
export const HUE_REFRESH_INTERVAL = 3 * 1000; // 3 seconds for Hue lights (real-time updates)

// Screensaver configuration
export const SCREENSAVER_IDLE_TIME = 60 * 1000; // 1 minute

// Maximum number of events to display
export const MAX_EVENTS_WIDGET = 100; // Maximum events in the widget (increased to show more events)
export const MAX_DATES_WIDGET = 365; // Maximum date sections in the widget (1 year)
export const MAX_EVENTS_PER_DATE_WIDGET = 3; // Maximum events per date in the widget (not used anymore, but kept for reference)
export const MAX_EVENTS_FULL_PAGE = null; // null = display all events (no limit)

