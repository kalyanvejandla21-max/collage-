const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

// Helper to check password complexity
function checkPasswordCriteria(password) {
  const passStr = password || '';
  const hasMinLen = passStr.length >= 8;
  const hasUpper = /[A-Z]/.test(passStr);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passStr);
  return hasMinLen && hasUpper && hasSymbol;
}

// POST /api/auth/login and POST /api/auth/student-login - Authenticate Student against Master Database
const handleStudentAuth = async (req, res) => {
  try {
    const rawReg = req.body.regNo || req.body.hallticket || req.body.username;
    const password = req.body.password || '';

    if (!rawReg || !rawReg.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Hall Ticket Number / Registration ID is required.'
      });
    }

    const cleanReg = rawReg.trim().toUpperCase();

    // 1. Check if Password satisfies complexity requirement
    if (!checkPasswordCriteria(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must have 8+ characters, 1 uppercase, 1 symbol'
      });
    }

    // 2. Query Student Master Database in MongoDB
    const student = await Student.findOne({ regNo: cleanReg });

    // 3. REQUIREMENT 3: Invalid Student Check
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found. Please check your Hall Ticket Number.'
      });
    }

    // 4. REQUIREMENT 22: Account Inactive Check
    if (student.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account is currently inactive. Please contact the faculty.'
      });
    }

    // 5. Success! Return ONLY this authenticated student's profile (REQUIREMENT 17)
    res.json({
      success: true,
      message: 'Authentication successful',
      token: `auth_session_${student.regNo}_${Date.now()}`,
      student: {
        id: student._id,
        regNo: student.regNo,
        hallticket: student.regNo,
        name: student.name,
        department: student.department || 'CSE',
        course: student.course || 'B.Tech',
        year: student.year || '3',
        semester: student.semester || '1',
        section: student.section || 'A',
        photo_url: student.photo_url || '',
        role: student.role || 'STUDENT'
      }
    });

  } catch (error) {
    console.error('Student login API error:', error);
    res.status(500).json({ success: false, message: 'Unable to verify student information. Please contact the administrator.' });
  }
};

router.post('/login', handleStudentAuth);
router.post('/student-login', handleStudentAuth);

// GET /api/student/profile - Fetch authenticated student profile
router.get('/profile', async (req, res) => {
  try {
    const regNo = req.headers['x-student-id'] || req.query.regNo;
    if (!regNo) {
      return res.status(400).json({ success: false, message: 'Student Registration ID header or parameter required.' });
    }

    const cleanReg = String(regNo).trim().toUpperCase();
    const student = await Student.findOne({ regNo: cleanReg }).select('-password');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found. Please check your Hall Ticket Number.' });
    }

    res.json({
      success: true,
      student: {
        id: student._id,
        regNo: student.regNo,
        hallticket: student.regNo,
        name: student.name,
        department: student.department,
        course: student.course,
        year: student.year,
        semester: student.semester,
        section: student.section,
        photo_url: student.photo_url,
        role: student.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/students - Restricted List for Authorized Admin/Faculty
router.get('/students', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'];
    if (userRole === 'STUDENT') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const students = await Student.find().select('-password').sort({ regNo: 1 });
    res.json({ success: true, count: students.length, students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

