const http = require('http');

function testStudentLogin(regNo, password) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ registrationId: regNo, password: password });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/student-login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch(e) {}
        resolve({ statusCode: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runMultiStudentVerification() {
  console.log("==================================================================");
  console.log("👥 VERIFYING LOGIN FOR MULTIPLE STUDENTS ACROSS 800+ DATABASE");
  console.log("==================================================================\n");

  const testStudents = [
    { reg: '24HP1A0501', label: 'CSE Sec A' },
    { reg: '24HP1A0502', label: 'CSE Sec A' },
    { reg: '24HP1A0541', label: 'CSE Sec A' },
    { reg: '25HP1A4401', label: 'CSD Year 2' },
    { reg: '25HP1A4411', label: 'CSD Year 2' },
    { reg: '25HP1A0569', label: 'CSE Year 2' },
    { reg: '24HP1A0569', label: 'CSE Sec B' },
    { reg: '24HP1A0484', label: 'ECE Year 3' },
    { reg: '24HP1A1263', label: 'IT Year 3' },
    { reg: '24HP1A1265', label: 'IT Year 3' }
  ];

  let passedCount = 0;

  for (const s of testStudents) {
    const res = await testStudentLogin(s.reg, 'AIET@123');
    if (res.statusCode === 200 && res.data.success && res.data.student && res.data.token) {
      console.log(`  ✅ LOGIN SUCCESS: ${s.reg} (${res.data.student.name}) | ${s.label} | Token Issued`);
      passedCount++;
    } else {
      console.log(`  ❌ LOGIN FAILED: ${s.reg} | Status: ${res.statusCode} | Msg: ${res.data ? res.data.message : 'Unknown'}`);
    }
  }

  console.log(`\n------------------------------------------------------------------`);
  console.log(`Summary: ${passedCount} of ${testStudents.length} Students Logged In Successfully!`);
  console.log("------------------------------------------------------------------");
}

runMultiStudentVerification().catch(console.error);
