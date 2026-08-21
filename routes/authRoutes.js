const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

// Sample student name map fallback helper
const studentNameMap = {
  "23A91A0501": "Kalyan",
  "24HP1A0541": "Kalyan",
  "24HPA10541": "Kalyan",
  "24HP1A0564": "G. Uday Kiran",
  "24HPA10564": "G. Uday Kiran"
};

const sampleStudentNames = [
  "A. Sai Ram", "B. Vamsi Krishna", "Ch. Harika", "D. Suresh Kumar", "E. Priyanka",
  "G. Uday Kiran", "H. Tejaswini", "J. Mahesh", "K. Kalyan", "L. Niharika",
  "M. Harsha Vardhan", "N. Divya", "P. Rakesh", "R. Bhavana", "S. Dinesh",
  "T. Anusha", "V. Sai Teja", "Y. Ramya", "A. Manoj Kumar", "B. Kavya"
];

function resolveStudentName(regNo) {
  const cleanReg = regNo.trim().toUpperCase();
  if (studentNameMap[cleanReg]) return studentNameMap[cleanReg];
  
  let numericPart = cleanReg.replace(/\D/g, '');
  if (numericPart.length >= 2) {
    const num = parseInt(numericPart.slice(-3), 10);
    if (!isNaN(num)) {
      return sampleStudentNames[num % sampleStudentNames.length];
    }
  }
  return "Student (" + cleanReg + ")";
}

// POST /api/auth/login - Student Login (Finds or Creates Student in MongoDB with Strict Validation)
router.post('/login', async (req, res) => {
  try {
    const { regNo, password } = req.body;
    if (!regNo) {
      return res.status(400).json({ success: false, message: 'Invalid Roll Number! Only registered students can access the exam.' });
    }

    const cleanReg = regNo.trim().toUpperCase();

    // 1. Strict Roll Number Range Validation (24HPA10501 - 24HPA10566)
    const rollMatch = cleanReg.match(/^24HPA105(\d{2})$/);
    if (!rollMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid Roll Number! Only registered students can access the exam.' 
      });
    }
    const rollNum = parseInt(rollMatch[1], 10);
    if (rollNum < 1 || rollNum > 66) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid Roll Number! Only registered students can access the exam.' 
      });
    }

    // 2. Strict Password Validation (Min 8 chars, 1 Uppercase, 1 Special Symbol)
    const passStr = password || '';
    const hasMinLen = passStr.length >= 8;
    const hasUpper = /[A-Z]/.test(passStr);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passStr);

    if (!hasMinLen || !hasUpper || !hasSymbol) {
      return res.status(400).json({
        success: false,
        message: 'Password must have 8+ characters, 1 uppercase, 1 symbol'
      });
    }

    let student = await Student.findOne({ regNo: cleanReg });

    if (!student) {
      const derivedName = resolveStudentName(cleanReg);
      student = await Student.create({
        regNo: cleanReg,
        name: derivedName,
        year: 'III B.Tech',
        section: 'A',
        password: passStr
      });
      console.log(`📌 Created new student record in MongoDB: ${cleanReg} - ${derivedName}`);
    }

    res.json({
      success: true,
      message: 'Login successful',
      student: {
        id: student._id,
        regNo: student.regNo,
        name: student.name,
        year: student.year,
        section: student.section
      }
    });
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/students - List all registered students
router.get('/students', async (req, res) => {
  try {
    const students = await Student.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: students.length, students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
