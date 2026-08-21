const mongoose = require('mongoose');

const studentAttemptSchema = new mongoose.Schema({
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
  examId: {
    type: String,
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true
  },
  examDate: {
    type: String
  },
  scheduledStartTime: {
    type: String
  },
  latestAllowedStartTime: {
    type: String
  },
  status: {
    type: String,
    enum: ['UPCOMING', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED'],
    default: 'UPCOMING',
    required: true
  },
  cancelReason: {
    type: String,
    enum: ['START_TIME_EXPIRED', 'SECURITY_VIOLATION', null],
    default: null
  },
  startedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  submittedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Composite unique index to ensure one attempt record per student per exam
studentAttemptSchema.index({ regNo: 1, examId: 1 }, { unique: true });

module.exports = mongoose.model('StudentAttempt', studentAttemptSchema);
