const https = require('https');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY || '';
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
          let errorMessage = `NewsData API returned status ${res.statusCode}`;
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

async function getNewsData(newsType = 'news') {
  // Check cache
  if (newsCache && newsCache.type === newsType && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return newsCache.data;
  }

  try {
    let url;
    let newsData;
    
    if (!NEWSDATA_API_KEY) {
      throw new Error('NEWSDATA_API_KEY is not configured');
    }
    
    // Build API URL based on news type
    if (newsType === 'news') {
      // Actualités françaises (top)
      url = `https://newsdata.io/api/1/latest?country=fr&language=fr&category=top&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'tech') {
      // Actualités tech
      url = `https://newsdata.io/api/1/latest?category=Technology&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'crime') {
      // Actualités crime
      url = `https://newsdata.io/api/1/latest?category=Crime&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'entertainment') {
      // Actualités entertainment
      url = `https://newsdata.io/api/1/latest?category=Entertainment&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'lifestyle') {
      // Actualités lifestyle
      url = `https://newsdata.io/api/1/latest?category=Lifestyle&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'world') {
      // Actualités world
      url = `https://newsdata.io/api/1/latest?category=World&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'domestic') {
      // Actualités domestic
      url = `https://newsdata.io/api/1/latest?category=Domestic&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'education') {
      // Actualités education
      url = `https://newsdata.io/api/1/latest?category=Education&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'environment') {
      // Actualités environment
      url = `https://newsdata.io/api/1/latest?category=Environment&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'health') {
      // Actualités health
      url = `https://newsdata.io/api/1/latest?category=Health&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'politics') {
      // Actualités politics
      url = `https://newsdata.io/api/1/latest?category=Politics&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else if (newsType === 'tourism') {
      // Actualités tourism
      url = `https://newsdata.io/api/1/latest?category=Tourism&language=fr&apikey=${NEWSDATA_API_KEY}`;
    } else {
      // Par défaut, actualités françaises
      url = `https://newsdata.io/api/1/latest?country=fr&language=fr&category=top&apikey=${NEWSDATA_API_KEY}`;
    }
    
    newsData = await makeRequest(url);
    
    // newsdata.io retourne 'status: success' et 'results' au lieu de 'articles'
    if (newsData.status !== 'success') {
      throw new Error(`NewsData API returned invalid status: ${newsData.status}${newsData.message ? ` - ${newsData.message}` : ''}`);
    }
    
    // Process articles from newsdata.io format
    // Documentation: https://newsdata.io/documentation#response-object
    const articles = (newsData.results || [])
      .map((article) => ({
        title: article.title || 'Sans titre',
        description: article.description || '',
        source: article.source_name || article.source_id || 'Source inconnue',
        url: article.link || '',
        urlToImage: article.image_url || null,
        author: article.creator?.[0] || article.creator || null,
        content: article.content || null,
        publishedAt: article.pubDate || new Date().toISOString(),
        cleanTitle: (article.title || '').replace(/\s*\[.*?\]\s*/g, '').trim() || 'Sans titre',
      }))
      .filter((article) => article.cleanTitle !== 'Sans titre' && article.cleanTitle.length > 0);

    const result = {
      articles,
      totalResults: newsData.totalResults || articles.length,
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

