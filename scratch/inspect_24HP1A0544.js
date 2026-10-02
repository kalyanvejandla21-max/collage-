require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');

async function inspectStudent() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aiet_exam_db');
  
  const student = await Student.findOne({ regNo: '24HP1A0544' });
  console.log("=== STUDENT 24HP1A0544 RECORD IN MONGODB ===");
  if (!student) {
    console.log("❌ Student 24HP1A0544 NOT FOUND IN MONGODB!");
  } else {
    console.log({
      regNo: student.regNo,
      name: student.name,
      password: student.password,
      passwordHash: student.passwordHash,
      mustChangePassword: student.mustChangePassword,
      accountStatus: student.accountStatus,
      failedLoginAttempts: student.failedLoginAttempts,
      lockedUntil: student.lockedUntil
    });

    const testPasswords = [
      '24HP1A0544',
      '24hp1a0544',
      '24HP1A0544@',
      '24HP1A0544!',
      'AIET@123',
      'admin123'
    ];

    console.log("\n=== TESTING PASSWORD MATCHES FOR 24HP1A0544 ===");
    for (const pass of testPasswords) {
      const isMatch = student.comparePassword(pass);
      console.log(`Password "${pass}":`, isMatch ? "✅ MATCH!" : "❌ NO");
    }
  }

  await mongoose.disconnect();
}

inspectStudent();
