const mongoose = require('mongoose');
const Student = require('../models/Student');
const connectDB = require('../config/db');

async function inspectStudent() {
  await connectDB();
  const student = await Student.findOne({ regNo: '24HP1A0501' });
  console.log("MongoDB Record for 24HP1A0501:", JSON.stringify(student, null, 2));

  const allCount = await Student.countDocuments();
  console.log("Total Student records in DB:", allCount);
  await mongoose.disconnect();
}

inspectStudent().catch(console.error);
