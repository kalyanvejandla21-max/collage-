const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  questionId: {
    type: Number,
    required: true
  },
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    required: true
  },
  correct: {
    type: Number,
    required: true
  },
  explanation: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
