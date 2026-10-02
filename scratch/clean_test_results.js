const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('../config/db');
const ExamResult = require('../models/ExamResult');
const Student = require('../models/Student');
const { rebuildExamExcelFromDB, EXCEL_RESULTS_BASE_DIR, MASTER_EXCEL_FILE_PATH } = require('../utils/excelHelper');

async function cleanTestResults() {
  await connectDB();

  console.log("==================================================");
  console.log("🧹 CLEANING SYNTHETIC / TEST EXAM RESULTS");
  console.log("==================================================");

  // Load master student reg numbers
  let validRegs = new Set();
  const masterPath = path.join(__dirname, '../data/students_master.json');
  if (fs.existsSync(masterPath)) {
    const masterList = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    masterList.forEach(s => {
      const reg = String(s.regNo || s.hallticket).trim().toUpperCase();
      validRegs.add(reg);
    });
  }

  // Also include faculty accounts and known student test IDs if any
  validRegs.add('FACULTY01');
  validRegs.add('FACULTY_CN');
  validRegs.add('FACULTY_DW');
  validRegs.add('23A91A0501');
  validRegs.add('23A91A05290');
  validRegs.add('24HPA10566');
  validRegs.add('24HPA10537');
  validRegs.add('24HPA10654');
  validRegs.add('24HP1A0501');

  const allResults = await ExamResult.find({});
  console.log(`Total ExamResult documents before cleanup: ${allResults.length}`);

  const syntheticPatterns = [
    /Simulated/i,
    /Test Student/i,
    /Verification Student/i,
    /TEST_RUNNER/i,
    /^SIM/i,
    /Test Exam/i
  ];

  const idsToDelete = [];
  const realResultsToKeep = [];

  allResults.forEach(r => {
    const regUpper = String(r.regNo || '').trim().toUpperCase();
    const nameStr = String(r.studentName || '');
    const subjectStr = String(r.subject || '');
    const examIdStr = String(r.examId || '');

    const isPatternMatch = syntheticPatterns.some(p => p.test(nameStr) || p.test(regUpper) || p.test(subjectStr) || p.test(examIdStr));
    const isUnknownReg = regUpper.startsWith('SIM') || regUpper.startsWith('TEST') || !validRegs.has(regUpper);

    if (isPatternMatch || isUnknownReg) {
      idsToDelete.push(r._id);
    } else {
      realResultsToKeep.push(r);
    }
  });

  console.log(`\nFound ${idsToDelete.length} synthetic test result records to delete.`);
  console.log(`Found ${realResultsToKeep.length} real student exam result records to KEEP.`);

  if (idsToDelete.length > 0) {
    const delRes = await ExamResult.deleteMany({ _id: { $in: idsToDelete } });
    console.log(`✅ Successfully deleted ${delRes.deletedCount} synthetic result documents from MongoDB.`);
  }

  // Clean test directories in data/results if any test subject folders exist
  const testDir = path.join(EXCEL_RESULTS_BASE_DIR, '2026-2027', 'Computer-Networks-Test');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log(`📁 Removed test folder: ${testDir}`);
  }

  console.log("\n==================================================");
  console.log("📊 REBUILDING ALL EXCEL RESULT FILES FROM MONGODB");
  console.log("==================================================");

  // Rebuild Excel workbooks for real subjects
  const subjects = ['Computer Networks', 'Quantum Computing', 'Finite Automata', 'Data Warehouse and Data Mining', 'Fundamentals of Computing'];
  for (const subj of subjects) {
    await rebuildExamExcelFromDB(subj);
  }

  const remainingMongoCount = await ExamResult.countDocuments();
  console.log(`\n==================================================`);
  console.log(`🎉 CLEANUP COMPLETE! Remaining Genuine Results in DB: ${remainingMongoCount}`);
  console.log(`==================================================`);

  process.exit(0);
}

cleanTestResults();
