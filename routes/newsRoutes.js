/**
 * routes/newsRoutes.js - News API Proxy Route
 * 
 * GET /api/news -> Fetch disaster-related news (any logged-in user)
 */

const express = require('express');
const router = express.Router();
const { getDisasterNews } = require('../controllers/newsController');
const { protect } = require('../middleware/authMiddleware');

// Protected - user must be logged in to access news
router.get('/', protect, getDisasterNews);

module.exports = router;
