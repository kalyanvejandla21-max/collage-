const mongoose = require('mongoose');
require('dotenv').config();

const ExamSchedule = require('../models/ExamSchedule');
const StudentAttempt = require('../models/StudentAttempt');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aiet_exam_db');
  const schedules = await ExamSchedule.find();
  console.log("=== EXAM SCHEDULES ===");
  schedules.forEach(s => {
    console.log(`ID: ${s.examId}, Subject: ${s.subject}, Date: ${s.examDate}, Start: ${s.startTime}, Latest: ${s.latestAllowedStartTime}, End: ${s.endTime}, Active: ${s.isActive}`);
  });

  const attempts = await StudentAttempt.find();
  console.log(`=== TOTAL STUDENT ATTEMPTS: ${attempts.length} ===`);
  attempts.forEach(a => {
    console.log(`RegNo: ${a.regNo}, Exam: ${a.examId}, Status: ${a.status}, Reason: ${a.cancelReason}`);
  });

  await mongoose.disconnect();
}

check().catch(console.error);
