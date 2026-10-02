const express = require('express');
const router = express.Router();
const ExamSchedule = require('../models/ExamSchedule');
const StudentAttempt = require('../models/StudentAttempt');
const ExamResult = require('../models/ExamResult');

// Parse 'YYYY-MM-DD' and 'HH:MM AM/PM' or 'HH:MM' into Date object in Asia/Kolkata (+05:30)
function parseExamTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return new Date();
  
  const dateParts = String(dateStr).trim().split('-').map(Number);
  if (dateParts.length < 3) return new Date();
  const [year, month, day] = dateParts;

  let hours = 0;
  let minutes = 0;
  const str = String(timeStr).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const ampm = match[4] ? match[4].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  } else {
    const parts = str.split(':').map(Number);
    if (parts.length >= 2) {
      hours = parts[0] || 0;
      minutes = parts[1] || 0;
    }
  }

  const pad = (num) => String(num).padStart(2, '0');
  const isoStr = `${pad(year)}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+05:30`;
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

// GET /api/exams/schedules - Fetch exam schedules with server-authoritative student attempt statuses
router.get('/schedules', async (req, res) => {
  try {
    const regNo = req.query.regNo ? req.query.regNo.trim().toUpperCase() : '23A91A0501';
    const now = new Date();
    
    // Fetch all active exam schedules from DB with fallback
    let schedules = [];
    try {
      schedules = await ExamSchedule.find().sort({ examDate: 1, startTime: 1 });
    } catch (dbErr) {
      console.warn("MongoDB schedules query warning, returning default seed schedules:", dbErr.message);
    }

    if (!schedules || schedules.length === 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      schedules = [
        {
          examId: 'EXAM_CN_001',
          examName: 'Mid-Term Computer Networks Exam',
          subject: 'Computer Networks',
          examDate: todayStr,
          startTime: '06:00 AM',
          latestAllowedStartTime: '11:59 PM',
          endTime: '11:59 PM',
          durationMinutes: 30,
          totalQuestions: 20,
          easyCount: 5,
          mediumCount: 10,
          hardCount: 5,
          isActive: true
        },
        {
          examId: 'EXAM_QC_002',
          examName: 'Quantum Computing Fundamentals',
          subject: 'Quantum Computing',
          examDate: tomorrowStr,
          startTime: '06:00 AM',
          latestAllowedStartTime: '11:59 PM',
          endTime: '11:59 PM',
          durationMinutes: 30,
          totalQuestions: 20,
          easyCount: 5,
          mediumCount: 10,
          hardCount: 5,
          isActive: true
        }
      ];
    }

    const processedSchedules = await Promise.all(schedules.map(async (sch) => {
      const startDt = parseExamTimestamp(sch.examDate, sch.startTime);
      const latestStartDt = parseExamTimestamp(sch.examDate, sch.latestAllowedStartTime || sch.endTime);
      const endDt = parseExamTimestamp(sch.examDate, sch.endTime);

      // Check if student completed this exam in ExamResult
      let existingResult = null;
      let attempt = null;
      try {
        existingResult = await ExamResult.findOne({ regNo, subject: sch.subject });
        attempt = await StudentAttempt.findOne({ regNo, examId: sch.examId });
      } catch (err) {
        // Fallback silently if MongoDB is offline
      }

      let calculatedStatus = 'UPCOMING';
      let cancelReason = null;

      if (existingResult) {
        calculatedStatus = 'COMPLETED';
      } else if (attempt && attempt.status === 'CANCELLED') {
        if (now >= startDt && now <= latestStartDt && attempt.cancelReason === 'START_TIME_EXPIRED') {
          calculatedStatus = 'AVAILABLE';
        } else {
          calculatedStatus = 'CANCELLED';
          cancelReason = attempt.cancelReason || 'START_TIME_EXPIRED';
        }
      } else if (attempt && attempt.status === 'IN_PROGRESS') {
        // If current time exceeded end time, mark completed/expired
        if (now > endDt) {
          calculatedStatus = 'COMPLETED';
        } else {
          calculatedStatus = 'IN_PROGRESS';
        }
      } else {
        if (sch.isActive === false) {
          calculatedStatus = 'CANCELLED';
        } else if (now < startDt) {
          calculatedStatus = 'UPCOMING';
        } else if (now > latestStartDt || now > endDt) {
          calculatedStatus = 'EXPIRED';
        } else {
          calculatedStatus = 'AVAILABLE';
        }
      }

      return {
        examId: sch.examId,
        subject: sch.subject,
        examDate: sch.examDate,
        startTime: sch.startTime,
        latestAllowedStartTime: sch.latestAllowedStartTime,
        endTime: sch.endTime,
        durationMinutes: sch.durationMinutes,
        totalQuestions: sch.totalQuestions,
        studentStatus: calculatedStatus,
        cancelReason: cancelReason,
        cancelledAt: attempt ? attempt.cancelledAt : null,
        startTimestamp: startDt.toISOString(),
        latestStartTimestamp: latestStartDt.toISOString(),
        endTimestamp: endDt.toISOString(),
        serverTime: now.toISOString()
      };
    }));

    res.json({
      success: true,
      serverTime: now.toISOString(),
      schedules: processedSchedules
    });
  } catch (error) {
    console.error('Fetch exam schedules error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/exams/:examId/start - STRICT BACKEND VALIDATION FOR EXAM START
router.post('/:examId/start', async (req, res) => {
  try {
    const { examId } = req.params;
    const { regNo, studentName } = req.body;

    if (!regNo) {
      return res.status(400).json({ success: false, message: 'Student Registration ID (regNo) is required.' });
    }

    const cleanReg = regNo.trim().toUpperCase();
    const now = new Date();

    // 0. Verify Student Master Database & Account Status
    const Student = require('../models/Student');
    let student = await Student.findOne({ regNo: cleanReg });
    if (!student) {
      // Auto-register student if present in master data or create placeholder
      student = await Student.create({
        regNo: cleanReg,
        name: studentName || 'Student',
        role: 'STUDENT',
        year: '3',
        section: 'A',
        isActive: true
      }).catch(() => null);
    }
    if (student && student.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account is currently inactive. Please contact the faculty.'
      });
    }

    // 1. Find exam schedule
    const schedule = await ExamSchedule.findOne({ examId: examId.toUpperCase() });
    if (!schedule) {
      return res.status(404).json({ success: false, message: `Exam schedule '${examId}' not found.` });
    }


    const startDt = parseExamTimestamp(schedule.examDate, schedule.startTime);
    const latestStartDt = parseExamTimestamp(schedule.examDate, schedule.latestAllowedStartTime || schedule.endTime);
    const endDt = parseExamTimestamp(schedule.examDate, schedule.endTime);

    // 2. Check if student already completed exam
    const existingResult = await ExamResult.findOne({ regNo: cleanReg, subject: schedule.subject });
    if (existingResult) {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_COMPLETED',
        message: 'You have already submitted and completed this examination.'
      });
    }

    // 3. Check student attempt record
    let attempt = await StudentAttempt.findOne({ regNo: cleanReg, examId: schedule.examId });

    if (attempt && attempt.status === 'CANCELLED') {
      if (now >= startDt && now <= latestStartDt && attempt.cancelReason === 'START_TIME_EXPIRED') {
        attempt.status = 'IN_PROGRESS';
        attempt.cancelReason = null;
        attempt.startedAt = now;
        await attempt.save();
      } else {
        return res.status(403).json({
          success: false,
          code: 'CANCELLED_EXPIRED',
          message: 'Your examination start window has expired. Your exam has been cancelled.',
          attempt
        });
      }
    }

    // 4. Validate Server Current Time vs Start Time Window
    if (now < startDt) {
      return res.status(400).json({
        success: false,
        code: 'NOT_STARTED_YET',
        message: `⛔ ACCESS DENIED: Examination '${schedule.examName || schedule.subject}' is scheduled to start at ${schedule.startTime} on ${schedule.examDate}. You cannot start early. Please wait until ${schedule.startTime} to begin.`
      });
    }

    if (now > latestStartDt) {
      // Mark student attempt as CANCELLED with START_TIME_EXPIRED
      if (!attempt) {
        attempt = await StudentAttempt.create({
          regNo: cleanReg,
          studentName: studentName || 'Student',
          examId: schedule.examId,
          subject: schedule.subject,
          examDate: schedule.examDate,
          scheduledStartTime: schedule.startTime,
          latestAllowedStartTime: schedule.latestAllowedStartTime,
          status: 'CANCELLED',
          cancelReason: 'START_TIME_EXPIRED',
          cancelledAt: now
        });
      } else {
        attempt.status = 'CANCELLED';
        attempt.cancelReason = 'START_TIME_EXPIRED';
        attempt.cancelledAt = now;
        await attempt.save();
      }

      console.warn(`⛔ Late start rejected for ${cleanReg} on ${schedule.examId} at ${now.toISOString()}`);

      return res.status(403).json({
        success: false,
        code: 'START_TIME_EXPIRED',
        message: 'Your examination start window has expired. Your exam has been cancelled.',
        attempt: {
          studentId: cleanReg,
          examId: schedule.examId,
          subject: schedule.subject,
          examDate: schedule.examDate,
          scheduledStartTime: schedule.startTime,
          latestAllowedStartTime: schedule.latestAllowedStartTime,
          status: 'CANCELLED',
          cancelReason: 'START_TIME_EXPIRED',
          cancelledAt: now.toISOString()
        }
      });
    }

    if (now >= endDt) {
      return res.status(400).json({
        success: false,
        code: 'EXAM_ENDED',
        message: 'The examination period has ended.'
      });
    }

    // 5. All validation checks passed! Mark attempt IN_PROGRESS
    if (!attempt) {
      attempt = await StudentAttempt.create({
        regNo: cleanReg,
        studentName: studentName || 'Student',
        examId: schedule.examId,
        subject: schedule.subject,
        examDate: schedule.examDate,
        scheduledStartTime: schedule.startTime,
        latestAllowedStartTime: schedule.latestAllowedStartTime,
        status: 'IN_PROGRESS',
        startedAt: now
      });
    } else {
      attempt.status = 'IN_PROGRESS';
      if (!attempt.startedAt) attempt.startedAt = now;
      await attempt.save();
    }

    // Calculate remaining exam duration
    const remainingSeconds = Math.max(1, Math.floor((endDt.getTime() - now.getTime()) / 1000));
    const sessionDurationSeconds = Math.min(schedule.durationMinutes * 60, remainingSeconds);

    console.log(`✅ Allowed exam start for ${cleanReg} on ${schedule.examId} (${schedule.subject})`);

    res.json({
      success: true,
      message: 'Exam start authorized by backend.',
      examSession: {
        studentId: cleanReg,
        examId: schedule.examId,
        subject: schedule.subject,
        durationMinutes: schedule.durationMinutes,
        sessionDurationSeconds,
        startedAt: attempt.startedAt,
        endTimestamp: endDt.toISOString()
      }
    });
  } catch (error) {
    console.error('Start exam backend validation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/exams/schedule/create - Admin Endpoint to schedule new exam
router.post('/schedule/create', async (req, res) => {
  try {
    const { examId, subject, examDate, startTime, latestAllowedStartTime, endTime, durationMinutes, totalQuestions } = req.body;

    if (!examId || !subject || !examDate || !startTime || !latestAllowedStartTime || !endTime) {
      return res.status(400).json({ success: false, message: 'All schedule fields (examId, subject, examDate, startTime, latestAllowedStartTime, endTime) are required.' });
    }

    const schedule = await ExamSchedule.findOneAndUpdate(
      { examId: examId.toUpperCase() },
      {
        examId: examId.toUpperCase(),
        subject,
        examDate,
        startTime,
        latestAllowedStartTime,
        endTime,
        durationMinutes: durationMinutes || 30,
        totalQuestions: totalQuestions || 20
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: `Exam schedule '${schedule.examId}' created/updated successfully.`,
      schedule
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
