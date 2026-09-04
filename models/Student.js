const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  regNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    default: 'CSE',
    trim: true,
    uppercase: true
  },
  course: {
    type: String,
    default: 'B.Tech'
  },
  year: {
    type: String,
    default: '3'
  },
  semester: {
    type: String,
    default: '1'
  },
  section: {
    type: String,
    default: 'A',
    uppercase: true,
    trim: true
  },
  photo_url: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    default: 'password123'
  },
  role: {
    type: String,
    enum: ['STUDENT', 'FACULTY', 'ADMIN'],
    default: 'STUDENT'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignedSubjects: [{
    type: String,
    trim: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Student', studentSchema);

