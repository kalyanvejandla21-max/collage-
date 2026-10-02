const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');
const bcrypt = require('bcryptjs');

function validateLoginPassword(password) {
  const passStr = String(password || '');
  const lengthOk = passStr.length >= 8;
  const upperOk = /[A-Z]/.test(passStr);
  const symbolOk = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passStr);
  return lengthOk && upperOk && symbolOk;
}

function verifyStudentPassword(candidatePassword, student) {
  const candidate = String(candidatePassword || '').trim();
  if (!candidate) return false;

  const regNoUpper = String(student.regNo || student.hallticket || '').trim().toUpperCase();

  // 1. Roll number or roll number with symbol match
  if (candidate.toUpperCase() === regNoUpper || candidate.toUpperCase().replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, '') === regNoUpper) {
    return true;
  }

  // 2. Direct bcrypt hash comparison
  const hash = (student.passwordHash && String(student.passwordHash).startsWith('$2'))
    ? student.passwordHash
    : ((student.password && String(student.password).startsWith('$2')) ? student.password : null);

  if (hash) {
    try {
      if (bcrypt.compareSync(candidate, hash) || bcrypt.compareSync(candidate.toUpperCase(), hash)) {
        return true;
      }
    } catch (e) {
      return false;
    }
  }

  return false;
}

async function test() {
  await connectDB();
  const student = await Student.findOne({ regNo: '24HP1A0541' });
  console.log('Student found:', student ? student.name : 'No');

  const passwordsToTest = ['ddsb@DJFFJ', '24HP1A0541', '24HP1A0541@', '24HP1A0541!', 'AIET@123'];

  for (const p of passwordsToTest) {
    const fmt = validateLoginPassword(p);
    const ver = verifyStudentPassword(p, student);
    console.log(`Password: "${p}" -> FormatValid: ${fmt}, PasswordValid: ${ver}, LoginWillSucceed: ${fmt && ver}`);
  }

  await mongoose.disconnect();
}

test().catch(console.error);
