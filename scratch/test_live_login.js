async function testLiveLogin() {
  try {
    const res = await fetch('http://localhost:5000/api/auth/student-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId: '24HPA10566',
        password: '24HP1A0566'
      })
    });

    const data = await res.json();
    console.log('HTTP Status:', res.status);
    console.log('Response Payload:', data);
  } catch (err) {
    console.error('Error testing live login:', err);
  }
}

testLiveLogin();
