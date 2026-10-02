async function testUpcomingExamRules() {
  try {
    console.log("--- 1. CREATING UPCOMING EXAM SCHEDULED FOR TOMORROW AT 10:00 AM ---");
    const payload = {
      examName: 'Quantum Computing Unit 2',
      subject: 'Quantum Computing',
      examDate: '2026-09-10',
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
    const examId = createData.exam.examId;
    console.log('Created Exam ID:', examId);

    console.log("\n--- 2. VERIFYING STUDENT DASHBOARD STATUS BEFORE START TIME ---");
    const studentRes = await fetch('http://localhost:5000/api/exams/schedules?regNo=24HP1A0565');
    const studentData = await studentRes.json();
    const upcomingCard = studentData.schedules.find(s => s.examId === examId);
    console.log('Student Schedule Card:', upcomingCard ? { examId: upcomingCard.examId, subject: upcomingCard.subject, studentStatus: upcomingCard.studentStatus } : 'Not found');

    console.log("\n--- 3. ATTEMPTING TO START EXAM BEFORE 10:00 AM START TIME ---");
    const startRes = await fetch(`http://localhost:5000/api/exams/${encodeURIComponent(examId)}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regNo: '24HP1A0565', studentName: 'Test Student' })
    });

    const startData = await startRes.json();
    console.log('Start Exam Attempt Status:', startRes.status);
    console.log('Start Exam Response Code:', startData.code);
    console.log('Start Exam Response Message:', startData.message);

    if (startRes.status === 400 && startData.code === 'NOT_STARTED_YET') {
      console.log('\n🎉 SUCCESS! System correctly blocked early start before 10:00 AM and displayed the start time warning message!');
    } else {
      console.log('\n⚠️ Check response:', startData);
    }
  } catch (err) {
    console.error('Error during test:', err);
  }
}

testUpcomingExamRules();
