const http = require('http');

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
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
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runVerification() {
  console.log('--- STARTING STUDENT LOGIN REQUIREMENT VERIFICATION ---\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Five Different Valid Students
  const sampleStudents = ['24HP1A0541', '24HP1A0501', '24HP1A0502', '24HP1A4401', '24HP1A0401'];
  for (const reg of sampleStudents) {
    await test(`Valid Student Login: ${reg} / ${reg}`, async () => {
      const res = await postJson('/api/auth/student-login', { registrationId: reg, password: reg });
      if (res.status !== 200 || !res.data.success || !res.data.student) {
        throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (res.data.student.regNo !== reg) {
        throw new Error(`Expected regNo ${reg}, got ${res.data.student.regNo}`);
      }
    });
  }

  // 2. Case Insensitivity
  await test('Case Insensitivity Normalization: 24hp1a0541 / 24hp1a0541', async () => {
    const res = await postJson('/api/auth/student-login', { registrationId: '24hp1a0541', password: '24hp1a0541' });
    if (res.status !== 200 || !res.data.success || res.data.student.regNo !== '24HP1A0541') {
      throw new Error(`Expected normalized 200 login, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 3. Whitespace Trimming
  await test('Accidental Spaces Trimming: "  24HP1A0541  " / " 24HP1A0541 "', async () => {
    const res = await postJson('/api/auth/student-login', { registrationId: '  24HP1A0541  ', password: ' 24HP1A0541 ' });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Expected 200 login after trim, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 4. Cross-Student Login Rejection
  await test('Cross-Student Login Prevention: Student A ID with Student B Password', async () => {
    const res = await postJson('/api/auth/student-login', { registrationId: '24HP1A0541', password: '24HP1A0501' });
    if (res.status !== 401 || res.data.success === true) {
      throw new Error(`Expected 401 rejection for cross-login attempt, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 5. Cross-Student Login Rejection Reverse
  await test('Cross-Student Login Prevention: Student B ID with Student A Password', async () => {
    const res = await postJson('/api/auth/student-login', { registrationId: '24HP1A0501', password: '24HP1A0541' });
    if (res.status !== 401 || res.data.success === true) {
      throw new Error(`Expected 401 rejection for cross-login attempt, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 6. Wrong Password Rejection
  await test('Invalid Password Rejection: password123', async () => {
    const res = await postJson('/api/auth/student-login', { registrationId: '24HP1A0541', password: 'password123' });
    if (res.status !== 401 || res.data.success === true) {
      throw new Error(`Expected 401 rejection for wrong password, got ${res.status}`);
    }
  });

  // 7. Blank Registration ID Rejection
  await test('Blank Registration ID Rejection', async () => {
    const res = await postJson('/api/auth/student-login', { registrationId: '', password: '24HP1A0541' });
    if (res.status !== 400 || res.data.success === true) {
      throw new Error(`Expected 400 rejection for blank ID, got ${res.status}`);
    }
  });

  // 8. Blank Password Rejection
  await test('Blank Password Rejection', async () => {
    const res = await postJson('/api/auth/student-login', { registrationId: '24HP1A0541', password: '' });
    if (res.status !== 400 || res.data.success === true) {
      throw new Error(`Expected 400 rejection for blank password, got ${res.status}`);
    }
  });

  // 9. Non-existent Student Rejection
  await test('Non-Existent Student Rejection', async () => {
    const res = await postJson('/api/auth/student-login', { registrationId: 'INVALID999', password: 'INVALID999' });
    if (res.status !== 401 || res.data.success === true) {
      throw new Error(`Expected 401 rejection for invalid student, got ${res.status}`);
    }
  });

  console.log(`\n--- VERIFICATION SUMMARY ---`);
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
}

runVerification().catch(console.error);
