const https = require('https');
const http = require('http');

/**
 * Script pour trouver l'identifiant d'un arrêt de bus TAN
 * Usage: node scripts/find-bus-stop.js "nom de l'arrêt" [latitude] [longitude]
 * 
 * Exemple: node scripts/find-bus-stop.js "La Houssais" 47.2 -1.55
 */

const stopName = process.argv[2] || 'La Houssais';
const lat = process.argv[3] || '47.2'; // Latitude approximative de Rezé
const lon = process.argv[4] || '-1.55'; // Longitude approximative de Rezé

console.log(`🔍 Recherche de l'arrêt "${stopName}" près de ${lat}, ${lon}...\n`);

// API Naolib - Liste des arrêts à proximité (utilise HTTPS)
const url = `https://open.tan.fr/ewp/arrets.json/${lat}/${lon}`;

console.log(`📡 Appel API: ${url}\n`);

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const stops = JSON.parse(data);
            
            if (!Array.isArray(stops)) {
              console.error('❌ Format de réponse inattendu');
              console.log('Structure de la réponse:', JSON.stringify(stops, null, 2).substring(0, 500));
              return;
            }

            console.log(`✅ ${stops.length} arrêts trouvés à proximité\n`);
            
            // Afficher la structure du premier arrêt pour debug
            if (stops.length > 0) {
              console.log('📋 Structure d\'un arrêt (premier exemple):');
              console.log(JSON.stringify(stops[0], null, 2));
              console.log('\n');
            }

            // Chercher l'arrêt par nom (insensible à la casse)
            const searchTerm = stopName.toLowerCase();
            const matchingStops = stops.filter(stop => {
              const name = (stop.libelle || stop.nom || stop.name || '').toLowerCase();
              return name.includes(searchTerm);
            });

            if (matchingStops.length > 0) {
              console.log(`🎯 ${matchingStops.length} arrêt(s) correspondant à "${stopName}":\n`);
              
              matchingStops.forEach((stop, index) => {
                const name = stop.libelle || stop.nom || stop.name || 'Sans nom';
                const code = stop.codeLieu || stop.code || stop.id || 'N/A';
                const lignes = stop.ligne ? stop.ligne.map(l => l.numLigne).join(', ') : 'N/A';
                const distance = stop.distance || 'N/A';
                
                console.log(`${index + 1}. ${name}`);
                console.log(`   Code: ${code}`);
                console.log(`   Lignes: ${lignes}`);
                console.log(`   Distance: ${distance}`);
                console.log('');
              });

              if (matchingStops.length === 1) {
                const stop = matchingStops[0];
                const code = stop.codeLieu || stop.code || stop.id || 'N/A';
                console.log(`✅ Identifiant recommandé: ${code}`);
              } else {
                console.log('⚠️  Plusieurs arrêts trouvés. Vérifiez lequel correspond à votre arrêt.');
              }
            } else {
              console.log(`❌ Aucun arrêt trouvé correspondant à "${stopName}"\n`);
              console.log('📋 Liste de tous les arrêts trouvés:\n');
              stops.forEach((stop, index) => {
                const name = stop.libelle || stop.nom || stop.name || 'Sans nom';
                const code = stop.codeLieu || stop.code || stop.id || 'N/A';
                const distance = stop.distance || 'N/A';
                console.log(`${index + 1}. ${name} (Code: ${code}, Distance: ${distance})`);
              });
            }
          } catch (error) {
            console.error('❌ Erreur lors du parsing JSON:', error.message);
            console.log('Réponse brute (premiers 1000 caractères):', data.substring(0, 1000));
          }
        } else {
          console.error(`❌ Erreur HTTP ${res.statusCode}`);
          console.log('Réponse:', data);
        }
      });
}).on('error', (error) => {
  console.error('❌ Erreur lors de la requête:', error.message);
});

