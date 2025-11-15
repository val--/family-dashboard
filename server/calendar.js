const { google } = require('googleapis');
const { format, parseISO, startOfDay, addDays, isAfter, isSameDay, eachDayOfInterval } = require('date-fns');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');
const config = require('./config');
const path = require('path');
const fs = require('fs');

class CalendarService {
  constructor() {
    this.auth = null;
    this.calendar = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const credentialsPath = path.resolve(config.credentialsPath);
      
      if (!fs.existsSync(credentialsPath)) {
        throw new Error(`Service account credentials not found at ${credentialsPath}`);
      }

      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

      this.auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly']
      });

      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Google Calendar service:', error);
      throw error;
    }
  }

  async getEvents() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const now = new Date();
      const timezone = config.timezone;
      
      // Get start of today in Paris timezone
      const todayInParis = utcToZonedTime(now, timezone);
      const startOfToday = startOfDay(todayInParis);
      const startTime = zonedTimeToUtc(startOfToday, timezone).toISOString();

          // Search up to 30 days ahead to find all upcoming events
          const endDate = addDays(startOfToday, 30);
          const endTime = zonedTimeToUtc(endDate, timezone).toISOString();

      const response = await this.calendar.events.list({
        calendarId: config.calendarId,
        timeMin: startTime,
        timeMax: endTime,
        singleEvents: true,
        orderBy: 'startTime',
            maxResults: 250 // Get all events, then filter
      });

      const events = response.data.items || [];
      
      // Format and filter events
      const formattedEvents = this.formatEvents(events, timezone);
      
      // Limit to maxEvents if specified, otherwise return all
      if (config.maxEvents) {
        return formattedEvents.slice(0, config.maxEvents);
      }
      return formattedEvents;
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  formatEvents(events, timezone) {
    const now = new Date();
    const todayInParis = utcToZonedTime(now, timezone);
    const startOfToday = startOfDay(todayInParis);

    return events
      .filter(event => {
        // Only include events that haven't ended yet
        const eventEnd = event.end?.dateTime || event.end?.date;
        if (!eventEnd) return false;

        const endDate = event.end.dateTime 
          ? parseISO(event.end.dateTime)
          : parseISO(event.end.date + 'T23:59:59');
        
        return isAfter(endDate, now);
      })
      .map(event => {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;

        let startDate;
        let endDate;
        let isAllDay = false;

        if (event.start.date) {
          // All-day event
          isAllDay = true;
          startDate = parseISO(event.start.date);
          endDate = parseISO(event.end.date);
        } else {
          // Timed event
          startDate = parseISO(event.start.dateTime);
          endDate = parseISO(event.end.dateTime);
        }

        // Convert to Paris timezone for display
        const startInParis = utcToZonedTime(startDate, timezone);
        const endInParis = utcToZonedTime(endDate, timezone);

        // Format time with start and end
        let timeDisplay;
        let endTimeDisplay = null;
        if (isAllDay) {
          timeDisplay = 'Toute la journée';
        } else {
          timeDisplay = format(startInParis, 'HH:mm');
          endTimeDisplay = format(endInParis, 'HH:mm');
        }

        // Check if event spans multiple days
        const startDay = startOfDay(startInParis);
        const endDay = startOfDay(endInParis);
        const spansMultipleDays = !isSameDay(startInParis, endInParis);

        // If event spans multiple days, create entries for each day
        if (spansMultipleDays) {
          const days = eachDayOfInterval({ start: startDay, end: endDay });
          return days.map((day, index) => {
            let dayTimeDisplay;
            let dayEndTimeDisplay = null;
            let dayIsAllDay = false;

            // First day: show start time
            if (index === 0) {
              if (isAllDay) {
                dayTimeDisplay = 'Toute la journée';
                dayIsAllDay = true;
              } else {
                dayTimeDisplay = format(startInParis, 'HH:mm');
                // Don't show end time on first day if it continues
              }
            }
            // Last day: show end time
            else if (index === days.length - 1) {
              if (isAllDay) {
                dayTimeDisplay = 'Toute la journée';
                dayIsAllDay = true;
              } else {
                dayTimeDisplay = '00:00';
                dayEndTimeDisplay = format(endInParis, 'HH:mm');
              }
            }
            // Middle days: all day
            else {
              dayTimeDisplay = 'Toute la journée';
              dayIsAllDay = true;
            }

                return {
                  id: `${event.id}_${index}`,
                  title: event.summary || 'Sans titre',
                  time: dayTimeDisplay,
                  endTime: dayEndTimeDisplay,
                  location: event.location || null,
                  description: event.description || null,
                  start: startInParis.toISOString(),
                  end: endInParis.toISOString(),
                  date: day.toISOString(),
                  isAllDay: dayIsAllDay
                };
          });
        } else {
              // Single day event
              return {
                id: event.id,
                title: event.summary || 'Sans titre',
                time: timeDisplay,
                endTime: endTimeDisplay,
                location: event.location || null,
                description: event.description || null,
                start: startInParis.toISOString(),
                end: endInParis.toISOString(),
                date: startDay.toISOString(),
                isAllDay
              };
        }
      })
      .flat() // Flatten array of arrays from multi-day events
      .sort((a, b) => {
        // Sort by date first, then by start time
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return new Date(a.start) - new Date(b.start);
      });
  }
}

module.exports = new CalendarService();


