const mongoose = require('mongoose');

const examResultSchema = new mongoose.Schema({
  regNo: {
    type: String,
    required: true,
    index: true,
    uppercase: true,
    trim: true
  },
  studentName: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  easyCount: {
    type: Number,
    default: 0
  },
  mediumCount: {
    type: Number,
    default: 0
  },
  hardCount: {
    type: Number,
    default: 0
  },
  hintsUsed: {
    type: Number,
    default: 0
  },
  maximumMarks: {
    type: Number,
    default: 20
  },
  correctCount: {
    type: Number,
    required: true
  },
  wrongCount: {
    type: Number,
    required: true
  },
  marksObtained: {
    type: String,
    required: true
  },
  marksObtainedNum: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['PASS', 'FAIL'],
    required: true
  },
  userAnswers: [mongoose.Schema.Types.Mixed],
  breakdown: [
    {
      questionId: Number,
      question: String,
      difficulty: String,
      maxMarks: Number,
      hintUsed: Boolean,
      userAnswer: Number,
      correctAnswer: Number,
      isCorrect: Boolean,
      marksAwarded: Number,
      explanation: String
    }
  ],
  fullscreenExitCount: {
    type: Number,
    default: 0
  },
  tabSwitchCount: {
    type: Number,
    default: 0
  },
  totalViolationsCount: {
    type: Number,
    default: 0
  },
  year: {
    type: String,
    default: 'III B.Tech'
  },
  section: {
    type: String,
    default: 'A'
  },
  examName: {
    type: String,
    default: ''
  },
  examDate: {
    type: String,
    default: ''
  },
  startTime: {
    type: String,
    default: ''
  },
  attemptedCount: {
    type: Number,
    default: 0
  },
  unansweredCount: {
    type: Number,
    default: 0
  },
  totalMarks: {
    type: Number,
    default: 20
  },
  durationMinutes: {
    type: Number,
    default: 30
  },
  timeTaken: {
    type: String,
    default: ''
  },
  autoSubmitted: {
    type: Boolean,
    default: false
  },
  submissionType: {
    type: String,
    enum: ['MANUAL', 'AUTOMATIC'],
    default: 'MANUAL'
  },
  excelSynced: {
    type: Boolean,
    default: true
  },
  excelSyncError: {
    type: String,
    default: ''
  },
  securityLogs: [
    {
      eventType: String,
      timestamp: String,
      count: Number
    }
  ],
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ExamResult', examResultSchema);
