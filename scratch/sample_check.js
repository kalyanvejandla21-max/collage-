require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');

async function sampleCheck() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aiet_exam_db');
  
  const sample = await Student.find({ role: 'STUDENT' }).limit(5);

  for (const s of sample) {
    const reg = String(s.regNo).trim().toUpperCase();
    console.log(`Student ${reg} (${s.name}):`);
    console.log(`  - bcrypt.compareSync("${reg}", hash):`, bcrypt.compareSync(reg, s.passwordHash));
    console.log(`  - bcrypt.compareSync("${reg}@", hash):`, bcrypt.compareSync(reg + '@', s.passwordHash));
    console.log(`  - bcrypt.compareSync("AIET@123", hash):`, bcrypt.compareSync("AIET@123", s.passwordHash));
  }

  await mongoose.disconnect();
}

sampleCheck();
