const http = require('http');

function testLogin(regNo, password) {
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
        resolve({ status: res.statusCode, body: JSON.parse(body) });
      });
    });
    req.on('error', err => resolve({ status: 500, error: err.message }));
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log("=== TESTING STUDENT LOGIN API ===");
  const testCases = [
    { regNo: '25HP1A4401', pass: '25HP1A4401' },
    { regNo: '25HP1A4401', pass: '25HP1A4401@' },
    { regNo: '25HP1A4401', pass: 'AIET@123' },
    { regNo: '24HP1A0501', pass: '24HP1A0501' },
    { regNo: '24HP1A0501', pass: '24HP1A0501@' },
    { regNo: '24HP1A0501', pass: 'AIET@123' }
  ];

  for (const tc of testCases) {
    const res = await testLogin(tc.regNo, tc.pass);
    console.log(`Login (${tc.regNo} / "${tc.pass}") -> Status ${res.status}:`, res.body);
  }
}

runTests();
