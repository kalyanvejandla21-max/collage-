async function verifyExamCreationAndDisplay() {
  try {
    console.log("--- 1. CREATING NEW EXAMINATION 'MID3' ---");
    const payload = {
      examName: 'MID3 Final Test',
      subject: 'Finite Automata',
      examDate: '2026-09-09',
      startTime: '10:00 AM',
      latestAllowedStartTime: '10:05 AM',
      endTime: '10:35 AM',
      durationMinutes: 30,
      totalQuestions: 20,
      marksPerQuestion: 1,
      passingPercentage: 40
    };

    const createRes = await fetch('http://localhost:5000/api/admin/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const createData = await createRes.json();
    console.log('Create Exam Status:', createRes.status);
    console.log('Created Exam ID:', createData.exam ? createData.exam.examId : 'N/A');

    console.log("\n--- 2. VERIFYING ADMIN DASHBOARD SCHEDULES (GET /api/admin/exams) ---");
    const adminRes = await fetch('http://localhost:5000/api/admin/exams');
    const adminData = await adminRes.json();
    console.log('Admin Scheduled Exams Total:', adminData.exams ? adminData.exams.length : 0);
    const latestAdminExam = adminData.exams ? adminData.exams[0] : null;
    console.log('Latest Admin Exam:', latestAdminExam ? { examId: latestAdminExam.examId, name: latestAdminExam.examName, status: latestAdminExam.status } : 'None');

    console.log("\n--- 3. VERIFYING STUDENT DASHBOARD SCHEDULES (GET /api/exams/schedules) ---");
    const studentRes = await fetch('http://localhost:5000/api/exams/schedules?regNo=24HP1A0565');
    const studentData = await studentRes.json();
    console.log('Student Dashboard Schedules Total:', studentData.schedules ? studentData.schedules.length : 0);
    const latestStudentExam = studentData.schedules ? studentData.schedules[0] : null;
    console.log('Latest Student Exam Card:', latestStudentExam ? { examId: latestStudentExam.examId, subject: latestStudentExam.subject, studentStatus: latestStudentExam.studentStatus } : 'None');

    if (latestAdminExam && latestStudentExam && latestStudentExam.studentStatus === 'AVAILABLE') {
      console.log('\n🎉 SUCCESS! Created exam is now LIVE and AVAILABLE on both Admin and Student Dashboards!');
    } else {
      console.log('\n⚠️ Check status values.');
    }
  } catch (err) {
    console.error('Error during verification:', err);
  }
}

verifyExamCreationAndDisplay();
