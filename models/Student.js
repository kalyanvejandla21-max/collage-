const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  regNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    default: 'CSE',
    trim: true,
    uppercase: true
  },
  course: {
    type: String,
    default: 'B.Tech'
  },
  year: {
    type: String,
    default: '3'
  },
  semester: {
    type: String,
    default: '1'
  },
  section: {
    type: String,
    default: 'A',
    uppercase: true,
    trim: true
  },
  photo_url: {
    type: String,
    default: ''
  },
  password: {
    type: String
  },
  passwordHash: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['STUDENT', 'FACULTY', 'ADMIN'],
    default: 'STUDENT'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mustChangePassword: {
    type: Boolean,
    default: true
  },
  accountStatus: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'LOCKED'],
    default: 'ACTIVE'
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  },
  passwordChangedAt: {
    type: Date,
    default: null
  },
  assignedSubjects: [{
    type: String,
    trim: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to ensure passwordHash is populated via bcrypt
studentSchema.pre('save', function (next) {
  if (this.isModified('password') && this.password && !this.password.startsWith('$2')) {
    try {
      this.passwordHash = bcrypt.hashSync(this.password, 10);
      this.password = undefined;
    } catch (err) {
      console.warn('Bcrypt hashing warning:', err.message);
    }
  }
  next();
});

// Instance method to strictly verify candidate password against stored bcrypt hash
studentSchema.methods.comparePassword = function (candidatePassword) {
  const candidate = String(candidatePassword || '').trim();
  if (!candidate) return false;

  const targetHash = (this.passwordHash && this.passwordHash.startsWith('$2'))
    ? this.passwordHash
    : ((this.password && this.password.startsWith('$2')) ? this.password : null);

  if (targetHash) {
    try {
      return bcrypt.compareSync(candidate, targetHash);
    } catch (e) {
      return false;
    }
  }
  return false;
};

module.exports = mongoose.model('Student', studentSchema);
