async function testApi() {
  const regNo = '24HP1A0544';
  const startRes = await fetch(`http://localhost:5000/api/exams/EXAM_CN_001/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regNo, studentName: 'Test Student' })
  });
  const startData = await startRes.json();
  console.log("=== START EXAM RESPONSE FOR 24HP1A0544 ON EXAM_CN_001 ===");
  console.log(JSON.stringify(startData, null, 2));
}

testApi().catch(console.error);
