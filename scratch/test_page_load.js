const http = require('http');

http.get('http://localhost:5000/', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Content Type:', res.headers['content-type']);
    console.log('Contains login-page element:', body.includes('id="login-page"'));
    console.log('Contains student-id input:', body.includes('id="student-id"'));
    console.log('Contains password input:', body.includes('id="password"'));
    console.log('Contains app.js script:', body.includes('app.js'));
  });
}).on('error', console.error);
