const express = require('express');
const {
    geocodeLocation,
    reverseGeocodeLocation,
    getDisasterOverview,
    getWeatherSnapshot,
} = require('../controllers/disasterController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/geocode', geocodeLocation);
router.get('/reverse-geocode', reverseGeocodeLocation);
router.get('/overview', getDisasterOverview);
router.get('/weather', getWeatherSnapshot);

module.exports = router;
