const http = require('http');

function postLogin(registrationId, password) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ registrationId, password });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/student-login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.write(data);
    req.end();
  });
}

const testStudents = [
  '24HP1A0566',
  '24HP1A0541',
  '24HP1A0501',
  '24HP1A0502',
  '24HP1A4401',
  '24HP1A0401',
  '25HP1A4401',
  '25HP1A4402',
  '25HP1A4403',
  '24HP1A0567'
];

async function runAuthSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE AUTH SUITE ON 10 STUDENTS');
  console.log('====================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  for (const reg of testStudents) {
    console.log('----------------------------------------------------');
    console.log('Testing Student:', reg);
    console.log('----------------------------------------------------');

    // 1. Valid Hall Ticket + Correct Password (meeting format: min 8 chars, 1 uppercase, 1 symbol)
    totalTests++;
    const res1 = await postLogin(reg, reg + '@');
    if (res1.status === 200 && res1.body.success && res1.body.student && res1.body.student.regNo === reg) {
      console.log(`  1. Valid HT + Correct Password    => ✅ [PASS] HTTP 200 SUCCESS (${res1.body.student.name})`);
      passedTests++;
    } else {
      console.error(`  1. Valid HT + Correct Password    => ❌ [FAIL] Status ${res1.status}: ${JSON.stringify(res1.body)}`);
    }

    // 2. Valid Hall Ticket + Wrong Password (meeting format)
    totalTests++;
    const res2 = await postLogin(reg, 'WrongPass123@');
    if (res2.status === 401 && res2.body.success === false && res2.body.message === 'Invalid registration ID or password.') {
      console.log(`  2. Valid HT + Wrong Password      => ✅ [PASS] HTTP 401 REJECTED ("${res2.body.message}")`);
      passedTests++;
    } else {
      console.error(`  2. Valid HT + Wrong Password      => ❌ [FAIL] Status ${res2.status}: ${JSON.stringify(res2.body)}`);
    }

    // 3. Invalid Hall Ticket + Valid Password (meeting format)
    totalTests++;
    const res3 = await postLogin('INVALID' + reg, 'ValidPass123@');
    if (res3.status === 401 && res3.body.success === false && res3.body.message === 'Student record not found.') {
      console.log(`  3. Invalid HT + Valid Password    => ✅ [PASS] HTTP 401 REJECTED ("${res3.body.message}")`);
      passedTests++;
    } else {
      console.error(`  3. Invalid HT + Valid Password    => ❌ [FAIL] Status ${res3.status}: ${JSON.stringify(res3.body)}`);
    }

    // 4. Invalid Hall Ticket + Invalid Password Format (missing symbol / short)
    totalTests++;
    const res4 = await postLogin('INVALID' + reg, 'short');
    if (res4.status === 400 && res4.body.success === false && res4.body.message === 'Password does not satisfy the required format.') {
      console.log(`  4. Invalid HT + Invalid Format    => ✅ [PASS] HTTP 400 REJECTED ("${res4.body.message}")`);
      passedTests++;
    } else {
      console.error(`  4. Invalid HT + Invalid Format    => ❌ [FAIL] Status ${res4.status}: ${JSON.stringify(res4.body)}`);
    }
  }

  console.log('\n====================================================');
  console.log(`📊 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================');
}

runAuthSuite().catch(console.error);
