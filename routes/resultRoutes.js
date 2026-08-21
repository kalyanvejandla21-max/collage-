const express = require('express');
const router = express.Router();
const fs = require('fs');
const ExamResult = require('../models/ExamResult');
const Question = require('../models/Question');
const { appendExamResultToExcel, EXCEL_FILE_PATH } = require('../utils/excelHelper');

// POST /api/results/submit - Server-side grading & auto-update MongoDB & Excel Sheet
router.post('/submit', async (req, res) => {
  try {
    const { regNo, studentName, subject, userAnswers, fullscreenExitCount, tabSwitchCount, totalViolationsCount, securityLogs } = req.body;

    if (!regNo || !subject || !userAnswers) {
      return res.status(400).json({ success: false, message: 'regNo, subject, and userAnswers are required.' });
    }

    // Fetch master questions from MongoDB for validation
    let dbQuestions = await Question.find({ subject }).sort({ questionId: 1 });

    let correctCount = 0;
    let wrongCount = 0;
    const breakdown = [];

    dbQuestions.forEach((q, idx) => {
      const studentAns = userAnswers[idx] !== undefined && userAnswers[idx] !== null ? Number(userAnswers[idx]) : null;
      const isCorrect = studentAns === q.correct;

      if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }

      breakdown.push({
        questionId: q.questionId || idx + 1,
        question: q.question,
        userAnswer: studentAns,
        correctAnswer: q.correct,
        isCorrect,
        explanation: q.explanation
      });
    });

    const totalQuestions = dbQuestions.length || userAnswers.length;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const status = percentage >= 40 ? 'PASS' : 'FAIL';
    const marksObtained = `${correctCount} / ${totalQuestions}`;

    // Save result to MongoDB
    const resultDoc = await ExamResult.create({
      regNo: regNo.toUpperCase(),
      studentName: studentName || 'Student',
      subject,
      totalQuestions,
      correctCount,
      wrongCount,
      marksObtained,
      percentage,
      status,
      userAnswers,
      breakdown,
      fullscreenExitCount: fullscreenExitCount || 0,
      tabSwitchCount: tabSwitchCount || 0,
      totalViolationsCount: totalViolationsCount || 0,
      securityLogs: Array.isArray(securityLogs) ? securityLogs : [],
      submittedAt: new Date()
    });

    console.log(`📊 Saved Exam Result to MongoDB: ${regNo} | ${subject} | Marks: ${marksObtained} | Status: ${status}`);

    // AUTOMATICALLY APPEND RESULT TO EXCEL SPREADSHEET
    appendExamResultToExcel(resultDoc);

    res.status(201).json({
      success: true,
      message: 'Exam submitted successfully. MongoDB & Excel Spreadsheet updated.',
      result: resultDoc
    });
  } catch (error) {
    console.error('Submit result error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/results/download-excel - Download the master Excel spreadsheet file
router.get('/download-excel', (req, res) => {
  try {
    if (fs.existsSync(EXCEL_FILE_PATH)) {
      res.download(EXCEL_FILE_PATH, 'ALIET_Exam_Results_Database.xlsx', (err) => {
        if (err) {
          console.error('Download error:', err);
        }
      });
    } else {
      res.status(404).json({ success: false, message: 'No Excel sheet found yet. Submit an exam to generate it.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/results/student/:regNo - Get student's exam submission history
router.get('/student/:regNo', async (req, res) => {
  try {
    const cleanReg = req.params.regNo.trim().toUpperCase();
    const results = await ExamResult.find({ regNo: cleanReg }).sort({ submittedAt: -1 });
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/results/all - Get all exam results across students
router.get('/all', async (req, res) => {
  try {
    const results = await ExamResult.find().sort({ submittedAt: -1 });
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
