const path = require('path');
const XLSX = require('xlsx');

const filePath = path.join(__dirname, '../data/results/2026-2027/Computer-Networks/Computer-Networks-Results.xlsx');
const wb = XLSX.readFile(filePath);
const summaryData = XLSX.utils.sheet_to_json(wb.Sheets['Exam Summary']);

console.log('====================================================');
console.log('📊 EXAM SUMMARY SHEET METRICS (Sheet 2)');
console.log('====================================================');
summaryData.forEach(row => {
  console.log(`${row['Metric / Parameter'].padEnd(32)} : ${row['Value']}`);
});
console.log('====================================================');
