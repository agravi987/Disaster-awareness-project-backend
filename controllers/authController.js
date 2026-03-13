/**
 * controllers/authController.js - Authentication Logic
 * 
 * Handles user registration and login.
 * 
 * - registerUser: Creates a new user in the database and returns a JWT.
 * - loginUser: Validates credentials and returns a JWT on success.
 * 
 * A JWT (JSON Web Token) is a signed string that proves the user is 
 * authenticated. The client stores it and sends it with every request.
 */

const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * generateToken - Creates a signed JWT containing the user's ID.
 * The token expires after the value set in JWT_EXPIRES_IN (.env).
 * 
 * @param {string} id - The MongoDB _id of the user
 * @returns {string} Signed JWT string
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        // Check if a user with this email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Prevent public users from creating 'teacher' accounts
        if (role === 'teacher') {
            return res.status(403).json({ message: 'Public teacher registration is disabled.' });
        }

        // Create user - the pre-save hook in User.js will hash the password
        // Force role to 'student' as an extra safety measure
        const user = await User.create({ name, email, password, role: 'student' });

        // Return user info and a fresh JWT token
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Login an existing user
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the user by email (include password hash for comparison)
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Use the comparePassword method we defined in the User model
        const isPasswordCorrect = await user.comparePassword(password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Return user info and a fresh token
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get logged-in user's profile
 * @route   GET /api/auth/me
 * @access  Private (requires token)
 */
const getMe = async (req, res) => {
    // req.user is attached by the protect middleware
    res.json(req.user);
};

module.exports = { registerUser, loginUser, getMe };
