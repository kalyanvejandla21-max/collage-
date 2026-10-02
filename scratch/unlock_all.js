require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');

async function unlockAll() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aiet_exam_db');
  const res = await Student.updateMany(
    {},
    { $set: { accountStatus: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null } }
  );
  console.log(`Unlocked ${res.modifiedCount} accounts.`);
  await mongoose.disconnect();
}

unlockAll();
