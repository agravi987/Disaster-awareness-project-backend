const https = require('https');

const NOMINATIM_USER_AGENT =
    process.env.NOMINATIM_USER_AGENT || 'DisasterAwarenessLearningPlatform/1.0 (support@example.com)';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const httpsGetJson = (url, headers = {}, timeoutMs = 12000) =>
    new Promise((resolve, reject) => {
        const request = https.get(
            url,
            {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': NOMINATIM_USER_AGENT,
                    ...headers,
                },
            },
            (response) => {
                let raw = '';

                response.on('data', (chunk) => {
                    raw += chunk;
                });

                response.on('end', () => {
                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        return reject(
                            new Error(`Request failed (${response.statusCode}) for ${url}`)
                        );
                    }
                    try {
                        resolve(JSON.parse(raw));
                    } catch (error) {
                        reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
                    }
                });
            }
        );

        request.on('error', (error) => reject(error));
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`Request timed out (${timeoutMs}ms)`));
        });
    });

const toRadians = (deg) => (deg * Math.PI) / 180;

const getDistanceKm = (lat1, lng1, lat2, lng2) => {
    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const toIso = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeEarthquakeEvents = (payload) =>
    (payload?.features || []).map((feature) => {
        const coords = feature?.geometry?.coordinates || [];
        const magnitude = feature?.properties?.mag;
        const time = toIso(feature?.properties?.time);

        return {
            id: feature?.id || `usgs-${Math.random().toString(36).slice(2, 8)}`,
            type: 'Earthquake',
            severity: magnitude >= 6 ? 'high' : magnitude >= 4 ? 'medium' : 'low',
            title: feature?.properties?.title || 'Earthquake',
            description: feature?.properties?.place || 'Location unavailable',
            source: 'USGS',
            url: feature?.properties?.url || null,
            magnitude: typeof magnitude === 'number' ? magnitude : null,
            occurredAt: time,
            coordinates: {
                lng: typeof coords[0] === 'number' ? coords[0] : null,
                lat: typeof coords[1] === 'number' ? coords[1] : null,
            },
            metadata: {
                tsunami: feature?.properties?.tsunami === 1,
                feltReports: feature?.properties?.felt || 0,
            },
        };
    });

const normalizeEonetEvents = (payload) =>
    (payload?.events || []).map((event) => {
        const lastGeometry = event?.geometry?.[event.geometry.length - 1] || {};
        const coords = lastGeometry?.coordinates || [];
        const category = event?.categories?.[0]?.title || 'Other Hazard';
        const occurredAt = toIso(lastGeometry?.date);

        return {
            id: event?.id || `eonet-${Math.random().toString(36).slice(2, 8)}`,
            type: category,
            severity: 'medium',
            title: event?.title || category,
            description: event?.description || 'Active natural hazard event.',
            source: 'NASA EONET',
            url: event?.sources?.[0]?.url || null,
            magnitude: null,
            occurredAt,
            coordinates: {
                lng: typeof coords[0] === 'number' ? coords[0] : null,
                lat: typeof coords[1] === 'number' ? coords[1] : null,
            },
            metadata: {
                categories: (event?.categories || []).map((item) => item.title),
                geometryCount: event?.geometry?.length || 0,
            },
        };
    });

const filterAndSortEvents = (events, focusLat, focusLng, radiusKm) => {
    const enriched = events
        .filter((event) => {
            const lat = event.coordinates?.lat;
            const lng = event.coordinates?.lng;
            return typeof lat === 'number' && typeof lng === 'number';
        })
        .map((event) => {
            if (typeof focusLat === 'number' && typeof focusLng === 'number') {
                const distanceKm = getDistanceKm(focusLat, focusLng, event.coordinates.lat, event.coordinates.lng);
                return { ...event, distanceKm: Number(distanceKm.toFixed(1)) };
            }
            return { ...event, distanceKm: null };
        })
        .filter((event) => event.distanceKm === null || event.distanceKm <= radiusKm)
        .sort((a, b) => {
            const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
            const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
            return bTime - aTime;
        });

    return enriched.slice(0, 200);
};

const buildSummary = (events) => {
    const countsByType = events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
    }, {});

    const highSeverity = events.filter((event) => event.severity === 'high').length;
    const recent24h = events.filter((event) => {
        if (!event.occurredAt) return false;
        return Date.now() - new Date(event.occurredAt).getTime() <= 24 * 60 * 60 * 1000;
    }).length;

    return {
        totalEvents: events.length,
        highSeverity,
        recent24h,
        countsByType,
    };
};

const geocodeLocation = async (req, res) => {
    const query = req.query.location?.trim();
    if (!query) {
        return res.status(400).json({ message: 'Query parameter "location" is required.' });
    }

    try {
        // Primary geocoder: Open-Meteo (free, keyless, demo-friendly)
        const primaryUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            query
        )}&count=5&language=en&format=json`;
        const primaryPayload = await httpsGetJson(primaryUrl);

        const primaryResults = (primaryPayload?.results || []).map((item) => ({
            displayName: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
            lat: Number(item.latitude),
            lng: Number(item.longitude),
            type: item.feature_code || 'place',
        }));

        if (primaryResults.length > 0) {
            return res.json({ query, provider: 'open-meteo', results: primaryResults });
        }

        // Secondary fallback: Nominatim (may fail on some shared IPs/policy checks)
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
        )}&limit=5`;
        const fallbackPayload = await httpsGetJson(fallbackUrl);

        const fallbackResults = (fallbackPayload || []).map((item) => ({
            displayName: item.display_name,
            lat: Number(item.lat),
            lng: Number(item.lon),
            type: item.type,
        }));

        return res.json({ query, provider: 'nominatim', results: fallbackResults });
    } catch (error) {
        res.status(500).json({ message: 'Failed to geocode location.', error: error.message });
    }
};

const getDisasterOverview = async (req, res) => {
    const focusLat = toNumber(req.query.lat);
    const focusLng = toNumber(req.query.lng);
    const radiusKm = clamp(toNumber(req.query.radiusKm) || 600, 50, 3000);

    try {
        const [earthquakePayload, eonetPayload] = await Promise.all([
            httpsGetJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'),
            httpsGetJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100'),
        ]);

        const events = [
            ...normalizeEarthquakeEvents(earthquakePayload),
            ...normalizeEonetEvents(eonetPayload),
        ];

        const filtered = filterAndSortEvents(events, focusLat, focusLng, radiusKm);

        res.json({
            generatedAt: new Date().toISOString(),
            focus: {
                lat: focusLat,
                lng: focusLng,
                radiusKm,
            },
            summary: buildSummary(filtered),
            events: filtered,
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch disaster overview.', error: error.message });
    }
};

const getWeatherSnapshot = async (req, res) => {
    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);

    if (lat === null || lng === null) {
        return res.status(400).json({ message: 'Query parameters "lat" and "lng" are required.' });
    }

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&timezone=auto`;
        const payload = await httpsGetJson(url);
        const current = payload?.current || {};

        const precipitation = Number(current.precipitation || 0);
        const windSpeed = Number(current.wind_speed_10m || 0);

        const riskSignals = [];
        if (precipitation >= 15) riskSignals.push('Heavy precipitation observed');
        if (windSpeed >= 45) riskSignals.push('Strong wind conditions');
        if (current.weather_code >= 95) riskSignals.push('Thunderstorm risk signal');

        res.json({
            fetchedAt: new Date().toISOString(),
            location: {
                lat,
                lng,
                timezone: payload?.timezone || 'auto',
            },
            current: {
                temperatureC: Number(current.temperature_2m ?? 0),
                precipitationMm: precipitation,
                windSpeedKmh: windSpeed,
                weatherCode: Number(current.weather_code ?? 0),
            },
            riskSignals,
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch weather snapshot.', error: error.message });
    }
};

module.exports = {
    geocodeLocation,
    getDisasterOverview,
    getWeatherSnapshot,
};
