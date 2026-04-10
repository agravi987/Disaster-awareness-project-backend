const express = require('express');
const {
    geocodeLocation,
    getDisasterOverview,
    getWeatherSnapshot,
} = require('../controllers/disasterController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/geocode', geocodeLocation);
router.get('/overview', getDisasterOverview);
router.get('/weather', getWeatherSnapshot);

module.exports = router;
