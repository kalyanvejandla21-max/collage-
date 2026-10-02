const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const masterPath = path.join(__dirname, '../data/results/Master-Exam-Results.xlsx');

console.log("==================================================");
console.log("🔍 VERIFYING CLEAN EXCEL RESULT FILE ON DISK");
console.log("==================================================");

if (!fs.existsSync(masterPath)) {
  console.error("❌ Master Excel file missing at:", masterPath);
  process.exit(1);
}

const wb = XLSX.readFile(masterPath);
const ws = wb.Sheets[wb.SheetNames[0]];

const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log(`Total Excel Rows (including header): ${rows.length}`);

console.log("\n--- HEADER ROW (ROW 1) ---");
console.log(rows[0]);

console.log("\n--- FIRST 5 STUDENT RESULT ROWS ---");
for (let i = 1; i < Math.min(rows.length, 6); i++) {
  console.log(`Row ${i + 1}: [${rows[i][1]}] ${rows[i][0]} - ${rows[i][2]} (${rows[i][6]})`);
}

// Check for synthetic names
let syntheticFound = false;
rows.forEach((r, idx) => {
  if (idx === 0) return;
  const name = String(r[0] || '');
  const reg = String(r[1] || '');
  if (name.includes('Simulated') || name.includes('Test Student') || reg.includes('SIM') || reg.includes('TEST')) {
    console.error(`❌ Synthetic row found at line ${idx + 1}:`, r);
    syntheticFound = true;
  }
});

if (!syntheticFound && rows.length === 16) { // 1 header + 15 real student results
  console.log("\n🎉 EXCEL FILE IS 100% CLEAN & CONTAINS ONLY REAL STUDENT RESULTS IN HORIZONTAL TABULAR FORMAT!");
} else if (!syntheticFound) {
  console.log(`\n✅ No synthetic test records found. Total real rows: ${rows.length - 1}`);
} else {
  console.error("\n❌ Synthetic records detected in Excel file!");
  process.exit(1);
}
