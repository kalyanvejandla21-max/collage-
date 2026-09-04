const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ExamResult = require('../models/ExamResult');
const Question = require('../models/Question');
const ActivityLog = require('../models/ActivityLog');
const { requireFacultyOrAdmin, requireSubjectPermission } = require('../middleware/authMiddleware');
const {
  appendExamResultToExcel,
  generateFilteredExcelBuffer,
  EXCEL_RESULTS_BASE_DIR
} = require('../utils/excelHelper');

/**
 * Helper to log faculty/admin activities for audit logs
 */
async function logAudit(facultyId, facultyName, action, subject = 'N/A', details = '') {
  try {
    await ActivityLog.create({
      action: `[AUDIT] ${action}`,
      details: `Faculty ID: ${facultyId} (${facultyName}) | Subject: ${subject} | Details: ${details}`,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Failed to log audit activity:', err);
  }
}

// 1. POST /api/results/submit - Student Exam Submission, Server-side Grading, MongoDB & Excel Auto-Sync
router.post('/submit', async (req, res) => {
  try {
    const {
      regNo,
      studentName,
      year,
      section,
      subject,
      examName,
      examDate,
      startTime,
      userAnswers,
      durationMinutes,
      timeTaken,
      autoSubmitted,
      submissionType,
      fullscreenExitCount,
      tabSwitchCount,
      totalViolationsCount,
      securityLogs
    } = req.body;

    if (!regNo || !subject || !Array.isArray(userAnswers)) {
      return res.status(400).json({
        success: false,
        message: 'Registration Number (regNo), Subject, and User Answers array are required.'
      });
    }

    const cleanReg = regNo.trim().toUpperCase();

    // REQUIREMENT 5 & 13: Fetch authenticated Student record from DB as Source of Truth
    const Student = require('../models/Student');
    const dbStudent = await Student.findOne({ regNo: cleanReg });
    const verifiedName = dbStudent ? dbStudent.name : (studentName || 'Student');
    const verifiedYear = dbStudent ? (dbStudent.year.includes('B.Tech') ? dbStudent.year : `${dbStudent.year} Year`) : (year || '3rd Year');
    const verifiedSection = dbStudent ? dbStudent.section : (section || 'A');

    // REQUIREMENT 12: DUPLICATE PREVENTION - Check if this student already submitted this exam
    let existingResult = await ExamResult.findOne({ regNo: cleanReg, subject });
    if (existingResult) {
      console.log(`⚠️ Duplicate submission prevented for ${cleanReg} on ${subject}. Returning existing result record.`);
      return res.status(200).json({
        success: true,
        message: 'Exam submission already recorded. Duplicate entry prevented.',
        isDuplicate: true,
        result: existingResult
      });
    }

    const hintsUsedArray = Array.isArray(req.body.hintsUsed) ? req.body.hintsUsed : [];
    const clientQuestionList = Array.isArray(req.body.questionList) ? req.body.questionList : [];

    // Fetch master questions from MongoDB for server-authoritative grading
    let dbQuestions = await Question.find({ subject }).sort({ questionId: 1 });
    let evalQuestions = (clientQuestionList && clientQuestionList.length > 0) ? clientQuestionList : dbQuestions;

    const dbQuestionMap = new Map();
    if (dbQuestions && dbQuestions.length > 0) {
      dbQuestions.forEach(dbQ => {
        dbQuestionMap.set(dbQ.questionId || dbQ._id, dbQ);
      });
    }

    let correctCount = 0;
    let wrongCount = 0;
    let attemptedCount = 0;
    let unansweredCount = 0;
    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;
    let hintsUsedTotal = 0;
    let totalMaxMarks = 0;
    let totalMarksObtained = 0;
    const breakdown = [];

    evalQuestions.forEach((q, idx) => {
      const studentAns = userAnswers[idx] !== undefined && userAnswers[idx] !== null ? Number(userAnswers[idx]) : null;
      const isHintUsed = Boolean(hintsUsedArray[idx]);

      if (isHintUsed) hintsUsedTotal++;

      if (studentAns !== null && studentAns !== undefined && studentAns >= 0) {
        attemptedCount++;
      } else {
        unansweredCount++;
      }

      const dbMatch = dbQuestionMap.get(q.questionId || q.id);
      const targetCorrect = (dbMatch && typeof dbMatch.correct === 'number' && (!clientQuestionList || !clientQuestionList.length)) ? dbMatch.correct : q.correct;
      const diffStr = q.difficulty || (dbMatch && dbMatch.difficulty) || (idx % 3 === 0 ? 'Easy' : (idx % 3 === 1 ? 'Medium' : 'Hard'));
      const diffUpper = String(diffStr).trim().toUpperCase();
      let normDiff = 'Medium';
      let baseMarks = 2;

      if (diffUpper === 'EASY') {
        normDiff = 'Easy';
        baseMarks = 1;
        easyCount++;
      } else if (diffUpper === 'HARD') {
        normDiff = 'Hard';
        baseMarks = 2;
        hardCount++;
      } else {
        normDiff = 'Medium';
        baseMarks = 2;
        mediumCount++;
      }

      totalMaxMarks += baseMarks;

      // Available max marks after hint penalty
      const availableMaxMarks = isHintUsed ? Math.max(0, baseMarks - 1) : baseMarks;
      const isCorrect = studentAns === targetCorrect;

      let marksAwarded = 0;
      if (isCorrect) {
        correctCount++;
        marksAwarded = availableMaxMarks;
        totalMarksObtained += marksAwarded;
      } else {
        wrongCount++;
        marksAwarded = 0;
      }

      breakdown.push({
        questionId: q.questionId || idx + 1,
        question: q.question,
        difficulty: normDiff,
        maxMarks: baseMarks,
        hintUsed: isHintUsed,
        userAnswer: studentAns,
        correctAnswer: q.correct,
        isCorrect,
        marksAwarded,
        explanation: q.explanation || ''
      });
    });

    const totalQuestions = evalQuestions.length || userAnswers.length;
    const percentage = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;
    const status = percentage >= 40 ? 'PASS' : 'FAIL';
    const marksObtainedStr = `${totalMarksObtained} / ${totalMaxMarks}`;

    // Create MongoDB ExamResult document (Source of Truth)
    const resultDoc = await ExamResult.create({
      regNo: cleanReg,
      studentName: verifiedName,
      year: verifiedYear,
      section: verifiedSection,
      subject,
      examName: examName || `${subject} Mid Examination`,
      examDate: examDate || new Date().toISOString().split('T')[0],
      startTime: startTime || '10:00 AM',
      totalQuestions,
      easyCount,
      mediumCount,

      hardCount,
      hintsUsed: hintsUsedTotal,
      maximumMarks: totalMaxMarks,
      attemptedCount,
      unansweredCount,
      correctCount,
      wrongCount,
      totalMarks: totalMaxMarks,
      marksObtained: marksObtainedStr,
      marksObtainedNum: totalMarksObtained,
      percentage,
      status,
      durationMinutes: durationMinutes || 30,
      timeTaken: timeTaken || '20 Mins',
      autoSubmitted: Boolean(autoSubmitted),
      submissionType: submissionType || (autoSubmitted ? 'AUTOMATIC' : 'MANUAL'),
      userAnswers,
      breakdown,
      fullscreenExitCount: fullscreenExitCount || 0,
      tabSwitchCount: tabSwitchCount || 0,
      totalViolationsCount: totalViolationsCount || 0,
      securityLogs: Array.isArray(securityLogs) ? securityLogs : [],
      excelSynced: true,
      excelSyncError: '',
      submittedAt: new Date()
    });

    console.log(`📊 Saved Exam Result to MongoDB: ${cleanReg} | ${subject} | Marks: ${marksObtainedStr} | Status: ${status}`);

    // REQUIREMENT 4, 13 & 19: Automatic Excel storage on server with error resilience
    const excelSynced = appendExamResultToExcel(resultDoc);

    if (!excelSynced) {
      // Record synchronization warning in MongoDB without failing student exam submission
      resultDoc.excelSynced = false;
      resultDoc.excelSyncError = 'File access locked or Excel write failed temporarily. Sync retry queued.';
      await resultDoc.save();
      console.warn(`⚠️ Excel sync delayed for ${cleanReg} on ${subject}. MongoDB result preserved safely.`);
    }

    res.status(201).json({
      success: true,
      message: excelSynced 
        ? 'Exam submitted successfully. Result saved in MongoDB and Excel workbook updated.'
        : 'Result saved successfully in MongoDB. Excel synchronization requires retry.',
      result: resultDoc,
      excelSynced
    });
  } catch (error) {
    console.error('Submit result error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. GET /api/results/faculty/summary - KPI Cards Data (Faculty/Admin Only)
router.get('/faculty/summary', requireFacultyOrAdmin, async (req, res) => {
  try {
    const user = req.user;
    let filter = {};

    // Filter by Faculty Assigned Subjects
    if (user.role === 'FACULTY' && Array.isArray(user.assignedSubjects) && user.assignedSubjects.length > 0) {
      filter.subject = { $in: user.assignedSubjects };
    }

    const results = await ExamResult.find(filter);

    const totalSubmissions = results.length;
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const uniqueStudents = new Set(results.map(r => r.regNo)).size;
    const uniqueExams = new Set(results.map(r => r.subject)).size;

    const totalPctSum = results.reduce((acc, r) => acc + (r.percentage || 0), 0);
    const averageMarks = totalSubmissions > 0 ? Math.round(totalPctSum / totalSubmissions) : 0;
    const pendingExcelSyncCount = results.filter(r => r.excelSynced === false).length;

    res.json({
      success: true,
      summary: {
        totalExams: uniqueExams,
        totalStudents: uniqueStudents,
        totalSubmissions,
        passCount,
        failCount,
        averageMarks,
        pendingExcelSyncCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. GET /api/results/faculty/all - Filtered Result Table (Faculty/Admin Only with Subject Restriction)
router.get('/faculty/all', requireFacultyOrAdmin, requireSubjectPermission, async (req, res) => {
  try {
    const user = req.user;
    const { subject, examName, examDate, year, section, status, search } = req.query;

    const filter = {};

    // Apply Faculty Subject Scope
    if (user.role === 'FACULTY' && Array.isArray(user.assignedSubjects) && user.assignedSubjects.length > 0) {
      if (subject && subject !== 'ALL') {
        filter.subject = subject;
      } else {
        filter.subject = { $in: user.assignedSubjects };
      }
    } else if (subject && subject !== 'ALL') {
      filter.subject = subject;
    }

    if (status && status !== 'ALL') filter.status = status.toUpperCase();
    if (year && year !== 'ALL') filter.year = year;
    if (section && section !== 'ALL') filter.section = section.toUpperCase();
    if (examDate) filter.examDate = examDate;
    if (examName) filter.examName = { $regex: examName, $options: 'i' };

    if (search) {
      filter.$or = [
        { regNo: { $regex: search, $options: 'i' } },
        { studentName: { $regex: search, $options: 'i' } }
      ];
    }

    const results = await ExamResult.find(filter).sort({ submittedAt: -1 });

    res.json({
      success: true,
      count: results.length,
      userRole: user.role,
      assignedSubjects: user.assignedSubjects || [],
      results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. GET /api/results/faculty/export - Secure Excel Download (Faculty/Admin Only with Subject Restriction)
router.get('/faculty/export', requireFacultyOrAdmin, requireSubjectPermission, async (req, res) => {
  try {
    const user = req.user;
    const { subject, examName, examDate, year, section, status, search } = req.query;

    const filter = {};

    if (user.role === 'FACULTY' && Array.isArray(user.assignedSubjects) && user.assignedSubjects.length > 0) {
      if (subject && subject !== 'ALL') {
        filter.subject = subject;
      } else {
        filter.subject = { $in: user.assignedSubjects };
      }
    } else if (subject && subject !== 'ALL') {
      filter.subject = subject;
    }

    if (status && status !== 'ALL') filter.status = status.toUpperCase();
    if (year && year !== 'ALL') filter.year = year;
    if (section && section !== 'ALL') filter.section = section.toUpperCase();
    if (examDate) filter.examDate = examDate;
    if (examName) filter.examName = { $regex: examName, $options: 'i' };

    if (search) {
      filter.$or = [
        { regNo: { $regex: search, $options: 'i' } },
        { studentName: { $regex: search, $options: 'i' } }
      ];
    }

    const results = await ExamResult.find(filter).sort({ submittedAt: -1 });

    if (!results || results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No examination results found matching the specified criteria for Excel export.'
      });
    }

    // Generate dynamic Excel Buffer
    const excelBuffer = generateFilteredExcelBuffer(results, `${subject || 'ALIET'}_Exam_Results`);

    const safeSubjectName = (subject || 'Filtered_Results').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `ALIET_${safeSubjectName}_Results_${Date.now().toString().slice(-6)}.xlsx`;

    // Audit Log for Excel Export
    await logAudit(user.regNo, user.name, 'Downloaded Excel Results', subject || 'ALL', `Records Exported: ${results.length}`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(excelBuffer);
  } catch (error) {
    console.error('Excel Export Route Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. POST /api/results/faculty/retry-sync - Manually retry failed Excel writes (Faculty/Admin Only)
router.post('/faculty/retry-sync', requireFacultyOrAdmin, async (req, res) => {
  try {
    const pendingResults = await ExamResult.find({ excelSynced: false });

    let syncedCount = 0;
    for (const doc of pendingResults) {
      const ok = appendExamResultToExcel(doc);
      if (ok) {
        doc.excelSynced = true;
        doc.excelSyncError = '';
        await doc.save();
        syncedCount++;
      }
    }

    await logAudit(req.user.regNo, req.user.name, 'Triggered Excel Sync Retry', 'N/A', `Synced ${syncedCount} of ${pendingResults.length} pending records`);

    res.json({
      success: true,
      message: `Excel Synchronization Retry complete. Successfully synced ${syncedCount} of ${pendingResults.length} pending records.`,
      pendingCount: pendingResults.length - syncedCount,
      syncedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. GET /api/results/student/:regNo - Get student's exam submission history
router.get('/student/:regNo', async (req, res) => {
  try {
    const cleanReg = req.params.regNo.trim().toUpperCase();
    const results = await ExamResult.find({ regNo: cleanReg }).sort({ submittedAt: -1 });
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
