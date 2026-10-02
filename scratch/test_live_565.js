async function testLiveLogin565() {
  const tests = [
    { id: '24HP1A0565', pass: '24HP1A0565' },
    { id: '24HP1A0565', pass: '24HP1A0565@' },
    { id: '24HPA10565', pass: '24HP1A0565' },
    { id: '24HP1A0565', pass: '24hp1a0565' }
  ];

  for (const t of tests) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: t.id,
          password: t.pass
        })
      });
      const data = await res.json();
      console.log(`ID: "${t.id}" | Pass: "${t.pass}" => Status: ${res.status} | Success: ${data.success} | Name: ${data.student ? data.student.name : data.message}`);
    } catch (e) {
      console.error('Fetch error:', e);
    }
  }
}

testLiveLogin565();
