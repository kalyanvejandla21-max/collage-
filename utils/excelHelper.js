const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Dedicated folder for Excel files inside the project workspace
const EXCEL_FOLDER_PATH = path.join(__dirname, '../excel_results');
const EXCEL_FILE_PATH_FOLDER = path.join(EXCEL_FOLDER_PATH, 'ALIET_Student_Exam_Results.xlsx');
const EXCEL_FILE_PATH_ROOT = path.join(__dirname, '../Exam_Results_Database.xlsx');

// Ensure the excel_results directory exists
function ensureExcelFolder() {
  if (!fs.existsSync(EXCEL_FOLDER_PATH)) {
    fs.mkdirSync(EXCEL_FOLDER_PATH, { recursive: true });
    console.log(`📁 Created dedicated Excel directory: ${EXCEL_FOLDER_PATH}`);
  }
}

const sampleRecords = [
  {
    'S.No': 1,
    'Registration Number': '23A91A0501',
    'Student Name': 'Kalyan',
    'Subject Paper': 'Computer Networks',
    'Total Questions': 20,
    'Correct Answers': 17,
    'Wrong Answers': 3,
    'Marks Obtained': '17 / 20',
    'Percentage (%)': '85%',
    'Status': 'PASS',
    'Submission Timestamp': '2026-08-12 08:30:00'
  },
  {
    'S.No': 2,
    'Registration Number': '24HP1A0564',
    'Student Name': 'G. Uday Kiran',
    'Subject Paper': 'Finite Automata',
    'Total Questions': 20,
    'Correct Answers': 18,
    'Wrong Answers': 2,
    'Marks Obtained': '18 / 20',
    'Percentage (%)': '90%',
    'Status': 'PASS',
    'Submission Timestamp': '2026-08-12 08:45:00'
  },
  {
    'S.No': 3,
    'Registration Number': '24HP1A0501',
    'Student Name': 'A. Sai Ram',
    'Subject Paper': 'Data Warehouse and Data Mining',
    'Total Questions': 20,
    'Correct Answers': 15,
    'Wrong Answers': 5,
    'Marks Obtained': '15 / 20',
    'Percentage (%)': '75%',
    'Status': 'PASS',
    'Submission Timestamp': '2026-08-12 09:00:00'
  },
  {
    'S.No': 4,
    'Registration Number': '24HP1A0502',
    'Student Name': 'B. Vamsi Krishna',
    'Subject Paper': 'Fundamentals of Computing',
    'Total Questions': 20,
    'Correct Answers': 19,
    'Wrong Answers': 1,
    'Marks Obtained': '19 / 20',
    'Percentage (%)': '95%',
    'Status': 'PASS',
    'Submission Timestamp': '2026-08-12 09:10:00'
  },
  {
    'S.No': 5,
    'Registration Number': '24HP1A0503',
    'Student Name': 'Ch. Harika',
    'Subject Paper': 'Computer Networks',
    'Total Questions': 20,
    'Correct Answers': 16,
    'Wrong Answers': 4,
    'Marks Obtained': '16 / 20',
    'Percentage (%)': '80%',
    'Status': 'PASS',
    'Submission Timestamp': '2026-08-12 09:20:00'
  }
];

function createWorkbookWithData(records) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(records);

  worksheet['!cols'] = [
    { wch: 8 },  // S.No
    { wch: 22 }, // Registration Number
    { wch: 24 }, // Student Name
    { wch: 34 }, // Subject Paper
    { wch: 16 }, // Total Questions
    { wch: 16 }, // Correct Answers
    { wch: 16 }, // Wrong Answers
    { wch: 16 }, // Marks Obtained
    { wch: 16 }, // Percentage (%)
    { wch: 12 }, // Status
    { wch: 18 }, // Fullscreen Exits
    { wch: 18 }, // Tab Switches
    { wch: 24 }, // Total Security Violations
    { wch: 26 }  // Submission Timestamp
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Exam Results');
  return workbook;
}

function safeWriteExcel(workbook, filePath) {
  try {
    XLSX.writeFile(workbook, filePath);
    return true;
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.warn(`⚠️ File ${path.basename(filePath)} is currently open/locked in another program. Close it to allow live updates.`);
    } else {
      console.error(`❌ Error writing to ${filePath}:`, err.message);
    }
    return false;
  }
}

// Pre-populate initial 5 sample student records in Excel file locations
function initializeExcelWithSamples() {
  ensureExcelFolder();

  // Create in folder excel_results/ALIET_Student_Exam_Results.xlsx
  if (!fs.existsSync(EXCEL_FILE_PATH_FOLDER)) {
    const wbFolder = createWorkbookWithData(sampleRecords);
    safeWriteExcel(wbFolder, EXCEL_FILE_PATH_FOLDER);
    console.log(`📊 Initialized Excel Sheet with 5 sample student records in folder: ${EXCEL_FILE_PATH_FOLDER}`);
  }

  // Create in root directory Exam_Results_Database.xlsx
  if (!fs.existsSync(EXCEL_FILE_PATH_ROOT)) {
    const wbRoot = createWorkbookWithData(sampleRecords);
    safeWriteExcel(wbRoot, EXCEL_FILE_PATH_ROOT);
  }
}

/**
 * Automatically appends a new student attempt into Excel files
 */
function appendExamResultToExcel(resultData) {
  try {
    ensureExcelFolder();

    const filePaths = [EXCEL_FILE_PATH_FOLDER, EXCEL_FILE_PATH_ROOT];

    filePaths.forEach((filePath) => {
      let existingData = [];

      if (fs.existsSync(filePath)) {
        try {
          const workbook = XLSX.readFile(filePath);
          const sheetName = workbook.SheetNames[0] || 'Exam Results';
          const worksheet = workbook.Sheets[sheetName];
          existingData = XLSX.utils.sheet_to_json(worksheet);
        } catch (e) {
          existingData = [...sampleRecords];
        }
      } else {
        existingData = [...sampleRecords];
      }

      const newRow = {
        'S.No': existingData.length + 1,
        'Registration Number': resultData.regNo ? resultData.regNo.toUpperCase() : 'N/A',
        'Student Name': resultData.studentName || 'Student',
        'Subject Paper': resultData.subject || 'General Engineering',
        'Total Questions': resultData.totalQuestions || 20,
        'Correct Answers': resultData.correctCount || 0,
        'Wrong Answers': resultData.wrongCount || 0,
        'Marks Obtained': resultData.marksObtained || `${resultData.correctCount || 0} / ${resultData.totalQuestions || 20}`,
        'Percentage (%)': `${resultData.percentage || 0}%`,
        'Status': resultData.status || (resultData.percentage >= 40 ? 'PASS' : 'FAIL'),
        'Fullscreen Exits': resultData.fullscreenExitCount || 0,
        'Tab Switches': resultData.tabSwitchCount || 0,
        'Total Security Violations': resultData.totalViolationsCount || 0,
        'Submission Timestamp': resultData.submittedAt ? new Date(resultData.submittedAt).toLocaleString() : new Date().toLocaleString()
      };

      existingData.push(newRow);

      const updatedWb = createWorkbookWithData(existingData);
      const written = safeWriteExcel(updatedWb, filePath);
      if (written) {
        console.log(`📊 Automatically appended new exam result to Excel sheet: ${path.basename(filePath)} [Total Records: ${existingData.length}]`);
      }
    });

    return true;
  } catch (error) {
    console.error('❌ Error appending exam result to Excel:', error.message);
    return false;
  }
}

/**
 * Parses MCQ questions from Excel file
 */
function parseMCQsFromExcel(filePath, subjectName) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Excel question file not found at: ${filePath}`);
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
      else {
        const foundIdx = [optA, optB, optC, optD].indexOf(rawAns);
        if (foundIdx !== -1) correctIndex = foundIdx;
      }

      questions.push({
        id: qId,
        questionId: qId,
        subject: subjectName,
        question: qText,
        options: [optA, optB, optC, optD],
        correct: correctIndex,
        explanation: `${subjectName} concepts & principles.`
      });

      qId++;
    }

    console.log(`📖 Successfully parsed ${questions.length} MCQs from Excel: ${path.basename(filePath)}`);
    return questions;
  } catch (err) {
    console.error(`❌ Error parsing MCQs from Excel ${filePath}:`, err.message);
    return [];
  }
}

// Call initialization immediately on module load
initializeExcelWithSamples();

module.exports = {
  appendExamResultToExcel,
  initializeExcelWithSamples,
  parseMCQsFromExcel,
  EXCEL_FILE_PATH: EXCEL_FILE_PATH_FOLDER,
  EXCEL_FILE_PATH_ROOT,
  EXCEL_FOLDER_PATH
};
