const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Private Server-side Excel storage location (Outside public static web root)
const EXCEL_RESULTS_BASE_DIR = path.join(__dirname, '../data/results');
const MASTER_EXCEL_FILE_PATH = path.join(EXCEL_RESULTS_BASE_DIR, 'Master-Exam-Results.xlsx');

/**
 * Ensures the target directory exists
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created secure Excel directory: ${dirPath}`);
  }
}

/**
 * Converts a raw result database object into a standardized horizontal record for Sheet 1 (Results)
 * ONE STUDENT'S COMPLETE RESULT OCCUPIES ONE ROW.
 */
function formatResultRecord(resDoc) {
  const totalQ = resDoc.totalQuestions || 20;
  const correct = resDoc.correctCount !== undefined ? resDoc.correctCount : 0;
  const wrong = resDoc.wrongCount !== undefined ? resDoc.wrongCount : 0;
  const attempted = resDoc.attemptedCount !== undefined ? resDoc.attemptedCount : (correct + wrong);
  const unanswered = resDoc.unansweredCount !== undefined ? resDoc.unansweredCount : Math.max(0, totalQ - attempted);
  const marksObtained = resDoc.marksObtained || `${correct} / ${totalQ}`;
  const pct = resDoc.percentage !== undefined ? resDoc.percentage : (totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0);
  const status = resDoc.status || (pct >= 40 ? 'PASS' : 'FAIL');
  const submittedTime = resDoc.submittedAt ? new Date(resDoc.submittedAt).toLocaleString() : new Date().toLocaleString();
  const regNo = resDoc.regNo ? resDoc.regNo.toUpperCase() : 'N/A';

  const easyQ = resDoc.easyCount !== undefined ? resDoc.easyCount : 0;
  const mediumQ = resDoc.mediumCount !== undefined ? resDoc.mediumCount : 0;
  const hardQ = resDoc.hardCount !== undefined ? resDoc.hardCount : 0;
  const hintsUsed = resDoc.hintsUsed !== undefined ? resDoc.hintsUsed : 0;
  const maxMarks = resDoc.maximumMarks !== undefined ? resDoc.maximumMarks : (resDoc.totalMarks || totalQ);

  const fullscreenExits = resDoc.fullscreenExitCount !== undefined ? resDoc.fullscreenExitCount : 0;
  const tabSwitches = resDoc.tabSwitchCount !== undefined ? resDoc.tabSwitchCount : 0;
  const totalViolations = resDoc.totalSecurityViolations !== undefined ? resDoc.totalSecurityViolations : (fullscreenExits + tabSwitches);

  return {
    // Primary User-Requested Parameter Columns
    'Student Name': resDoc.studentName || 'Student',
    'Registration Number': regNo,
    'Subject Paper': resDoc.subject || 'General Engineering',
    'Total Questions': totalQ,
    'Correct Answers': correct,
    'Wrong Answers': wrong,
    'Marks Obtained': marksObtained,
    'Percentage': `${pct}%`,
    'Evaluation Status': status,
    'Fullscreen Exits': fullscreenExits,
    'Tab Switches / Focus Loss': tabSwitches,
    'Total Security Violations': totalViolations,
    'Timestamp': submittedTime,

    // Additional Backend System Data Fields (Preserved as extra columns)
    'Student ID': resDoc._id ? String(resDoc._id) : regNo,
    'Year': resDoc.year || 'III B.Tech',
    'Section': resDoc.section || 'A',
    'Exam Name': resDoc.examName || `${resDoc.subject || 'Subject'} Mid Examination`,
    'Exam ID': resDoc.examId || 'EXAM_GEN_001',
    'Exam Date': resDoc.examDate || new Date().toISOString().split('T')[0],
    'Start Time': resDoc.startTime || '10:00 AM',
    'Duration': `${resDoc.durationMinutes || 30} Mins`,
    'Time Taken': resDoc.timeTaken || '20 Mins',
    'Easy Qs': easyQ,
    'Medium Qs': mediumQ,
    'Hard Qs': hardQ,
    'Hints Used': hintsUsed,
    'Attempted': attempted,
    'Unanswered': unanswered,
    'Total Marks': maxMarks,
    'Auto Submitted': resDoc.autoSubmitted ? 'Yes' : 'No',
    'Submission Type': resDoc.submissionType || 'MANUAL',
    'Sync Status': resDoc.excelSynced !== false ? 'Synced' : 'Failed'
  };
}

/**
 * Computes Sheet 2 ("Exam Summary") statistics array from result records
 */
function computeExamSummaryRows(resultDocs, subjectName = '', examTitle = '') {
  const totalSubmissions = resultDocs.length;
  if (totalSubmissions === 0) {
    return [
      { 'Metric / Parameter': 'Exam Subject', 'Value': subjectName || 'N/A' },
      { 'Metric / Parameter': 'Exam Name', 'Value': examTitle || 'N/A' },
      { 'Metric / Parameter': 'Total Submissions', 'Value': 0 }
    ];
  }

  const passCount = resultDocs.filter(r => (r['Evaluation Status'] || r['Result'] || r.status) === 'PASS').length;
  const failCount = resultDocs.filter(r => (r['Evaluation Status'] || r['Result'] || r.status) === 'FAIL').length;
  const passPct = Math.round((passCount / totalSubmissions) * 100);

  const pcts = resultDocs.map(r => parseInt(r['Percentage'] || r.percentage) || 0);
  const marksNums = resultDocs.map(r => r.marksObtainedNum !== undefined ? r.marksObtainedNum : (parseInt(r['Marks Obtained'] || r['Correct Answers'] || r.correctCount) || 0));

  const avgPct = Math.round(pcts.reduce((a, b) => a + b, 0) / totalSubmissions);
  const highestMarks = Math.max(...marksNums);
  const lowestMarks = Math.min(...marksNums);

  const totalTabSwitches = resultDocs.reduce((acc, r) => acc + (parseInt(r['Tab Switches / Focus Loss'] || r['Tab Switches'] || r.tabSwitchCount) || 0), 0);
  const totalFullscreenExits = resultDocs.reduce((acc, r) => acc + (parseInt(r['Fullscreen Exits'] || r.fullscreenExitCount) || 0), 0);
  const autoSubmittedCount = resultDocs.filter(r => (r['Auto Submitted'] === 'Yes' || r.autoSubmitted)).length;

  const sampleDoc = resultDocs[0] || {};

  return [
    { 'Metric / Parameter': 'Subject', 'Value': sampleDoc['Subject Paper'] || sampleDoc.subject || subjectName },
    { 'Metric / Parameter': 'Exam Name', 'Value': sampleDoc['Exam Name'] || sampleDoc.examName || examTitle },
    { 'Metric / Parameter': 'Exam ID', 'Value': sampleDoc['Exam ID'] || sampleDoc.examId || 'EXAM_GEN_001' },
    { 'Metric / Parameter': 'Exam Date', 'Value': sampleDoc['Exam Date'] || sampleDoc.examDate || new Date().toISOString().split('T')[0] },
    { 'Metric / Parameter': 'Total Submissions', 'Value': totalSubmissions },
    { 'Metric / Parameter': 'Passed Students Count', 'Value': passCount },
    { 'Metric / Parameter': 'Failed Students Count', 'Value': failCount },
    { 'Metric / Parameter': 'Pass Percentage', 'Value': `${passPct}%` },
    { 'Metric / Parameter': 'Average Percentage', 'Value': `${avgPct}%` },
    { 'Metric / Parameter': 'Highest Marks Obtained', 'Value': highestMarks },
    { 'Metric / Parameter': 'Lowest Marks Obtained', 'Value': lowestMarks },
    { 'Metric / Parameter': 'Total Tab Switches Logged', 'Value': totalTabSwitches },
    { 'Metric / Parameter': 'Total Fullscreen Exits Logged', 'Value': totalFullscreenExits },
    { 'Metric / Parameter': 'Auto-Submitted Exams Count', 'Value': autoSubmittedCount },
    { 'Metric / Parameter': 'Summary Generated At', 'Value': new Date().toLocaleString() }
  ];
}

/**
 * Creates a multi-sheet Excel workbook:
 * Sheet 1: Results (1 Row per Student)
 * Sheet 2: Exam Summary
 */
function createFormattedWorkbook(records, sheetTitle = 'Results', summaryRows = null) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(records);

  // Column width specifications for horizontal tabular fields
  worksheet['!cols'] = [
    { wch: 22 }, // Student Name
    { wch: 22 }, // Registration Number
    { wch: 26 }, // Subject Paper
    { wch: 16 }, // Total Questions
    { wch: 16 }, // Correct Answers
    { wch: 16 }, // Wrong Answers
    { wch: 16 }, // Marks Obtained
    { wch: 14 }, // Percentage
    { wch: 18 }, // Evaluation Status
    { wch: 18 }, // Fullscreen Exits
    { wch: 26 }, // Tab Switches / Focus Loss
    { wch: 24 }, // Total Security Violations
    { wch: 24 }, // Timestamp
    { wch: 26 }, // Student ID
    { wch: 14 }, // Year
    { wch: 10 }, // Section
    { wch: 30 }, // Exam Name
    { wch: 16 }, // Exam ID
    { wch: 14 }, // Exam Date
    { wch: 14 }, // Start Time
    { wch: 14 }, // Duration
    { wch: 14 }, // Time Taken
    { wch: 10 }, // Easy Qs
    { wch: 12 }, // Medium Qs
    { wch: 10 }, // Hard Qs
    { wch: 12 }, // Hints Used
    { wch: 12 }, // Attempted
    { wch: 14 }, // Unanswered
    { wch: 14 }, // Total Marks
    { wch: 16 }, // Auto Submitted
    { wch: 18 }, // Submission Type
    { wch: 14 }  // Sync Status
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);

  // Sheet 2: Exam Summary
  if (summaryRows && Array.isArray(summaryRows)) {
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    summarySheet['!cols'] = [{ wch: 35 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Exam Summary');
  }

  return workbook;
}

/**
 * Safely writes a workbook to a file path
 */
function safeWriteExcelFile(workbook, filePath) {
  try {
    ensureDirectory(path.dirname(filePath));
    XLSX.writeFile(workbook, filePath);
    return true;
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.warn(`⚠️ Excel file ${path.basename(filePath)} is currently open/locked in another process.`);
    } else {
      console.error(`❌ Error writing Excel file ${filePath}:`, err.message);
    }
    return false;
  }
}

/**
 * Gets path for subject & exam-specific Excel file inside organized folder structure:
 * data/results/{AcademicYear}/{Subject-Slug}/{Exam-Slug}-Results.xlsx
 */
function getSubjectExcelPath(subjectName, examName = '', academicYear = '2026-2027') {
  const safeSubjectSlug = String(subjectName || 'General')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-');

  const safeExamSlug = examName
    ? String(examName).replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')
    : `${safeSubjectSlug}-Results`;

  const folderPath = path.join(EXCEL_RESULTS_BASE_DIR, academicYear, safeSubjectSlug);
  return path.join(folderPath, `${safeExamSlug}.xlsx`);
}

/**
 * Appends or updates a student result in the consolidated per-exam Excel file & Master file
 * Enforces DUPLICATE PREVENTION: Updates existing row if student regNo & subject/examId match.
 */
function appendExamResultToExcel(resultDoc) {
  try {
    ensureDirectory(EXCEL_RESULTS_BASE_DIR);

    const formattedRecord = formatResultRecord(resultDoc);
    const subjectFilePath = getSubjectExcelPath(resultDoc.subject, resultDoc.examName || resultDoc.examId);
    const targetFilePaths = [subjectFilePath, MASTER_EXCEL_FILE_PATH];

    let overallSuccess = true;

    targetFilePaths.forEach((filePath) => {
      let existingRecords = [];

      if (fs.existsSync(filePath)) {
        try {
          const workbook = XLSX.readFile(filePath);
          const sheetName = workbook.SheetNames[0] || 'Results';
          const worksheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet);

          // If old vertical Parameter/Value format was present, reset existingRecords to migrate cleanly
          if (rawRows.length > 0 && ('Parameter' in rawRows[0] || 'Metric / Parameter' in rawRows[0])) {
            console.log(`ℹ️ Converting old vertical Excel format to horizontal format for: ${path.basename(filePath)}`);
            existingRecords = [];
          } else {
            existingRecords = rawRows;
          }
        } catch (e) {
          existingRecords = [];
        }
      }

      // DUPLICATE PREVENTION: Check if record already exists for student & examId/subject
      const regToMatch = String(formattedRecord['Registration Number']).toUpperCase();
      const existingIdx = existingRecords.findIndex(r => {
        const rReg = String(r['Registration Number'] || r['Registration ID'] || r['RegNo'] || '').toUpperCase();
        const rExamId = String(r['Exam ID'] || '').toUpperCase();
        const rSubject = String(r['Subject Paper'] || r['Subject'] || '').toLowerCase();

        return rReg === regToMatch && (
          (resultDoc.examId && rExamId === String(resultDoc.examId).toUpperCase()) ||
          rSubject === String(formattedRecord['Subject Paper']).toLowerCase()
        );
      });

      if (existingIdx !== -1) {
        // Update existing record row in-place
        existingRecords[existingIdx] = {
          ...existingRecords[existingIdx],
          ...formattedRecord
        };
      } else {
        // Append new student result row
        existingRecords.push(formattedRecord);
      }

      const summaryRows = computeExamSummaryRows(existingRecords, resultDoc.subject, resultDoc.examName);

      const updatedWb = createFormattedWorkbook(existingRecords, 'Results', summaryRows);
      const written = safeWriteExcelFile(updatedWb, filePath);
      if (!written) {
        overallSuccess = false;
      } else {
        console.log(`📊 Stored horizontal result in Excel: ${path.basename(filePath)} [Total Student Rows: ${existingRecords.length}]`);
      }
    });

    return overallSuccess;
  } catch (error) {
    console.error('❌ Error saving result to Excel workbook:', error.message);
    return false;
  }
}

/**
 * Rebuilds complete consolidated Excel workbook for an exam/subject directly from MongoDB
 */
async function rebuildExamExcelFromDB(subject, examName = '') {
  try {
    const ExamResult = require('../models/ExamResult');
    const filter = {};
    if (subject && subject !== 'ALL') filter.subject = subject;
    if (examName) filter.examName = examName;

    const resultDocs = await ExamResult.find(filter).sort({ submittedAt: 1 });
    if (!resultDocs || resultDocs.length === 0) {
      console.warn(`No results found in MongoDB to rebuild Excel for subject '${subject}'`);
      return false;
    }

    const formattedRecords = resultDocs.map(formatResultRecord);
    const summaryRows = computeExamSummaryRows(resultDocs, subject, examName);

    const filePath = getSubjectExcelPath(subject, examName);
    const workbook = createFormattedWorkbook(formattedRecords, 'Results', summaryRows);
    const written = safeWriteExcelFile(workbook, filePath);

    // Also update Master file
    const allResults = await ExamResult.find().sort({ submittedAt: 1 });
    const masterFormatted = allResults.map(formatResultRecord);
    const masterSummary = computeExamSummaryRows(allResults, 'All Subjects', 'Master Results');
    const masterWb = createFormattedWorkbook(masterFormatted, 'Results', masterSummary);
    safeWriteExcelFile(masterWb, MASTER_EXCEL_FILE_PATH);

    return written;
  } catch (err) {
    console.error('❌ Error rebuilding Excel workbook from MongoDB:', err.message);
    return false;
  }
}

/**
 * Dynamic generation of Excel Buffer for filtered export requests
 */
function generateFilteredExcelBuffer(resultDocs, sheetName = 'Filtered Results') {
  const formattedRecords = resultDocs.map(formatResultRecord);
  const summaryRows = computeExamSummaryRows(resultDocs, 'Filtered', sheetName);
  const workbook = createFormattedWorkbook(formattedRecords, sheetName, summaryRows);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Parses MCQ questions from Excel file (for question import)
 */
function parseMCQsFromExcel(filePath, subjectName) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Question import file not found at: ${filePath}`);
      return [];
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const questions = [];
    let qId = 1;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length < 5) continue;

      const qText = row[0] ? String(row[0]).trim() : '';
      if (!qText || qText.toLowerCase() === 'question' || qText.toLowerCase().includes('unit')) continue;

      const optA = row[1] ? String(row[1]).trim() : '';
      const optB = row[2] ? String(row[2]).trim() : '';
      const optC = row[3] ? String(row[3]).trim() : '';
      const optD = row[4] ? String(row[4]).trim() : '';

      if (!optA || !optB) continue;

      const rawAns = row[5] ? String(row[5]).trim().toUpperCase() : 'A';
      let correctIndex = 0;

      if (rawAns === 'A' || rawAns.startsWith('OPTION A')) correctIndex = 0;
      else if (rawAns === 'B' || rawAns.startsWith('OPTION B')) correctIndex = 1;
      else if (rawAns === 'C' || rawAns.startsWith('OPTION C')) correctIndex = 2;
      else if (rawAns === 'D' || rawAns.startsWith('OPTION D')) correctIndex = 3;

      // Extract & Validate Difficulty
      const rawDiff = row[6] ? String(row[6]).trim().toUpperCase() : (qId % 3 === 1 ? 'EASY' : (qId % 3 === 2 ? 'MEDIUM' : 'HARD'));
      let difficulty = 'Medium';
      let marks = 2;

      if (rawDiff === 'EASY') {
        difficulty = 'Easy';
        marks = 1;
      } else if (rawDiff === 'HARD') {
        difficulty = 'Hard';
        marks = 2;
      } else {
        difficulty = 'Medium';
        marks = 2;
      }

      const hint = row[8] ? String(row[8]).trim() : (row[7] ? String(row[7]).trim() : `Focus on core principles of ${subjectName}.`);

      questions.push({
        id: qId,
        questionId: qId,
        subject: subjectName,
        question: qText,
        options: [optA, optB, optC, optD],
        correct: correctIndex,
        difficulty,
        marks,
        hint,
        explanation: `${subjectName} concepts & principles.`
      });

      qId++;
    }

    console.log(`📖 Parsed ${questions.length} MCQs from Excel: ${path.basename(filePath)}`);
    return questions;
  } catch (err) {
    console.error(`❌ Error parsing MCQs from Excel ${filePath}:`, err.message);
    return [];
  }
}

module.exports = {
  appendExamResultToExcel,
  rebuildExamExcelFromDB,
  formatResultRecord,
  computeExamSummaryRows,
  getSubjectExcelPath,
  generateFilteredExcelBuffer,
  parseMCQsFromExcel,
  EXCEL_RESULTS_BASE_DIR,
  MASTER_EXCEL_FILE_PATH
};
