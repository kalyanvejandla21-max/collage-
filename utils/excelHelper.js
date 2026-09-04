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
 * Converts a raw result database object into a standardized 25-column record
 */
function formatResultRecord(resDoc) {
  const totalQ = resDoc.totalQuestions || 20;
  const correct = resDoc.correctCount || 0;
  const wrong = resDoc.wrongCount || 0;
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

  return {
    'Student ID': resDoc._id ? String(resDoc._id) : regNo,
    'Student Name': resDoc.studentName || 'Student',
    'Registration Number': regNo,
    'Year': resDoc.year || 'III B.Tech',
    'Section': resDoc.section || 'A',
    'Subject': resDoc.subject || 'General Engineering',
    'Exam Name': resDoc.examName || `${resDoc.subject || 'Subject'} Mid Examination`,
    'Exam Date': resDoc.examDate || new Date().toISOString().split('T')[0],
    'Start Time': resDoc.startTime || '10:00 AM',
    'Submission Time': submittedTime,
    'Total Questions': totalQ,
    'Easy Qs': easyQ,
    'Medium Qs': mediumQ,
    'Hard Qs': hardQ,
    'Hints Used': hintsUsed,
    'Attempted': attempted,
    'Unanswered': unanswered,
    'Correct': correct,
    'Wrong': wrong,
    'Total Marks': maxMarks,
    'Marks Obtained': marksObtained,
    'Percentage': `${pct}%`,
    'Result': status,
    'Duration': `${resDoc.durationMinutes || 30} Mins`,
    'Time Taken': resDoc.timeTaken || '20 Mins',
    'Tab Switches': resDoc.tabSwitchCount || 0,
    'Fullscreen Exits': resDoc.fullscreenExitCount || 0,
    'Auto Submitted': resDoc.autoSubmitted ? 'Yes' : 'No',
    'Submission Type': resDoc.submissionType || 'MANUAL'
  };
}

/**
 * Creates an Excel workbook from an array of formatted records with optimized column widths
 */
function createFormattedWorkbook(records, sheetTitle = 'Exam Results') {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(records);

  // Column width specifications for 25 columns
  worksheet['!cols'] = [
    { wch: 26 }, // Student ID
    { wch: 24 }, // Student Name
    { wch: 22 }, // Registration Number
    { wch: 14 }, // Year
    { wch: 10 }, // Section
    { wch: 32 }, // Subject
    { wch: 32 }, // Exam Name
    { wch: 14 }, // Exam Date
    { wch: 14 }, // Start Time
    { wch: 24 }, // Submission Time
    { wch: 16 }, // Total Questions
    { wch: 12 }, // Attempted
    { wch: 14 }, // Unanswered
    { wch: 12 }, // Correct
    { wch: 10 }, // Wrong
    { wch: 14 }, // Total Marks
    { wch: 16 }, // Marks Obtained
    { wch: 14 }, // Percentage
    { wch: 12 }, // Result
    { wch: 14 }, // Duration
    { wch: 14 }, // Time Taken
    { wch: 14 }, // Tab Switches
    { wch: 18 }, // Fullscreen Exits
    { wch: 16 }, // Auto Submitted
    { wch: 18 }  // Submission Type
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
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
 * Gets path for subject-specific Excel file inside organized folder structure:
 * data/results/2026-2027/{Subject-Slug}/{Subject-Slug}-Results.xlsx
 */
function getSubjectExcelPath(subjectName, academicYear = '2026-2027') {
  const safeSubjectSlug = String(subjectName || 'General')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-');
  
  const folderPath = path.join(EXCEL_RESULTS_BASE_DIR, academicYear, safeSubjectSlug);
  return path.join(folderPath, `${safeSubjectSlug}-Results.xlsx`);
}

/**
 * Appends or updates a student result in the Excel files (Subject-specific & Master)
 * Enforces DUPLICATE PREVENTION: Updates existing row if student regNo & subject already present.
 */
function appendExamResultToExcel(resultDoc) {
  try {
    ensureDirectory(EXCEL_RESULTS_BASE_DIR);

    const formattedRecord = formatResultRecord(resultDoc);
    const subjectFilePath = getSubjectExcelPath(resultDoc.subject);
    const targetFilePaths = [subjectFilePath, MASTER_EXCEL_FILE_PATH];

    let overallSuccess = true;

    targetFilePaths.forEach((filePath) => {
      let existingRecords = [];

      if (fs.existsSync(filePath)) {
        try {
          const workbook = XLSX.readFile(filePath);
          const sheetName = workbook.SheetNames[0] || 'Exam Results';
          const worksheet = workbook.Sheets[sheetName];
          existingRecords = XLSX.utils.sheet_to_json(worksheet);
        } catch (e) {
          existingRecords = [];
        }
      }

      // DUPLICATE PREVENTION: Check if record already exists for student & subject
      const existingIdx = existingRecords.findIndex(r => 
        String(r['Registration Number']).toUpperCase() === String(formattedRecord['Registration Number']).toUpperCase() &&
        String(r['Subject']).toLowerCase() === String(formattedRecord['Subject']).toLowerCase()
      );

      if (existingIdx !== -1) {
        // Update existing record
        existingRecords[existingIdx] = {
          ...formattedRecord,
          'Student ID': existingRecords[existingIdx]['Student ID'] || formattedRecord['Student ID']
        };
      } else {
        // Append new record
        existingRecords.push(formattedRecord);
      }

      const updatedWb = createFormattedWorkbook(existingRecords);
      const written = safeWriteExcelFile(updatedWb, filePath);
      if (!written) {
        overallSuccess = false;
      } else {
        console.log(`📊 Successfully stored result in Excel: ${path.basename(filePath)} [Total Records: ${existingRecords.length}]`);
      }
    });

    return overallSuccess;
  } catch (error) {
    console.error('❌ Error saving result to Excel workbook:', error.message);
    return false;
  }
}

/**
 * Dynamic generation of Excel Buffer for filtered export requests
 */
function generateFilteredExcelBuffer(resultDocs, sheetName = 'Filtered Results') {
  const formattedRecords = resultDocs.map(formatResultRecord);
  const workbook = createFormattedWorkbook(formattedRecords, sheetName);
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
  formatResultRecord,
  getSubjectExcelPath,
  generateFilteredExcelBuffer,
  parseMCQsFromExcel,
  EXCEL_RESULTS_BASE_DIR,
  MASTER_EXCEL_FILE_PATH
};
