const axios = require('axios');
const { parseISO, format, startOfDay, eachDayOfInterval, isSameDay } = require('date-fns');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');
const config = require('./config');

// Configuration
const API_BASE_URL = 'https://metropole.nantes.fr/node/9543/filters';
const PAGE_SIZE = 100; // Nombre d'événements par page
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

class NantesEventsService {
  constructor() {
    this.cache = null;
    this.cacheTimestamp = null;
    this.categoriesCache = null;
    this.categoriesCacheTimestamp = null;
  }

  clearCache() {
    this.cache = null;
    this.cacheTimestamp = null;
    this.categoriesCache = null;
    this.categoriesCacheTimestamp = null;
  }

  async getAvailableCategories() {
    // Check cache first
    if (this.categoriesCache && this.categoriesCacheTimestamp && 
        Date.now() - this.categoriesCacheTimestamp < CACHE_DURATION) {
      return this.categoriesCache;
    }

    try {
      // Récupérer les agrégations pour obtenir toutes les catégories disponibles
      const params = new URLSearchParams({
        'aggregations[0][k]': 'nm-types',
        'aggregations[0][t]': 'af',
        'aggregations[0][m]': '',
        'aggregations[0][f]': 'nm-types',
        'aggregations[0][s]': '2000'
      });

      const url = `${API_BASE_URL}?${params.toString()}`;
      const response = await axios.get(url, {
        timeout: 30000,
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      const data = response.data;
      if (!data || !data.aggregations || !data.aggregations['nm-types']) {
        return [];
      }

      // Extraire les catégories depuis les agrégations
      const categories = data.aggregations['nm-types']
        .map(agg => agg.label)
        .sort();

      // Mettre en cache
      this.categoriesCache = categories;
      this.categoriesCacheTimestamp = Date.now();

      return categories;
    } catch (error) {
      console.error('Error fetching available categories:', error);
      return [];
    }
  }

  async getEvents(selectedCategories = null) {
    // Check cache first
    if (this.cache && this.cacheTimestamp && Date.now() - this.cacheTimestamp < CACHE_DURATION) {
      // If selectedCategories is explicitly an empty array, return no events (all categories deselected)
      if (Array.isArray(selectedCategories) && selectedCategories.length === 0) {
        return [];
      }
      // If categories filter is applied, filter cached events
      if (selectedCategories && selectedCategories.length > 0) {
        return this.cache.filter(event => {
          if (!event.type) return false;
          // event.type can be a string with comma-separated categories
          const eventTypes = event.type.split(',').map(t => t.trim());
          return eventTypes.some(type => selectedCategories.includes(type));
        });
      }
      // If selectedCategories is null/undefined, return all events (no filter)
      return this.cache;
    }

    try {
      const now = new Date();
      const timezone = config.timezone || 'Europe/Paris';
      const today = startOfDay(utcToZonedTime(now, timezone));

      // Construire les paramètres de la requête
      const params = new URLSearchParams({
        page: '0',
        size: PAGE_SIZE.toString(),
        sort: 'timingsWithFeatured.asc'
      });

      // Ajouter les agrégations pour obtenir les catégories
      params.append('aggregations[0][k]', 'nm-types');
      params.append('aggregations[0][t]', 'af');
      params.append('aggregations[0][m]', '');
      params.append('aggregations[0][f]', 'nm-types');
      params.append('aggregations[0][s]', '2000');

      // Ajouter les filtres de catégories si nécessaire
      if (selectedCategories && selectedCategories.length > 0) {
        // Pour chaque catégorie sélectionnée, on doit trouver son ID depuis les agrégations
        // Pour l'instant, on va filtrer côté client après récupération
        // TODO: Implémenter le filtrage côté API si possible
      }

      const url = `${API_BASE_URL}?${params.toString()}`;

      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      const data = response.data;

      if (!data || !data.events) {
        return [];
      }

      // Formater les événements pour correspondre au format des événements Google Calendar
      const formattedEvents = [];

      data.events.forEach(event => {
        const title = event.title?.fr || 'Sans titre';
        const timings = event.timings || [];
        const types = event['nm-types'] || [];
        const typeLabels = types.map(t => t.label).join(',');
        const location = event.location;
        const description = event.description?.fr || event.longDescription?.fr || '';
        const url = event.originAgenda?.url || null;
        const organizer = event.originAgenda?.title || null;

        // Construire l'URL de l'image si disponible
        let imageUrl = null;
        if (event.image && event.image.filename && event.image.base) {
          // Utiliser la variante "full" si disponible, sinon le fichier de base
          const variant = event.image.variants?.find(v => v.type === 'full');
          const filename = variant ? variant.filename : event.image.filename;
          imageUrl = `${event.image.base}${filename}`;
        }

        // Construire le lieu
        let locationString = '';
        if (location) {
          if (location.name) {
            locationString = location.name;
          }
          if (location.address && location.address !== '.') {
            if (locationString) {
              locationString += `, ${location.address}`;
            } else {
              locationString = location.address;
            }
          }
          if (location.city) {
            if (locationString) {
              locationString += `, ${location.city}`;
            } else {
              locationString = location.city;
            }
          }
        }

        // Pour chaque timing, créer un événement (comme pour les événements multi-jours)
        timings.forEach((timing, timingIndex) => {
          const beginDate = parseISO(timing.begin);
          const endDate = parseISO(timing.end);

          // Convertir en timezone Paris (déjà en Europe/Paris normalement)
          const startInParis = utcToZonedTime(beginDate, timezone);
          const endInParis = utcToZonedTime(endDate, timezone);

          // Vérifier si l'événement se termine après aujourd'hui
          if (endInParis < today) {
            return; // Ignorer les événements déjà terminés
          }

          // Vérifier si l'événement s'étend sur plusieurs jours
          const startDay = startOfDay(startInParis);
          const endDay = startOfDay(endInParis);
          const spansMultipleDays = !isSameDay(startDay, endDay);

          if (spansMultipleDays) {
            // Créer un événement pour chaque jour, mais seulement à partir d'aujourd'hui
            const days = eachDayOfInterval({ start: startDay, end: endDay });
            const daysFromToday = days.filter(day => day >= today);
            daysFromToday.forEach((day, dayIndex) => {
              // Calculer l'index original dans le tableau complet pour déterminer si c'est le premier/dernier jour
              const originalIndex = days.indexOf(day);
              const isFirstDay = originalIndex === 0;
              const isLastDay = originalIndex === days.length - 1;
              let dayTimeDisplay;
              let dayEndTimeDisplay = null;
              let dayIsAllDay = false;
              let dayStart = startInParis;
              let dayEnd = endInParis;

              // Premier jour : montrer l'heure de début
              if (isFirstDay) {
                dayTimeDisplay = format(startInParis, 'HH:mm');
                dayStart = startInParis;
                // Pas d'heure de fin si l'événement continue
                dayEnd = startOfDay(startInParis);
                dayEnd.setHours(23, 59, 59);
              }
              // Dernier jour : montrer l'heure de fin
              else if (isLastDay) {
                dayTimeDisplay = '00:00';
                dayEndTimeDisplay = format(endInParis, 'HH:mm');
                dayStart = startOfDay(endInParis);
                dayEnd = endInParis;
              }
              // Jours intermédiaires : toute la journée
              else {
                dayTimeDisplay = 'Toute la journée';
                dayIsAllDay = true;
                dayStart = startOfDay(day);
                dayEnd = startOfDay(day);
                dayEnd.setHours(23, 59, 59);
              }

              formattedEvents.push({
                id: `nantes_${event.uid}_${timingIndex}_${dayIndex}`,
                title,
                time: dayTimeDisplay,
                endTime: dayEndTimeDisplay,
                location: locationString || null,
                description: description || null,
                start: dayStart.toISOString(),
                end: dayEnd.toISOString(),
                date: day.toISOString(),
                isAllDay: dayIsAllDay,
                source: 'nantes',
                type: typeLabels || null,
                organizer: organizer || null,
                url: url || null,
                image: imageUrl || null
              });
            });
          } else {
            // Événement sur un seul jour
            const isAllDay = event['nm-ignorer-heure-debut'] && event['nm-ignorer-heure-fin'];
            let timeDisplay, endTimeDisplay = null;

            if (isAllDay) {
              timeDisplay = 'Toute la journée';
            } else {
              timeDisplay = format(startInParis, 'HH:mm');
              if (!event['nm-ignorer-heure-fin']) {
                endTimeDisplay = format(endInParis, 'HH:mm');
              }
            }

            formattedEvents.push({
              id: `nantes_${event.uid}_${timingIndex}`,
              title,
              time: timeDisplay,
              endTime: endTimeDisplay,
              location: locationString || null,
              description: description || null,
              start: startInParis.toISOString(),
              end: endInParis.toISOString(),
              date: startDay.toISOString(),
              isAllDay,
              source: 'nantes',
              type: typeLabels || null,
              organizer: organizer || null,
              url: url || null,
              image: imageUrl || null
            });
          }
        });
      });

      // Trier les événements par date puis par heure
      formattedEvents.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return new Date(a.start) - new Date(b.start);
      });

      // Filtrer par catégories si nécessaire
      let filteredEvents = formattedEvents;
      // If selectedCategories is explicitly an empty array, return no events (all categories deselected)
      if (Array.isArray(selectedCategories) && selectedCategories.length === 0) {
        filteredEvents = [];
      } else if (selectedCategories && selectedCategories.length > 0) {
        filteredEvents = formattedEvents.filter(event => {
          if (!event.type) return false;
          const eventTypes = event.type.split(',').map(t => t.trim());
          return eventTypes.some(type => selectedCategories.includes(type));
        });
      }
      // If selectedCategories is null/undefined, filteredEvents = formattedEvents (all events)

      // Mettre en cache
      this.cache = filteredEvents;
      this.cacheTimestamp = Date.now();

      return filteredEvents;
    } catch (error) {
      console.error('Error fetching Nantes events:', error);
      throw error;
    }
  }
}

module.exports = new NantesEventsService();
