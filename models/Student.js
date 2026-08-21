const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  regNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: String,
    default: 'III B.Tech'
  },
  section: {
    type: String,
    default: 'A'
  },
  password: {
    type: String,
    default: 'password123'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Student', studentSchema);
