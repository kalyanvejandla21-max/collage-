require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');

async function checkTypes() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aiet_exam_db');
  
  const students = await Student.find({ role: 'STUDENT' });
  console.log(`Total Student Records in DB: ${students.length}`);

  let matchRegNo = 0;
  let matchAIET = 0;
  let otherCount = 0;

  for (const s of students) {
    const cleanReg = String(s.regNo).trim().toUpperCase();
    const hash = s.passwordHash;
    if (hash && hash.startsWith('$2')) {
      if (bcrypt.compareSync(cleanReg, hash)) {
        matchRegNo++;
      } else if (bcrypt.compareSync('AIET@123', hash)) {
        matchAIET++;
      } else {
        otherCount++;
      }
    }
  }

  console.log("=== RESULTS ===");
  console.log("Match regNo (e.g. 24HP1A0501):", matchRegNo);
  console.log("Match AIET@123:", matchAIET);
  console.log("Other/Unknown hashes:", otherCount);

  await mongoose.disconnect();
}

checkTypes();
