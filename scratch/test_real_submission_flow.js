const http = require('http');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');

const connectDB = require('../config/db');
const ExamResult = require('../models/ExamResult');
const { MASTER_EXCEL_FILE_PATH } = require('../utils/excelHelper');

function postJSON(pathStr, bodyObj) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(bodyObj);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: pathStr,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', err => reject(err));
    req.write(data);
    req.end();
  });
}

async function testSubmissionFlow() {
  await connectDB();

  console.log("==================================================");
  console.log("🧪 TESTING REAL NEW EXAM SUBMISSION & EXCEL APPEND FLOW");
  console.log("==================================================");

  const initialMongoCount = await ExamResult.countDocuments();
  console.log(`Initial MongoDB ExamResult count: ${initialMongoCount}`);

  const wb0 = XLSX.readFile(MASTER_EXCEL_FILE_PATH);
  const initialExcelRows = XLSX.utils.sheet_to_json(wb0.Sheets[wb0.SheetNames[0]], { header: 1 }).length;
  console.log(`Initial Master Excel row count: ${initialExcelRows}`);

  // Test Real Student Submission for 24HP1A0544 (MANDALAPU CHARAN SRIVATSAVA)
  const submissionPayload = {
    regNo: '24HP1A0544',
    studentName: 'MANDALAPU CHARAN SRIVATSAVA',
    subject: 'Computer Networks',
    examName: 'Mid-Term Computer Networks Exam',
    examId: 'EXAM_CN_001',
    totalQuestions: 20,
    correctCount: 15,
    wrongCount: 5,
    attemptedCount: 20,
    unansweredCount: 0,
    marksObtained: '15 / 20',
    percentage: 75,
    status: 'PASS',
    fullscreenExitCount: 0,
    tabSwitchCount: 0,
    totalSecurityViolations: 0,
    durationMinutes: 30,
    timeTaken: '15 Mins',
    userAnswers: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]
  };

  console.log("\n1. Submitting real new exam attempt for 24HP1A0544 (CHARAN SRIVATSAVA)...");
  const res1 = await postJSON('/api/results/submit', submissionPayload);
  console.log(`Response Status: ${res1.statusCode}`, res1.data.message);

  const countAfter1 = await ExamResult.countDocuments();
  console.log(`MongoDB count after new submission: ${countAfter1}`);

  // Inspect Master Excel file on disk
  const wb1 = XLSX.readFile(MASTER_EXCEL_FILE_PATH);
  const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 });
  console.log(`Master Excel total rows after new submission: ${rows1.length}`);

  const isOneRowAdded = (countAfter1 === initialMongoCount + 1) && (rows1.length === initialExcelRows + 1);
  const lastRow = rows1[rows1.length - 1];
  console.log("\nNew Row Appended to Excel:");
  console.log(`[${lastRow[1]}] ${lastRow[0]} - ${lastRow[2]} (${lastRow[6]} - ${lastRow[8]})`);

  console.log("\n==================================================");
  console.log("NEW SUBMISSION FLOW TEST SUMMARY:");
  console.log("1. Real new exam submission success:", res1.statusCode === 200 ? "PASS" : "FAIL");
  console.log("2. Exactly ONE new row added to MongoDB & Excel:", isOneRowAdded ? "PASS" : "FAIL");
  console.log("==================================================");

  process.exit(0);
}

testSubmissionFlow();
