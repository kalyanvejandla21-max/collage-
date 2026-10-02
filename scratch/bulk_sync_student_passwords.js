const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const connectDB = require('../config/db');

async function bulkSyncStudentPasswords() {
  console.log("==================================================================");
  console.log("⚡ FAST BULK SYNCING ALL 800+ STUDENT PASSWORDS & BCRYPT HASHES");
  console.log("==================================================================\n");

  const masterPath = path.join(__dirname, '..', 'data', 'students_master.json');
  if (!fs.existsSync(masterPath)) {
    console.error("❌ masterPath not found:", masterPath);
    process.exit(1);
  }

  const masterList = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  console.log(`📂 Loaded ${masterList.length} records from data/students_master.json`);

  let updatedMasterCount = 0;
  const cleanMasterList = masterList.map(s => {
    const reg = String(s.regNo || s.hallticket || '').trim().toUpperCase();
    s.regNo = reg;
    s.hallticket = reg;
    if (s.mustChangePassword !== false || !s.passwordHash || !String(s.passwordHash).startsWith('$2')) {
      delete s.password;
      s.passwordHash = bcrypt.hashSync(reg, 10);
      s.mustChangePassword = true;
      updatedMasterCount++;
    }
    return s;
  });

  fs.writeFileSync(masterPath, JSON.stringify(cleanMasterList, null, 2), 'utf8');
  console.log(`✅ Updated ${updatedMasterCount} default student records in data/students_master.json.`);

  await connectDB();

  const studentsInDb = await Student.find({ role: 'STUDENT' });
  console.log(`🗄️ Loaded ${studentsInDb.length} student documents from MongoDB`);

  const bulkOps = [];
  for (const s of studentsInDb) {
    const reg = String(s.regNo).trim().toUpperCase();
    if (s.mustChangePassword !== false || !s.passwordHash || !String(s.passwordHash).startsWith('$2')) {
      const newHash = bcrypt.hashSync(reg, 10);
      bulkOps.push({
        updateOne: {
          filter: { _id: s._id },
          update: {
            $set: { passwordHash: newHash, mustChangePassword: true },
            $unset: { password: "" }
          }
        }
      });
    }
  }

  if (bulkOps.length > 0) {
    console.log(`⚡ Executing bulkWrite for ${bulkOps.length} student records...`);
    const bulkRes = await Student.bulkWrite(bulkOps);
    console.log(`✅ Bulk write completed: matched ${bulkRes.matchedCount}, modified ${bulkRes.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log("✨ Fast bulk sync completed successfully.");
}

bulkSyncStudentPasswords().catch(console.error);
