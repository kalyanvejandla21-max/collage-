const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const path = require('path');
const { parseMCQsFromExcel } = require('../utils/excelHelper');

// Fisher-Yates Shuffle Utility
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Randomly samples 20 questions and shuffles options (preserving correct answer)
function processRandomExamPaper(questionList, limit = 20) {
  if (!questionList || questionList.length === 0) return [];
  
  // 1. Randomly sample 'limit' (20) questions out of available pool
  const sampled = shuffleArray(questionList).slice(0, limit);

  // 2. Shuffle question order & options while tracking correct answer
  return sampled.map((q, idx) => {
    const options = Array.isArray(q.options) ? [...q.options] : [];
    const correctIdx = typeof q.correct === 'number' ? q.correct : 0;
    const correctText = options[correctIdx] || options[0];

    const shuffledOpts = shuffleArray(options);
    const newCorrectIdx = shuffledOpts.indexOf(correctText);

    return {
      id: q.questionId || q.id || (idx + 1),
      questionId: q.questionId || q.id || (idx + 1),
      subject: q.subject,
      question: q.question,
      options: shuffledOpts,
      correct: newCorrectIdx !== -1 ? newCorrectIdx : 0,
      explanation: q.explanation || ''
    };
  });
}

// GET /api/questions/subjects - Get list of distinct subjects from MongoDB
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await Question.distinct('subject');
    res.json({ success: true, subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/questions/:subject - Fetch 20 randomized questions with shuffled options
router.get('/:subject', async (req, res) => {
  try {
    const subjectParam = req.params.subject;
    let questions = await Question.find({ subject: subjectParam }).lean();
    
    // Fallback to Excel files directly if MongoDB returns empty
    if (!questions || questions.length === 0) {
      if (subjectParam.toLowerCase().includes('network')) {
        questions = parseMCQsFromExcel(path.join(__dirname, '../Computer_Networks_Unit1_2_50_MCQs.xlsx'), 'Computer Networks');
      } else if (subjectParam.toLowerCase().includes('quantum')) {
        questions = parseMCQsFromExcel(path.join(__dirname, '../Quantum_Computing_Unit1_Unit2_50_MCQs.xlsx'), 'Quantum Computing');
      }
    }

    // Process 20 random sampling + question shuffling + option shuffling
    const examPaper = processRandomExamPaper(questions, 20);

    res.json({
      success: true,
      subject: subjectParam,
      totalPoolCount: questions.length,
      count: examPaper.length,
      questions: examPaper
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/questions - Add a single question or array of questions to MongoDB
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    let created;
    if (Array.isArray(data)) {
      created = await Question.insertMany(data);
    } else {
      created = await Question.create(data);
    }
    res.status(201).json({ success: true, count: Array.isArray(created) ? created.length : 1, data: created });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
