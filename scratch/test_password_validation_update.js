const http = require('http');

function postLogin(registrationId, password) {
  return new Promise((resolve, reject) => {
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

async function verifyCriteria() {
  console.log('--- TESTING STUDENT LOGIN PASSWORD VALIDATION RULES ---\n');
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

  // 1. Password < 8 characters (Short)
  await test('Reject password < 8 characters ("Pass@1")', async () => {
    const res = await postLogin('24HP1A0501', 'Pass@1');
    if (res.status !== 400 || res.data.success === true) {
      throw new Error(`Expected 400 rejection, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!res.data.message.includes('Password must be at least 8 characters')) {
      throw new Error(`Unexpected error message: ${res.data.message}`);
    }
  });

  // 2. Password missing Uppercase Letter
  await test('Reject password without uppercase letter ("pass@1234")', async () => {
    const res = await postLogin('24HP1A0501', 'pass@1234');
    if (res.status !== 400 || res.data.success === true) {
      throw new Error(`Expected 400 rejection, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 3. Password missing Special Symbol
  await test('Reject password without special symbol ("Password123")', async () => {
    const res = await postLogin('24HP1A0501', 'Password123');
    if (res.status !== 400 || res.data.success === true) {
      throw new Error(`Expected 400 rejection, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 4. Password meeting ALL 3 conditions (Min 8 chars, 1 uppercase, 1 symbol)
  await test('Accept password meeting ALL 3 conditions ("24HP1A0501@")', async () => {
    const res = await postLogin('24HP1A0501', '24HP1A0501@');
    if (res.status !== 200 && res.status !== 401) { // 200 (if matched) or 401 (if invalid pass in DB), but NOT 400 (validation error)!
      throw new Error(`Expected complexity check to pass (status 200 or 401), got validation error ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  console.log(`\n--- SUMMARY: ${passed} PASSED / ${failed} FAILED ---`);
}

verifyCriteria().catch(console.error);
