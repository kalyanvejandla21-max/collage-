const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');

async function syncChunked() {
  console.log("Starting chunked bcrypt sync...");
  const masterPath = path.join(__dirname, '..', 'data', 'students_master.json');
  const masterList = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

  // Pre-generate a map of hashes per unique regNo
  const hashCache = {};
  console.log("Generating hashes for 803 master students...");
  for (let i = 0; i < masterList.length; i++) {
    const s = masterList[i];
    const reg = String(s.regNo || s.hallticket || '').trim().toUpperCase();
    if (!hashCache[reg]) {
      hashCache[reg] = bcrypt.hashSync(reg, 10);
    }
    s.regNo = reg;
    s.hallticket = reg;
    s.passwordHash = hashCache[reg];
    s.mustChangePassword = true;
    delete s.password;
  }

  fs.writeFileSync(masterPath, JSON.stringify(masterList, null, 2), 'utf8');
  console.log("✅ Updated students_master.json file.");

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aiet_exam_db');
  console.log("Connected to MongoDB.");

  const studentsInDb = await Student.find({ role: 'STUDENT' });
  console.log(`Updating ${studentsInDb.length} students in MongoDB...`);

  const bulkOps = studentsInDb.map(s => {
    const reg = String(s.regNo).trim().toUpperCase();
    const h = hashCache[reg] || bcrypt.hashSync(reg, 10);
    return {
      updateOne: {
        filter: { _id: s._id },
        update: {
          $set: { passwordHash: h, mustChangePassword: true },
          $unset: { password: "" }
        }
      }
    };
  });

  const res = await Student.bulkWrite(bulkOps);
  console.log(`✅ MongoDB bulkWrite finished: matched ${res.matchedCount}, modified ${res.modifiedCount}`);

  await mongoose.disconnect();
  console.log("ALL DONE!");
}

syncChunked().catch(console.error);
