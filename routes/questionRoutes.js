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

const ExamSchedule = require('../models/ExamSchedule');

// Difficulty-based or random question sampling with Fisher-Yates shuffle
function processRandomExamPaper(questionList, limit = 20, difficultyDist = null) {
  if (!questionList || questionList.length === 0) return [];

  let selectedPool = [];

  // 1. Check if a valid difficulty distribution is provided (e.g. { easy: 3, medium: 4, hard: 3 })
  if (difficultyDist && (difficultyDist.easy > 0 || difficultyDist.medium > 0 || difficultyDist.hard > 0)) {
    const easyPool = shuffleArray(questionList.filter(q => (q.difficulty || 'MEDIUM').toUpperCase() === 'EASY'));
    const mediumPool = shuffleArray(questionList.filter(q => (q.difficulty || 'MEDIUM').toUpperCase() === 'MEDIUM'));
    const hardPool = shuffleArray(questionList.filter(q => (q.difficulty || 'MEDIUM').toUpperCase() === 'HARD'));

    const selectedEasy = easyPool.slice(0, difficultyDist.easy);
    const selectedMedium = mediumPool.slice(0, difficultyDist.medium);
    const selectedHard = hardPool.slice(0, difficultyDist.hard);

    selectedPool = [...selectedEasy, ...selectedMedium, ...selectedHard];

    // Top-up if pools were smaller than requested distribution
    if (selectedPool.length < limit) {
      const remainingNeeded = limit - selectedPool.length;
      const unusedPool = shuffleArray(questionList.filter(q => !selectedPool.includes(q)));
      selectedPool = [...selectedPool, ...unusedPool.slice(0, remainingNeeded)];
    }
  } else {
    // Standard random sampling
    selectedPool = shuffleArray(questionList).slice(0, limit);
  }

  // Shuffle final combined order
  const finalShuffled = shuffleArray(selectedPool);

  // 2. Shuffle options while maintaining correct answer tracking
  return finalShuffled.map((q, idx) => {
    const options = Array.isArray(q.options) ? [...q.options] : [];
    const correctIdx = typeof q.correct === 'number' ? q.correct : 0;
    const correctText = options[correctIdx] || options[0];

    const shuffledOpts = shuffleArray(options);
    const newCorrectIdx = shuffledOpts.indexOf(correctText);

    const diffUpper = (q.difficulty || (idx % 3 === 0 ? 'EASY' : (idx % 3 === 1 ? 'MEDIUM' : 'HARD'))).toString().trim().toUpperCase();
    let normDiff = 'Medium';
    let normMarks = 2;

    if (diffUpper === 'EASY') {
      normDiff = 'Easy';
      normMarks = 1;
    } else if (diffUpper === 'HARD') {
      normDiff = 'Hard';
      normMarks = 2;
    } else {
      normDiff = 'Medium';
      normMarks = 2;
    }

    return {
      id: q.questionId || q.id || (idx + 1),
      questionId: q.questionId || q.id || (idx + 1),
      subject: q.subject,
      question: q.question,
      options: shuffledOpts,
      correct: newCorrectIdx !== -1 ? newCorrectIdx : 0,
      difficulty: normDiff,
      marks: normMarks,
      hint: q.hint || `Analyze key principles of ${q.subject || 'this topic'}.`,
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

// GET /api/questions/:subject - Fetch randomized questions with difficulty selection support
router.get('/:subject', async (req, res) => {
  try {
    const subjectParam = req.params.subject;
    const { examId, easyCount, mediumCount, hardCount, limit } = req.query;

    let questions = await Question.find({ subject: subjectParam }).lean();
    
    // Fallback to Excel files directly if MongoDB returns empty
    if (!questions || questions.length === 0) {
      if (subjectParam.toLowerCase().includes('network')) {
        questions = parseMCQsFromExcel(path.join(__dirname, '../Computer_Networks_Unit1_2_50_MCQs.xlsx'), 'Computer Networks');
      } else if (subjectParam.toLowerCase().includes('quantum')) {
        questions = parseMCQsFromExcel(path.join(__dirname, '../Quantum_Computing_Unit1_Unit2_50_MCQs.xlsx'), 'Quantum Computing');
      }
    }

    let difficultyDist = null;
    let targetLimit = parseInt(limit || 20, 10);

    // If examId passed, check if exam schedule has difficulty distribution
    if (examId) {
      const schedule = await ExamSchedule.findOne({ examId: examId.toUpperCase() });
      if (schedule) {
        targetLimit = schedule.totalQuestions || 20;
        if (schedule.easyCount > 0 || schedule.mediumCount > 0 || schedule.hardCount > 0) {
          difficultyDist = {
            easy: schedule.easyCount,
            medium: schedule.mediumCount,
            hard: schedule.hardCount
          };
        }
      }
    } else if (easyCount !== undefined || mediumCount !== undefined || hardCount !== undefined) {
      difficultyDist = {
        easy: parseInt(easyCount || 0, 10),
        medium: parseInt(mediumCount || 0, 10),
        hard: parseInt(hardCount || 0, 10)
      };
    }

    // Process random sampling + difficulty distribution + question & option shuffling
    const examPaper = processRandomExamPaper(questions, targetLimit, difficultyDist);

    res.json({
      success: true,
      subject: subjectParam,
      totalPoolCount: questions.length,
      count: examPaper.length,
      difficultyDistribution: difficultyDist,
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
