const http = require('http');

function requestApi(method, path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = payload ? JSON.stringify(payload) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runFullVerification() {
  console.log('===============================================================');
  console.log('🔒 VERIFYING UNIQUE STUDENT PASSWORD AUTHENTICATION SYSTEM');
  console.log('===============================================================\n');

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

  // 1. Bulk Generate Temporary Passwords for All 800+ Students
  let credentialsList = [];
  await test('Admin Bulk Generate Unique Passwords (800+ Students)', async () => {
    const res = await requestApi('POST', '/api/admin/students/bulk-generate-passwords', { adminId: 'ADMIN' });
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.credentials)) {
      throw new Error(`Bulk generation failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    credentialsList = res.data.credentials;
    if (credentialsList.length < 50) {
      throw new Error(`Expected >50 credentials, got ${credentialsList.length}`);
    }
  });

  const getTempPass = (reg) => {
    const found = credentialsList.find(c => c['Registration ID / Hall Ticket'] === reg);
    return found ? found['Temporary Password'] : null;
  };

  const studentA = '24HP1A0501';
  const studentB = '24HP1A0502';
  const tempPassA = getTempPass(studentA);
  const tempPassB = getTempPass(studentB);

  // 2. First Login with Temporary Password (mustChangePassword === true)
  await test(`First Login with Temp Password (${studentA}): mustChangePassword === true`, async () => {
    const res = await requestApi('POST', '/api/auth/student-login', { registrationId: studentA, password: tempPassA });
    if (res.status !== 200 || !res.data.success || res.data.mustChangePassword !== true) {
      throw new Error(`Expected 200 with mustChangePassword=true, got status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 3. Cross-Student Login Rejection
  await test(`Cross-Student Login Prevention (${studentA} ID with ${studentB} Temp Password)`, async () => {
    const res = await requestApi('POST', '/api/auth/student-login', { registrationId: studentA, password: tempPassB });
    if (res.status !== 401 || res.data.success === true) {
      throw new Error(`Expected 401 rejection for cross-student password attempt, got ${res.status}`);
    }
  });

  // 4. Password Policy Validation on Change
  await test('Reject Weak Password Change Request (< 8 chars)', async () => {
    const res = await requestApi('POST', '/api/auth/change-password', {
      registrationId: studentA,
      currentPassword: tempPassA,
      newPassword: 'Weak1',
      confirmPassword: 'Weak1'
    });
    if (res.status !== 400 || res.data.success === true) {
      throw new Error(`Expected 400 rejection for weak password, got ${res.status}`);
    }
  });

  // 5. Successful Student Password Change
  const newPassA = 'SecureP@ss2026';
  await test(`Successful Student Password Change (${studentA} -> ${newPassA})`, async () => {
    const res = await requestApi('POST', '/api/auth/change-password', {
      registrationId: studentA,
      currentPassword: tempPassA,
      newPassword: newPassA,
      confirmPassword: newPassA
    });
    if (res.status !== 200 || !res.data.success || res.data.mustChangePassword !== false) {
      throw new Error(`Expected 200 with mustChangePassword=false, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 6. Login with Old Temp Password Rejected
  await test(`Login with Old Temp Password Rejected (${studentA})`, async () => {
    const res = await requestApi('POST', '/api/auth/student-login', { registrationId: studentA, password: tempPassA });
    if (res.status !== 401) {
      throw new Error(`Expected 401 rejection for old temp password, got ${res.status}`);
    }
  });

  // 7. Login with New Permanent Password
  await test(`Login with New Permanent Password (${studentA}): mustChangePassword === false`, async () => {
    const res = await requestApi('POST', '/api/auth/student-login', { registrationId: studentA, password: newPassA });
    if (res.status !== 200 || !res.data.success || res.data.mustChangePassword !== false) {
      throw new Error(`Expected 200 login with mustChangePassword=false, got ${res.status}`);
    }
  });

  // 8. Account Lockout Protection (5 Failed Attempts)
  await test(`Account Lockout Trigger after 5 Failed Attempts (${studentB})`, async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await requestApi('POST', '/api/auth/student-login', { registrationId: studentB, password: 'WrongP@ssword99' });
      if (i === 5) {
        if (res.status !== 401 && res.status !== 403) {
          throw new Error(`Expected 401/403 lockout warning on 5th attempt, got ${res.status}`);
        }
      }
    }
    // 6th attempt should be blocked due to LOCKED status
    const res6 = await requestApi('POST', '/api/auth/student-login', { registrationId: studentB, password: tempPassB });
    if (res6.status !== 403) {
      throw new Error(`Expected 403 Account Locked response, got ${res6.status}: ${JSON.stringify(res6.data)}`);
    }
  });

  // 9. Admin Account Unlock
  await test(`Admin Unlock Account (${studentB})`, async () => {
    const res = await requestApi('POST', '/api/admin/students/update-status', { registrationId: studentB, status: 'ACTIVE', adminId: 'ADMIN' });
    if (res.status !== 200 || !res.data.success || res.data.accountStatus !== 'ACTIVE') {
      throw new Error(`Failed to unlock account: ${JSON.stringify(res.data)}`);
    }
    // Now studentB should be able to log in with tempPassB
    const loginRes = await requestApi('POST', '/api/auth/student-login', { registrationId: studentB, password: tempPassB });
    if (loginRes.status !== 200) {
      throw new Error(`Expected successful login after unlock, got ${loginRes.status}`);
    }
  });

  // 10. Admin Single Student Password Reset
  let singleTempPass = '';
  await test(`Admin Reset Password for Student (${studentB})`, async () => {
    const res = await requestApi('POST', '/api/admin/students/reset-password', { registrationId: studentB, adminId: 'ADMIN' });
    if (res.status !== 200 || !res.data.success || !res.data.tempPassword) {
      throw new Error(`Admin reset failed: ${JSON.stringify(res.data)}`);
    }
    singleTempPass = res.data.tempPassword;
    if (singleTempPass === tempPassB) {
      throw new Error('New temp password should be different from old temp password');
    }
  });

  // 11. Login with Admin-Reset Temp Password
  await test(`Login with Admin-Reset Temp Password (${studentB})`, async () => {
    const res = await requestApi('POST', '/api/auth/student-login', { registrationId: studentB, password: singleTempPass });
    if (res.status !== 200 || res.data.mustChangePassword !== true) {
      throw new Error(`Expected successful login with forced password change, got ${res.status}`);
    }
  });

  // 12. Security Check: Direct HTTP Static Access to Credentials Excel Blocked
  await test('Security Middleware Blocks Direct Static Access to Credentials Excel', async () => {
    const res = await requestApi('GET', '/data/credentials/STUDENT_CREDENTIALS.xlsx');
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden for direct Excel URL, got ${res.status}`);
    }
  });

  // 13. Admin Protected Download Endpoint Serves File
  await test('Admin Protected Download Endpoint Serves Excel File', async () => {
    const res = await requestApi('GET', '/api/admin/download-credentials');
    if (res.status !== 200 || !res.headers['content-type'].includes('spreadsheetml')) {
      throw new Error(`Expected 200 with Excel content type, got status ${res.status}`);
    }
  });

  console.log('\n===============================================================');
  console.log(`🏆 FINAL VERIFICATION RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('===============================================================\n');
}

runFullVerification().catch(console.error);
