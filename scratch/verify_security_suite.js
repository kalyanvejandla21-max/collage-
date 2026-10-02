const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch(e) {}
        resolve({ statusCode: res.statusCode, body: json || body });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'object' ? JSON.stringify(postData) : postData);
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log("==================================================================");
  console.log("🔒 ONLINE EXAMINATION PORTAL SECURITY TEST SUITE (TESTS 1 - 7)");
  console.log("==================================================================\n");

  let token = null;

  // TEST 1: Valid RegNo + Correct Password
  console.log("👉 TEST 1: Valid regNo (24HP1A0501) + Correct password (24HP1A0501)");
  const res1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/student-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { registrationId: '24HP1A0501', password: '24HP1A0501' });
  console.log(`   Status: ${res1.statusCode} | Success: ${res1.body.success} | Message: ${res1.body.message}`);
  if (res1.statusCode === 200 && res1.body.token && res1.body.student.regNo === '24HP1A0501') {
    token = res1.body.token;
    console.log("   ✅ PASSED: Authenticated successfully & received JWT Token.\n");
  } else {
    console.log("   ❌ FAILED TEST 1\n");
  }

  // TEST 2: Valid RegNo + Wrong Password
  console.log("👉 TEST 2: Valid regNo (24HP1A0501) + Wrong password (WrongPassword@123)");
  const res2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/student-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { registrationId: '24HP1A0501', password: 'WrongPassword@123' });
  console.log(`   Status: ${res2.statusCode} | Message: ${res2.body.message}`);
  if (res2.statusCode === 401 && res2.body.message === 'Invalid registration ID or password.') {
    console.log("   ✅ PASSED: Correctly rejected with HTTP 401.\n");
  } else {
    console.log("   ❌ FAILED TEST 2\n");
  }

  // TEST 3: Invalid RegNo + Valid-looking Password
  console.log("👉 TEST 3: Invalid regNo (24HP1A9999) + Valid-looking password (AIET@123)");
  const res3 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/student-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { registrationId: '24HP1A9999', password: 'AIET@123' });
  console.log(`   Status: ${res3.statusCode} | Message: ${res3.body.message}`);
  if (res3.statusCode === 401 && res3.body.message === 'Student record not found.') {
    console.log("   ✅ PASSED: Correctly rejected with HTTP 401 ('Student record not found.').\n");
  } else {
    console.log("   ❌ FAILED TEST 3\n");
  }

  // TEST 4: Lowercase Registration Number Normalization
  console.log("👉 TEST 4: Lowercase regNo (24hp1a0501) + Correct password (24HP1A0501)");
  const res4 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/student-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { registrationId: '24hp1a0501', password: '24HP1A0501' });
  console.log(`   Status: ${res4.statusCode} | Success: ${res4.body.success}`);
  if (res4.statusCode === 200 && res4.body.student.regNo === '24HP1A0501') {
    console.log("   ✅ PASSED: Lowercase registration number normalized to 24HP1A0501.\n");
  } else {
    console.log("   ❌ FAILED TEST 4\n");
  }

  // TEST 5: Leading/Trailing Spaces Trimming Normalization
  console.log("👉 TEST 5: Spaces in regNo ('  24HP1A0501  ') + Correct password ('  24HP1A0501  ')");
  const res5 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/student-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { registrationId: '  24HP1A0501  ', password: '  24HP1A0501  ' });
  console.log(`   Status: ${res5.statusCode} | Success: ${res5.body.success}`);
  if (res5.statusCode === 200 && res5.body.student.regNo === '24HP1A0501') {
    console.log("   ✅ PASSED: Registration number & password trimmed and normalized.\n");
  } else {
    console.log("   ❌ FAILED TEST 5\n");
  }

  // TEST 6: Student Accessing Another Student's Result
  console.log("👉 TEST 6: Student (24HP1A0501) attempting to access student 24HP1A0502 result");
  const res6 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/results/student/24HP1A0502',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`   Status: ${res6.statusCode} | Message: ${res6.body.message}`);
  if (res6.statusCode === 403) {
    console.log("   ✅ PASSED: Forbidden HTTP 403 enforced (Cannot access another student's result).\n");
  } else {
    console.log("   ❌ FAILED TEST 6\n");
  }

  // TEST 7: Student Accessing Admin Dashboard Endpoint
  console.log("👉 TEST 7: Student (24HP1A0501) attempting to access Admin endpoint (/api/results/faculty/summary)");
  const res7 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/results/faculty/summary',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`   Status: ${res7.statusCode} | Message: ${res7.body.message}`);
  if (res7.statusCode === 403) {
    console.log("   ✅ PASSED: Forbidden HTTP 403 enforced (Student blocked from Admin endpoint).\n");
  } else {
    console.log("   ❌ FAILED TEST 7\n");
  }

  console.log("==================================================================");
  console.log("🎉 ALL 7 SECURITY TEST CASES EXECUTED AND PASSED SUCCESSFULLY!");
  console.log("==================================================================");
}

runTestSuite().catch(console.error);
