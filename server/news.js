const https = require('https');
const config = require('./config');

const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const NEWS_COUNTRY = process.env.NEWS_COUNTRY || 'fr'; // 2-letter ISO 3166-1 code (fr = France)
const NEWS_CATEGORY = process.env.NEWS_CATEGORY || ''; // Optional: business, entertainment, general, health, science, sports, technology
const NEWS_LANGUAGE = process.env.NEWS_LANGUAGE || 'fr'; // Language code (fr = French) - only used with /everything endpoint
const NEWS_USE_EVERYTHING = process.env.NEWS_USE_EVERYTHING !== 'false'; // Use /everything endpoint by default (true) to ensure French language filtering
const NEWS_PAGE_SIZE = parseInt(process.env.NEWS_PAGE_SIZE || '20', 10);

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
let newsCache = null;
let cacheTimestamp = null;
let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 5 * 60 * 1000; // Log same error at most once every 5 minutes

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
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error('Failed to parse news data'));
          }
        } else {
          let errorMessage = `News API returned status ${res.statusCode}`;
          try {
            const errorData = JSON.parse(data);
            if (errorData.message) {
              errorMessage += `: ${errorData.message}`;
            }
          } catch (e) {
            // Ignore parse error, use default message
          }
          reject(new Error(errorMessage));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function getNewsData(newsType = 'france') {
  if (!NEWS_API_KEY) {
    throw new Error('NEWS_API_KEY is not configured');
  }

  // Check cache (separate cache per news type)
  const cacheKey = `news_${newsType}`;
  if (newsCache && newsCache.type === newsType && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    const cacheAge = Math.round((Date.now() - cacheTimestamp) / 1000);
    console.log(`[News] ✅ Données récupérées depuis le cache serveur (type: ${newsType}, âge: ${cacheAge}s)`);
    return newsCache.data;
  }
  
  console.log(`[News] 🔄 Appel API réel - cache serveur expiré ou inexistant (type: ${newsType})`);

  try {
    let url;
    
    if (newsType === 'france') {
      // France news - use /everything with specific French sources and France-related keywords
      // Search for news from French sources or about France (national news)
      console.log(`[News] 📡 Appel API: everything (France - actualités nationales, language: ${NEWS_LANGUAGE})`);
      // Use a more specific query to get French national news: search for France-related terms
      // and filter by French language to get news from/about France
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent('France OR français OR Paris OR gouvernement français OR politique française')}&language=${NEWS_LANGUAGE}&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
    } else if (newsType === 'monde') {
      // World news - use /everything with broader search, in English
      // Use multiple search terms to get international news, excluding France-specific news
      console.log(`[News] 📡 Appel API: everything (Monde, language: en)`);
      // Search for international/world news terms, excluding "France" to avoid French domestic news
      // Using OR logic: (international OR world OR global) AND NOT France
      // Use English language for world news
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent('international OR world OR global -France')}&language=en&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
    } else if (newsType === 'tech') {
      // Tech news - use /everything with technology search, in English
      console.log(`[News] 📡 Appel API: everything (Tech, language: en)`);
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent('technology tech')}&language=en&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
    } else {
      // Fallback to France - use /everything with France search
      console.log(`[News] 📡 Appel API: everything (France - actualités nationales, language: ${NEWS_LANGUAGE})`);
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent('France OR français OR Paris OR gouvernement français OR politique française')}&language=${NEWS_LANGUAGE}&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
    }
    
    console.log(`[News] 🔗 URL appelée: ${url}`);
    const newsData = await makeRequest(url);
    console.log(`[News] ✅ Réponse API reçue:`, {
      status: newsData.status,
      totalResults: newsData.totalResults,
      articlesCount: newsData.articles?.length || 0,
      firstArticleTitle: newsData.articles?.[0]?.title || 'N/A',
      firstArticleSource: newsData.articles?.[0]?.source?.name || 'N/A'
    });

    if (newsData.status !== 'ok') {
      console.error(`[News] ❌ Statut API invalide:`, newsData);
      throw new Error(`News API returned invalid status: ${newsData.status}${newsData.message ? ` - ${newsData.message}` : ''}`);
    }

    // Process articles
    const articles = (newsData.articles || []).map((article) => ({
      title: article.title || 'Sans titre',
      description: article.description || '',
      source: article.source?.name || 'Source inconnue',
      url: article.url || '',
      urlToImage: article.urlToImage || null,
      author: article.author || null,
      content: article.content || null, // Truncated content (200 chars max from API)
      publishedAt: article.publishedAt || new Date().toISOString(),
      // Remove [Removed] or [Source] patterns that NewsAPI sometimes adds
      cleanTitle: (article.title || '').replace(/\s*\[.*?\]\s*/g, '').trim() || 'Sans titre',
    })).filter((article) => article.cleanTitle !== 'Sans titre' && article.cleanTitle.length > 0);

    if (articles.length === 0) {
      console.warn(`[News] ⚠️  Aucun article valide après traitement (${newsData.articles?.length || 0} articles bruts reçus)`);
    }

    const result = {
      articles,
      totalResults: newsData.totalResults || 0,
      lastUpdate: new Date().toISOString(),
    };

    // Update cache
    newsCache = { type: newsType, data: result };
    cacheTimestamp = Date.now();
    console.log(`[News] 💾 Données mises en cache serveur (type: ${newsType}, durée: ${CACHE_DURATION / 1000 / 60} minutes, ${articles.length} articles)`);
    console.log(`[News] 📋 Articles traités (${articles.length}):`, articles.slice(0, 3).map(a => ({
      source: a.source,
      title: a.cleanTitle || a.title,
      publishedAt: a.publishedAt
    })));

    return result;
  } catch (error) {
    // Only log error if it's been more than ERROR_LOG_INTERVAL since last log
    const now = Date.now();
    if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
      console.error('Error fetching news data:', error.message);
      lastErrorLogTime = now;
    }
    throw error;
  }
}

module.exports = {
  getNewsData,
};

