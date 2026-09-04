require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const resultRoutes = require('./routes/resultRoutes');
const examRoutes = require('./routes/examRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ExamSchedule = require('./models/ExamSchedule');
const Student = require('./models/Student');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB & Seed Exam Schedules & Faculty Account
connectDB().then(async () => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Seed Faculty Admin User
    await Student.findOneAndUpdate(
      { regNo: 'FACULTY01' },
      {
        regNo: 'FACULTY01',
        name: 'Faculty Coordinator',
        year: 'Faculty',
        section: 'CSE',
        password: 'admin123',
        role: 'FACULTY',
        assignedSubjects: ['Computer Networks', 'Finite Automata', 'Data Warehouse and Data Mining', 'Fundamentals of Computing']
      },
      { upsert: true, new: true }
    );

    // Seed Faculty A (Computer Networks & Finite Automata)
    await Student.findOneAndUpdate(
      { regNo: 'FACULTY_CN' },
      {
        regNo: 'FACULTY_CN',
        name: 'Prof. Ramesh (CN/FA)',
        year: 'Faculty',
        section: 'CSE',
        password: 'admin123',
        role: 'FACULTY',
        assignedSubjects: ['Computer Networks', 'Finite Automata']
      },
      { upsert: true, new: true }
    );

    // Seed Faculty B (Data Warehouse & Fundamentals)
    await Student.findOneAndUpdate(
      { regNo: 'FACULTY_DW' },
      {
        regNo: 'FACULTY_DW',
        name: 'Prof. Suresh (DWDM/FC)',
        year: 'Faculty',
        section: 'CSE',
        password: 'admin123',
        role: 'FACULTY',
        assignedSubjects: ['Data Warehouse and Data Mining', 'Fundamentals of Computing']
      },
      { upsert: true, new: true }
    );

    // Seed Computer Networks Schedule
    await ExamSchedule.findOneAndUpdate(
      { examId: 'EXAM_CN_001' },
      {
        examName: 'Mid-Term Computer Networks Exam',
        examId: 'EXAM_CN_001',
        subject: 'Computer Networks',
        examDate: today,
        startTime: '10:00 AM',
        latestAllowedStartTime: '10:05 AM',
        endTime: '10:35 AM',
        durationMinutes: 30,
        totalQuestions: 20,
        easyCount: 5,
        mediumCount: 10,
        hardCount: 5,
        isActive: true
      },
      { upsert: true, new: true }
    );

    // Seed Quantum Computing Schedule (Tomorrow / Upcoming)
    await ExamSchedule.findOneAndUpdate(
      { examId: 'EXAM_QC_002' },
      {
        examName: 'Quantum Computing Fundamentals',
        examId: 'EXAM_QC_002',
        subject: 'Quantum Computing',
        examDate: tomorrow,
        startTime: '10:00 AM',
        latestAllowedStartTime: '10:05 AM',
        endTime: '10:35 AM',
        durationMinutes: 30,
        totalQuestions: 20,
        easyCount: 5,
        mediumCount: 10,
        hardCount: 5,
        isActive: true
      },
      { upsert: true, new: true }
    );

    // Auto-seed Student Master Database if empty
    const fs = require('fs');
    const studentCount = await Student.countDocuments({ role: 'STUDENT' });
    if (studentCount < 10) {
      const masterPath = path.join(__dirname, 'data', 'students_master.json');
      if (fs.existsSync(masterPath)) {
        const masterList = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
        const docs = masterList.map(s => ({
          regNo: s.regNo || s.hallticket,
          name: s.name,
          department: s.department || 'CSE',
          course: s.course || 'B.Tech',
          year: String(s.year || '3'),
          semester: String(s.semester || '1'),
          section: s.section || 'A',
          photo_url: s.photo_url || '',
          password: 'password123',
          role: 'STUDENT',
          isActive: true
        }));
        await Student.insertMany(docs);
        console.log(`✅ Auto-seeded ${docs.length} master student records into MongoDB on startup.`);
      }
    }

    console.log(`📅 Exam Schedules & Faculty Accounts Initialized.`);
  } catch (err) {
    console.error('Failed to seed exam schedules:', err);
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// SERVER-SIDE SECURITY: Block direct HTTP requests for Excel files & results directory
app.use((req, res, next) => {
  const reqPath = req.path.toLowerCase();
  if (reqPath.endsWith('.xlsx') || reqPath.includes('/data/results') || reqPath.includes('/excel_results')) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Direct access to Excel result files is forbidden.'
    });
  }
  next();
});

// Serve static frontend files (index.html, styles.css, app.js, questions.js)
app.use(express.static(__dirname));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);

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
