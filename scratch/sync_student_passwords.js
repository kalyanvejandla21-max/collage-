const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const connectDB = require('../config/db');

async function syncAllStudentPasswords() {
  console.log("==================================================================");
  console.log("🔄 SYNCING ALL 800+ STUDENT PASSWORDS & BCRYPT HASHES");
  console.log("==================================================================\n");

  const masterPath = path.join(__dirname, '..', 'data', 'students_master.json');
  if (!fs.existsSync(masterPath)) {
    console.error("❌ masterPath not found:", masterPath);
    process.exit(1);
  }

  const masterList = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  console.log(`📂 Loaded ${masterList.length} records from data/students_master.json`);

  // 1. Re-hash default regNo password for master JSON records where mustChangePassword !== false
  let updatedMasterCount = 0;
  const cleanMasterList = masterList.map(s => {
    const reg = String(s.regNo || s.hallticket || '').trim().toUpperCase();
    s.regNo = reg;
    s.hallticket = reg;
    
    // Only set default hash if password hasn't been permanently changed by student
    if (s.mustChangePassword !== false || !s.passwordHash || !String(s.passwordHash).startsWith('$2')) {
      delete s.password;
      s.passwordHash = bcrypt.hashSync(reg, 10);
      s.mustChangePassword = true;
      updatedMasterCount++;
    }
    return s;
  });

  fs.writeFileSync(masterPath, JSON.stringify(cleanMasterList, null, 2), 'utf8');
  console.log(`✅ Updated ${updatedMasterCount} default student records in data/students_master.json with regNo bcrypt hashes.`);

  // 2. Connect to MongoDB and update Student collection
  await connectDB();

  const studentsInDb = await Student.find({ role: 'STUDENT' });
  console.log(`🗄️ Loaded ${studentsInDb.length} student documents from MongoDB`);

  let dbUpdatedCount = 0;
  for (const s of studentsInDb) {
    const reg = String(s.regNo).trim().toUpperCase();
    if (s.mustChangePassword !== false || !s.passwordHash || !String(s.passwordHash).startsWith('$2')) {
      const newHash = bcrypt.hashSync(reg, 10);
      s.passwordHash = newHash;
      s.password = undefined;
      s.mustChangePassword = true;
      await s.save();
      dbUpdatedCount++;
    }
  }

  console.log(`✅ Updated ${dbUpdatedCount} student records in MongoDB database (aiet_exam_db).\n`);

  await mongoose.disconnect();
  console.log("✨ Password sync completed successfully.");
}

syncAllStudentPasswords().catch(console.error);
