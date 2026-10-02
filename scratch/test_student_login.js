const http = require('http');

const data = JSON.stringify({
  registrationId: '24HP1A0501',
  password: 'password123'
});

const req = http.request('http://localhost:5000/api/auth/student-login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('RESPONSE:', body);
  });
});

req.write(data);
req.end();
