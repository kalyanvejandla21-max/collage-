const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const connectDB = require('../config/db');

async function checkAllStudents() {
  const masterPath = path.join(__dirname, '..', 'data', 'students_master.json');
  const masterList = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

  console.log(`Total Master JSON Records: ${masterList.length}`);

  // Sample 10 students across the file
  const sampleIndices = [0, 10, 50, 100, 200, 300, 500, 700, 800, masterList.length - 1];
  console.log("\nSample JSON Records:");
  sampleIndices.forEach(idx => {
    if (masterList[idx]) {
      const s = masterList[idx];
      console.log(`[${idx}] regNo:${s.regNo || s.hallticket} | name:${s.name} | hasHash:${Boolean(s.passwordHash)} | hashPrefix:${s.passwordHash ? s.passwordHash.slice(0, 10) : 'NONE'}`);
    }
  });

  await connectDB();
  const dbCount = await Student.countDocuments();
  console.log(`\nTotal MongoDB Records: ${dbCount}`);

  console.log("\nSample MongoDB Records:");
  for (const idx of sampleIndices) {
    if (masterList[idx]) {
      const reg = (masterList[idx].regNo || masterList[idx].hallticket).toUpperCase();
      const doc = await Student.findOne({ regNo: reg });
      if (doc) {
        console.log(`DB regNo:${doc.regNo} | name:${doc.name} | hasHash:${Boolean(doc.passwordHash)} | hashPrefix:${doc.passwordHash ? doc.passwordHash.slice(0, 10) : 'NONE'} | plainPass:${doc.password}`);
      } else {
        console.log(`DB regNo:${reg} -> NOT FOUND IN MONGODB!`);
      }
    }
  }

  await mongoose.disconnect();
}

checkAllStudents().catch(console.error);
