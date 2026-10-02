require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const fs = require('fs');
const path = require('path');

async function testPasswords() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aiet_exam_db');
  
  const student = await Student.findOne({ regNo: '25HP1A4401' });
  console.log("Student 25HP1A4401 passwordHash:", student.passwordHash);

  const testPasswords = [
    '25HP1A4401',
    '25HP1A4401@',
    'AIET@123',
    'admin123',
    '25hp1a4401',
    '25HP1A4401@123',
    '25HP1A4401!'
  ];

  for (const pass of testPasswords) {
    const isMatch = bcrypt.compareSync(pass, student.passwordHash);
    console.log(`Password "${pass}":`, isMatch ? "✅ MATCH!" : "❌ NO");
  }

  await mongoose.disconnect();
}

testPasswords();
