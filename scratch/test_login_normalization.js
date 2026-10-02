async function testLogin() {
  const inputsToTest = ['24HPA10566', '24HP1A0566', '24HPA1566', '24hp1a0566'];
  for (const id of inputsToTest) {
    let cleanReg = id.toUpperCase().trim().replace(/[\s\-]/g, '');
    cleanReg = cleanReg.replace(/HPA10?/g, 'HP1A0').replace(/HPA1/g, 'HP1A').replace(/HP1A(\d{3})$/g, 'HP1A0$1');
    console.log(`Input: "${id}" => Normalized: "${cleanReg}"`);
  }
}

testLogin();
