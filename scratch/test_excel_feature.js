const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', err => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING EXCEL STORAGE & SECURITY VERIFICATION");
  console.log("=================================================\n");

  // TEST 1: Direct Excel File HTTP Request (Must be 403 Forbidden)
  try {
    const res1 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/data/results/2026-2027/Computer-Networks/Computer-Networks-Results.xlsx',
      method: 'GET'
    });
    console.log(`Test 1 [Direct Excel URL Access Blocked]: Status ${res1.status} ${res1.status === 403 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Response: ${res1.body}`);
  } catch (err) {
    console.error("Test 1 error:", err.message);
  }

  // TEST 2: Student Calling Faculty Export API (Must be 403 Forbidden)
  try {
    const res2 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/results/faculty/export?subject=' + encodeURIComponent('Computer Networks'),
      method: 'GET',
      headers: { 'x-user-role': 'STUDENT' }
    });
    console.log(`\nTest 2 [Student Export API Access Blocked]: Status ${res2.status} ${res2.status === 403 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Response: ${res2.body}`);
  } catch (err) {
    console.error("Test 2 error:", err.message);
  }

  // TEST 3: Unauthorized Faculty Accessing Another Faculty's Subject (Must be 403 Forbidden)
  try {
    const res3 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/results/faculty/export?subject=' + encodeURIComponent('Finite Automata'),
      method: 'GET',
      headers: { 'x-faculty-id': 'FACULTY_DW' } // FACULTY_DW is only assigned DWDM & FC
    });
    console.log(`\nTest 3 [Faculty Subject Restriction Enforced]: Status ${res3.status} ${res3.status === 403 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Response: ${res3.body}`);
  } catch (err) {
    console.error("Test 3 error:", err.message);
  }

  // TEST 4: Student Exam Submission & Automatic Excel Storage
  let submissionRes = null;
  try {
    const postData = JSON.stringify({
      regNo: '24HP1A0501',
      studentName: 'A. Sai Ram',
      year: 'III B.Tech',
      section: 'A',
      subject: 'Computer Networks',
      examName: 'Mid-Term Computer Networks Exam',
      examDate: '2026-08-29',
      startTime: '10:00 AM',
      userAnswers: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
      durationMinutes: 30,
      timeTaken: '18 Mins',
      autoSubmitted: false,
      submissionType: 'MANUAL',
      fullscreenExitCount: 1,
      tabSwitchCount: 2,
      totalViolationsCount: 3
    });

    submissionRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/results/submit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);

    console.log(`\nTest 4 [Student Exam Submission & Auto Excel Storage]: Status ${submissionRes.status} ${submissionRes.status === 201 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Response: ${submissionRes.body}`);
  } catch (err) {
    console.error("Test 4 error:", err.message);
  }

  // TEST 5: Duplicate Submission Protection
  try {
    const postData = JSON.stringify({
      regNo: '24HP1A0501',
      studentName: 'A. Sai Ram',
      subject: 'Computer Networks',
      userAnswers: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]
    });

    const res5 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/results/submit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);

    const bodyObj = JSON.parse(res5.body);
    console.log(`\nTest 5 [Duplicate Submission Protection]: Status ${res5.status} ${bodyObj.isDuplicate === true ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Response: ${res5.body}`);
  } catch (err) {
    console.error("Test 5 error:", err.message);
  }

  // TEST 6: Authorized Faculty Excel Export
  try {
    const res6 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/results/faculty/export?subject=' + encodeURIComponent('Computer Networks'),
      method: 'GET',
      headers: { 'x-faculty-id': 'FACULTY_CN' } // FACULTY_CN is authorized for Computer Networks
    });
    const isExcel = res6.headers['content-type'] && res6.headers['content-type'].includes('spreadsheetml');
    console.log(`\nTest 6 [Authorized Faculty Excel Export]: Status ${res6.status} ${isExcel ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Content-Type: ${res6.headers['content-type']}`);
  } catch (err) {
    console.error("Test 6 error:", err.message);
  }

  // TEST 7: Admin Master Excel Export
  try {
    const res7 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/results/faculty/export?subject=ALL',
      method: 'GET',
      headers: { 'x-faculty-id': 'ADMIN' }
    });
    const isExcel = res7.headers['content-type'] && res7.headers['content-type'].includes('spreadsheetml');
    console.log(`\nTest 7 [Admin Full Master Export]: Status ${res7.status} ${isExcel ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Content-Type: ${res7.headers['content-type']}`);
  } catch (err) {
    console.error("Test 7 error:", err.message);
  }

  console.log("\n=================================================");
  console.log("🏁 ALL TESTS COMPLETED!");
  console.log("=================================================");
}

runTests();
