const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema({
  regNo: {
    type: String,
    required: true,
    index: true,
    uppercase: true,
    trim: true
  },
  studentName: {
    type: String,
    default: 'Student'
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
  eventType: {
    type: String,
    enum: ['TAB_SWITCH', 'WINDOW_BLUR', 'WINDOW_FOCUS', 'FULLSCREEN_EXIT', 'FULLSCREEN_ENTRY'],
    required: true
  },
  timestamp: {
    type: String,
    default: () => new Date().toLocaleTimeString()
  },
  violationCount: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
