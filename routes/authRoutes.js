/**
 * routes/authRoutes.js - Authentication Routes
 * 
 * Maps HTTP methods and paths to the auth controller functions.
 * These routes are public (no authentication required).
 * 
 * POST /api/auth/register  -> Register a new user
 * POST /api/auth/login     -> Login and receive JWT
 * GET  /api/auth/me        -> Get current user profile (protected)
 */

const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes - no token needed
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected route - token required (via protect middleware)
router.get('/me', protect, getMe);

module.exports = router;
