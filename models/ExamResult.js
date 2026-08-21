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
      userAnswer: Number,
      correctAnswer: Number,
      isCorrect: Boolean,
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
