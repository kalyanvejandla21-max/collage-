const express = require('express');
const router = express.Router();
const ExamSchedule = require('../models/ExamSchedule');
const StudentAttempt = require('../models/StudentAttempt');
const ExamResult = require('../models/ExamResult');

// Parse 'YYYY-MM-DD' and 'HH:MM AM/PM' into Date object
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

// GET /api/exams/schedules - Fetch exam schedules with server-authoritative student attempt statuses
router.get('/schedules', async (req, res) => {
  try {
    const regNo = req.query.regNo ? req.query.regNo.trim().toUpperCase() : '23A91A0501';
    const now = new Date();
    
    // Fetch all active exam schedules from DB
    let schedules = await ExamSchedule.find().sort({ examDate: 1, startTime: 1 });

    const processedSchedules = await Promise.all(schedules.map(async (sch) => {
      const startDt = parseExamTimestamp(sch.examDate, sch.startTime);
      const latestStartDt = parseExamTimestamp(sch.examDate, sch.latestAllowedStartTime);
      const endDt = parseExamTimestamp(sch.examDate, sch.endTime);

      // Check if student completed this exam in ExamResult
      const existingResult = await ExamResult.findOne({ regNo, subject: sch.subject });

      // Check existing StudentAttempt record
      let attempt = await StudentAttempt.findOne({ regNo, examId: sch.examId });

      let calculatedStatus = 'UPCOMING';
      let cancelReason = null;

      if (existingResult) {
        calculatedStatus = 'COMPLETED';
      } else if (attempt && attempt.status === 'CANCELLED') {
        calculatedStatus = 'CANCELLED';
        cancelReason = attempt.cancelReason || 'START_TIME_EXPIRED';
      } else if (attempt && attempt.status === 'IN_PROGRESS') {
        // If current time exceeded end time, mark completed/expired
        if (now > endDt) {
          calculatedStatus = 'COMPLETED';
        } else {
          calculatedStatus = 'IN_PROGRESS';
        }
      } else {
        // Evaluate based on server time window
        if (now < startDt) {
          calculatedStatus = 'UPCOMING';
        } else if (now >= startDt && now <= latestStartDt) {
          calculatedStatus = 'AVAILABLE';
        } else if (now > latestStartDt) {
          // LATE STUDENT POLICY: Automatically mark attempt as CANCELLED with START_TIME_EXPIRED
          calculatedStatus = 'CANCELLED';
          cancelReason = 'START_TIME_EXPIRED';

          if (!attempt) {
            attempt = await StudentAttempt.create({
              regNo,
              studentName: 'Student',
              examId: sch.examId,
              subject: sch.subject,
              examDate: sch.examDate,
              scheduledStartTime: sch.startTime,
              latestAllowedStartTime: sch.latestAllowedStartTime,
              status: 'CANCELLED',
              cancelReason: 'START_TIME_EXPIRED',
              cancelledAt: now
            });
          } else if (attempt.status !== 'CANCELLED') {
            attempt.status = 'CANCELLED';
            attempt.cancelReason = 'START_TIME_EXPIRED';
            attempt.cancelledAt = now;
            await attempt.save();
          }
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
    const student = await Student.findOne({ regNo: cleanReg });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found. Please check your Hall Ticket Number.'
      });
    }
    if (student.isActive === false) {
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
    const latestStartDt = parseExamTimestamp(schedule.examDate, schedule.latestAllowedStartTime);
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
      return res.status(403).json({
        success: false,
        code: 'CANCELLED_EXPIRED',
        message: 'Your examination start window has expired. Your exam has been cancelled.',
        attempt
      });
    }

    // 4. Validate Server Current Time vs Start Time Window
    if (now < startDt) {
      return res.status(400).json({
        success: false,
        code: 'NOT_STARTED_YET',
        message: `Exam starts at ${schedule.startTime}. Please wait until the scheduled start time.`
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
