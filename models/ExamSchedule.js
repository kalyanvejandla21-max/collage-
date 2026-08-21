const mongoose = require('mongoose');

const examScheduleSchema = new mongoose.Schema({
  examId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    index: true
  },
  examDate: {
    type: String, // Format: YYYY-MM-DD (e.g. '2026-08-19')
    required: true
  },
  startTime: {
    type: String, // Format: HH:MM AM/PM (e.g. '10:00 AM')
    required: true
  },
  latestAllowedStartTime: {
    type: String, // Format: HH:MM AM/PM (e.g. '10:05 AM')
    required: true
  },
  endTime: {
    type: String, // Format: HH:MM AM/PM (e.g. '10:35 AM')
    required: true
  },
  durationMinutes: {
    type: Number,
    required: true,
    default: 30
  },
  totalQuestions: {
    type: Number,
    default: 20
  },
  createdBy: {
    type: String,
    default: 'Faculty Admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ExamSchedule', examScheduleSchema);
