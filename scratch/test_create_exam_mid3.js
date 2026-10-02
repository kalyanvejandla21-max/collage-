async function testCreateExamMID3() {
  try {
    const payload = {
      examName: 'MID3',
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

    const res = await fetch('http://localhost:5000/api/admin/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('HTTP Status:', res.status);
    console.log('Created Exam Data:', data);

    // Verify it appears in GET /api/admin/exams
    const getRes = await fetch('http://localhost:5000/api/admin/exams');
    const getData = await getRes.json();
    console.log('\nAll Scheduled Exams Count:', getData.exams ? getData.exams.length : 0);
    if (getData.exams) {
      console.log('Scheduled Exams List:', getData.exams.map(e => ({ examId: e.examId, examName: e.examName, subject: e.subject })));
    }
  } catch (err) {
    console.error('Error creating exam:', err);
  }
}

testCreateExamMID3();
