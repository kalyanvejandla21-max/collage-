const mongoose = require('mongoose');
const Student = require('../models/Student');
const connectDB = require('../config/db');

async function checkAllHashes() {
  await connectDB();
  const students = await Student.find({ role: 'STUDENT' });
  console.log(`Total Student Records in DB: ${students.length}`);

  let validHashCount = 0;
  let missingHashCount = 0;
  let plainPassCount = 0;

  students.forEach(s => {
    const hasValidHash = s.passwordHash && s.passwordHash.startsWith('$2');
    if (hasValidHash) {
      validHashCount++;
    } else {
      missingHashCount++;
    }
    if (s.password && !s.password.startsWith('$2')) {
      plainPassCount++;
    }
  });

  console.log(`\nResults:`);
  console.log(`  - Students with valid bcrypt passwordHash ($2...): ${validHashCount}`);
  console.log(`  - Students with missing/invalid passwordHash: ${missingHashCount}`);
  console.log(`  - Students with plaintext password field: ${plainPassCount}`);

  await mongoose.disconnect();
}

checkAllHashes().catch(console.error);
