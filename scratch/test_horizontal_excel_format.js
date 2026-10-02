const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const { appendExamResultToExcel, getSubjectExcelPath } = require('../utils/excelHelper');

console.log("==================================================");
console.log("🧪 TESTING HORIZONTAL / TABULAR EXCEL RESULT FORMAT");
console.log("==================================================");

// Sample Student Result 1
const mockResult1 = {
  _id: '507f1f77bcf86cd799439011',
  regNo: '24HP1A0588',
  studentName: 'SHAIK RESHMI',
  subject: 'Computer Networks Test',
  examName: 'CN Test Exam 2026',
  examId: 'EXAM_TEST_001',
  totalQuestions: 20,
  correctCount: 2,
  wrongCount: 18,
  marksObtained: '2 / 20',
  percentage: 10,
  status: 'FAIL',
  fullscreenExitCount: 0,
  tabSwitchCount: 0,
  totalSecurityViolations: 0,
  submittedAt: new Date('2026-10-01T18:47:52Z')
};

// Sample Student Result 2
const mockResult2 = {
  _id: '507f1f77bcf86cd799439012',
  regNo: '24HP1A0541',
  studentName: 'KALYAN VEJANDLA',
  subject: 'Computer Networks Test',
  examName: 'CN Test Exam 2026',
  examId: 'EXAM_TEST_001',
  totalQuestions: 20,
  correctCount: 18,
  wrongCount: 2,
  marksObtained: '18 / 20',
  percentage: 90,
  status: 'PASS',
  fullscreenExitCount: 1,
  tabSwitchCount: 2,
  totalSecurityViolations: 3,
  submittedAt: new Date('2026-10-01T18:50:00Z')
};

// Clean test path if exists
const testExcelPath = getSubjectExcelPath(mockResult1.subject, mockResult1.examName);
if (fs.existsSync(testExcelPath)) {
  fs.unlinkSync(testExcelPath);
}

// 1. Append Student 1 Result
console.log("\n1. Appending Student 1 (24HP1A0588)...");
const res1 = appendExamResultToExcel(mockResult1);
console.log("Result 1 Save Success:", res1 ? "YES" : "NO");

// 2. Append Student 2 Result
console.log("\n2. Appending Student 2 (24HP1A0541)...");
const res2 = appendExamResultToExcel(mockResult2);
console.log("Result 2 Save Success:", res2 ? "YES" : "NO");

// 3. Re-append updated Student 1 Result (Duplicate prevention check)
console.log("\n3. Re-appending updated Student 1 Result (Duplicate prevention test)...");
const updatedMockResult1 = { ...mockResult1, correctCount: 15, wrongCount: 5, marksObtained: '15 / 20', percentage: 75, status: 'PASS' };
appendExamResultToExcel(updatedMockResult1);

// 4. Read generated Excel file back from disk
console.log(`\n4. Reading Excel file from disk: ${testExcelPath}`);

if (!fs.existsSync(testExcelPath)) {
  console.error("❌ Excel file not found at path:", testExcelPath);
  process.exit(1);
}

const wb = XLSX.readFile(testExcelPath);
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];

// Read raw array of arrays (header = 1) to inspect exact row structure
const rowsAOA = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log(`\nTotal Excel Rows (including header): ${rowsAOA.length}`);

console.log("\n--- ROW 1 (HEADER ROW) ---");
console.log(rowsAOA[0]);

console.log("\n--- ROW 2 (UPDATED STUDENT 1 RESULT ROW) ---");
console.log(rowsAOA[1]);

console.log("\n--- ROW 3 (STUDENT 2 RESULT ROW) ---");
console.log(rowsAOA[2]);

// Verification Checks
const headers = rowsAOA[0];
const expectedHeaders = [
  'Student Name',
  'Registration Number',
  'Subject Paper',
  'Total Questions',
  'Correct Answers',
  'Wrong Answers',
  'Marks Obtained',
  'Percentage',
  'Evaluation Status',
  'Fullscreen Exits',
  'Tab Switches / Focus Loss',
  'Total Security Violations',
  'Timestamp'
];

let allHeadersFound = true;
expectedHeaders.forEach(h => {
  if (!headers.includes(h)) {
    console.error(`❌ Expected header missing: "${h}"`);
    allHeadersFound = false;
  }
});

const isHorizontal = rowsAOA.length === 3 && rowsAOA[1][0] === 'SHAIK RESHMI' && rowsAOA[2][0] === 'KALYAN VEJANDLA';
const isUpdatedInPlace = rowsAOA[1][8] === 'PASS' && rowsAOA[1][6] === '15 / 20';

console.log("\n==================================================");
console.log("VERIFICATION SUMMARY:");
console.log("1. All required column headers present in Row 1:", allHeadersFound ? "PASS" : "FAIL");
console.log("2. Student 1 complete result in Row 2:", rowsAOA[1][0] === 'SHAIK RESHMI' ? "PASS" : "FAIL");
console.log("3. Student 2 complete result in Row 3:", rowsAOA[2][0] === 'KALYAN VEJANDLA' ? "PASS" : "FAIL");
console.log("4. One row per student tabular structure:", isHorizontal ? "PASS" : "FAIL");
console.log("5. Duplicate update in-place without extra row:", isUpdatedInPlace ? "PASS" : "FAIL");

if (allHeadersFound && isHorizontal && isUpdatedInPlace) {
  console.log("\n🎉 ALL EXCEL FORMAT TESTS PASSED SUCCESSFULLY!");
} else {
  console.error("\n❌ EXCEL FORMAT TESTS FAILED!");
  process.exit(1);
}
