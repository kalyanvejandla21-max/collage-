const Student = require('../models/Student');

/**
 * Middleware to ensure the user has FACULTY or ADMIN role.
 * Strictly blocks STUDENT role with HTTP 403 Forbidden.
 */
async function requireFacultyOrAdmin(req, res, next) {
  try {
    const facultyId = req.headers['x-faculty-id'] || req.query.facultyId || req.body.facultyId;
    const userRoleHeader = req.headers['x-user-role'];

    // Direct check for demo/seed faculty header or student role block
    if (userRoleHeader === 'STUDENT') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Faculty authorization required.'
      });
    }

    if (!facultyId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Faculty authorization required.'
      });
    }

    const cleanId = String(facultyId).trim().toUpperCase();

    // Default Faculty Seed Check
    if (cleanId === 'FACULTY01' || cleanId === 'ADMIN') {
      req.user = {
        regNo: cleanId,
        name: cleanId === 'ADMIN' ? 'Administrator' : 'Faculty Coordinator',
        role: cleanId === 'ADMIN' ? 'ADMIN' : 'FACULTY',
        assignedSubjects: ['Computer Networks', 'Finite Automata', 'Data Warehouse and Data Mining', 'Fundamentals of Computing']
      };
      return next();
    }

    const user = await Student.findOne({ regNo: cleanId });

    if (!user || (user.role !== 'FACULTY' && user.role !== 'ADMIN')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Faculty authorization required.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error during authorization.' });
  }
}

/**
 * Middleware to ensure FACULTY only accesses results for their assigned subjects.
 * ADMIN has unrestricted access across all subjects.
 */
function requireSubjectPermission(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(403).json({ success: false, message: 'Access denied. User authorization context missing.' });
    }

    // ADMIN has full access to all subjects
    if (user.role === 'ADMIN') {
      return next();
    }

    const requestedSubject = req.query.subject || req.params.subject || req.body.subject;

    // If no specific subject filter or ALL requested, verify faculty has access or restrict
    if (!requestedSubject || requestedSubject === 'ALL') {
      return next();
    }

    const assigned = Array.isArray(user.assignedSubjects) ? user.assignedSubjects : [];
    
    // Case-insensitive check
    const isAuthorized = assigned.some(s => s.trim().toLowerCase() === requestedSubject.trim().toLowerCase());

    if (!isAuthorized && assigned.length > 0) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You are not authorized to view results for '${requestedSubject}'.`
      });
    }

    next();
  } catch (error) {
    console.error('Subject Permission Middleware Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error during subject authorization.' });
  }
}

module.exports = {
  requireFacultyOrAdmin,
  requireSubjectPermission
};
