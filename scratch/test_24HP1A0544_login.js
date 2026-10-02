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

async function runTest() {
  console.log("=== TESTING 24HP1A0544 LOGIN VARIANTS ===");
  const passes = [
    '24HP1A0544',
    '24hp1a0544',
    '24HP1A0544@',
    '24HP1A0544!',
    'AIET@123'
  ];

  for (const p of passes) {
    const res = await testLogin('24HP1A0544', p);
    console.log(`Password "${p}" -> Status ${res.status}:`, res.data);
  }
}

runTest();
