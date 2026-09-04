const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const Student = require('../models/Student');
const ExamSchedule = require('../models/ExamSchedule');
const Question = require('../models/Question');
const ExamResult = require('../models/ExamResult');
const StudentAttempt = require('../models/StudentAttempt');
const SecurityEvent = require('../models/SecurityEvent');
const ActivityLog = require('../models/ActivityLog');

// Helper to log admin activities
async function logActivity(action, details = '') {
  try {
    await ActivityLog.create({ action, details, timestamp: new Date() });
  } catch (err) {
    console.error('Failed to save activity log:', err);
  }
}

// Helper to convert 'YYYY-MM-DD' and 'HH:MM AM/PM' into a Date object
function parseExamTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  let hours = 0;
  let minutes = 0;
  
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const ampm = match[4] ? match[4].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  }
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

// 1. POST /api/admin/login - Faculty/Admin Login
router.post('/login', async (req, res) => {
  try {
    const { facultyId, password } = req.body;
    if (!facultyId || !password) {
      return res.status(400).json({ success: false, message: 'Faculty ID and Password are required.' });
    }

    const cleanId = facultyId.trim().toUpperCase();
    const passStr = String(password).trim();

    // Default Faculty Seed Check
    if ((cleanId === 'FACULTY01' || cleanId === 'ADMIN') && passStr === 'admin123') {
      const isMasterAdmin = cleanId === 'ADMIN';
      return res.json({
        success: true,
        message: 'Faculty Admin Authentication Successful',
        user: {
          id: cleanId,
          name: isMasterAdmin ? 'System Administrator' : 'Faculty Coordinator',
          role: isMasterAdmin ? 'ADMIN' : 'FACULTY',
          department: 'Computer Science & Engineering',
          assignedSubjects: ['Computer Networks', 'Finite Automata', 'Data Warehouse and Data Mining', 'Fundamentals of Computing']
        }
      });
    }

    // Check DB for Faculty Role User
    const user = await Student.findOne({ regNo: cleanId, role: { $in: ['FACULTY', 'ADMIN'] } });
    if (user && user.password === passStr) {
      return res.json({
        success: true,
        message: 'Faculty Authentication Successful',
        user: {
          id: user.regNo,
          name: user.name,
          role: user.role,
          department: 'CSE',
          assignedSubjects: user.assignedSubjects || []
        }
      });
    }

    return res.status(401).json({ success: false, message: 'Invalid Faculty Credentials or Unauthorized Access!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. GET /api/admin/dashboard - Summary Cards & Recent Activity
router.get('/dashboard', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const totalStudents = await Student.countDocuments({ role: 'STUDENT' }) || 66;
    const totalExams = await ExamSchedule.countDocuments();
    const todayExams = await ExamSchedule.countDocuments({ examDate: todayStr });
    const upcomingExams = await ExamSchedule.countDocuments({ examDate: { $gt: todayStr } });
    const completedExams = await ExamResult.countDocuments();
    
    // Count total security violation events
    const securityEventsCount = await SecurityEvent.countDocuments();
    const examResultsViolations = await ExamResult.aggregate([
      { $group: { _id: null, total: { $sum: "$totalViolationsCount" } } }
    ]);
    const totalViolations = Math.max(securityEventsCount, (examResultsViolations[0]?.total || 0));

    // Fetch 10 most recent activity logs
    let recentActivities = await ActivityLog.find().sort({ timestamp: -1 }).limit(10);
    if (!recentActivities || recentActivities.length === 0) {
      recentActivities = [
        { action: 'Quantum Computing exam scheduled', details: 'Automated Schedule', timestamp: new Date(Date.now() - 3600000) },
        { action: 'Computer Networks exam created', details: 'System Initializer', timestamp: new Date(Date.now() - 7200000) },
        { action: '50 questions imported for Computer Networks', details: 'MCQ Bank', timestamp: new Date(Date.now() - 86400000) }
      ];
    }

    res.json({
      success: true,
      summary: {
        totalStudents,
        totalExams,
        todayExams,
        upcomingExams,
        completedExams,
        totalViolations
      },
      recentActivities
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. POST /api/admin/exams - Create New Exam
router.post('/exams', async (req, res) => {
  try {
    const {
      examName,
      subject,
      examDate,
      startTime,
      latestAllowedStartTime,
      endTime,
      durationMinutes,
      totalQuestions,
      marksPerQuestion,
      passingPercentage,
      easyCount,
      mediumCount,
      hardCount
    } = req.body;

    if (!subject || !examDate || !startTime || !latestAllowedStartTime || !endTime) {
      return res.status(400).json({ success: false, message: 'All required fields (Subject, Exam Date, Start Time, Latest Allowed Start Time, End Time) must be provided.' });
    }

    // Time logic validation
    const startDt = parseExamTimestamp(examDate, startTime);
    const latestStartDt = parseExamTimestamp(examDate, latestAllowedStartTime);
    const endDt = parseExamTimestamp(examDate, endTime);

    if (endDt <= startDt) {
      return res.status(400).json({ success: false, message: 'Validation Error: End Time must be strictly after Start Time.' });
    }
    if (latestStartDt > endDt) {
      return res.status(400).json({ success: false, message: 'Validation Error: Latest Allowed Start Time cannot be after End Time.' });
    }

    const tQuestions = parseInt(totalQuestions || 20, 10);
    const easy = parseInt(easyCount || 0, 10);
    const medium = parseInt(mediumCount || 0, 10);
    const hard = parseInt(hardCount || 0, 10);

    // Difficulty distribution validation
    if ((easy > 0 || medium > 0 || hard > 0) && (easy + medium + hard !== tQuestions)) {
      return res.status(400).json({
        success: false,
        message: `Difficulty Distribution Validation Error: Easy (${easy}) + Medium (${medium}) + Hard (${hard}) = ${easy + medium + hard}, which must equal Total Questions (${tQuestions}).`
      });
    }

    const examId = `EXAM_${subject.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_${Date.now().toString().slice(-4)}`;

    const newSchedule = await ExamSchedule.create({
      examName: examName || `${subject} Examination`,
      examId,
      subject,
      examDate,
      startTime,
      latestAllowedStartTime,
      endTime,
      durationMinutes: parseInt(durationMinutes || 30, 10),
      totalQuestions: tQuestions,
      marksPerQuestion: parseFloat(marksPerQuestion || 1),
      passingPercentage: parseFloat(passingPercentage || 40),
      easyCount: easy,
      mediumCount: medium,
      hardCount: hard,
      isActive: true
    });

    await logActivity(`New exam created: ${subject}`, `Scheduled for ${examDate} (${startTime} - ${endTime})`);

    res.status(201).json({
      success: true,
      message: `Exam '${newSchedule.examName}' created successfully.`,
      exam: newSchedule
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. GET /api/admin/exams - Get All Scheduled Exams
router.get('/exams', async (req, res) => {
  try {
    const exams = await ExamSchedule.find().sort({ examDate: 1, startTime: 1 });
    const now = new Date();

    const processed = exams.map(sch => {
      const startDt = parseExamTimestamp(sch.examDate, sch.startTime);
      const latestStartDt = parseExamTimestamp(sch.examDate, sch.latestAllowedStartTime);
      const endDt = parseExamTimestamp(sch.examDate, sch.endTime);

      let status = 'UPCOMING';
      if (!sch.isActive) {
        status = 'CANCELLED';
      } else if (now > endDt) {
        status = 'COMPLETED';
      } else if (now >= startDt && now <= latestStartDt) {
        status = 'AVAILABLE';
      } else if (now > latestStartDt && now <= endDt) {
        status = 'IN_PROGRESS';
      }

      return {
        ...sch.toObject(),
        status
      };
    });

    res.json({ success: true, count: processed.length, exams: processed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. PUT /api/admin/exams/:id - Update Exam Schedule
router.put('/exams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.examDate && updateData.startTime && updateData.endTime) {
      const startDt = parseExamTimestamp(updateData.examDate, updateData.startTime);
      const latestStartDt = parseExamTimestamp(updateData.examDate, updateData.latestAllowedStartTime || updateData.startTime);
      const endDt = parseExamTimestamp(updateData.examDate, updateData.endTime);

      if (endDt <= startDt) {
        return res.status(400).json({ success: false, message: 'End Time must be after Start Time.' });
      }
      if (latestStartDt > endDt) {
        return res.status(400).json({ success: false, message: 'Latest Allowed Start Time cannot be after End Time.' });
      }
    }

    const updated = await ExamSchedule.findByIdAndUpdate(id, updateData, { new: true });
    await logActivity(`Exam updated: ${updated?.subject || id}`, `Modified configuration`);

    res.json({ success: true, message: 'Exam schedule updated successfully.', exam: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. DELETE /api/admin/exams/:id - Delete Exam Schedule
router.delete('/exams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ExamSchedule.findByIdAndDelete(id);
    await logActivity(`Exam deleted: ${deleted?.subject || id}`);
    res.json({ success: true, message: 'Exam schedule deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. PATCH /api/admin/exams/:id/toggle - Activate/Deactivate Exam
router.patch('/exams/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await ExamSchedule.findById(id);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });

    exam.isActive = !exam.isActive;
    await exam.save();
    await logActivity(`Exam ${exam.isActive ? 'activated' : 'deactivated'}: ${exam.subject}`);

    res.json({ success: true, message: `Exam status toggled to ${exam.isActive ? 'Active' : 'Inactive'}.`, exam });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. GET /api/admin/questions - List & Filter Question Bank
router.get('/questions', async (req, res) => {
  try {
    const { subject, difficulty, search } = req.query;
    const filter = {};

    if (subject && subject !== 'ALL') {
      filter.subject = subject;
    }
    if (difficulty && difficulty !== 'ALL') {
      filter.difficulty = difficulty.toUpperCase();
    }
    if (search) {
      filter.question = { $regex: search, $options: 'i' };
    }

    const questions = await Question.find(filter).sort({ subject: 1, questionId: 1 });
    res.json({ success: true, count: questions.length, questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. POST /api/admin/questions - Add Question to Question Bank
router.post('/questions', async (req, res) => {
  try {
    const { subject, question, options, correct, explanation, topic, difficulty, marks, hint } = req.body;

    if (!subject || !question || !Array.isArray(options) || options.length < 2 || correct === undefined) {
      return res.status(400).json({ success: false, message: 'Subject, Question, at least 2 Options, and Correct Answer index are required.' });
    }

    // Determine highest existing questionId for subject
    const maxQ = await Question.findOne({ subject }).sort({ questionId: -1 });
    const questionId = maxQ ? maxQ.questionId + 1 : 1;

    const diffUpper = (difficulty || 'MEDIUM').toString().trim().toUpperCase();
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

    const newQ = await Question.create({
      subject,
      questionId,
      question,
      options,
      correct: parseInt(correct, 10),
      explanation: explanation || '',
      topic: topic || 'General',
      difficulty: normDiff,
      marks: normMarks,
      hint: hint || ''
    });

    await logActivity(`Question added to ${subject}`, `Question ID: ${questionId}`);

    res.status(201).json({ success: true, message: 'Question saved successfully.', question: newQ });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 10. PUT /api/admin/questions/:id - Edit Question
router.put('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.difficulty) {
      const diffUpper = String(updateData.difficulty).trim().toUpperCase();
      if (diffUpper === 'EASY') {
        updateData.difficulty = 'Easy';
        updateData.marks = 1;
      } else if (diffUpper === 'HARD') {
        updateData.difficulty = 'Hard';
        updateData.marks = 2;
      } else {
        updateData.difficulty = 'Medium';
        updateData.marks = 2;
      }
    }

    const updated = await Question.findByIdAndUpdate(id, updateData, { new: true });
    res.json({ success: true, message: 'Question updated successfully.', question: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. DELETE /api/admin/questions/:id - Delete Question
router.delete('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Question.findByIdAndDelete(id);
    res.json({ success: true, message: 'Question deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 12. POST /api/admin/questions/import - Excel MCQ File Import & Preview
router.post('/questions/import', async (req, res) => {
  try {
    const { fileData, confirm } = req.body;
    if (!fileData) {
      return res.status(400).json({ success: false, message: 'No Excel file data received.' });
    }

    // Convert Base64 string to Buffer and parse Excel
    const base64Clean = fileData.replace(/^data:.*;base64,/, '');
    const fileBuffer = Buffer.from(base64Clean, 'base64');
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (!rawRows || rawRows.length < 2) {
      return res.status(400).json({ success: false, message: 'Excel file appears to be empty or missing headers.' });
    }

    const headers = rawRows[0].map(h => String(h || '').trim().toLowerCase());
    
    // Find column indexes
    const qIdx = headers.findIndex(h => h.includes('question'));
    const optAIdx = headers.findIndex(h => h.includes('option a') || h === 'a');
    const optBIdx = headers.findIndex(h => h.includes('option b') || h === 'b');
    const optCIdx = headers.findIndex(h => h.includes('option c') || h === 'c');
    const optDIdx = headers.findIndex(h => h.includes('option d') || h === 'd');
    const ansIdx = headers.findIndex(h => h.includes('correct') || h.includes('answer'));
    const subjIdx = headers.findIndex(h => h.includes('subject'));
    const diffIdx = headers.findIndex(h => h.includes('difficulty'));
    const marksIdx = headers.findIndex(h => h.includes('mark'));
    const hintIdx = headers.findIndex(h => h.includes('hint'));

    const existingQuestions = await Question.find();
    const existingTexts = new Set(existingQuestions.map(q => q.question.trim().toLowerCase()));

    const validQuestions = [];
    const invalidQuestions = [];
    let duplicateCount = 0;
    const seenInBatch = new Set();

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const qText = qIdx !== -1 && row[qIdx] ? String(row[qIdx]).trim() : (row[0] ? String(row[0]).trim() : '');
      const optA = optAIdx !== -1 && row[optAIdx] ? String(row[optAIdx]).trim() : (row[1] ? String(row[1]).trim() : '');
      const optB = optBIdx !== -1 && row[optBIdx] ? String(row[optBIdx]).trim() : (row[2] ? String(row[2]).trim() : '');
      const optC = optCIdx !== -1 && row[optCIdx] ? String(row[optCIdx]).trim() : (row[3] ? String(row[3]).trim() : '');
      const optD = optDIdx !== -1 && row[optDIdx] ? String(row[optDIdx]).trim() : (row[4] ? String(row[4]).trim() : '');

      if (!qText || !optA || !optB) {
        invalidQuestions.push({ rowNumber: i + 1, reason: 'Missing question text or options' });
        continue;
      }

      const qLower = qText.toLowerCase();
      if (existingTexts.has(qLower) || seenInBatch.has(qLower)) {
        duplicateCount++;
        invalidQuestions.push({ rowNumber: i + 1, question: qText, reason: 'Duplicate question detected' });
        continue;
      }
      seenInBatch.add(qLower);

      // Determine correct answer index
      const rawAns = ansIdx !== -1 && row[ansIdx] ? String(row[ansIdx]).trim().toUpperCase() : (row[5] ? String(row[5]).trim().toUpperCase() : 'A');
      let correctIdx = 0;
      if (rawAns === 'A' || rawAns.startsWith('OPTION A') || rawAns === '0') correctIdx = 0;
      else if (rawAns === 'B' || rawAns.startsWith('OPTION B') || rawAns === '1') correctIdx = 1;
      else if (rawAns === 'C' || rawAns.startsWith('OPTION C') || rawAns === '2') correctIdx = 2;
      else if (rawAns === 'D' || rawAns.startsWith('OPTION D') || rawAns === '3') correctIdx = 3;

      const subject = subjIdx !== -1 && row[subjIdx] ? String(row[subjIdx]).trim() : 'General';
      const rawDiff = diffIdx !== -1 && row[diffIdx] ? String(row[diffIdx]).trim().toUpperCase() : 'MEDIUM';

      if (diffIdx !== -1 && row[diffIdx] && !['EASY', 'MEDIUM', 'HARD', 'EASY QUESTION', 'MEDIUM QUESTION', 'HARD QUESTION'].includes(rawDiff)) {
        invalidQuestions.push({ rowNumber: i + 1, question: qText, reason: `Invalid difficulty '${row[diffIdx]}'. Allowed values: Easy, Medium, Hard.` });
        continue;
      }

      let difficulty = 'Medium';
      let marks = 2;

      if (rawDiff.includes('EASY')) {
        difficulty = 'Easy';
        marks = 1;
      } else if (rawDiff.includes('HARD')) {
        difficulty = 'Hard';
        marks = 2;
      } else {
        difficulty = 'Medium';
        marks = 2;
      }

      const hint = hintIdx !== -1 && row[hintIdx] ? String(row[hintIdx]).trim() : '';

      validQuestions.push({
        subject,
        question: qText,
        options: [optA, optB, optC, optD].filter(Boolean),
        correct: correctIdx,
        difficulty,
        marks,
        hint,
        explanation: `${subject} concept.`
      });
    }

    // If confirmation flag is false, return preview summary
    if (!confirm) {
      return res.json({
        success: true,
        preview: true,
        summary: {
          totalFound: rawRows.length - 1,
          validCount: validQuestions.length,
          invalidCount: invalidQuestions.length,
          duplicateCount
        },
        validQuestions: validQuestions.slice(0, 5), // sample
        invalidQuestions
      });
    }

    // Insert valid questions into Mongoose DB
    let importedCount = 0;
    for (const q of validQuestions) {
      const maxQ = await Question.findOne({ subject: q.subject }).sort({ questionId: -1 });
      q.questionId = maxQ ? maxQ.questionId + 1 : 1;
      await Question.create(q);
      importedCount++;
    }

    await logActivity(`${importedCount} questions imported from Excel`, `Valid: ${validQuestions.length}, Duplicates: ${duplicateCount}`);

    res.json({
      success: true,
      message: `Successfully imported ${importedCount} MCQs into Question Bank.`,
      importedCount,
      duplicateCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 13. GET /api/admin/students - List Registered Students & Exam Participation
router.get('/students', async (req, res) => {
  try {
    const students = await Student.find({ role: 'STUDENT' }).sort({ regNo: 1 });
    const attempts = await StudentAttempt.find();
    const results = await ExamResult.find();

    // Map student statistics
    const studentList = [];

    // Ensure 66 section roll numbers (24HP1A0501 - 24HP1A0566) exist in response
    for (let i = 1; i <= 66; i++) {
      const regNo = `24HP1A05${String(i).padStart(2, '0')}`;
      const dbStudent = students.find(s => s.regNo === regNo);
      const studentAttempts = attempts.filter(a => a.regNo === regNo);
      const studentResults = results.filter(r => r.regNo === regNo);

      studentList.push({
        regNo,
        name: dbStudent ? dbStudent.name : `Student (${regNo})`,
        year: dbStudent ? dbStudent.year : 'III B.Tech',
        section: dbStudent ? dbStudent.section : 'A',
        totalAttempts: studentAttempts.length,
        completedExams: studentResults.length,
        latestStatus: studentAttempts.length > 0 ? studentAttempts[studentAttempts.length - 1].status : 'NOT_STARTED'
      });
    }

    res.json({ success: true, count: studentList.length, students: studentList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 14. GET /api/admin/results - Faculty Results Table
router.get('/results', async (req, res) => {
  try {
    const { subject, status, search } = req.query;
    const filter = {};

    if (subject && subject !== 'ALL') filter.subject = subject;
    if (status && status !== 'ALL') filter.status = status.toUpperCase();
    if (search) {
      filter.$or = [
        { regNo: { $regex: search, $options: 'i' } },
        { studentName: { $regex: search, $options: 'i' } }
      ];
    }

    const results = await ExamResult.find(filter).sort({ submittedAt: -1 });
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 15. GET /api/admin/security-events - Security Violations Breakdown & Logs
router.get('/security-events', async (req, res) => {
  try {
    const events = await SecurityEvent.find().sort({ createdAt: -1 });
    const results = await ExamResult.find({ totalViolationsCount: { $gt: 0 } });

    let tabSwitches = 0;
    let fullscreenExits = 0;
    let windowBlurs = 0;

    events.forEach(ev => {
      if (ev.eventType === 'TAB_SWITCH') tabSwitches += ev.violationCount || 1;
      else if (ev.eventType === 'FULLSCREEN_EXIT') fullscreenExits += ev.violationCount || 1;
      else if (ev.eventType === 'WINDOW_BLUR') windowBlurs += ev.violationCount || 1;
    });

    results.forEach(r => {
      tabSwitches += r.tabSwitchCount || 0;
      fullscreenExits += r.fullscreenExitCount || 0;
    });

    const totalViolations = tabSwitches + fullscreenExits + windowBlurs;

    res.json({
      success: true,
      summary: {
        tabSwitches,
        fullscreenExits,
        windowBlurs,
        totalViolations
      },
      events,
      violatedResults: results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 16. GET /api/admin/participation/:examId - Real-Time Exam Monitoring
router.get('/participation/:examId', async (req, res) => {
  try {
    const { examId } = req.params;
    const attempts = await StudentAttempt.find({ examId: examId.toUpperCase() });
    const results = await ExamResult.find();

    const studentStatusList = [];

    for (let i = 1; i <= 66; i++) {
      const regNo = `24HP1A05${String(i).padStart(2, '0')}`;
      const att = attempts.find(a => a.regNo === regNo);
      const resDoc = results.find(r => r.regNo === regNo);

      let status = 'NOT_STARTED';
      if (resDoc) status = 'SUBMITTED';
      else if (att) status = att.status;

      studentStatusList.push({
        regNo,
        studentName: att ? att.studentName : `Student (${regNo})`,
        status,
        cancelReason: att ? att.cancelReason : null,
        startedAt: att ? att.startedAt : null,
        submittedAt: resDoc ? resDoc.submittedAt : null
      });
    }

    res.json({ success: true, examId, total: studentStatusList.length, studentStatusList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 17. GET /api/admin/faculty/list - List all faculty accounts & assigned subjects
router.get('/faculty/list', async (req, res) => {
  try {
    const facultyList = await Student.find({ role: { $in: ['FACULTY', 'ADMIN'] } }).select('-password');
    res.json({ success: true, count: facultyList.length, facultyList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 18. PUT /api/admin/faculty/permissions - Admin updates assigned subjects for a faculty user
router.post('/faculty/permissions', async (req, res) => {
  try {
    const { facultyRegNo, assignedSubjects } = req.body;
    if (!facultyRegNo || !Array.isArray(assignedSubjects)) {
      return res.status(400).json({ success: false, message: 'facultyRegNo and assignedSubjects array are required.' });
    }

    const cleanReg = facultyRegNo.trim().toUpperCase();
    const updated = await Student.findOneAndUpdate(
      { regNo: cleanReg, role: { $in: ['FACULTY', 'ADMIN'] } },
      { assignedSubjects },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: `Faculty member '${cleanReg}' not found.` });
    }

    await logActivity(`Updated Faculty Subject Permissions`, `Faculty: ${cleanReg} | Subjects: ${assignedSubjects.join(', ')}`);

    res.json({
      success: true,
      message: `Assigned subjects for '${cleanReg}' updated successfully.`,
      faculty: {
        id: updated.regNo,
        name: updated.name,
        assignedSubjects: updated.assignedSubjects
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
