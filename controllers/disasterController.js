const https = require('https');

const NOMINATIM_USER_AGENT =
    process.env.NOMINATIM_USER_AGENT || 'DisasterAwarenessLearningPlatform/1.0 (support@example.com)';
const DISASTER_CACHE_TTL_MS = Math.max(
    Number(process.env.DISASTER_CACHE_TTL_MS) || 5 * 60 * 1000,
    30 * 1000
);
const DISASTER_GEOCODE_CACHE_TTL_MS = Math.max(
    Number(process.env.DISASTER_GEOCODE_CACHE_TTL_MS) || 6 * 60 * 60 * 1000,
    2 * 60 * 1000
);
const cacheStore = new Map();

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundCoord = (value, precision = 3) =>
    typeof value === 'number' ? Number(value.toFixed(precision)) : null;
const severityRank = { high: 3, medium: 2, low: 1 };

const getCache = (key) => {
    const record = cacheStore.get(key);
    if (!record) return null;
    if (Date.now() > record.expiresAt) return null;
    return record.value;
};

const getStaleCache = (key) => {
    const record = cacheStore.get(key);
    return record?.value || null;
};

const setCache = (key, value, ttlMs) => {
    cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
};

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

const inferEonetSeverity = (category, title = '') => {
    const label = `${category || ''} ${title || ''}`.toLowerCase();

    if (
        label.includes('wildfire') ||
        label.includes('volcano') ||
        label.includes('severe storm') ||
        label.includes('flood') ||
        label.includes('cyclone')
    ) {
        return 'high';
    }

    if (
        label.includes('drought') ||
        label.includes('landslide') ||
        label.includes('storm') ||
        label.includes('dust')
    ) {
        return 'medium';
    }

    return 'low';
};

const normalizeEarthquakeEvents = (payload) =>
    (payload?.features || []).map((feature) => {
        const coords = feature?.geometry?.coordinates || [];
        const magnitude = feature?.properties?.mag;
        const time = toIso(feature?.properties?.time);
        const severity = magnitude >= 6 ? 'high' : magnitude >= 4 ? 'medium' : 'low';

        return {
            id: feature?.id || `usgs-${Math.random().toString(36).slice(2, 8)}`,
            type: 'Earthquake',
            severity,
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
                severityReason:
                    severity === 'high'
                        ? 'Magnitude 6.0 or above'
                        : severity === 'medium'
                          ? 'Magnitude between 4.0 and 5.9'
                          : 'Magnitude below 4.0',
            },
        };
    });

const normalizeEonetEvents = (payload) =>
    (payload?.events || []).map((event) => {
        const lastGeometry = event?.geometry?.[event.geometry.length - 1] || {};
        const coords = lastGeometry?.coordinates || [];
        const category = event?.categories?.[0]?.title || 'Other Hazard';
        const occurredAt = toIso(lastGeometry?.date);
        const severity = inferEonetSeverity(category, event?.title);

        return {
            id: event?.id || `eonet-${Math.random().toString(36).slice(2, 8)}`,
            type: category,
            severity,
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
                severityReason:
                    severity === 'high'
                        ? 'Open high-impact natural hazard category'
                        : severity === 'medium'
                          ? 'Open moderate-impact natural hazard category'
                          : 'Open low-impact natural hazard category',
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
    const countsBySource = events.reduce((acc, event) => {
        acc[event.source] = (acc[event.source] || 0) + 1;
        return acc;
    }, {});

    const highSeverity = events.filter((event) => event.severity === 'high').length;
    const recent24h = events.filter((event) => {
        if (!event.occurredAt) return false;
        return Date.now() - new Date(event.occurredAt).getTime() <= 24 * 60 * 60 * 1000;
    }).length;
    const closestEvent = events.reduce((closest, event) => {
        if (typeof event.distanceKm !== 'number') return closest;
        if (!closest || event.distanceKm < closest.distanceKm) {
            return {
                id: event.id,
                title: event.title,
                type: event.type,
                severity: event.severity,
                distanceKm: event.distanceKm,
                occurredAt: event.occurredAt,
                source: event.source,
            };
        }
        return closest;
    }, null);
    const latestEventAt = events.reduce((latest, event) => {
        if (!event.occurredAt) return latest;
        if (!latest) return event.occurredAt;
        return new Date(event.occurredAt).getTime() > new Date(latest).getTime()
            ? event.occurredAt
            : latest;
    }, null);
    const highestSeverityEvent = events.reduce((top, event) => {
        if (!top) return event;
        const severityDiff = (severityRank[event.severity] || 0) - (severityRank[top.severity] || 0);
        if (severityDiff > 0) return event;
        if (severityDiff < 0) return top;

        const topTime = top.occurredAt ? new Date(top.occurredAt).getTime() : 0;
        const eventTime = event.occurredAt ? new Date(event.occurredAt).getTime() : 0;
        return eventTime > topTime ? event : top;
    }, null);

    return {
        totalEvents: events.length,
        highSeverity,
        recent24h,
        countsByType,
        countsBySource,
        sources: Object.keys(countsBySource),
        closestEvent,
        latestEventAt,
        highestSeverityEvent: highestSeverityEvent
            ? {
                  id: highestSeverityEvent.id,
                  title: highestSeverityEvent.title,
                  type: highestSeverityEvent.type,
                  severity: highestSeverityEvent.severity,
                  distanceKm: highestSeverityEvent.distanceKm,
                  occurredAt: highestSeverityEvent.occurredAt,
                  source: highestSeverityEvent.source,
              }
            : null,
    };
};

const geocodeLocation = async (req, res) => {
    const query = req.query.location?.trim();
    if (!query) {
        return res.status(400).json({ message: 'Query parameter "location" is required.' });
    }

    const cacheKey = `geocode|${query.toLowerCase()}`;
    const cached = getCache(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    let primaryError = null;
    let fallbackError = null;

    try {
        // Primary geocoder: Open-Meteo (free, keyless, demo-friendly)
        const primaryUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            query
        )}&count=5&language=en&format=json`;
        try {
            const primaryPayload = await httpsGetJson(primaryUrl);

            const primaryResults = (primaryPayload?.results || []).map((item) => ({
                displayName: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
                lat: Number(item.latitude),
                lng: Number(item.longitude),
                type: item.feature_code || 'place',
            }));

            if (primaryResults.length > 0) {
                return res.json(
                    setCache(
                        cacheKey,
                        { query, provider: 'open-meteo', results: primaryResults },
                        DISASTER_GEOCODE_CACHE_TTL_MS
                    )
                );
            }
        } catch (error) {
            primaryError = error;
        }

        // Secondary fallback: Nominatim (may fail on some shared IPs/policy checks)
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
        )}&limit=5`;
        try {
            const fallbackPayload = await httpsGetJson(fallbackUrl);

            const fallbackResults = (fallbackPayload || []).map((item) => ({
                displayName: item.display_name,
                lat: Number(item.lat),
                lng: Number(item.lon),
                type: item.type,
            }));

            return res.json(
                setCache(
                    cacheKey,
                    { query, provider: 'nominatim', results: fallbackResults },
                    DISASTER_GEOCODE_CACHE_TTL_MS
                )
            );
        } catch (error) {
            fallbackError = error;
        }

        const stale = getStaleCache(cacheKey);
        if (stale) {
            return res.json({
                ...stale,
                stale: true,
                message: 'Showing cached geocode results due to upstream provider issue.',
            });
        }

        const combinedError = [primaryError?.message, fallbackError?.message]
            .filter(Boolean)
            .join(' | ');
        return res.status(500).json({
            message: 'Failed to geocode location.',
            error: combinedError || 'No geocoding provider available.',
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to geocode location.', error: error.message });
    }
};

const reverseGeocodeLocation = async (req, res) => {
    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);

    if (lat === null || lng === null) {
        return res.status(400).json({ message: 'Query parameters "lat" and "lng" are required.' });
    }

    const cacheKey = `reverse-geocode|${roundCoord(lat)}|${roundCoord(lng)}`;
    const cached = getCache(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
        const payload = await httpsGetJson(url);

        const address = payload?.address || {};
        const label =
            payload?.display_name ||
            [
                address.city,
                address.town,
                address.village,
                address.state_district,
                address.state,
                address.country,
            ]
                .filter(Boolean)
                .join(', ') ||
            `${lat.toFixed(3)}, ${lng.toFixed(3)}`;

        const responsePayload = {
            lat,
            lng,
            label,
            address: {
                city: address.city || address.town || address.village || null,
                state: address.state || null,
                country: address.country || null,
            },
        };

        return res.json(setCache(cacheKey, responsePayload, DISASTER_GEOCODE_CACHE_TTL_MS));
    } catch (error) {
        const stale = getStaleCache(cacheKey);
        if (stale) {
            return res.json({
                ...stale,
                stale: true,
                message: 'Showing cached reverse-geocode result due to upstream provider issue.',
            });
        }

        return res.status(500).json({
            message: 'Failed to reverse geocode location.',
            error: error.message,
        });
    }
};

const getDisasterOverview = async (req, res) => {
    const focusLat = toNumber(req.query.lat);
    const focusLng = toNumber(req.query.lng);
    const radiusKm = clamp(toNumber(req.query.radiusKm) || 600, 50, 3000);
    const cacheKey = `overview|${roundCoord(focusLat)}|${roundCoord(focusLng)}|${radiusKm}`;

    try {
        const cached = getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const [earthquakePayload, eonetPayload] = await Promise.all([
            httpsGetJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson'),
            httpsGetJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100'),
        ]);

        const events = [
            ...normalizeEarthquakeEvents(earthquakePayload),
            ...normalizeEonetEvents(eonetPayload),
        ];

        const filtered = filterAndSortEvents(events, focusLat, focusLng, radiusKm);

        const payload = {
            generatedAt: new Date().toISOString(),
            focus: {
                lat: focusLat,
                lng: focusLng,
                radiusKm,
            },
            summary: buildSummary(filtered),
            events: filtered,
        };

        return res.json(setCache(cacheKey, payload, DISASTER_CACHE_TTL_MS));
    } catch (error) {
        const stale = getStaleCache(cacheKey);
        if (stale) {
            return res.json({
                ...stale,
                stale: true,
                message: 'Showing recently cached disaster overview due to upstream issue.',
            });
        }
        res.status(500).json({ message: 'Failed to fetch disaster overview.', error: error.message });
    }
};

const getWeatherSnapshot = async (req, res) => {
    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);
    const cacheKey = `weather|${roundCoord(lat)}|${roundCoord(lng)}`;

    if (lat === null || lng === null) {
        return res.status(400).json({ message: 'Query parameters "lat" and "lng" are required.' });
    }

    try {
        const cached = getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&timezone=auto`;
        const payload = await httpsGetJson(url);
        const current = payload?.current || {};

        const precipitation = Number(current.precipitation || 0);
        const windSpeed = Number(current.wind_speed_10m || 0);

        const riskSignals = [];
        if (precipitation >= 15) riskSignals.push('Heavy precipitation observed');
        if (windSpeed >= 45) riskSignals.push('Strong wind conditions');
        if (current.weather_code >= 95) riskSignals.push('Thunderstorm risk signal');

        const responsePayload = {
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
        };

        return res.json(setCache(cacheKey, responsePayload, DISASTER_CACHE_TTL_MS));
    } catch (error) {
        const stale = getStaleCache(cacheKey);
        if (stale) {
            return res.json({
                ...stale,
                stale: true,
                message: 'Showing recently cached weather due to upstream issue.',
            });
        }
        res.status(500).json({ message: 'Failed to fetch weather snapshot.', error: error.message });
    }
};

module.exports = {
    geocodeLocation,
    reverseGeocodeLocation,
    getDisasterOverview,
    getWeatherSnapshot,
};
