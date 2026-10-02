require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');

async function checkAllHashes() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aiet_exam_db');
  
  const students = await Student.find({ role: 'STUDENT' });
  console.log(`Total Student Records in DB: ${students.length}`);

  let matchRegNoCount = 0;
  let mismatchCount = 0;
  let missingHashCount = 0;

  for (const s of students) {
    if (!s.passwordHash || !s.passwordHash.startsWith('$2')) {
      missingHashCount++;
      continue;
    }

    const cleanReg = String(s.regNo).trim().toUpperCase();
    const isMatchReg = bcrypt.compareSync(cleanReg, s.passwordHash);

    if (isMatchReg) {
      matchRegNoCount++;
    } else {
      mismatchCount++;
      console.log(`Mismatch for student ${cleanReg} (${s.name}): passwordHash does not match regNo hash.`);
    }
  }

  console.log("\n=== HASH VALIDITY SUMMARY ===");
  console.log("Matches regNo default hash:", matchRegNoCount);
  console.log("Mismatches / Custom passwords:", mismatchCount);
  console.log("Missing passwordHash:", missingHashCount);

  await mongoose.disconnect();
}

checkAllHashes();
