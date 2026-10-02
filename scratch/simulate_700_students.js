const http = require('http');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const API_HOST = 'localhost';
const API_PORT = 5000;
const TOTAL_SIMULATED_STUDENTS = 700;
const DUPLICATE_TEST_COUNT = 20;

function postJSON(pathStr, bodyObj) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(bodyObj);
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: pathStr,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

async function run700StudentsSimulation() {
  console.log(`================================================================`);
  console.log(`⚡ STARTING 700-STUDENT CONCURRENT SUBMISSION SIMULATION TEST`);
  console.log(`================================================================`);

  const examId = 'EXAM_CN_001';
  const subject = 'Computer Networks';
  const examName = 'Mid-Term Computer Networks Exam';

  const startTime = Date.now();
  let successCount = 0;
  let duplicatePreventedCount = 0;
  let errorCount = 0;

  console.log(`🚀 Launching ${TOTAL_SIMULATED_STUDENTS} student exam submission requests...`);

  // Batch requests in concurrent chunks of 50
  const chunkSize = 50;
  for (let i = 1; i <= TOTAL_SIMULATED_STUDENTS; i += chunkSize) {
    const batch = [];
    for (let j = i; j < i + chunkSize && j <= TOTAL_SIMULATED_STUDENTS; j++) {
      const regNo = `SIM24HP1A${String(j).padStart(4, '0')}`;
      const studentName = `Simulated Student ${j}`;
      const userAnswers = Array.from({ length: 20 }, (_, idx) => (j + idx) % 4);

      const payload = {
        regNo,
        studentName,
        year: 'III B.Tech',
        section: j % 3 === 0 ? 'A' : (j % 3 === 1 ? 'B' : 'C'),
        subject,
        examId,
        examName,
        examDate: new Date().toISOString().split('T')[0],
        startTime: '10:00 AM',
        userAnswers,
        durationMinutes: 30,
        timeTaken: `${15 + (j % 10)} Mins`,
        autoSubmitted: j % 15 === 0,
        submissionType: j % 15 === 0 ? 'AUTOMATIC' : 'MANUAL',
        fullscreenExitCount: j % 7 === 0 ? 1 : 0,
        tabSwitchCount: j % 5 === 0 ? 2 : 0,
        totalViolationsCount: (j % 7 === 0 ? 1 : 0) + (j % 5 === 0 ? 2 : 0)
      };

      batch.push(postJSON('/api/results/submit', payload));
    }

    const results = await Promise.all(batch);
    results.forEach(res => {
      if (res.statusCode === 201 || res.statusCode === 200) {
        if (res.data.isDuplicate) {
          duplicatePreventedCount++;
        } else {
          successCount++;
        }
      } else {
        errorCount++;
      }
    });

    if (i % 200 === 1 || i + chunkSize > TOTAL_SIMULATED_STUDENTS) {
      console.log(`⏳ Progress: ${Math.min(i + chunkSize - 1, TOTAL_SIMULATED_STUDENTS)} / ${TOTAL_SIMULATED_STUDENTS} requests sent...`);
    }
  }

  console.log(`\n🔄 Testing Duplicate Prevention with ${DUPLICATE_TEST_COUNT} repeated submissions...`);
  const duplicateBatch = [];
  for (let d = 1; d <= DUPLICATE_TEST_COUNT; d++) {
    const regNo = `SIM24HP1A${String(d).padStart(4, '0')}`;
    const payload = {
      regNo,
      studentName: `Simulated Student ${d}`,
      subject,
      examId,
      examName,
      userAnswers: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]
    };
    duplicateBatch.push(postJSON('/api/results/submit', payload));
  }

  const dupResults = await Promise.all(duplicateBatch);
  let duplicateSuccessCount = 0;
  dupResults.forEach(res => {
    if (res.data && res.data.isDuplicate) {
      duplicateSuccessCount++;
    }
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n================================================================`);
  console.log(`✅ SUBMISSION SIMULATION COMPLETED IN ${durationSec}s`);
  console.log(`================================================================`);
  console.log(`- Total Initial Submissions: ${successCount}`);
  console.log(`- Duplicate Submissions Rejected Cleanly: ${duplicateSuccessCount} / ${DUPLICATE_TEST_COUNT}`);
  console.log(`- Errors: ${errorCount}`);

  // Wait 1.5 seconds for async queue to finish writing Excel workbook
  console.log(`\n⏳ Waiting for background Excel queue to flush changes...`);
  await new Promise(r => setTimeout(r, 1500));

  // Verify Excel File Integrity
  const excelDir = path.join(__dirname, '../data/results/2026-2027/Computer-Networks');
  const excelFiles = fs.existsSync(excelDir) ? fs.readdirSync(excelDir) : [];
  console.log(`\n📁 Checking Excel Storage Directory (${excelDir}):`);
  console.log(`- Files Found:`, excelFiles);

  let verifiedRows = 0;
  let summarySheetFound = false;

  for (const f of excelFiles) {
    if (f.endsWith('.xlsx')) {
      const filePath = path.join(excelDir, f);
      try {
        const wb = XLSX.readFile(filePath);
        console.log(`\n📖 Inspecting Excel Workbook: ${f}`);
        console.log(`- Sheet Names:`, wb.SheetNames);

        if (wb.SheetNames.includes('Results')) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets['Results']);
          verifiedRows = rows.length;
          console.log(`- Sheet 1 ('Results') Row Count: ${rows.length}`);
        }

        if (wb.SheetNames.includes('Exam Summary')) {
          summarySheetFound = true;
          const summaryData = XLSX.utils.sheet_to_json(wb.Sheets['Exam Summary']);
          console.log(`- Sheet 2 ('Exam Summary') Metrics:`);
          summaryData.forEach(row => {
            console.log(`   • ${row['Metric / Parameter']}: ${row['Value']}`);
          });
        }
      } catch (e) {
        console.error(`❌ Error reading workbook ${f}:`, e.message);
      }
    }
  }

  console.log(`\n================================================================`);
  console.log(`🎯 VERIFICATION SUMMARY`);
  console.log(`================================================================`);
  console.log(`1. MongoDB Submissions Saved: ${successCount}`);
  console.log(`2. Duplicate Submissions Intercepted: ${duplicateSuccessCount} / ${DUPLICATE_TEST_COUNT}`);
  console.log(`3. Excel 'Results' Rows Verified: ${verifiedRows}`);
  console.log(`4. 2-Sheet Workbook Validated: ${summarySheetFound ? 'YES (Results & Exam Summary)' : 'NO'}`);
  console.log(`================================================================\n`);
}

run700StudentsSimulation().catch(console.error);
