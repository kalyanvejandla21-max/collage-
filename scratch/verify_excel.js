const path = require('path');
const XLSX = require('xlsx');
const connectDB = require('../config/db');
const { rebuildExamExcelFromDB } = require('../utils/excelHelper');

async function testRebuild() {
  console.log('🔄 Connecting to MongoDB to trigger Excel rebuild...');
  await connectDB();

  console.log('⚡ Rebuilding Excel workbook for "Computer Networks"...');
  const ok = await rebuildExamExcelFromDB('Computer Networks');
  console.log(`Rebuild Result: ${ok}`);

  const filePath = path.join(__dirname, '../data/results/2026-2027/Computer-Networks/Computer-Networks-Results.xlsx');
  console.log(`\n📖 Inspecting rebuilt workbook at: ${filePath}`);

  const wb = XLSX.readFile(filePath);
  console.log(`- Sheet Names:`, wb.SheetNames);

  wb.SheetNames.forEach(sheetName => {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    console.log(`\n--- Sheet '${sheetName}' (${data.length} records) ---`);
    if (data.length > 0) {
      console.log('Sample first row:', data[0]);
    }
  });

  process.exit(0);
}

testRebuild().catch(err => {
  console.error(err);
  process.exit(1);
});
