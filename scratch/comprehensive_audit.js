const http = require('http');
const mongoose = require('mongoose');

function requestAPI(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch(e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed || body });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'object' ? JSON.stringify(data) : data);
    }
    req.end();
  });
}

async function runComprehensiveAudit() {
  console.log("==================================================================");
  console.log("⚡ STARTING COMPREHENSIVE PORTAL AUTOMATED TEST SUITE");
  console.log("==================================================================\n");

  let testCount = 0;
  let passCount = 0;

  function reportResult(name, condition, details = '') {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`✅ TEST ${testCount}: ${name}`);
    } else {
      console.log(`❌ TEST ${testCount}: ${name} - FAILED! ${details}`);
    }
  }

  // 1. Health Check Endpoint
  const healthRes = await requestAPI({ hostname: 'localhost', port: 5000, path: '/api/health', method: 'GET' });
  reportResult('API Health Check Endpoint', healthRes.status === 200 && healthRes.body.status === 'Backend Online');

  // 2. Student Schedules API
  const schedulesRes = await requestAPI({ hostname: 'localhost', port: 5000, path: '/api/exams/schedules?regNo=24HP1A0501', method: 'GET' });
  reportResult('Exams Schedule Retrieval', schedulesRes.status === 200 && Array.isArray(schedulesRes.body.schedules));

  // 3. Question Retrieval for Exam
  const questionsRes = await requestAPI({ hostname: 'localhost', port: 5000, path: '/api/questions/Computer%20Networks?subject=Computer%20Networks&count=20', method: 'GET' });
  reportResult('Question Retrieval & Bank Serving', questionsRes.status === 200 && Array.isArray(questionsRes.body.questions) && questionsRes.body.questions.length > 0);

  // 4. Student Authentication Token Generation
  const loginRes = await requestAPI({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/student-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { registrationId: '24HP1A0501', password: '24HP1A0501' });

  const token = loginRes.body ? loginRes.body.token : null;
  reportResult('Student Auth & JWT Token Issue', loginRes.status === 200 && !!token);

  // 5. Protected Endpoint Access with Student JWT Token
  const studentResultRes = await requestAPI({
    hostname: 'localhost',
    port: 5000,
    path: '/api/results/student/24HP1A0501',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  reportResult('Protected Student Result Access (Authorized)', studentResultRes.status === 200 || studentResultRes.status === 404);

  // 6. Access Control: Student blocked from Admin API
  const adminAccessRes = await requestAPI({
    hostname: 'localhost',
    port: 5000,
    path: '/api/results/faculty/summary',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  reportResult('Access Control: Student blocked from Admin/Faculty endpoint', adminAccessRes.status === 403);

  // 7. Security: Direct Excel File Request Blocked by Express Middleware
  const excelSecurityRes = await requestAPI({
    hostname: 'localhost',
    port: 5000,
    path: '/excel_results/Computer-Networks-Results.xlsx',
    method: 'GET'
  });
  reportResult('Security: Direct Excel file download blocked by server (403 Forbidden)', excelSecurityRes.status === 403);

  // 8. Admin Authentication
  const adminLoginRes = await requestAPI({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { facultyId: 'FACULTY01', password: 'admin123' });
  reportResult('Faculty / Admin Login Endpoint', adminLoginRes.status === 200 && adminLoginRes.body.success);

  // 9. Admin Dashboard API
  const adminDashRes = await requestAPI({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/dashboard',
    method: 'GET'
  });
  reportResult('Admin Dashboard Summary Metrics', adminDashRes.status === 200 && adminDashRes.body.success && typeof adminDashRes.body.summary.totalStudents === 'number');

  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passCount} / ${testCount} Core Integration Tests Passed.`);
  console.log("==================================================================");
}

runComprehensiveAudit();
