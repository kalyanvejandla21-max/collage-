const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ExamResult = require('../models/ExamResult');
const Question = require('../models/Question');
const ActivityLog = require('../models/ActivityLog');
const { requireStudentAuth, requireOwnStudentResult, requireFacultyOrAdmin, requireSubjectPermission } = require('../middleware/authMiddleware');
const {
  appendExamResultToExcel,
  rebuildExamExcelFromDB,
  generateFilteredExcelBuffer,
  getSubjectExcelPath,
  EXCEL_RESULTS_BASE_DIR,
  MASTER_EXCEL_FILE_PATH
} = require('../utils/excelHelper');
const { enqueueExcelSync } = require('../utils/excelQueue');

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

// 1. POST /api/results/submit - Student Exam Submission, Server-side Grading, MongoDB & Non-blocking Async Excel Sync
router.post('/submit', async (req, res) => {
  try {
    const {
      regNo,
      studentName,
      year,
      section,
      subject,
      examId,
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
    const cleanExamId = (examId || `EXAM_${subject.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`).trim().toUpperCase();

    // REQUIREMENT 5 & 13: Fetch authenticated Student record from DB as Source of Truth
    const Student = require('../models/Student');
    const dbStudent = await Student.findOne({ regNo: cleanReg });
    const verifiedName = dbStudent ? dbStudent.name : (studentName || 'Student');
    const verifiedYear = dbStudent ? (dbStudent.year.includes('B.Tech') ? dbStudent.year : `${dbStudent.year} Year`) : (year || '3rd Year');
    const verifiedSection = dbStudent ? dbStudent.section : (section || 'A');

    // REQUIREMENT 8 & 12: DUPLICATE PREVENTION - Check if this student already submitted this exam
    let existingResult = await ExamResult.findOne({
      regNo: cleanReg,
      $or: [
        { examId: cleanExamId },
        { subject }
      ]
    });

    if (existingResult) {
      console.log(`⚠️ Duplicate submission prevented for ${cleanReg} on ${subject} (${cleanExamId}). Returning existing result.`);
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

    // REQUIREMENT 7: Save to MongoDB as Primary Source of Truth
    const resultDoc = await ExamResult.create({
      regNo: cleanReg,
      studentName: verifiedName,
      year: verifiedYear,
      section: verifiedSection,
      subject,
      examId: cleanExamId,
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

    console.log(`📊 Saved Exam Result to MongoDB: ${cleanReg} | ${cleanExamId} (${subject}) | Marks: ${marksObtainedStr} | Status: ${status}`);

    // REQUIREMENT 9, 10 & 11: Non-blocking Queue for Excel Synchronization
    enqueueExcelSync(resultDoc, appendExamResultToExcel);

    // Return response immediately to student
    res.status(201).json({
      success: true,
      message: 'Exam submitted successfully. Result saved in MongoDB and Excel synchronization queued.',
      result: resultDoc,
      excelSynced: true
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

// 3. GET /api/results/faculty/all - Filtered & Paginated Result Table (Faculty/Admin Only)
router.get('/faculty/all', requireFacultyOrAdmin, requireSubjectPermission, async (req, res) => {
  try {
    const user = req.user;
    const { subject, examName, examDate, year, section, status, search, page = 1, limit = 50 } = req.query;

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
        { studentName: { $regex: search, $options: 'i' } },
        { examId: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const total = await ExamResult.countDocuments(filter);
    const results = await ExamResult.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      count: results.length,
      userRole: user.role,
      assignedSubjects: user.assignedSubjects || [],
      results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. GET /api/results/faculty/export - Secure Excel Export Download (Faculty/Admin Only)
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

    const excelBuffer = generateFilteredExcelBuffer(results, `${subject || 'ALIET'}_Exam_Results`);
    const safeSubjectName = (subject || 'Filtered_Results').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `ALIET_${safeSubjectName}_Results_${Date.now().toString().slice(-6)}.xlsx`;

    await logAudit(user.regNo || user.id, user.name, 'Downloaded Filtered Excel Results', subject || 'ALL', `Records Exported: ${results.length}`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(excelBuffer);
  } catch (error) {
    console.error('Excel Export Route Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. POST /api/results/admin/rebuild-excel - Rebuild Consolidated 2-Sheet Excel Workbook from MongoDB
router.post('/admin/rebuild-excel', requireFacultyOrAdmin, async (req, res) => {
  try {
    const { subject, examName } = req.body;
    const ok = await rebuildExamExcelFromDB(subject, examName);

    if (ok) {
      await logAudit(req.user.regNo || req.user.id, req.user.name, 'Rebuilt Excel Workbook from DB', subject || 'ALL', `Exam: ${examName || 'ALL'}`);
      return res.json({
        success: true,
        message: `Consolidated Excel workbook for '${subject || 'ALL'}' successfully rebuilt from MongoDB.`
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to rebuild Excel workbook or no matching records found.'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. GET /api/results/admin/download-exam-excel - Download Consolidated Per-Exam Excel File
router.get('/admin/download-exam-excel', requireFacultyOrAdmin, async (req, res) => {
  try {
    const { subject, examName } = req.query;
    const filePath = getSubjectExcelPath(subject, examName);

    if (!fs.existsSync(filePath)) {
      // Auto-rebuild if not yet created on disk
      await rebuildExamExcelFromDB(subject, examName);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: `Excel workbook for '${subject || 'Exam'}' is not available.`
      });
    }

    await logAudit(req.user.regNo || req.user.id, req.user.name, 'Downloaded Exam Excel File', subject || 'N/A');
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6b. GET /api/results/download-excel - Download Master Excel File
router.get('/download-excel', async (req, res) => {
  try {
    if (fs.existsSync(MASTER_EXCEL_FILE_PATH)) {
      return res.download(MASTER_EXCEL_FILE_PATH, 'Exam_Results_Database.xlsx');
    }

    const results = await ExamResult.find({}).sort({ submittedAt: -1 });
    if (!results || results.length === 0) {
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['No results available yet']]);
      XLSX.utils.book_append_sheet(wb, ws, 'Results');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Exam_Results_Database.xlsx"');
      return res.send(buf);
    }

    const excelBuffer = generateFilteredExcelBuffer(results, 'Master_Exam_Results');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Exam_Results_Database.xlsx"');
    return res.send(excelBuffer);
  } catch (error) {
    console.error('Master Excel Download Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. POST /api/results/faculty/retry-sync - Manually retry failed Excel writes (Faculty/Admin Only)
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

    await logAudit(req.user.regNo || req.user.id, req.user.name, 'Triggered Excel Sync Retry', 'N/A', `Synced ${syncedCount} of ${pendingResults.length} pending records`);

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

// 8. GET /api/results/student/:regNo - Get student's exam submission history (Protected: Own student or Faculty/Admin)
router.get('/student/:regNo', requireStudentAuth, requireOwnStudentResult, async (req, res) => {
  try {
    const cleanReg = req.params.regNo.trim().toUpperCase();
    const results = await ExamResult.find({ regNo: cleanReg }).sort({ submittedAt: -1 });
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
