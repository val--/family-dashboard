const axios = require('axios');
const { parseISO, format, startOfDay, eachDayOfInterval, isSameDay } = require('date-fns');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');
const config = require('./config');

// Configuration - Nouvelle API Open Data Nantes Métropole
const API_BASE_URL = 'https://data.nantesmetropole.fr/api/explore/v2.1/catalog/datasets/244400404_agenda-evenements-nantes-metropole_v2/records';
const PAGE_SIZE = 100; // Limite max de l'API
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
      // Récupérer un échantillon d'événements pour extraire les catégories
      const now = new Date();
      const timezone = config.timezone || 'Europe/Paris';
      const today = startOfDay(utcToZonedTime(now, timezone));
      const todayStr = format(today, 'yyyy-MM-dd');

      const url = `${API_BASE_URL}?limit=${PAGE_SIZE}&where=date%3E%3D%22${todayStr}%22`;
      const response = await axios.get(url, {
        timeout: 30000,
        headers: { 
          'Accept': 'application/json'
        }
      });

      const data = response.data;
      if (!data || !data.results) {
        return [];
      }

      // Extraire toutes les catégories uniques depuis types_libelles
      const categoriesSet = new Set();
      data.results.forEach(record => {
        if (record.types_libelles && Array.isArray(record.types_libelles)) {
          record.types_libelles.forEach(cat => {
            if (cat && cat.trim()) {
              categoriesSet.add(cat.trim());
            }
          });
        }
      });

      const categories = Array.from(categoriesSet).sort();

      // Mettre en cache
      this.categoriesCache = categories;
      this.categoriesCacheTimestamp = Date.now();

      return categories;
    } catch (error) {
      console.error('Error fetching available categories:', error);
      return [];
    }
  }

  async fetchRecords(selectedCategories = null, dateMax = null, limitRecords = null) {
    const now = new Date();
    const timezone = config.timezone || 'Europe/Paris';
    const today = startOfDay(utcToZonedTime(now, timezone));
    const todayStr = format(today, 'yyyy-MM-dd');

    // Si dateMax est fournie, l'utiliser, sinon pas de limite
    let whereClause = `date>=%22${todayStr}%22`;
    if (dateMax) {
      const dateMaxStr = format(dateMax, 'yyyy-MM-dd');
      whereClause += `%20AND%20date<=%22${dateMaxStr}%22`;
    }
    
    // Filtrer les événements annulés
    whereClause += `%20AND%20annule=%22non%22`;

    let allRecords = [];
    let offset = 0;
    let hasMore = true;
    const maxRecords = limitRecords || 10000; // Limite par défaut pour éviter de tout charger

    while (hasMore && allRecords.length < maxRecords) {
      try {
        const url = `${API_BASE_URL}?limit=${PAGE_SIZE}&offset=${offset}&where=${whereClause}&order_by=date%20ASC`;
        
        const response = await axios.get(url, {
          timeout: 30000,
          headers: {
            'Accept': 'application/json'
          }
        });

        const data = response.data;
        if (!data || !data.results || data.results.length === 0) {
          hasMore = false;
          break;
        }

        allRecords = allRecords.concat(data.results);

        // Vérifier s'il y a plus de résultats
        if (data.results.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          offset += PAGE_SIZE;
        }

        // Limite de sécurité
        if (offset > 10000) {
          console.warn('Reached safety limit for pagination');
          break;
        }
      } catch (error) {
        console.error('Error fetching records:', error);
        hasMore = false;
      }
    }

    return allRecords;
  }

  async getEvents(selectedCategories = null, dateMax = null, limitRecords = null) {
    // Pour la pagination, on ne peut pas utiliser le cache complet
    // car on charge seulement une partie des événements
    const cacheKey = `${JSON.stringify(selectedCategories)}_${dateMax ? format(dateMax, 'yyyy-MM-dd') : 'all'}_${limitRecords || 'all'}`;
    
    // Check cache first (seulement si pas de pagination)
    if (!dateMax && !limitRecords && this.cache && this.cacheTimestamp && Date.now() - this.cacheTimestamp < CACHE_DURATION) {
      // If selectedCategories is explicitly an empty array, return no events (all categories deselected)
      if (Array.isArray(selectedCategories) && selectedCategories.length === 0) {
        return { events: [], hasMore: false };
      }
      // If categories filter is applied, filter cached events
      if (selectedCategories && selectedCategories.length > 0) {
        const filtered = this.cache.filter(event => {
          if (!event.type) return false;
          // event.type can be a string with comma-separated categories
          const eventTypes = event.type.split(',').map(t => t.trim());
          return eventTypes.some(type => selectedCategories.includes(type));
        });
        return { events: filtered, hasMore: false };
      }
      // If selectedCategories is null/undefined, return all events (no filter)
      return { events: this.cache, hasMore: false };
    }

    try {
      const now = new Date();
      const timezone = config.timezone || 'Europe/Paris';
      const today = startOfDay(utcToZonedTime(now, timezone));

      // Récupérer les enregistrements avec pagination
      const records = await this.fetchRecords(selectedCategories, dateMax, limitRecords);
      
      if (dateMax) {
        console.log(`[Nantes Events Server] Récupéré ${records.length} enregistrements jusqu'au ${format(dateMax, 'yyyy-MM-dd')}`);
      }

      // Regrouper les enregistrements par id_manif (même événement, différentes dates)
      const eventsMap = new Map();

      records.forEach(record => {
        // Ignorer les événements annulés ou reportés
        if (record.annule === 'oui' || record.reporte === 'oui') {
          return;
        }

        const idManif = record.id_manif;
        if (!idManif) return;

        if (!eventsMap.has(idManif)) {
          // Créer un nouvel événement
          const title = record.nom || 'Sans titre';
          const types = record.types_libelles || [];
          const typeLabels = types.join(',');
          
          // Construire le lieu
          let locationString = '';
          if (record.lieu) {
            locationString = record.lieu;
          }
          if (record.adresse && record.adresse !== '.') {
            if (locationString) {
              locationString += `, ${record.adresse}`;
            } else {
              locationString = record.adresse;
            }
          }
          if (record.ville) {
            if (locationString) {
              locationString += `, ${record.ville}`;
            } else {
              locationString = record.ville;
            }
          }

          // Description
          const description = record.description_evt || record.description || '';
          // Nettoyer le HTML de la description si présent
          const cleanDescription = description.replace(/<[^>]*>/g, '').trim();

          // URL
          const url = record.lien_agenda || record.url_site || null;

          // Organisateur
          const organizer = record.emetteur || null;

          // Image
          const imageUrl = record.media_url || null;

          eventsMap.set(idManif, {
            id_manif: idManif,
            title,
            type: typeLabels || null,
            locationString,
            description: cleanDescription || null,
            url,
            organizer,
            image: imageUrl,
            timings: [] // Sera rempli avec les occurrences
          });
        }

        // Ajouter cette occurrence (date/heure) à l'événement
        const event = eventsMap.get(idManif);
        
        // Parser la date et l'heure
        const dateStr = record.date;
        if (!dateStr) return;

        // Parser la date (format YYYY-MM-DD)
        const [year, month, day] = dateStr.split('-').map(Number);
        const heureDebut = record.heure_debut || null;
        const heureFin = record.heure_fin || null;

        // Ignorer l'heure si l'événement est "toute la journée"
        // Cas 1: pas d'heure de début
        // Cas 2: heure_debut = "00:00" et heure_fin = null (événement toute la journée)
        const ignoreHeure = !heureDebut || heureDebut === '' || (heureDebut === '00:00' && (!heureFin || heureFin === ''));

        // Construire les timestamps en timezone locale d'abord
        let beginDate, endDate;
        
        if (ignoreHeure) {
          // Événement toute la journée - créer une date locale
          beginDate = new Date(year, month - 1, day, 0, 0, 0, 0);
          endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        } else {
          // Parser l'heure (format HH:mm)
          const [hours, minutes] = heureDebut.split(':').map(Number);
          beginDate = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);

          if (heureFin) {
            const [endHours, endMinutes] = heureFin.split(':').map(Number);
            endDate = new Date(year, month - 1, day, endHours || 0, endMinutes || 0, 0, 0);
          } else {
            endDate = new Date(beginDate);
            endDate.setHours(beginDate.getHours() + 2); // Par défaut 2h si pas d'heure de fin
          }
        }

        // Interpréter cette date locale comme étant en timezone Paris et convertir en UTC
        const beginUTC = zonedTimeToUtc(beginDate, timezone);
        const endUTC = zonedTimeToUtc(endDate, timezone);
        
        // Convertir en timezone Paris pour vérification
        const startInParis = utcToZonedTime(beginUTC, timezone);
        const endInParis = utcToZonedTime(endUTC, timezone);
        
        // Vérifier si l'événement se termine après aujourd'hui
        if (endInParis < today) {
          return; // Ignorer les événements déjà terminés
        }

        event.timings.push({
          begin: beginUTC.toISOString(),
          end: endUTC.toISOString(),
          ignoreHeure,
          heureDebut,
          heureFin,
          startInParis: startInParis.toISOString(),
          endInParis: endInParis.toISOString()
        });
      });

      // Formater les événements pour correspondre au format des événements Google Calendar
      const formattedEvents = [];

      eventsMap.forEach((event, idManif) => {
        const { title, type, locationString, description, url, organizer, image, timings } = event;

        // Filtrer par catégories si nécessaire
        // Si selectedCategories est un tableau vide, ne retourner aucun événement
        if (Array.isArray(selectedCategories) && selectedCategories.length === 0) {
          return; // Toutes les catégories sont désélectionnées, ne pas inclure cet événement
        }
        // Si selectedCategories contient des catégories, filtrer
        if (selectedCategories && selectedCategories.length > 0) {
          if (!type) return;
          const eventTypes = type.split(',').map(t => t.trim());
          if (!eventTypes.some(t => selectedCategories.includes(t))) {
            return;
          }
        }

        // Pour chaque timing, créer un événement (comme pour les événements multi-jours)
        timings.forEach((timing, timingIndex) => {
          // Utiliser les dates déjà converties en Paris timezone
          const startInParis = parseISO(timing.startInParis);
          const endInParis = parseISO(timing.endInParis);

          // Vérifier si l'événement s'étend sur plusieurs jours
          const startDay = startOfDay(startInParis);
          const endDay = startOfDay(endInParis);
          const spansMultipleDays = !isSameDay(startDay, endDay);

          if (spansMultipleDays) {
            // Créer un événement pour chaque jour, mais seulement à partir d'aujourd'hui
            const days = eachDayOfInterval({ start: startDay, end: endDay });
            const daysFromToday = days.filter(day => day >= today);
            daysFromToday.forEach((day, dayIndex) => {
              // Calculer l'index original dans le tableau complet
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
                if (timing.ignoreHeure) {
                  dayTimeDisplay = 'Toute la journée';
                  dayIsAllDay = true;
                } else {
                  dayTimeDisplay = format(startInParis, 'HH:mm');
                }
                dayStart = startInParis;
                dayEnd = startOfDay(startInParis);
                dayEnd.setHours(23, 59, 59);
              }
              // Dernier jour : montrer l'heure de fin
              else if (isLastDay) {
                if (timing.ignoreHeure) {
                  dayTimeDisplay = 'Toute la journée';
                  dayIsAllDay = true;
                } else {
                  dayTimeDisplay = '00:00';
                  dayEndTimeDisplay = format(endInParis, 'HH:mm');
                }
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
                id: `nantes_${idManif}_${timingIndex}_${dayIndex}`,
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
                type: type || null,
                organizer: organizer || null,
                url: url || null,
                image: image || null
              });
            });
          } else {
            // Événement sur un seul jour
            const isAllDay = timing.ignoreHeure;
            let timeDisplay, endTimeDisplay = null;

            if (isAllDay) {
              timeDisplay = 'Toute la journée';
            } else {
              timeDisplay = format(startInParis, 'HH:mm');
              if (timing.heureFin) {
                endTimeDisplay = format(endInParis, 'HH:mm');
              }
            }

            formattedEvents.push({
              id: `nantes_${idManif}_${timingIndex}`,
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
              type: type || null,
              organizer: organizer || null,
              url: url || null,
              image: image || null
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

      // Si limitRecords est fourni, limiter le nombre d'événements retournés
      // (après le regroupement par id_manif, le nombre peut être différent)
      let finalEvents = formattedEvents;
      if (limitRecords && formattedEvents.length > limitRecords) {
        finalEvents = formattedEvents.slice(0, limitRecords);
      }

      // Déterminer s'il y a plus d'événements à charger
      // Si on a limité par dateMax, on suppose qu'il y a toujours plus d'événements après
      // (sauf si on n'a récupéré aucun événement, ce qui signifie qu'on a atteint la fin)
      let hasMore = false;
      if (dateMax) {
        // Si on a des événements et qu'on a limité par date, il y a probablement plus après
        // On suppose qu'il y a toujours plus d'événements après dateMax
        hasMore = finalEvents.length > 0;
      } else if (limitRecords) {
        // Si on a limité par nombre, vérifier si on a atteint la limite
        hasMore = formattedEvents.length >= limitRecords;
      }

      // Mettre en cache seulement si on charge tout (pas de pagination)
      if (!dateMax && !limitRecords) {
        this.cache = formattedEvents;
        this.cacheTimestamp = Date.now();
      }

      return { events: finalEvents, hasMore };
    } catch (error) {
      console.error('Error fetching Nantes events:', error);
      throw error;
    }
  }
}

module.exports = new NantesEventsService();
