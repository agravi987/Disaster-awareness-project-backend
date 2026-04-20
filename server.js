/**
 * server.js - Main application entry point
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

const parseSeedTeachers = () => {
  const raw = (process.env.SEED_TEACHERS_JSON || '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        item &&
        typeof item.name === 'string' &&
        typeof item.email === 'string' &&
        typeof item.password === 'string'
    );
  } catch (error) {
    console.error('Invalid SEED_TEACHERS_JSON value:', error.message);
    return [];
  }
};

connectDB().then(async () => {
  const shouldSeedTeachers = process.env.SEED_DEFAULT_TEACHERS === 'true';
  if (!shouldSeedTeachers) return;

  const teachersToSeed = parseSeedTeachers();
  if (!teachersToSeed.length) {
    console.log('SEED_DEFAULT_TEACHERS=true but no valid SEED_TEACHERS_JSON entries found.');
    return;
  }

  try {
    const User = require('./models/User');

    for (const teacherData of teachersToSeed) {
      const existing = await User.findOne({ email: teacherData.email });
      if (!existing) {
        await User.create({ ...teacherData, role: 'teacher' });
        console.log(`Seeded teacher account: ${teacherData.email}`);
      }
    }
  } catch (error) {
    console.error('Failed to seed teacher accounts:', error.message);
  }
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/quizzes', require('./routes/quizRoutes'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/disaster', require('./routes/disasterRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

app.get('/', (req, res) => {
  res.json({ message: 'Disaster Awareness Learning Platform API is running!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
