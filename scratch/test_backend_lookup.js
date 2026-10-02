const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

function testBackendStudentLookup(rawReg) {
  const cleanReg = String(rawReg).trim().toUpperCase().replace(/[\s\-]/g, '');
  const normalizedReg = cleanReg.replace(/HPA10?/g, 'HP1A0').replace(/HPA1/g, 'HP1A').replace(/HP1A(\d{3})$/g, 'HP1A0$1');

  const masterPath = path.join(__dirname, '..', 'data', 'students_master.json');
  const masterList = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

  const found = masterList.find(s => {
    const r = String(s.regNo || s.hallticket || '').trim().toUpperCase().replace(/[\s\-]/g, '');
    const h = String(s.hallticket || s.regNo || '').trim().toUpperCase().replace(/[\s\-]/g, '');
    return r === cleanReg || h === cleanReg || r === normalizedReg || h === normalizedReg;
  });

  if (found) {
    console.log(`✅ Success! Input "${rawReg}" matched student: ${found.name} (${found.regNo})`);
  } else {
    console.log(`❌ Not found for input "${rawReg}"`);
  }
}

testBackendStudentLookup('24HPA10566');
testBackendStudentLookup('24HP1A0566');
