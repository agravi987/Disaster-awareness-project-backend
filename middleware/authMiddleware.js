/**
 * middleware/authMiddleware.js - JWT Authentication & Role-Based Access
 * 
 * This file exports two middleware functions:
 * 
 * 1. protect - Verifies the JWT token in the request header.
 *    Attaches the logged-in user object to req.user for downstream use.
 * 
 * 2. authorizeRoles(...roles) - Checks that req.user has one of the
 *    allowed roles. Use AFTER protect middleware.
 * 
 * Usage in routes:
 *   router.get('/path', protect, authorizeRoles('teacher'), controller)
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect - Middleware to verify JWT token.
 * 
 * Expects the token in the Authorization header as:
 *   Authorization: Bearer <token>
 */
const protect = async (req, res, next) => {
    let token;

    // Check if Authorization header exists and starts with "Bearer"
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Extract the token from "Bearer <token>"
            token = req.headers.authorization.split(' ')[1];

            // Verify and decode the token using the secret from .env
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Attach the user (without the password) to the request object
            req.user = await User.findById(decoded.id).select('-password');

            // Proceed to the next middleware or route handler
            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token provided' });
    }
};

/**
 * authorizeRoles - Middleware factory to restrict access by role.
 * 
 * @param {...string} roles - Allowed roles (e.g., 'teacher', 'student')
 * @returns Middleware function that checks req.user.role
 * 
 * Example: authorizeRoles('teacher') blocks students from teacher routes.
 */
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Access denied. Required role: ${roles.join(' or ')}`,
            });
        }
        next();
    };
};

module.exports = { protect, authorizeRoles };
