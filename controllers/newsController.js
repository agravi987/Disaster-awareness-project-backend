const https = require('https');

const DEFAULT_LIMIT = 10;
const NEWS_CACHE_TTL_MS = Math.max(Number(process.env.NEWS_CACHE_TTL_MS) || 15 * 60 * 1000, 60 * 1000);
const NEWS_API_BASE_URL = (process.env.NEWS_API_BASE_URL || 'https://newsapi.org/v2').replace(/\/+$/, '');
const NEWS_API_EVERYTHING_PATH = process.env.NEWS_API_EVERYTHING_PATH || '/everything';
const NEWS_DEFAULT_LOCATION = process.env.NEWS_DEFAULT_LOCATION || 'India';

const DISASTER_KEYWORDS = [
    'earthquake',
    'flood',
    'wildfire',
    'cyclone',
    'hurricane',
    'tornado',
    'typhoon',
    'tsunami',
    'landslide',
    'storm',
    'volcano',
    'volcanic',
    'eruption',
    'heatwave',
];

const NEWS_EXCLUDE_KEYWORDS = [
    'ipl',
    'cricket',
    'premier league',
    'football',
    'basketball',
    'baseball',
    'movie',
    'trailer',
    'exercise cyclone',
    'joint special forces',
    'tornado cash',
    'landslide victory',
    'teen tornado',
    'election',
    'gop',
    'maga',
    'stock',
    'market',
    'earnings',
    'crypto',
    'session cookies',
    'against england - flood',
    'hydro project',
    'clean power',
];

const PREFERRED_NEWS_DOMAINS = [
    'reuters.com',
    'apnews.com',
    'bbc.com',
    'bbc.co.uk',
    'aljazeera.com',
    'theguardian.com',
    'cnn.com',
    'thehindu.com',
    'ndtv.com',
    'indianexpress.com',
    'hindustantimes.com',
    'indiatimes.com',
    'weather.com',
    'accuweather.com',
    'reliefweb.int',
];

const cacheStore = new Map();

const buildUrl = (base, path, params = {}) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            searchParams.append(key, String(value));
        }
    });

    const query = searchParams.toString();
    return `${base}${normalizedPath}${query ? `?${query}` : ''}`;
};

const httpsGetJson = (url, headers = {}, timeoutMs = 12000) =>
    new Promise((resolve, reject) => {
        const request = https.get(
            url,
            {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'DisasterAwarenessLearningPlatform/1.0',
                    ...headers,
                },
            },
            (response) => {
                let raw = '';
                response.on('data', (chunk) => {
                    raw += chunk;
                });
                response.on('end', () => {
                    let payload;
                    try {
                        payload = JSON.parse(raw);
                    } catch {
                        payload = null;
                    }

                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        const message =
                            payload?.message ||
                            `News request failed (${response.statusCode})`;
                        return reject(new Error(message));
                    }

                    if (!payload || typeof payload !== 'object') {
                        return reject(new Error('Invalid JSON response from NewsAPI.'));
                    }

                    resolve(payload);
                });
            }
        );

        request.on('error', (error) => reject(error));
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`News request timed out (${timeoutMs}ms)`));
        });
    });

const getCache = (key) => {
    const record = cacheStore.get(key);
    if (!record) return null;
    if (Date.now() > record.expiresAt) return null;
    return record.value;
};

const setCache = (key, value, ttlMs) => {
    cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
};

const buildDisasterQuery = (location) => {
    const disasterPart =
        '(earthquake OR flood OR wildfire OR cyclone OR hurricane OR tornado OR typhoon OR tsunami OR landslide OR storm OR volcano OR volcanic eruption OR heatwave)';
    if (!location) return disasterPart;
    return `${disasterPart} AND (${location})`;
};

const isDisasterRelevant = (article) => {
    const title = `${article?.title || ''}`.toLowerCase();
    const haystack = `${article?.title || ''} ${article?.description || ''}`.toLowerCase();
    const hasDisasterTerm = DISASTER_KEYWORDS.some((word) => haystack.includes(word));
    const hasExcludedTerm = NEWS_EXCLUDE_KEYWORDS.some((word) => title.includes(word));
    return hasDisasterTerm && !hasExcludedTerm;
};

const getDomainFromUrl = (value) => {
    try {
        return new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        return '';
    }
};

const isPreferredDomain = (url) => {
    const domain = getDomainFromUrl(url);
    if (!domain) return false;
    return PREFERRED_NEWS_DOMAINS.some(
        (preferred) => domain === preferred || domain.endsWith(`.${preferred}`)
    );
};

const toCardArticle = (article) => ({
    title: article.title,
    description: article.description || 'No summary available.',
    url: article.url,
    urlToImage: article.urlToImage || null,
    publishedAt: article.publishedAt || new Date().toISOString(),
    source: {
        name: article?.source?.name || 'NewsAPI',
    },
});

const normalizeArticles = (articles = []) => {
    const base = articles
        .filter((article) => article?.title && article?.url)
        .filter(isDisasterRelevant)
        .map(toCardArticle);

    const strict = base.filter((article) => isPreferredDomain(article.url));
    return strict.length >= 4 ? strict : base;
};

const dedupeArticles = (articles = []) => {
    const seen = new Set();
    return articles.filter((article) => {
        if (seen.has(article.url)) return false;
        seen.add(article.url);
        return true;
    });
};

const fallbackArticles = () => [
    {
        title: 'USGS Real-Time Earthquake Map',
        description: 'Live earthquake events and magnitudes from USGS.',
        url: 'https://earthquake.usgs.gov/earthquakes/map/',
        urlToImage: null,
        publishedAt: new Date().toISOString(),
        source: { name: 'USGS' },
    },
    {
        title: 'NASA EONET Active Natural Hazard Events',
        description: 'Open feed of active wildfire, storm, volcano, and hazard events.',
        url: 'https://eonet.gsfc.nasa.gov/',
        urlToImage: null,
        publishedAt: new Date().toISOString(),
        source: { name: 'NASA EONET' },
    },
    {
        title: 'Ready.gov Disaster Preparedness Guides',
        description: 'Preparedness actions for floods, earthquakes, storms, and fires.',
        url: 'https://www.ready.gov/',
        urlToImage: null,
        publishedAt: new Date().toISOString(),
        source: { name: 'Ready.gov' },
    },
    {
        title: 'ReliefWeb Global Disasters',
        description: 'Latest disaster updates, reports, and humanitarian response from ReliefWeb.',
        url: 'https://reliefweb.int/disasters',
        urlToImage: null,
        publishedAt: new Date().toISOString(),
        source: { name: 'ReliefWeb' },
    },
];

const fetchNewsApiBatch = async ({ apiKey, query, limit }) => {
    const fromDate = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

    const url = buildUrl(NEWS_API_BASE_URL, NEWS_API_EVERYTHING_PATH, {
        q: query,
        language: 'en',
        sortBy: 'publishedAt',
        from: fromDate,
        pageSize: Math.min(Math.max(limit, 20), 50),
        apiKey,
    });

    const payload = await httpsGetJson(url);
    if (payload.status === 'error') {
        throw new Error(payload.message || 'NewsAPI returned an error');
    }

    return dedupeArticles(normalizeArticles(payload.articles || []));
};

const getDisasterNews = async (req, res) => {
    const location = (req.query.location || NEWS_DEFAULT_LOCATION).trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 5), 20);
    const query = buildDisasterQuery(location);
    const apiKey = process.env.NEWS_API_KEY || '';
    const keyFingerprint = apiKey ? apiKey.slice(0, 6) : 'no-key';
    const cacheKey = `newsapi|${query}|${limit}|${keyFingerprint}`;
    const extraResources = fallbackArticles();

    try {
        const cached = getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        if (!apiKey) {
            return res.json({
                provider: 'fallback',
                location,
                totalResults: 0,
                articles: [],
                extraResources,
                message: 'NEWS_API_KEY not configured. Showing fallback disaster resources.',
            });
        }

        const primaryArticles = await fetchNewsApiBatch({
            apiKey,
            query,
            limit: limit * 2,
        });
        let merged = [...primaryArticles];

        // If location-filtered query is too sparse, enrich with global disaster-only results.
        if (merged.length < limit) {
            const globalQuery = buildDisasterQuery('');
            const globalArticles = await fetchNewsApiBatch({
                apiKey,
                query: globalQuery,
                limit: limit * 2,
            });
            merged = dedupeArticles([...merged, ...globalArticles]);
        }

        const articles = merged.slice(0, limit);
        const responsePayload = {
            provider: 'newsapi',
            location,
            totalResults: articles.length,
            articles,
            extraResources,
            message: articles.length
                ? null
                : 'No matching natural-disaster news right now. Check extra resources below.',
        };

        return res.json(setCache(cacheKey, responsePayload, NEWS_CACHE_TTL_MS));
    } catch (error) {
        return res.status(500).json({
            message: 'Failed to fetch disaster news.',
            error: error.message,
            articles: [],
            extraResources,
        });
    }
};

module.exports = { getDisasterNews };
