require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const resultRoutes = require('./routes/resultRoutes');
const examRoutes = require('./routes/examRoutes');
const ExamSchedule = require('./models/ExamSchedule');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB & Seed Exam Schedules
connectDB().then(async () => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Seed Computer Networks Schedule
    await ExamSchedule.findOneAndUpdate(
      { examId: 'EXAM_CN_001' },
      {
        examId: 'EXAM_CN_001',
        subject: 'Computer Networks',
        examDate: today,
        startTime: '10:00 AM',
        latestAllowedStartTime: '10:05 AM',
        endTime: '10:35 AM',
        durationMinutes: 30,
        totalQuestions: 20
      },
      { upsert: true, new: true }
    );

    // Seed Quantum Computing Schedule (Tomorrow / Upcoming)
    await ExamSchedule.findOneAndUpdate(
      { examId: 'EXAM_QC_002' },
      {
        examId: 'EXAM_QC_002',
        subject: 'Quantum Computing',
        examDate: tomorrow,
        startTime: '10:00 AM',
        latestAllowedStartTime: '10:05 AM',
        endTime: '10:35 AM',
        durationMinutes: 30,
        totalQuestions: 20
      },
      { upsert: true, new: true }
    );

    console.log(`📅 Exam Schedules Initialized: Computer Networks (${today}), Quantum Computing (${tomorrow})`);
  } catch (err) {
    console.error('Failed to seed exam schedules:', err);
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files (index.html, styles.css, app.js, questions.js)
app.use(express.static(__dirname));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/exams', examRoutes);

// Admin Direct Route - Serves main app page & triggers Admin Login modal
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'Backend Online',
    timestamp: new Date().toISOString(),
    database: 'MongoDB'
  });
});

// Root Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Express Listener
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Node.js Express Backend running on port ${PORT}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔒 Admin Route: http://localhost:${PORT}/admin`);
  console.log(`====================================================`);
});
