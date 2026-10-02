const fs = require('fs');
const path = require('path');

const masterPath = path.join(__dirname, '..', 'data', 'students_master.json');
const students = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

const cseStudents = students.filter(s => {
  const reg = s.regNo || s.hallticket || '';
  return reg.startsWith('24HP1A05');
});

console.log(`TOTAL_FOUND:${cseStudents.length}`);
cseStudents.forEach(s => {
  console.log(`${s.regNo || s.hallticket} | ${s.name} | ${s.department || 'CSE'} | Section ${s.section || 'A'}`);
});
