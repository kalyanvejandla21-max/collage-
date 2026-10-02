const mongoose = require('mongoose');
const connectDB = require('../config/db');
const ExamResult = require('../models/ExamResult');

async function inspectResults() {
  await connectDB();

  const totalResults = await ExamResult.countDocuments();
  console.log(`\n==================================================`);
  console.log(`📊 TOTAL EXAM_RESULTS IN MONGODB: ${totalResults}`);
  console.log(`==================================================`);

  const results = await ExamResult.find().sort({ submittedAt: -1 });

  let simulatedCount = 0;
  let realCount = 0;

  const simulatedPatterns = [
    /Simulated/i,
    /Test Student/i,
    /Verification Student/i,
    /TEST_RUNNER/i,
    /^SIM/i
  ];

  results.forEach((r, idx) => {
    const isSimulated = simulatedPatterns.some(p => p.test(r.studentName) || p.test(r.regNo));
    if (isSimulated) {
      simulatedCount++;
    } else {
      realCount++;
      if (realCount <= 20) {
        console.log(`Real Result #${realCount}: [${r.regNo}] ${r.studentName} - ${r.subject} (${r.marksObtained}) - ${new Date(r.submittedAt).toLocaleString()}`);
      }
    }
  });

  console.log(`\n--------------------------------------------------`);
  console.log(`🤖 Synthetic / Test Results Count: ${simulatedCount}`);
  console.log(`👤 Real Student Exam Results Count: ${realCount}`);
  console.log(`--------------------------------------------------`);

  process.exit(0);
}

inspectResults();
