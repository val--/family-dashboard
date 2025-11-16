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

  // Check cache
  if (newsCache && newsCache.type === newsType && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return newsCache.data;
  }

  try {
    // Build API URL based on news type
    let url;
    if (newsType === 'france') {
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent('France OR français OR Paris OR gouvernement français OR politique française')}&language=${NEWS_LANGUAGE}&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
    } else if (newsType === 'monde') {
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent('international OR world OR global -France')}&language=en&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
    } else if (newsType === 'tech') {
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent('technology tech')}&language=en&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
    } else {
      url = `https://newsapi.org/v2/everything?q=${encodeURIComponent('France OR français OR Paris OR gouvernement français OR politique française')}&language=${NEWS_LANGUAGE}&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
    }
    
    const newsData = await makeRequest(url);

    if (newsData.status !== 'ok') {
      throw new Error(`News API returned invalid status: ${newsData.status}${newsData.message ? ` - ${newsData.message}` : ''}`);
    }

    // Process articles
    const articles = (newsData.articles || [])
      .map((article) => ({
        title: article.title || 'Sans titre',
        description: article.description || '',
        source: article.source?.name || 'Source inconnue',
        url: article.url || '',
        urlToImage: article.urlToImage || null,
        author: article.author || null,
        content: article.content || null,
        publishedAt: article.publishedAt || new Date().toISOString(),
        cleanTitle: (article.title || '').replace(/\s*\[.*?\]\s*/g, '').trim() || 'Sans titre',
      }))
      .filter((article) => article.cleanTitle !== 'Sans titre' && article.cleanTitle.length > 0);

    const result = {
      articles,
      totalResults: newsData.totalResults || 0,
      lastUpdate: new Date().toISOString(),
    };

    // Update cache
    newsCache = { type: newsType, data: result };
    cacheTimestamp = Date.now();

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

