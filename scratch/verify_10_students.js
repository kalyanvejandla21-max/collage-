const http = require('http');

function postLogin(regNo, password) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ registrationId: regNo, password: password });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/student-login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', err => resolve({ status: 500, error: err.message }));
    req.write(data);
    req.end();
  });
}

async function runVerificationSuite() {
  console.log("==================================================================");
  console.log("🧪 VERIFYING STUDENT AUTHENTICATION FOR 10+ DYNAMIC STUDENTS");
  console.log("==================================================================\n");

  const validStudents = [
    '24HP1A0501',
    '25HP1A4401',
    '24HP1A0566',
    '24HP1A1201',
    '25HP1A0570',
    '24HP1A0484',
    '24HP1A1263',
    '25HP1A4405',
    '25HP1A4410',
    '24HP1A0502'
  ];

  let passedCount = 0;
  let failedCount = 0;

  console.log("👉 PART 1: Testing Valid Students with Default Passwords");
  for (let i = 0; i < validStudents.length; i++) {
    const reg = validStudents[i];
    const res = await postLogin(reg, reg);
    if (res.status === 200 && res.data.success && res.data.token) {
      console.log(`  [${i + 1}/${validStudents.length}] ✅ PASS: ${reg} (${res.data.student.name})`);
      passedCount++;
    } else {
      console.log(`  [${i + 1}/${validStudents.length}] ❌ FAIL: ${reg} -> Status ${res.status}:`, res.data);
      failedCount++;
    }
  }

  console.log("\n👉 PART 2: Testing Valid Student with WRONG Password");
  const wrongPassRes = await postLogin('24HP1A0501', 'WrongPassword123');
  if (wrongPassRes.status === 401 && !wrongPassRes.data.success) {
    console.log(`  ✅ PASS: Correctly rejected wrong password with Status ${wrongPassRes.status} (${wrongPassRes.data.message})`);
    passedCount++;
  } else {
    console.log(`  ❌ FAIL: Wrong password test returned Status ${wrongPassRes.status}`);
    failedCount++;
  }

  console.log("\n👉 PART 3: Testing Nonexistent Student ID");
  const nonexistentRes = await postLogin('NONEXISTENT_9999', 'Password123');
  if (nonexistentRes.status === 401 && !nonexistentRes.data.success) {
    console.log(`  ✅ PASS: Correctly rejected nonexistent student with Status ${nonexistentRes.status} (${nonexistentRes.data.message})`);
    passedCount++;
  } else {
    console.log(`  ❌ FAIL: Nonexistent student test returned Status ${nonexistentRes.status}`);
    failedCount++;
  }

  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED out of ${passedCount + failedCount} total tests`);
  console.log("==================================================================");
}

runVerificationSuite();
