/**
 * server.js - Main application entry point
 * 
 * This file bootstraps the Express server:
 * - Loads environment variables from .env
 * - Connects to MongoDB
 * - Sets up middleware (cors, json parsing)
 * - Mounts all API route handlers
 * - Starts listening on the configured port
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app = express();

// Connect to MongoDB
connectDB().then(async () => {
  try {
    const User = require('./models/User');

    // Ensure default teachers exist
    const teachersToSeed = [
      { name: 'rithiga', email: 'rithi@gmail.com', password: 'rithi@143', role: 'teacher' },
      { name: 'ravi', email: 'ravi@gmail.com', password: 'rithu@143', role: 'teacher' }
    ];

    for (const teacherData of teachersToSeed) {
      const existing = await User.findOne({ email: teacherData.email });
      if (!existing) {
        // The pre-save hook in User model will automatically hash these passwords
        await User.create(teacherData);
        console.log(`🌱 Seeded teacher account: ${teacherData.email}`);
      }
    }
  } catch (err) {
    console.error('Failed to seed teacher accounts:', err);
  }
});

// ─── Middleware ───────────────────────────────────────────────────────────────
// Enable Cross-Origin Resource Sharing so the React frontend can talk to this API
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// ─── API Routes ───────────────────────────────────────────────────────────────
// Authentication routes (register, login)
app.use('/api/auth', require('./routes/authRoutes'));

// User management routes (teacher CRUD for students)
app.use('/api/users', require('./routes/userRoutes'));

// Group management routes
app.use('/api/groups', require('./routes/groupRoutes'));

// Course and lesson management routes
app.use('/api/courses', require('./routes/courseRoutes'));

// Quiz management routes
app.use('/api/quizzes', require('./routes/quizRoutes'));

// News proxy route (fetches news from external API)
app.use('/api/news', require('./routes/newsRoutes'));

// Disaster intelligence routes (map events, geocoding, weather)
app.use('/api/disaster', require('./routes/disasterRoutes'));

// Image upload route (Cloudinary)
app.use('/api/upload', require('./routes/uploadRoutes'));

// ─── Root health check ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'Disaster Awareness Learning Platform API is running!' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
