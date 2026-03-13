/**
 * controllers/newsController.js - News API Proxy
 * 
 * Fetches disaster-related news from the NewsAPI and returns it to the client.
 * Using a server-side proxy avoids exposing the API key in the frontend code.
 * 
 * Register for a free key at: https://newsapi.org
 * Add your key to the .env file as: NEWS_API_KEY=your_key_here
 */

const https = require('https');

/**
 * @desc    Get disaster-related news articles
 * @route   GET /api/news
 * @access  Private (logged-in users)
 */
const getDisasterNews = async (req, res) => {
    const apiKey = process.env.NEWS_API_KEY;

    // If no API key is set, return sample/fallback data so the UI still works
    if (!apiKey) {
        return res.json({
            articles: [
                {
                    title: 'Earthquake Preparedness: What You Need to Know',
                    description: 'Essential tips for preparing for earthquakes and staying safe.',
                    url: 'https://www.ready.gov/earthquakes',
                    urlToImage: 'https://via.placeholder.com/400x200?text=Earthquake+Safety',
                    publishedAt: new Date().toISOString(),
                    source: { name: 'Ready.gov' },
                },
                {
                    title: 'Flood Safety Tips from FEMA',
                    description: 'How to protect yourself and your family during floods.',
                    url: 'https://www.ready.gov/floods',
                    urlToImage: 'https://via.placeholder.com/400x200?text=Flood+Safety',
                    publishedAt: new Date().toISOString(),
                    source: { name: 'FEMA' },
                },
                {
                    title: 'Hurricane Season Preparation Guide',
                    description: 'Prepare for hurricane season with this comprehensive guide.',
                    url: 'https://www.nhc.noaa.gov/prepare',
                    urlToImage: 'https://via.placeholder.com/400x200?text=Hurricane+Safety',
                    publishedAt: new Date().toISOString(),
                    source: { name: 'NOAA' },
                },
            ],
        });
    }

    // Generate a random page number between 1 and 3 to ensure we don't go out of bounds for many queries
    const randomPage = Math.floor(Math.random() * 3) + 1;

    // Fetch from NewsAPI - strict search for disaster keywords, sorted by published date
    const query = encodeURIComponent('disaster OR earthquake OR flood OR hurricane OR tsunami OR wildfire OR tornado');

    // NewsAPI requires a User-Agent header for all requests made from a server
    const options = {
        hostname: 'newsapi.org',
        path: `/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=10&page=${randomPage}&apiKey=${apiKey}`,
        method: 'GET',
        headers: {
            'User-Agent': 'DisasterAwarenessLearningPlatform/1.0',
            'Accept': 'application/json'
        }
    };

    https.get(options, (response) => {
        let data = '';

        // Log status code for debugging
        if (response.statusCode !== 200) {
            console.error(`NewsAPI Error: Status ${response.statusCode}`);
        }

        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
            try {
                const parsed = JSON.parse(data);

                // If the API returned an error (like 429 or 403), NewsAPI includes a message
                if (parsed.status === 'error') {
                    console.error('NewsAPI Message:', parsed.message);
                    return res.status(400).json({ message: parsed.message });
                }

                res.json(parsed);
            } catch (e) {
                console.error('Failed to parse news data:', e.message);
                res.status(500).json({ message: 'Failed to parse news data' });
            }
        });
    }).on('error', (err) => {
        console.error('https.get error:', err.message);
        res.status(500).json({ message: 'Failed to fetch news', error: err.message });
    });
};

module.exports = { getDisasterNews };
