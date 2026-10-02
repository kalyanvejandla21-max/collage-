const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const connectDB = require('../config/db');

async function fixAllStudentPasswords() {
  const defaultHash = bcrypt.hashSync('AIET@123', 10);

  // 1. Update data/students_master.json
  const masterPath = path.join(__dirname, '..', 'data', 'students_master.json');
  if (fs.existsSync(masterPath)) {
    const masterList = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    const cleanMasterList = masterList.map(s => {
      delete s.password;
      s.passwordHash = defaultHash;
      return s;
    });
    fs.writeFileSync(masterPath, JSON.stringify(cleanMasterList, null, 2), 'utf8');
    console.log(`✅ Updated ${cleanMasterList.length} records in students_master.json with hashed AIET@123 passwords.`);
  }

  // 2. Update MongoDB collection
  await connectDB();
  const result = await Student.updateMany(
    { role: 'STUDENT' },
    {
      $set: { passwordHash: defaultHash },
      $unset: { password: "" }
    }
  );
  console.log(`✅ Updated MongoDB student collection: matched ${result.matchedCount}, modified ${result.modifiedCount} records.`);

  // 3. Test verification for 10 random students
  const sampleRegs = ['24HP1A0501', '24HP1A0502', '24HP1A0541', '25HP1A4401', '25HP1A4411', '25HP1A0569', '24HP1A0569', '24HP1A0484', '24HP1A1263', '24HP1A1265'];
  console.log("\n🧪 Verification of 10 random students with password 'AIET@123':");
  for (const reg of sampleRegs) {
    const doc = await Student.findOne({ regNo: reg });
    if (doc) {
      const isMatch = doc.comparePassword('AIET@123');
      console.log(`  - ${reg} (${doc.name}): ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    } else {
      console.log(`  - ${reg}: ❌ NOT FOUND IN DB`);
    }
  }

  await mongoose.disconnect();
}

fixAllStudentPasswords().catch(console.error);
