require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');

async function diagnose() {
  console.log("=== 1. ENVIRONMENT VARIABLES ===");
  console.log("MONGODB_URI:", process.env.MONGODB_URI ? "PRESENT" : "MISSING");
  console.log("PORT:", process.env.PORT ? "PRESENT" : "MISSING");
  console.log("JWT_SECRET:", process.env.JWT_SECRET ? "PRESENT" : "MISSING");
  console.log("Node version:", process.version);

  console.log("\n=== 2. MASTER JSON RECORD COUNT ===");
  const masterPath = path.join(__dirname, '..', 'data', 'students_master.json');
  let masterCount = 0;
  let sampleMasterStudents = [];
  if (fs.existsSync(masterPath)) {
    const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    masterCount = masterData.length;
    sampleMasterStudents = masterData.slice(0, 5);
    console.log("Master JSON total count:", masterCount);
    console.log("Sample master students:", sampleMasterStudents.map(s => ({ regNo: s.regNo || s.hallticket, name: s.name })));
  } else {
    console.log("Master JSON file NOT found at", masterPath);
  }

  console.log("\n=== 3. MONGODB CONNECTION & STUDENT COLLECTION ===");
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aiet_exam_db');
    console.log("Mongoose connection readyState:", mongoose.connection.readyState);
    console.log("Database name:", mongoose.connection.name);
    
    const dbCount = await Student.countDocuments();
    console.log("MongoDB Student collection count:", dbCount);

    const sampleDbStudents = await Student.find({ role: 'STUDENT' }).limit(10);
    console.log("\n=== 4. SAMPLE DB STUDENT RECORDS ===");
    for (const s of sampleDbStudents) {
      console.log({
        regNo: s.regNo,
        name: s.name,
        hasPassword: !!s.password,
        hasPasswordHash: !!s.passwordHash,
        passwordHashStart: s.passwordHash ? s.passwordHash.substring(0, 10) + '...' : 'NONE',
        mustChangePassword: s.mustChangePassword
      });

      // Test comparing password with regNo (e.g. 24HP1A0566)
      const testCandidatePass = s.regNo;
      const compareResult = s.comparePassword(testCandidatePass);
      console.log(`  -> comparePassword("${testCandidatePass}"):`, compareResult);

      // Test comparing with regNo + '@' or regNo + '!'
      const compareWithSymbol = s.comparePassword(testCandidatePass + '@');
      console.log(`  -> comparePassword("${testCandidatePass}@"):`, compareWithSymbol);
    }

  } catch (err) {
    console.error("MongoDB Connection Failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

diagnose();
