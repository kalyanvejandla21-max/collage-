const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');
const fs = require('fs');

async function checkDuplicates() {
  await connectDB();
  
  // 1. Check MongoDB duplicates
  const pipeline = [
    { $group: { _id: '$regNo', count: { $sum: 1 }, docs: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ];
  const dbDuplicates = await Student.aggregate(pipeline);
  console.log('MongoDB Duplicate regNos count:', dbDuplicates.length);
  if (dbDuplicates.length > 0) {
    console.log('Duplicates:', dbDuplicates);
  }

  // 2. Check JSON duplicates
  const master = JSON.parse(fs.readFileSync('data/students_master.json', 'utf8'));
  const regCounts = {};
  master.forEach(s => {
    const r = (s.regNo || s.hallticket || '').trim().toUpperCase();
    regCounts[r] = (regCounts[r] || 0) + 1;
  });
  const jsonDuplicates = Object.entries(regCounts).filter(([k, v]) => v > 1);
  console.log('Master JSON Duplicate regNos count:', jsonDuplicates.length);
  if (jsonDuplicates.length > 0) {
    console.log('JSON Duplicates:', jsonDuplicates);
  }

  // 3. Check Indexes on Student model
  const indexes = await Student.collection.getIndexes();
  console.log('MongoDB Student Collection Indexes:', indexes);

  await mongoose.disconnect();
}

checkDuplicates().catch(console.error);
