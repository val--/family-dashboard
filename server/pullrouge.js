const axios = require('axios');
const cheerio = require('cheerio');
const { parse, format, startOfDay } = require('date-fns');
const { fr } = require('date-fns/locale');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');
const config = require('./config');
const path = require('path');
const fs = require('fs');

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const DATA_DIR = path.join(__dirname, '../data');
const EVENTS_FILE = path.join(DATA_DIR, 'pullrouge-events.json');

class PullRougeService {
  constructor() {
    this.cache = null;
    this.cacheTimestamp = null;
  }

  clearCache() {
    this.cache = null;
    this.cacheTimestamp = null;
  }

  /**
   * Parse a French date string like "vendredi 21 novembre 2025"
   */
  parseFrenchDate(dateStr) {
    try {
      // Remove day name if present (e.g., "vendredi 21 novembre 2025" -> "21 novembre 2025")
      const dateWithoutDay = dateStr.replace(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+/i, '');
      
      // Parse the date
      const parsedDate = parse(dateWithoutDay, 'd MMMM yyyy', new Date(), { locale: fr });
      
      if (isNaN(parsedDate.getTime())) {
        return null;
      }
      
      return parsedDate;
    } catch (error) {
      console.error('Error parsing date:', dateStr, error);
      return null;
    }
  }

  /**
   * Parse time string like "20h00" or "19h30"
   */
  parseTime(timeStr) {
    try {
      const match = timeStr.match(/(\d{1,2})h(\d{2})?/);
      if (!match) return null;
      
      const hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
      }
      
      return { hours, minutes };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract venue from text (after @ symbol)
   * Handles cases like "@ Lune Froide / 5€" or "@ salle des Trois Îles - BASSE INDRE / COMPLET"
   */
  extractVenue(text) {
    // Find the @ symbol
    const atIndex = text.indexOf('@');
    if (atIndex === -1) return null;
    
    // Get text after @
    const afterAt = text.substring(atIndex + 1).trim();
    
    // Find the first / that's likely the price separator (not part of venue name)
    // Look for pattern like "venue name / price" or "venue - location / price"
    const priceMatch = afterAt.match(/^([^/]+?)(?:\s*\/\s*(.+))?$/);
    if (priceMatch) {
      let venue = priceMatch[1].trim();
      // Remove trailing / if present
      venue = venue.replace(/\s*\/\s*$/, '');
      return venue;
    }
    
    return afterAt.replace(/\s*\/\s*$/, '');
  }

  /**
   * Extract price/info from text (after / that comes after @)
   */
  extractPriceInfo(text) {
    // Find the @ symbol first
    const atIndex = text.indexOf('@');
    if (atIndex === -1) {
      // No @, check if there's a / anywhere
      const parts = text.split('/');
      if (parts.length > 1) {
        return parts.slice(1).join('/').trim();
      }
      return null;
    }
    
    // Get text after @
    const afterAt = text.substring(atIndex + 1).trim();
    
    // Find the / that separates venue from price
    const priceMatch = afterAt.match(/^[^/]+\s*\/\s*(.+)$/);
    if (priceMatch) {
      return priceMatch[1].trim();
    }
    
    return null;
  }

  /**
   * Clean artist name (remove "présente", ">>", etc.)
   */
  cleanArtistName(artistStr) {
    return artistStr
      .replace(/\s*_présente_\s*/gi, ' ')
      .replace(/\s*>>\s*/g, ' / ')
      .replace(/\s*>\s*/g, ' / ')
      .trim();
  }

  /**
   * Extract image URL from HTML that follows an event
   * Looks for img tags near the event text
   */
  findEventImage($, eventText, eventIndex) {
    try {
      // Find all images in the body
      const images = $('body img');
      const bodyHtml = $('body').html();
      
      // Find the position of the event text in the HTML
      const eventTextIndex = bodyHtml.indexOf(eventText);
      if (eventTextIndex === -1) {
        return null;
      }
      
      // Look for images that appear after this event text (within reasonable distance)
      let closestImage = null;
      let closestDistance = Infinity;
      
      images.each((i, img) => {
        const imgHtml = $.html(img);
        const imgIndex = bodyHtml.indexOf(imgHtml);
        
        // Only consider images that come after the event text
        if (imgIndex > eventTextIndex) {
          const distance = imgIndex - eventTextIndex;
          // Only consider images within 2000 characters (reasonable distance)
          if (distance < 2000 && distance < closestDistance) {
            const src = $(img).attr('src');
            if (src && src.startsWith('http')) {
              closestImage = src;
              closestDistance = distance;
            }
          }
        }
      });
      
      return closestImage;
    } catch (error) {
      console.error('Error finding event image:', error);
      return null;
    }
  }

  /**
   * Find image that follows an event in the HTML
   * Returns the image URL if found, null otherwise
   * Only returns an image if it appears directly after the event (no new event in between)
   */
  findImageAfterEvent($, bodyHtml, eventEndIndex) {
    if (eventEndIndex === null || eventEndIndex === undefined) {
      return null;
    }
    
    // Find all images
    const images = $('body img');
    let closestImage = null;
    let closestDistance = Infinity;
    
    // Pattern to detect start of a new event (date pattern)
    const datePattern = /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/i;
    
    images.each((i, img) => {
      const src = $(img).attr('src');
      if (!src || !src.startsWith('http')) {
        return; // Skip invalid images
      }
      
      // Find the position of this image in the HTML
      const imgHtml = $.html(img);
      const imgIndex = bodyHtml.indexOf(imgHtml, eventEndIndex);
      
      // Only consider images that come after the event
      if (imgIndex !== -1 && imgIndex > eventEndIndex) {
        const distance = imgIndex - eventEndIndex;
        
        // Check if there's a new event between the current event and this image
        const htmlBetween = bodyHtml.substring(eventEndIndex, imgIndex);
        const textBetween = htmlBetween.replace(/<[^>]*>/g, ''); // Remove HTML tags to check text
        const hasNewEvent = datePattern.test(textBetween);
        
        // Only consider images within 2000 characters and without a new event in between
        if (distance < 2000 && !hasNewEvent && distance < closestDistance) {
          closestImage = src;
          closestDistance = distance;
        }
      }
    });
    
    return closestImage;
  }

  /**
   * Parse event lines from the HTML content
   */
  parseEvents(html) {
    const $ = cheerio.load(html);
    const events = [];
    
    // Get the main content - the site seems to have events in the body
    const bodyText = $('body').text();
    const bodyHtml = $('body').html();
    
    // Split by lines and process (keep original whitespace for indentation detection)
    const lines = bodyText.split('\n');
    
    let currentDate = null;
    let currentTime = null;
    let eventLines = []; // Accumulate lines for multi-line events
    let eventStartIndex = null; // Track where event starts in HTML
    let eventEndIndex = null; // Track where event ends in HTML
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines (but continue accumulating if we're in an event)
      if (!trimmedLine) {
        // If we have accumulated event lines, process them
        if (eventLines.length > 0 && currentDate && currentTime) {
          const fullEventText = eventLines.join(' ').trim();
          if (fullEventText.length > 5) {
            // Find where this event ends in the HTML
            if (eventStartIndex !== null) {
              // Find the last line of the event in the HTML
              // Try to find a unique part of the last line (venue or price info)
              const lastLine = eventLines[eventLines.length - 1];
              let searchText = lastLine;
              
              // Try to find venue or price in the last line for better matching
              const venueMatch = lastLine.match(/@\s*([^/\n]+)/);
              if (venueMatch) {
                searchText = venueMatch[1].trim();
              } else {
                // Use last 50 chars of the line
                searchText = lastLine.substring(Math.max(0, lastLine.length - 50));
              }
              
              const lastLineIndex = bodyHtml.indexOf(searchText, eventStartIndex);
              if (lastLineIndex !== -1) {
                // Find the end of this text in the HTML (look for closing tags or end of text)
                let endPos = lastLineIndex + searchText.length;
                // Look ahead for closing tags or newlines
                const nextChars = bodyHtml.substring(endPos, endPos + 100);
                const tagMatch = nextChars.match(/^[^<]*/);
                if (tagMatch) {
                  endPos += tagMatch[0].length;
                }
                eventEndIndex = endPos;
              } else {
                // Fallback: use the full last line
                const fallbackIndex = bodyHtml.indexOf(lastLine, eventStartIndex);
                if (fallbackIndex !== -1) {
                  eventEndIndex = fallbackIndex + lastLine.length;
                }
              }
            }
            this.processEventLine(fullEventText, currentDate, currentTime, events, $, bodyHtml, eventStartIndex, eventEndIndex);
          }
          eventLines = [];
          eventStartIndex = null;
          eventEndIndex = null;
          currentTime = null; // Reset for next event
        }
        continue;
      }
      
      // Try to match date pattern: "vendredi 21 novembre 2025" or "samedi 22 novembre 2025"
      const dateMatch = trimmedLine.match(/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);
      
      if (dateMatch) {
        // Process any accumulated event lines first
        if (eventLines.length > 0 && currentDate && currentTime) {
          const fullEventText = eventLines.join(' ').trim();
          if (fullEventText.length > 5) {
            // Find where this event ends in the HTML
            if (eventStartIndex !== null) {
              // Find the last line of the event in the HTML
              const lastLine = eventLines[eventLines.length - 1];
              let searchText = lastLine;
              
              // Try to find venue or price in the last line for better matching
              const venueMatch = lastLine.match(/@\s*([^/\n]+)/);
              if (venueMatch) {
                searchText = venueMatch[1].trim();
              } else {
                // Use last 50 chars of the line
                searchText = lastLine.substring(Math.max(0, lastLine.length - 50));
              }
              
              const lastLineIndex = bodyHtml.indexOf(searchText, eventStartIndex);
              if (lastLineIndex !== -1) {
                // Find the end of this text in the HTML
                let endPos = lastLineIndex + searchText.length;
                // Look ahead for closing tags or newlines
                const nextChars = bodyHtml.substring(endPos, endPos + 100);
                const tagMatch = nextChars.match(/^[^<]*/);
                if (tagMatch) {
                  endPos += tagMatch[0].length;
                }
                eventEndIndex = endPos;
              } else {
                // Fallback: use the full last line
                const fallbackIndex = bodyHtml.indexOf(lastLine, eventStartIndex);
                if (fallbackIndex !== -1) {
                  eventEndIndex = fallbackIndex + lastLine.length;
                }
              }
            }
            this.processEventLine(fullEventText, currentDate, currentTime, events, $, bodyHtml, eventStartIndex, eventEndIndex);
          }
          eventLines = [];
          eventStartIndex = null;
          eventEndIndex = null;
        }
        
        // This line contains a date
        const dateStr = dateMatch[0];
        currentDate = this.parseFrenchDate(dateStr);
        
        // Find where this date line starts in the HTML
        const dateIndex = bodyHtml.indexOf(dateStr);
        if (dateIndex !== -1) {
          eventStartIndex = dateIndex;
        }
        
        // Check if there's a time on the same line (after the date)
        const afterDate = trimmedLine.substring(trimmedLine.indexOf(dateMatch[0]) + dateMatch[0].length).trim();
        const timeMatch = afterDate.match(/(\d{1,2}h\d{2})/);
        
        if (timeMatch) {
          const timeObj = this.parseTime(timeMatch[1]);
          if (timeObj) {
            currentTime = timeObj;
            
            // Check if there's event info after the time on the same line
            const afterTime = afterDate.substring(afterDate.indexOf(timeMatch[0]) + timeMatch[0].length).trim();
            if (afterTime && afterTime.length > 5) {
              eventLines.push(afterTime);
            }
          }
        } else {
          currentTime = null;
        }
        continue;
      }
      
      // Try to match time pattern: "20h00" or "19h30" (standalone time line)
      const timeMatch = trimmedLine.match(/^(\d{1,2}h\d{2})\s+(.+)$/);
      if (timeMatch && currentDate) {
        // Process any accumulated event lines first
        if (eventLines.length > 0 && currentTime) {
          const fullEventText = eventLines.join(' ').trim();
          if (fullEventText.length > 5) {
            if (eventStartIndex !== null) {
              const lastLine = eventLines[eventLines.length - 1];
              const lastLineIndex = bodyHtml.indexOf(lastLine, eventStartIndex);
              if (lastLineIndex !== -1) {
                eventEndIndex = lastLineIndex + lastLine.length;
              }
            }
            this.processEventLine(fullEventText, currentDate, currentTime, events, $, bodyHtml, eventStartIndex, eventEndIndex);
          }
          eventLines = [];
          eventStartIndex = null;
          eventEndIndex = null;
        }
        
        const timeObj = this.parseTime(timeMatch[1]);
        if (timeObj) {
          currentTime = timeObj;
          const eventInfo = timeMatch[2].trim();
          if (eventInfo && eventInfo.length > 5) {
            eventLines.push(eventInfo);
            // Update event start index if not set
            if (eventStartIndex === null) {
              const timeIndex = bodyHtml.indexOf(timeMatch[1]);
              if (timeIndex !== -1) {
                eventStartIndex = timeIndex;
              }
            }
          }
        }
        continue;
      }
      
      // If we have a date and time, accumulate event detail lines
      // Event detail lines are usually indented (start with spaces) or contain @
      if (currentDate && currentTime) {
        // Check if this line looks like an event detail (contains @, or is indented, or has artist-like content)
        if (trimmedLine.includes('@') || 
            (line.startsWith(' ') && trimmedLine.length > 2) ||
            (/[A-Za-z]/.test(trimmedLine) && trimmedLine.length > 3 && !trimmedLine.match(/^\d{4}\s+\d{2}h\d{2}/))) {
          eventLines.push(trimmedLine);
          continue;
        }
      }
      
      // If we have a date but no time, check if this line has a time
      if (currentDate && !currentTime) {
        const timeMatch = trimmedLine.match(/(\d{1,2}h\d{2})/);
        if (timeMatch) {
          const timeObj = this.parseTime(timeMatch[1]);
          if (timeObj) {
            currentTime = timeObj;
            const afterTime = trimmedLine.substring(trimmedLine.indexOf(timeMatch[0]) + timeMatch[0].length).trim();
            if (afterTime && afterTime.length > 5) {
              eventLines.push(afterTime);
            }
          }
        }
      }
    }
    
    // Process any remaining accumulated event lines
    if (eventLines.length > 0 && currentDate && currentTime) {
      const fullEventText = eventLines.join(' ').trim();
      if (fullEventText.length > 5) {
        if (eventStartIndex !== null) {
          const lastLine = eventLines[eventLines.length - 1];
          const lastLineIndex = bodyHtml.indexOf(lastLine, eventStartIndex);
          if (lastLineIndex !== -1) {
            eventEndIndex = lastLineIndex + lastLine.length;
          }
        }
        this.processEventLine(fullEventText, currentDate, currentTime, events, $, bodyHtml, eventStartIndex, eventEndIndex);
      }
    }
    
    return events;
  }

  /**
   * Process a single event line and add it to events array
   */
  processEventLine(line, date, time, events, $ = null, bodyHtml = null, eventStartIndex = null, eventEndIndex = null) {
    // Skip lines that are clearly not events
    if (line.includes('▼') || line.includes('▲') || line.trim().startsWith('*') || 
        line.includes('bouloches du jour') || line.includes('détails') ||
        line.includes('tricots copains') || line.includes('©') ||
        line.match(/^\d{4}\s+\d{2}h\d{2}/) || // Skip timestamp lines like "2111 10h01"
        line.includes('https://') || line.includes('http://') ||
        line.includes('VERNISSAGE') && !line.includes('@') || // Skip standalone "VERNISSAGE" lines
        line.includes('FINISSAGE') && !line.includes('@')) { // Skip standalone "FINISSAGE" lines
      return;
    }
    
    // Skip if line is too short or doesn't look like an event
    if (line.trim().length < 5) {
      return;
    }
    
    // Extract venue (must be done first to know where artist name ends)
    const venue = this.extractVenue(line);
    
    // Extract price/info
    const priceInfo = this.extractPriceInfo(line);
    
    // Extract artist name (everything before @)
    let artistName = line;
    const atIndex = line.indexOf('@');
    if (atIndex !== -1) {
      // Everything before @ is the artist name
      artistName = line.substring(0, atIndex).trim();
    } else {
      // No @, check if there's a / that might separate artist from price
      const slashIndex = line.indexOf('/');
      if (slashIndex !== -1 && !priceInfo) {
        // If there's a / but we didn't extract price info, it might be part of artist name
        // Only use it if the part after / doesn't look like a price
        const afterSlash = line.substring(slashIndex + 1).trim();
        if (!afterSlash.match(/^\d+€|prix|free|COMPLET|ANNULÉ/i)) {
          artistName = line.substring(0, slashIndex).trim();
        }
      }
    }
    
    // Clean artist name
    artistName = this.cleanArtistName(artistName);
    
    // Skip if no artist name (venue is optional)
    if (!artistName || artistName.length < 2) {
      return;
    }
    
    // Create date object with time
    const timezone = config.timezone || 'Europe/Paris';
    const eventDate = new Date(date);
    eventDate.setHours(time.hours, time.minutes, 0, 0);
    
    // Convert to timezone
    const eventDateInParis = utcToZonedTime(eventDate, timezone);
    const eventDateUTC = zonedTimeToUtc(eventDateInParis, timezone);
    
    // Try to find associated image (if there's an <img> tag directly after this event)
    let imageUrl = null;
    if ($ && bodyHtml && eventEndIndex !== null) {
      // Use the eventEndIndex to find images that follow directly after
      imageUrl = this.findImageAfterEvent($, bodyHtml, eventEndIndex);
    }
    
    // Create event object
    const event = {
      id: `pullrouge_${date.getTime()}_${time.hours}${time.minutes}_${artistName.substring(0, 20).replace(/\s+/g, '_')}`,
      title: artistName,
      time: format(eventDateInParis, 'HH:mm'),
      location: venue || null,
      description: priceInfo || null,
      start: eventDateUTC.toISOString(),
      end: eventDateUTC.toISOString(), // We don't have end time, use same as start
      date: startOfDay(eventDateInParis).toISOString(),
      isAllDay: false,
      source: 'pullrouge',
      venue: venue || null,
      priceInfo: priceInfo || null,
      image: imageUrl || null
    };
    
    events.push(event);
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * Save events to JSON file
   */
  saveEventsToFile(events) {
    try {
      this.ensureDataDir();
      const data = {
        events,
        lastUpdate: new Date().toISOString(),
        count: events.length
      };
      fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[PullRouge] Saved ${events.length} events to ${EVENTS_FILE}`);
    } catch (error) {
      console.error('[PullRouge] Error saving events to file:', error);
    }
  }

  /**
   * Load events from JSON file
   */
  loadEventsFromFile() {
    try {
      if (!fs.existsSync(EVENTS_FILE)) {
        return [];
      }
      const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
      return data.events || [];
    } catch (error) {
      console.error('[PullRouge] Error loading events from file:', error);
      return [];
    }
  }

  /**
   * Fetch and save events (called periodically)
   */
  async refreshEvents() {
    try {
      console.log('[PullRouge] Starting refresh...');
      const response = await axios.get('https://pullrouge.fr/', {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const events = this.parseEvents(response.data);
      
      // Filter out past events
      const now = new Date();
      const timezone = config.timezone || 'Europe/Paris';
      const filteredEvents = events.filter(event => {
        const eventDate = new Date(event.start);
        return eventDate >= now;
      });
      
      // Sort by date
      filteredEvents.sort((a, b) => {
        return new Date(a.start) - new Date(b.start);
      });
      
      // Save to file
      this.saveEventsToFile(filteredEvents);
      
      // Update cache
      this.cache = filteredEvents;
      this.cacheTimestamp = Date.now();
      
      console.log(`[PullRouge] Refresh complete: ${filteredEvents.length} events`);
      return filteredEvents;
    } catch (error) {
      console.error('[PullRouge] Error refreshing events:', error);
      // Return cached events or file events if available
      if (this.cache) {
        return this.cache;
      }
      return this.loadEventsFromFile();
    }
  }

  async getEvents() {
    // Check cache first
    if (this.cache && this.cacheTimestamp && Date.now() - this.cacheTimestamp < CACHE_DURATION) {
      return this.cache;
    }

    // Try to load from file if cache is expired
    const fileEvents = this.loadEventsFromFile();
    if (fileEvents.length > 0) {
      // Use file events as cache
      this.cache = fileEvents;
      this.cacheTimestamp = Date.now();
      return fileEvents;
    }

    // If no file, fetch fresh data
    return await this.refreshEvents();
  }
}

module.exports = new PullRougeService();

