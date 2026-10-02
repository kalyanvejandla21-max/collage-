const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const masterPath = path.join(__dirname, '..', 'data', 'students_master.json');
const students = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

// Generate hashes
const defaultHash = bcrypt.hashSync('AIET@123', 10);

console.log(`Migrating ${students.length} student records with bcrypt password hashes...`);

const updatedStudents = students.map(s => {
  const reg = (s.regNo || s.hallticket || '').toUpperCase();
  let plainPass = 'AIET@123';
  let hash = defaultHash;

  // Ensure hash is present
  delete s.password; // Do not store plaintext password
  s.passwordHash = hash;
  return s;
});

fs.writeFileSync(masterPath, JSON.stringify(updatedStudents, null, 2), 'utf8');
console.log(`✅ Successfully updated ${updatedStudents.length} master student records with bcrypt password hashes.`);
