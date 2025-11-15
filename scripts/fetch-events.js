/**
 * Script pour interroger l'API et récupérer les événements du calendrier
 * Usage: node scripts/fetch-events.js
 */

const calendarService = require('../server/calendar');

async function fetchEvents() {
  try {
    console.log('📅 Récupération des événements...\n');
    
    const events = await calendarService.getEvents();
    
    if (!events || events.length === 0) {
      console.log('❌ Aucun événement trouvé');
      return;
    }
    
    console.log(`✅ ${events.length} événement(s) trouvé(s):\n`);
    
    events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   Date: ${new Date(event.date).toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`);
      console.log(`   Heure: ${event.time}${event.endTime ? ` - ${event.endTime}` : ''}`);
      if (event.location) {
        console.log(`   Lieu: ${event.location}`);
      }
      if (event.description) {
        console.log(`   Description: ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des événements:', error.message);
    if (error.response) {
      console.error('Détails:', error.response.data);
    }
    process.exit(1);
  }
}

fetchEvents();

