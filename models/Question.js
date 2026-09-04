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
  },
  topic: {
    type: String,
    default: 'General'
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard', 'EASY', 'MEDIUM', 'HARD'],
    default: 'Medium'
  },
  marks: {
    type: Number,
    default: 2
  },
  hint: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Pre-save hook to normalize difficulty to TitleCase and auto-assign marks
questionSchema.pre('save', function(next) {
  if (this.difficulty) {
    const diffUpper = String(this.difficulty).trim().toUpperCase();
    if (diffUpper === 'EASY') {
      this.difficulty = 'Easy';
      this.marks = 1;
    } else if (diffUpper === 'HARD') {
      this.difficulty = 'Hard';
      this.marks = 2;
    } else {
      this.difficulty = 'Medium';
      this.marks = 2;
    }
  }
  next();
});

module.exports = mongoose.model('Question', questionSchema);
