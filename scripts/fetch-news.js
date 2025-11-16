#!/usr/bin/env node

// Script de débogage pour tester l'API NewsAPI.org
// Usage: node scripts/fetch-news.js ou npm run fetch-news

// Charger les variables d'environnement depuis la racine du projet
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const https = require('https');

const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const NEWS_COUNTRY = process.env.NEWS_COUNTRY || 'fr'; // 2-letter ISO 3166-1 code (fr = France)
const NEWS_CATEGORY = process.env.NEWS_CATEGORY || ''; // Optional: business, entertainment, general, health, science, sports, technology
const NEWS_LANGUAGE = process.env.NEWS_LANGUAGE || 'fr'; // Language code (fr = French) - only used with /everything endpoint
const NEWS_USE_EVERYTHING = process.env.NEWS_USE_EVERYTHING !== 'false'; // Use /everything endpoint by default (true) to ensure French language filtering
const NEWS_PAGE_SIZE = parseInt(process.env.NEWS_PAGE_SIZE || '20', 10);

console.log('🔍 Débogage API NewsAPI.org\n');
console.log('Configuration:');
console.log(`  - API Key: ${NEWS_API_KEY ? NEWS_API_KEY.substring(0, 10) + '...' : 'NON CONFIGURÉE'}`);
console.log(`  - Endpoint: ${NEWS_USE_EVERYTHING ? '/everything (avec filtre langue)' : '/top-headlines (par pays)'}`);
console.log(`  - Country: ${NEWS_COUNTRY}`);
console.log(`  - Language: ${NEWS_LANGUAGE}`);
console.log(`  - Category: ${NEWS_CATEGORY || 'Aucune (toutes catégories)'}`);
console.log(`  - Page Size: ${NEWS_PAGE_SIZE}\n`);

if (!NEWS_API_KEY) {
  console.error('❌ ERREUR: NEWS_API_KEY n\'est pas configurée dans le fichier .env');
  process.exit(1);
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Family-Dashboard/1.0 (https://github.com/yourusername/family-dashboard)',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {

        if (res.statusCode === 200) {
          try {
            const jsonData = JSON.parse(data);
            console.log('✅ Réponse JSON valide:');
            console.log(JSON.stringify(jsonData, null, 2));
            resolve(jsonData);
          } catch (error) {
            console.error('❌ Erreur de parsing JSON:');
            console.error(error.message);
            console.log('📄 Données brutes:');
            console.log(data);
            reject(new Error('Failed to parse news data'));
          }
        } else {
          console.error(`❌ Erreur HTTP ${res.statusCode}:`);
          try {
            const errorData = JSON.parse(data);
            console.log(JSON.stringify(errorData, null, 2));
          } catch (e) {
            console.log('📄 Données brutes:');
            console.log(data);
          }
          reject(new Error(`News API returned status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erreur de requête:');
      console.error(error);
      reject(error);
    });

    req.end();
  });
}

async function testNewsAPI() {
  try {
    let url;
    
    // Test avec /top-headlines pour France
    console.log('🚀 Démarrage du test avec endpoint /top-headlines (country=fr)...\n');
    url = `https://newsapi.org/v2/top-headlines?country=fr&pageSize=${NEWS_PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
    
    // Alternative: test avec /everything
    // console.log('🚀 Démarrage du test avec endpoint /everything (filtre langue)...\n');
    // url = `https://newsapi.org/v2/everything?q=${encodeURIComponent('France')}&language=${NEWS_LANGUAGE}&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
    
    const newsData = await makeRequest(url);

    if (newsData.status !== 'ok') {
      console.error('❌ Le statut de la réponse n\'est pas "ok":');
      console.error(`  - Status: ${newsData.status}`);
      console.error(`  - Code: ${newsData.code}`);
      console.error(`  - Message: ${newsData.message}`);
      return;
    }

    console.log('\n📊 Résumé:');
    console.log(`  - Status: ${newsData.status}`);
    console.log(`  - Total Results: ${newsData.totalResults || 0}`);
    console.log(`  - Articles reçus: ${(newsData.articles || []).length}`);

    if (newsData.articles && newsData.articles.length > 0) {
      console.log('\n📰 Premiers articles:');
      newsData.articles.slice(0, 3).forEach((article, index) => {
        console.log(`\n  Article ${index + 1}:`);
        console.log(`    - Source: ${article.source?.name || 'N/A'}`);
        console.log(`    - Titre: ${article.title || 'N/A'}`);
        console.log(`    - Description: ${article.description ? article.description.substring(0, 100) + '...' : 'N/A'}`);
        console.log(`    - URL: ${article.url || 'N/A'}`);
        console.log(`    - Publié: ${article.publishedAt || 'N/A'}`);
      });

      // Test du nettoyage des titres
      console.log('\n🧹 Test du nettoyage des titres:');
      newsData.articles.slice(0, 5).forEach((article, index) => {
        const originalTitle = article.title || '';
        const cleanTitle = originalTitle.replace(/\s*\[.*?\]\s*/g, '').trim();
        if (originalTitle !== cleanTitle) {
          console.log(`  Article ${index + 1}:`);
          console.log(`    - Original: "${originalTitle}"`);
          console.log(`    - Nettoyé: "${cleanTitle}"`);
        }
      });
    }

    console.log('\n✅ Test terminé avec succès!');
  } catch (error) {
    console.error('\n❌ Erreur lors du test:');
    console.error(`  - Message: ${error.message}`);
    if (error.stack) {
      console.error(`  - Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

testNewsAPI();

