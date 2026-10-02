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
  console.log("=== TESTING 24HP1A0541 LOGIN ===");
  const res1 = await testLogin('24HP1A0541', '24HP1A0541');
  console.log('Login with 24HP1A0541 -> Status', res1.status, res1.data.student ? `SUCCESS (${res1.data.student.name})` : res1.data);
  
  const res2 = await testLogin('24HP1A0541', 'HFGHTRHT#');
  console.log('Login with HFGHTRHT# -> Status', res2.status, res2.data.message);
}

runTest();
