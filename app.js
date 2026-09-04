// API Base URL for Node.js Express Backend
const API_BASE_URL = 'http://localhost:5000/api';
let isBackendConnected = false;

// State Variables
let isLoggedIn = false;
let currentStudent = {
  name: "Kalyan",
  regNo: "23A91A0501",
  department: "CSE",
  course: "B.Tech",
  year: "3",
  semester: "1",
  section: "A",
  photo_url: "",
  role: "STUDENT"
};

// Roll Number to Student Name Database & Generator (Fallback)
const studentNameMap = {
  "23A91A0501": "Kalyan",
  "24HP1A0541": "Kalyan",
  "24HP1A0564": "G. Uday Kiran",
  "24HP1A0501": "A. Sai Ram"
};

const sampleStudentNames = [
  "A. Sai Ram", "B. Vamsi Krishna", "Ch. Harika", "D. Suresh Kumar", "E. Priyanka",
  "G. Uday Kiran", "H. Tejaswini", "J. Mahesh", "K. Kalyan", "L. Niharika",
  "M. Harsha Vardhan", "N. Divya", "P. Rakesh", "R. Bhavana", "S. Dinesh",
  "T. Anusha", "V. Sai Teja", "Y. Ramya", "A. Manoj Kumar", "B. Kavya",
  "C. Swathi", "D. Tarun", "G. Naveen", "K. Chaitanya", "M. Sravani",
  "N. Akhil", "P. Deepika", "R. Venkatesh", "S. Keerthi", "T. Rajesh",
  "V. Sneha", "K. Srikanth", "M. Rohith", "P. Meghana", "B. Sandeep",
  "Ch. Pawan Kalyan", "D. Varun Kumar", "E. Anjali", "G. Vishnu", "K. Monica",
  "M. Karthik", "N. Sandhya", "P. Vivek", "R. Pooja", "S. Charan",
  "T. Mounika", "V. Ajay", "Y. Madhav", "A. Sravan", "B. Preeti",
  "C. Jagadeesh", "D. Himaja", "G. Sairam", "K. Naveen Kumar", "M. Bindu",
  "N. Rakesh", "P. Sowmya", "R. Praveen", "S. Likitha", "T. Lokesh",
  "V. Manasa", "K. Nikhil", "M. Jyothi", "P. Sai Kumar", "B. Yashwanth"
];

function getStudentNameByRollNo(regNo) {
  const cleanReg = regNo.trim().toUpperCase();
  if (studentNameMap[cleanReg]) {
    return studentNameMap[cleanReg];
  }

  let numericPart = cleanReg.replace(/\D/g, '');
  if (numericPart.length >= 2) {
    const num = parseInt(numericPart.slice(-3), 10);
    if (!isNaN(num)) {
      const index = num % sampleStudentNames.length;
      return sampleStudentNames[index];
    }
  }

  let hash = 0;
  for (let i = 0; i < cleanReg.length; i++) {
    hash = (hash * 31 + cleanReg.charCodeAt(i)) % sampleStudentNames.length;
  }
  return sampleStudentNames[Math.abs(hash)];
}

let selectedSubject = "Computer Networks";
let currentQuestions = [];
let userAnswers = new Array(20).fill(null);
let reviewFlags = new Array(20).fill(false);
let hintsUsedFlags = new Array(20).fill(false);
let currentQIndex = 0;

let timerInterval = null;
let secondsRemaining = 20 * 60; // 20 Minutes

// Theme Enforcement (Default Standard Light Mode)
function initTheme() {
  localStorage.removeItem('aiet-theme');
  localStorage.removeItem('aliet_theme');
  document.documentElement.removeAttribute('data-theme');
}

function toggleTheme() {}
function applyTheme(theme) {
  document.documentElement.removeAttribute('data-theme');
}

// --- ROLL NUMBER & PASSWORD VALIDATION LOGIC ---

// Roll Number Range Validation (24HP1A0501 to 24HP1A0566 - total 66 students)
function isValidRollNumber(regNo) {
  if (!regNo) return false;
  const cleanReg = regNo.trim().toUpperCase();
  const match = cleanReg.match(/^24HP1A05(\d{2})$/);
  if (!match) return false;
  const num = parseInt(match[1], 10);
  return num >= 1 && num <= 66;
}

// Password Criteria Check (8+ chars, 1 uppercase, 1 special symbol)
function checkPasswordCriteria(password) {
  const passStr = password || '';
  const lengthOk = passStr.length >= 8;
  const upperOk = /[A-Z]/.test(passStr);
  const symbolOk = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passStr);
  const isValid = lengthOk && upperOk && symbolOk;
  return { isValid, lengthOk, upperOk, symbolOk };
}

// Real-time Password Validation Hints Updater
function validatePasswordRealtime() {
  const passwordInput = document.getElementById('password');
  if (!passwordInput) return;
  const val = passwordInput.value;
  const { lengthOk, upperOk, symbolOk } = checkPasswordCriteria(val);

  updateHintItem('hint-length', lengthOk, '8+ characters');
  updateHintItem('hint-upper', upperOk, '1 uppercase letter');
  updateHintItem('hint-symbol', symbolOk, '1 symbol (@, #, $, !, %, etc.)');
}

function updateHintItem(elementId, isMet, textLabel) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (isMet) {
    el.className = 'hint-item valid';
    el.innerHTML = `<i class="fa-solid fa-circle-check status-icon"></i> <span>${textLabel}</span>`;
  } else {
    el.className = 'hint-item invalid';
    el.innerHTML = `<i class="fa-solid fa-circle-xmark status-icon"></i> <span>${textLabel}</span>`;
  }
}

// Show/Hide Password Toggle
function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('toggle-password-icon');
  if (!passwordInput || !toggleIcon) return;

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.className = 'fa-solid fa-eye-slash';
  } else {
    passwordInput.type = 'password';
    toggleIcon.className = 'fa-solid fa-eye';
  }
}

// Display Error Message Banner on Login Card
function showLoginError(msg) {
  const errorContainer = document.getElementById('login-error-container');
  const errorMsg = document.getElementById('login-error-msg');
  if (errorContainer && errorMsg) {
    errorMsg.innerText = msg;
    errorContainer.style.display = 'flex';
    errorContainer.classList.add('shake-anim');
    setTimeout(() => errorContainer.classList.remove('shake-anim'), 500);
  }
}

// Clear Error Message Banner
function clearLoginError() {
  const errorContainer = document.getElementById('login-error-container');
  if (errorContainer) {
    errorContainer.style.display = 'none';
  }
}

// Check Node.js Express & MongoDB Backend Health
async function checkBackendStatus() {
  const statusBadge = document.getElementById('backend-status-badge');
  const statusText = document.getElementById('backend-status-text');
  
  if (!statusBadge || !statusText) return;

  try {
    const response = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const data = await response.json();
      isBackendConnected = true;
      statusBadge.className = 'status-pill-badge online';
      statusText.innerHTML = `<i class="fa-solid fa-database"></i> Node.js & MongoDB Connected`;
      console.log('✅ Connected to Express & MongoDB backend API');
    } else {
      throw new Error('Backend health check returned non-200');
    }
  } catch (err) {
    isBackendConnected = false;
    statusBadge.className = 'status-pill-badge offline';
    statusText.innerHTML = `<i class="fa-solid fa-plug-circle-exclamation"></i> Local Server Mode`;
    console.warn('⚠️ Node.js backend server not detected, using local client memory.');
  }
}

// Page Router
function showPage(pageId) {
  document.querySelectorAll('.page-view').forEach(page => {
    page.classList.remove('active');
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // Toggle Header User Badge
  const headerBadge = document.getElementById('header-user-badge');
  if (pageId === 'login-page') {
    headerBadge.style.display = 'none';
  } else {
    headerBadge.style.display = 'flex';
  }

  if (pageId === 'dashboard-page') {
    loadStudentExamSchedules();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update UI Headers & Profile Cards across all screens
function updateStudentProfileUI() {
  if (!currentStudent) return;

  const studentName = currentStudent.name || 'Student';
  const regNo = currentStudent.regNo || currentStudent.hallticket || '';
  const dept = currentStudent.department || 'CSE';
  const yearStr = currentStudent.year || '3';
  const semStr = currentStudent.semester || '1';
  const sectionStr = currentStudent.section || 'A';
  const photoUrl = currentStudent.photo_url || '';

  // Top-Right Header Elements
  const headerName = document.getElementById('header-student-name');
  const headerReg = document.getElementById('header-student-reg');
  const headerDept = document.getElementById('header-student-dept');
  const headerPhoto = document.getElementById('header-student-photo');
  const avatarInitials = document.getElementById('avatar-initials');

  if (headerName) headerName.innerText = studentName;
  if (headerReg) headerReg.innerText = regNo;
  if (headerDept) headerDept.innerText = dept;

  if (avatarInitials) {
    avatarInitials.innerText = studentName.charAt(0).toUpperCase();
  }

  if (headerPhoto) {
    if (photoUrl && photoUrl.trim().length > 0) {
      headerPhoto.src = photoUrl;
      headerPhoto.style.display = 'block';
      if (avatarInitials) avatarInitials.style.display = 'none';
    } else {
      headerPhoto.style.display = 'none';
      if (avatarInitials) avatarInitials.style.display = 'flex';
    }
  }

  // Dashboard Page Elements
  const dashName = document.getElementById('dash-student-name');
  const dashReg = document.getElementById('dash-reg-no');
  const dashYear = document.getElementById('dash-student-year');
  const dashSec = document.getElementById('dash-student-sec');

  if (dashName) dashName.innerText = studentName;
  if (dashReg) dashReg.innerText = regNo;
  if (dashYear) dashYear.innerText = `Year ${yearStr} • Semester ${semStr}`;
  if (dashSec) dashSec.innerText = `${dept} - Section ${sectionStr}`;

  // Exam Page Elements
  const examName = document.getElementById('exam-student-name');
  const examReg = document.getElementById('exam-reg-no');
  if (examName) examName.innerText = studentName;
  if (examReg) examReg.innerText = regNo;

  // Result Page Elements
  const resName = document.getElementById('res-student-name');
  const resReg = document.getElementById('res-reg-no');
  if (resName) resName.innerText = studentName;
  if (resReg) resReg.innerText = regNo;
}

// Page 1: Login Handler (Strict Student Master Database Authentication)
async function handleLogin() {
  clearLoginError();
  const studentIdInput = document.getElementById('student-id')?.value.trim() || '';
  const passwordInput = document.getElementById('password')?.value || '';

  if (!studentIdInput) {
    showLoginError("Please enter your Hall Ticket Number.");
    return;
  }

  // 1. Password Criteria Check (8+ chars, 1 uppercase, 1 symbol)
  const passCheck = checkPasswordCriteria(passwordInput);
  if (!passCheck.isValid) {
    showLoginError("Password must have 8+ characters, 1 uppercase, 1 symbol");
    return;
  }

  const cleanReg = studentIdInput.toUpperCase();

  try {
    const res = await fetch(`${API_BASE_URL}/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regNo: cleanReg, password: passwordInput })
    });

    const data = await res.json();

    if (!res.ok || !data.success || !data.student) {
      // REQUIREMENT 3 & 22: Display clear error message from backend
      showLoginError(data.message || "Student record not found. Please check your Hall Ticket Number.");
      return;
    }

    // REQUIREMENT 4 & 5: Populate student profile from authenticated database record
    currentStudent = {
      id: data.student.id,
      regNo: data.student.regNo || cleanReg,
      hallticket: data.student.hallticket || cleanReg,
      name: data.student.name || 'Student',
      department: data.student.department || 'CSE',
      course: data.student.course || 'B.Tech',
      year: data.student.year || '3',
      semester: data.student.semester || '1',
      section: data.student.section || 'A',
      photo_url: data.student.photo_url || '',
      role: data.student.role || 'STUDENT'
    };

    if (data.token) {
      sessionStorage.setItem('student_auth_token', data.token);
    }

  } catch (e) {
    console.error("Backend student login fetch error:", e);
    showLoginError("Unable to verify student information. Please check server connection.");
    return;
  }

  isLoggedIn = true;

  // REQUIREMENT 6, 7 & 9: Update student profile in top-right corner & dashboard
  updateStudentProfileUI();

  showPage('dashboard-page');
}

// Page 2: Dashboard Subject Selection
function selectSubject(cardElement) {
  document.querySelectorAll('.subject-card').forEach(card => {
    card.classList.remove('selected');
    card.querySelector('input[type="radio"]').checked = false;
  });

  cardElement.classList.add('selected');
  const radio = cardElement.querySelector('input[type="radio"]');
  radio.checked = true;
  selectedSubject = radio.value;
}

// Fisher-Yates Randomization Utilities for Question & Option Shuffling
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function prepareRandomizedExamPaper(questionsPool, limit = 20) {
  if (!questionsPool || questionsPool.length === 0) return [];
  
  // 1. Randomly sample 20 questions out of total pool
  const sampled = shuffleArray(questionsPool).slice(0, limit);

  // 2. Shuffle question order & options while preserving correct answer index
  return sampled.map((q, idx) => {
    const options = Array.isArray(q.options) ? [...q.options] : [];
    const correctIdx = typeof q.correct === 'number' ? q.correct : 0;
    const correctText = options[correctIdx] || options[0];

    const shuffledOpts = shuffleArray(options);
    const newCorrectIdx = shuffledOpts.indexOf(correctText);

    return {
      id: q.id || q.questionId || (idx + 1),
      questionId: q.questionId || q.id || (idx + 1),
      subject: q.subject || selectedSubject,
      question: q.question,
      options: shuffledOpts,
      correct: newCorrectIdx !== -1 ? newCorrectIdx : 0,
      explanation: q.explanation || ''
    };
  });
}

// ==========================================================================
// EXAM SECURITY SYSTEM & ANTI-CHEATING ENGINE
// ==========================================================================
const MAX_VIOLATIONS = 3;
let isExamSecurityActive = false;
let fullscreenExitCount = 0;
let tabSwitchCount = 0;
let totalViolationsCount = 0;
let securityLogs = [];
let wasFullscreenActiveBeforeExit = false;
let isSecurityModalOpen = false;

// Request Browser Fullscreen Mode
function requestExamFullscreen() {
  const docEl = document.documentElement;
  if (!docEl) return Promise.resolve();

  try {
    if (docEl.requestFullscreen) {
      return docEl.requestFullscreen();
    } else if (docEl.webkitRequestFullscreen) {
      return docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
      return docEl.msRequestFullscreen();
    }
  } catch (err) {
    console.warn("Fullscreen request blocked or not supported:", err);
  }
  return Promise.resolve();
}

function exitExamFullscreen() {
  try {
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen && document.webkitFullscreenElement) {
      document.webkitExitFullscreen();
    }
  } catch (e) {
    // Ignore exit errors
  }
}

function isFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
}

// Reset Security State for New Exam Session
function resetSecurityState() {
  fullscreenExitCount = 0;
  tabSwitchCount = 0;
  totalViolationsCount = 0;
  securityLogs = [];
  isExamSecurityActive = true;
  isSecurityModalOpen = false;
  wasFullscreenActiveBeforeExit = true;
  updateSecurityBadgesUI();
}

// Update UI Indicators on Top Exam Bar
function updateSecurityBadgesUI() {
  const fsExitEl = document.getElementById('fs-exit-count-display');
  const tabSwitchEl = document.getElementById('tab-switch-count-display');
  const violationsEl = document.getElementById('violations-count-display');
  const maxViolationsEl = document.getElementById('max-violations-display');
  const pillEl = document.getElementById('fullscreen-status-pill');

  if (fsExitEl) fsExitEl.innerText = fullscreenExitCount;
  if (tabSwitchEl) tabSwitchEl.innerText = tabSwitchCount;
  if (violationsEl) violationsEl.innerText = totalViolationsCount;
  if (maxViolationsEl) maxViolationsEl.innerText = MAX_VIOLATIONS;

  if (pillEl) {
    if (isFullscreenActive()) {
      pillEl.className = 'sec-indicator-pill active';
      pillEl.innerHTML = `<i class="fa-solid fa-lock"></i> <span>🔒 Fullscreen Exam Mode</span>`;
    } else {
      pillEl.className = 'sec-indicator-pill warning-active';
      pillEl.innerHTML = `<i class="fa-solid fa-unlock"></i> <span>⚠️ Fullscreen Exited</span>`;
    }
  }
}

// Security Event Record & Timestamp Generator
function logSecurityEvent(eventType) {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const eventEntry = {
    eventType,
    timestamp,
    count: securityLogs.length + 1
  };
  securityLogs.push(eventEntry);
  console.warn(`🛡️ Exam Security Logged: [${eventEntry.count}] ${eventType} — ${timestamp}`);
  return eventEntry;
}

// Trigger Security Warning Modal
function triggerSecurityWarning(type, customTitle, customMsg) {
  if (!isExamSecurityActive) return;

  totalViolationsCount++;
  
  if (type === 'FULLSCREEN_EXIT') {
    fullscreenExitCount++;
    logSecurityEvent('Fullscreen exited');
  } else if (type === 'TAB_SWITCH') {
    tabSwitchCount++;
    logSecurityEvent('Tab switched / Focus lost');
  }

  updateSecurityBadgesUI();
  renderSecurityModal(type, customTitle, customMsg);
}

function renderSecurityModal(type, customTitle, customMsg) {
  const modal = document.getElementById('security-warning-modal');
  if (!modal) return;

  isSecurityModalOpen = true;

  const titleEl = document.getElementById('sec-modal-title');
  const badgeEl = document.getElementById('sec-warning-level-badge');
  const msgEl = document.getElementById('sec-modal-message');
  const fsValEl = document.getElementById('sec-modal-fs-count');
  const tabValEl = document.getElementById('sec-modal-tab-count');
  const violValEl = document.getElementById('sec-modal-violations-count');
  const reFsBtn = document.getElementById('btn-re-fullscreen');
  const logListEl = document.getElementById('sec-modal-log-list');

  // Progressive Warning Level
  let severityClass = 'severity-1';
  let warningBadgeText = `Warning ${Math.min(totalViolationsCount, MAX_VIOLATIONS)} of ${MAX_VIOLATIONS}`;

  if (totalViolationsCount >= MAX_VIOLATIONS) {
    severityClass = 'severity-3';
    warningBadgeText = `Final Warning: Max Violations (${totalViolationsCount}/${MAX_VIOLATIONS})`;
  } else if (totalViolationsCount === 2) {
    severityClass = 'severity-2';
    warningBadgeText = `Strong Warning: Violation ${totalViolationsCount} of ${MAX_VIOLATIONS}`;
  }

  if (badgeEl) {
    badgeEl.className = `warning-level-badge ${severityClass}`;
    badgeEl.innerText = warningBadgeText;
  }

  // Titles & Messages
  if (type === 'FULLSCREEN_EXIT') {
    titleEl.innerHTML = `⚠️ Fullscreen Mode Exited`;
    msgEl.innerText = customMsg || `You have exited fullscreen mode. Please return to fullscreen mode to continue your examination.`;
    if (reFsBtn) reFsBtn.style.display = 'flex';
  } else {
    titleEl.innerHTML = `🚫 Exam Security Warning`;
    msgEl.innerText = customMsg || `You have left the examination window. Please remain on the examination screen throughout the exam.`;
    if (reFsBtn) reFsBtn.style.display = isFullscreenActive() ? 'none' : 'flex';
  }

  if (fsValEl) fsValEl.innerText = fullscreenExitCount;
  if (tabValEl) tabValEl.innerText = tabSwitchCount;
  if (violValEl) violValEl.innerText = `${totalViolationsCount} / ${MAX_VIOLATIONS}`;

  // Render Log Timeline
  if (logListEl) {
    logListEl.innerHTML = '';
    if (securityLogs.length === 0) {
      logListEl.innerHTML = `<div class="sec-log-empty">No violations logged yet.</div>`;
    } else {
      securityLogs.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'sec-log-item';
        div.innerHTML = `
          <span><strong>${index + 1}.</strong> ${item.eventType}</span>
          <span class="time-tag"><i class="fa-regular fa-clock"></i> ${item.timestamp}</span>
        `;
        logListEl.appendChild(div);
      });
    }
  }

  modal.classList.add('active');
}

function dismissSecurityWarning() {
  const modal = document.getElementById('security-warning-modal');
  if (modal) modal.classList.remove('active');
  isSecurityModalOpen = false;

  // If user is not in fullscreen, attempt to re-enter
  if (isExamSecurityActive && !isFullscreenActive()) {
    requestExamFullscreen().catch(err => console.log("Re-fullscreen on dismiss ignored:", err));
  }
}

function returnToFullscreen() {
  dismissSecurityWarning();
  requestExamFullscreen().catch(err => console.log("Re-fullscreen ignored:", err));
}

// Event Listeners for Fullscreen Exit and Tab/Blur Detection
function handleFullscreenChangeEvent() {
  if (!isExamSecurityActive) return;

  const inFullscreen = isFullscreenActive();
  updateSecurityBadgesUI();

  if (!inFullscreen && wasFullscreenActiveBeforeExit && !isSecurityModalOpen) {
    triggerSecurityWarning(
      'FULLSCREEN_EXIT',
      '⚠️ Fullscreen Mode Exited',
      'You have exited fullscreen mode. Please return to fullscreen mode to continue your examination.'
    );
  }

  wasFullscreenActiveBeforeExit = inFullscreen;
}

function handleVisibilityAndBlurEvent() {
  if (!isExamSecurityActive) return;

  if (document.hidden || !document.hasFocus()) {
    if (!isSecurityModalOpen) {
      triggerSecurityWarning(
        'TAB_SWITCH',
        '🚫 Exam Security Warning',
        'You have left the examination window. Please remain on the examination screen throughout the exam.'
      );
    }
  }
}

function setupSecurityEventListeners() {
  document.addEventListener('fullscreenchange', handleFullscreenChangeEvent);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChangeEvent);
  document.addEventListener('msfullscreenchange', handleFullscreenChangeEvent);

  document.addEventListener('visibilitychange', handleVisibilityAndBlurEvent);
  window.addEventListener('blur', handleVisibilityAndBlurEvent);
}

function removeSecurityEventListeners() {
  isExamSecurityActive = false;
  document.removeEventListener('fullscreenchange', handleFullscreenChangeEvent);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChangeEvent);
  document.removeEventListener('msfullscreenchange', handleFullscreenChangeEvent);

  document.removeEventListener('visibilitychange', handleVisibilityAndBlurEvent);
  window.removeEventListener('blur', handleVisibilityAndBlurEvent);

  const modal = document.getElementById('security-warning-modal');
  if (modal) modal.classList.remove('active');
  
  exitExamFullscreen();
}

// Load student exam schedules with backend validation status
async function loadStudentExamSchedules() {
  const container = document.getElementById('student-schedules-container');
  if (!container) return;

  try {
    const regNo = currentStudent.regNo || '24HP1A0501';
    let data = null;

    if (isBackendConnected) {
      const response = await fetch(`${API_BASE_URL}/exams/schedules?regNo=${encodeURIComponent(regNo)}`);
      data = await response.json();
    }

    // Fallback client-side evaluation if offline or backend health fail
    if (!data || !data.success || !Array.isArray(data.schedules)) {
      const todayStr = new Date().toISOString().split('T')[0];
      const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      
      data = {
        schedules: [
          {
            examId: 'EXAM_CN_001',
            subject: 'Computer Networks',
            examDate: todayStr,
            startTime: '10:00 AM',
            latestAllowedStartTime: '10:05 AM',
            endTime: '10:35 AM',
            durationMinutes: 30,
            totalQuestions: 20,
            studentStatus: 'AVAILABLE'
          },
          {
            examId: 'EXAM_QC_002',
            subject: 'Quantum Computing',
            examDate: tomorrowStr,
            startTime: '10:00 AM',
            latestAllowedStartTime: '10:05 AM',
            endTime: '10:35 AM',
            durationMinutes: 30,
            totalQuestions: 20,
            studentStatus: 'UPCOMING'
          }
        ]
      };
    }

    container.innerHTML = '';

    data.schedules.forEach(sch => {
      const card = document.createElement('div');
      card.className = 'exam-schedule-card';

      let statusBadgeHtml = '';
      let actionBtnHtml = '';
      let warningBannerHtml = '';

      const st = sch.studentStatus;

      if (st === 'AVAILABLE') {
        statusBadgeHtml = `<span class="exam-status-badge available"><i class="fa-solid fa-circle-check"></i> AVAILABLE</span>`;
        actionBtnHtml = `
          <button type="button" class="btn-primary" style="width: 100%; justify-content: center;" onclick="startScheduledExam('${sch.examId}', '${sch.subject}')">
            <i class="fa-solid fa-pen-to-square"></i> [ START EXAM ]
          </button>
        `;
      } else if (st === 'UPCOMING') {
        statusBadgeHtml = `<span class="exam-status-badge upcoming"><i class="fa-solid fa-clock"></i> UPCOMING</span>`;
        actionBtnHtml = `
          <button type="button" class="btn-secondary" style="width: 100%; justify-content: center; opacity: 0.65;" disabled>
            <i class="fa-solid fa-lock"></i> [ NOT AVAILABLE YET ]
          </button>
        `;
      } else if (st === 'IN_PROGRESS') {
        statusBadgeHtml = `<span class="exam-status-badge in_progress"><i class="fa-solid fa-spinner fa-spin"></i> IN PROGRESS</span>`;
        actionBtnHtml = `
          <button type="button" class="btn-primary" style="width: 100%; justify-content: center; background: linear-gradient(135deg, #7c3aed, #4f46e5);" onclick="startScheduledExam('${sch.examId}', '${sch.subject}')">
            <i class="fa-solid fa-play"></i> [ RESUME EXAM ]
          </button>
        `;
      } else if (st === 'COMPLETED') {
        statusBadgeHtml = `<span class="exam-status-badge completed"><i class="fa-solid fa-square-check"></i> COMPLETED</span>`;
        actionBtnHtml = `
          <button type="button" class="btn-secondary" style="width: 100%; justify-content: center;" onclick="alert('${sch.subject} examination has been completed and submitted.')">
            <i class="fa-solid fa-chart-pie"></i> [ VIEW RESULT ]
          </button>
        `;
      } else if (st === 'CANCELLED' || st === 'MISSED') {
        statusBadgeHtml = `<span class="exam-status-badge cancelled"><i class="fa-solid fa-circle-xmark"></i> CANCELLED</span>`;
        warningBannerHtml = `
          <div class="exam-late-warning-banner">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.2rem;"></i>
            <div>
              <strong>Exam Start Time Expired!</strong><br>
              Your examination start window passed at ${sch.latestAllowedStartTime}. Attempt has been cancelled (START_TIME_EXPIRED).
            </div>
          </div>
        `;
        actionBtnHtml = `
          <button type="button" class="btn-secondary" style="width: 100%; justify-content: center; color: var(--danger); border-color: rgba(220, 38, 38, 0.3); opacity: 0.7;" disabled>
            <i class="fa-solid fa-ban"></i> [ EXAM CLOSED ]
          </button>
        `;
      }

      card.innerHTML = `
        <div class="exam-schedule-header">
          <div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 700; color: var(--primary);">${sch.examId}</div>
            <h3 class="exam-schedule-title">${sch.subject}</h3>
          </div>
          ${statusBadgeHtml}
        </div>

        <div class="exam-meta-grid">
          <div class="exam-meta-item">
            <span class="exam-meta-label">Exam Date</span>
            <span class="exam-meta-val"><i class="fa-regular fa-calendar" style="color: var(--primary);"></i> ${sch.examDate}</span>
          </div>
          <div class="exam-meta-item">
            <span class="exam-meta-label">Exam Time</span>
            <span class="exam-meta-val"><i class="fa-regular fa-clock" style="color: var(--accent-cyan);"></i> ${sch.startTime} – ${sch.endTime}</span>
          </div>
          <div class="exam-meta-item">
            <span class="exam-meta-label">Latest Start Window</span>
            <span class="exam-meta-val" style="color: var(--danger);"><i class="fa-solid fa-user-clock"></i> ${sch.latestAllowedStartTime}</span>
          </div>
          <div class="exam-meta-item">
            <span class="exam-meta-label">Duration & Questions</span>
            <span class="exam-meta-val"><i class="fa-solid fa-list-check"></i> ${sch.durationMinutes} Mins • ${sch.totalQuestions} Qs</span>
          </div>
        </div>

        ${warningBannerHtml}
        ${actionBtnHtml}
      `;

      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load student exam schedules:', err);
  }
}

// Start Scheduled Exam with Strict Backend Validation
async function startScheduledExam(examId, subject) {
  selectedSubject = subject || 'Computer Networks';
  const regNo = currentStudent.regNo || '24HP1A0501';

  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE_URL}/exams/${encodeURIComponent(examId)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regNo, studentName: currentStudent.name })
      });

      const data = await res.json();

      if (!data.success) {
        alert(`⛔ ${data.message || 'Exam start authorization rejected.'}`);
        loadStudentExamSchedules(); // Refresh cards to show CANCELLED badge if window expired
        return;
      }

      console.log("✅ Backend exam start validated:", data.examSession);
      if (data.examSession && data.examSession.sessionDurationSeconds) {
        secondsRemaining = data.examSession.sessionDurationSeconds;
      }
    } catch (err) {
      console.warn("Backend start validation error:", err);
    }
  }

  // Proceed into exam
  startExam();
}

// Admin Scheduling Form Handler
async function handleAdminCreateSchedule() {
  const examId = document.getElementById('sch-exam-id')?.value.trim();
  const subject = document.getElementById('sch-subject')?.value.trim();
  const examDate = document.getElementById('sch-date')?.value;
  const startTime = document.getElementById('sch-start-time')?.value.trim();
  const latestAllowedStartTime = document.getElementById('sch-latest-start')?.value.trim();
  const endTime = document.getElementById('sch-end-time')?.value.trim();
  const durationMinutes = parseInt(document.getElementById('sch-duration')?.value, 10) || 30;

  if (!examId || !subject || !examDate || !startTime || !latestAllowedStartTime || !endTime) {
    alert("Please fill in all schedule specification fields.");
    return;
  }

  try {
    if (isBackendConnected) {
      const res = await fetch(`${API_BASE_URL}/exams/schedule/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, subject, examDate, startTime, latestAllowedStartTime, endTime, durationMinutes, totalQuestions: 20 })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Exam schedule '${examId}' published successfully!`);
        renderAdminSchedulesList();
      } else {
        alert(`Error: ${data.message}`);
      }
    } else {
      alert(`✅ Exam schedule '${examId}' saved in local memory.`);
    }
  } catch (err) {
    console.error("Schedule creation error:", err);
    alert("Failed to create schedule.");
  }
}

async function renderAdminSchedulesList() {
  const container = document.getElementById('admin-schedules-list-container');
  if (!container) return;

  try {
    let schedules = [];
    if (isBackendConnected) {
      const res = await fetch(`${API_BASE_URL}/exams/schedules?regNo=ADMIN`);
      const data = await res.json();
      if (data.success && data.schedules) schedules = data.schedules;
    }

    if (schedules.length === 0) {
      container.innerHTML = `<div style="padding: 1.5rem; color: var(--text-muted); text-align: center;">No active exam schedules configured.</div>`;
      return;
    }

    container.innerHTML = '';
    schedules.forEach(s => {
      const div = document.createElement('div');
      div.className = 'exam-schedule-card';
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <strong style="color: var(--primary); font-family: 'JetBrains Mono', monospace;">${s.examId}</strong>
          <span class="status-pill pass">${s.subject}</span>
        </div>
        <div style="font-size: 0.88rem; color: var(--text-sub);">
          📅 <strong>Date:</strong> ${s.examDate} &nbsp;|&nbsp;
          ⏰ <strong>Start:</strong> ${s.startTime} &nbsp;|&nbsp;
          ⛔ <strong>Latest Start:</strong> <span style="color: var(--danger); font-weight: 700;">${s.latestAllowedStartTime}</span> &nbsp;|&nbsp;
          ⌛ <strong>End:</strong> ${s.endTime} &nbsp;|&nbsp;
          ⏱️ <strong>Duration:</strong> ${s.durationMinutes} Mins
        </div>
      `;
      container.appendChild(div);
    });
  } catch (e) {
    console.error("Failed to render admin schedules list:", e);
  }
}

// Start Examination Handler (Fetches Question Bank from MongoDB or Local Bank)
async function startExam() {
  const selectedRadio = document.querySelector('input[name="subject"]:checked');
  if (selectedRadio) {
    selectedSubject = selectedRadio.value;
  }

  let questionsLoaded = false;

  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE_URL}/questions/${encodeURIComponent(selectedSubject)}`);
      const data = await res.json();
      if (data.success && data.questions && data.questions.length > 0) {
        currentQuestions = data.questions;
        questionsLoaded = true;
        console.log(`Loaded ${currentQuestions.length} randomized questions from MongoDB for ${selectedSubject}`);
      }
    } catch (err) {
      console.error("Failed to load questions from backend:", err);
    }
  }

  // Fallback to local questions if backend fails or offline
  if (!questionsLoaded) {
    let rawPool = [];
    if (typeof subjectQuestionBanks !== 'undefined' && subjectQuestionBanks[selectedSubject]) {
      rawPool = subjectQuestionBanks[selectedSubject];
    } else if (typeof subjectQuestionBanks !== 'undefined' && subjectQuestionBanks["Computer Networks"]) {
      rawPool = subjectQuestionBanks["Computer Networks"];
    }

    currentQuestions = prepareRandomizedExamPaper(rawPool, 20);
  }

  // Reset exam state
  userAnswers = new Array(currentQuestions.length).fill(null);
  reviewFlags = new Array(currentQuestions.length).fill(false);
  hintsUsedFlags = new Array(currentQuestions.length).fill(false);
  currentQIndex = 0;
  if (!secondsRemaining) secondsRemaining = 20 * 60;

  // Reset & Activate Security System
  resetSecurityState();
  setupSecurityEventListeners();
  requestExamFullscreen().catch(err => console.log("Initial fullscreen prompt note:", err));

  // Update Exam Meta Header
  document.getElementById('exam-student-name').innerText = currentStudent.name;
  document.getElementById('exam-reg-no').innerText = currentStudent.regNo;
  document.getElementById('exam-subject-title').innerText = selectedSubject;

  // Render initial question and palette
  renderQuestion();
  renderGridPalette();
  updateProgressBar();
  startTimer();

  showPage('exam-page');
}

// Page 3: Render Active Question
function renderQuestion() {
  const qData = currentQuestions[currentQIndex];
  if (!qData) return;

  // Normalize Difficulty & Marks
  const diffStr = qData.difficulty || (currentQIndex % 3 === 0 ? 'Easy' : (currentQIndex % 3 === 1 ? 'Medium' : 'Hard'));
  const diffUpper = String(diffStr).trim().toUpperCase();
  let normDiff = 'Medium';
  let baseMarks = 2;

  if (diffUpper === 'EASY') {
    normDiff = 'Easy';
    baseMarks = 1;
  } else if (diffUpper === 'HARD') {
    normDiff = 'Hard';
    baseMarks = 2;
  } else {
    normDiff = 'Medium';
    baseMarks = 2;
  }

  // Update Difficulty & Marks Badges
  const diffBadge = document.getElementById('q-difficulty-badge');
  const marksBadge = document.getElementById('q-marks-badge');
  if (diffBadge) {
    diffBadge.innerText = `Difficulty: ${normDiff.toUpperCase()}`;
    diffBadge.className = `q-diff-badge ${normDiff.toLowerCase()}`;
  }
  if (marksBadge) {
    marksBadge.innerText = `Marks: ${baseMarks}`;
  }

  // Question number header
  document.getElementById('q-number-display').innerText = `Question ${currentQIndex + 1} of ${currentQuestions.length}`;
  document.getElementById('q-text-display').innerText = `Q${qData.questionId || (currentQIndex + 1)}. ${qData.question}`;

  // Render options A, B, C, D
  const optionsContainer = document.getElementById('q-options-container');
  optionsContainer.innerHTML = '';

  const labels = ['A', 'B', 'C', 'D'];
  qData.options.forEach((optText, index) => {
    const isSelected = userAnswers[currentQIndex] === index;
    const optionDiv = document.createElement('div');
    optionDiv.className = `option-item ${isSelected ? 'selected' : ''}`;
    optionDiv.onclick = () => selectOption(index);

    optionDiv.innerHTML = `
      <div class="opt-badge">${labels[index]}</div>
      <div class="opt-text">${optText}</div>
    `;
    optionsContainer.appendChild(optionDiv);
  });

  // Hint Container & Button state
  const hintBtn = document.getElementById('hint-btn');
  const hintBox = document.getElementById('q-hint-box');
  const hintText = document.getElementById('q-hint-text');
  const isHintUsed = Boolean(hintsUsedFlags[currentQIndex]);

  if (hintBtn) {
    if (isHintUsed) {
      hintBtn.className = 'btn-hint used';
      hintBtn.innerHTML = `<i class="fa-solid fa-lightbulb"></i> Hint Used (-1 Mark)`;
    } else {
      hintBtn.className = 'btn-hint';
      hintBtn.innerHTML = `<i class="fa-solid fa-lightbulb"></i> [ USE HINT ]`;
    }
  }

  if (hintBox && hintText) {
    if (isHintUsed) {
      hintBox.style.display = 'block';
      hintText.innerText = qData.hint || `Focus on core principles of ${selectedSubject}.`;
    } else {
      hintBox.style.display = 'none';
      hintText.innerText = '';
    }
  }

  // Update Review Button status
  const reviewBtn = document.getElementById('review-btn');
  if (reviewFlags[currentQIndex]) {
    reviewBtn.classList.add('active');
    reviewBtn.innerHTML = `<i class="fa-solid fa-bookmark"></i> Marked for Review`;
  } else {
    reviewBtn.classList.remove('active');
    reviewBtn.innerHTML = `<i class="fa-regular fa-bookmark"></i> Mark for Review`;
  }

  // Update Question Palette UI & Progress Bar
  renderGridPalette();
  updateProgressBar();
}

// Hint System Modal & Handlers
function promptUseHint() {
  if (hintsUsedFlags[currentQIndex]) return;
  const modal = document.getElementById('hint-confirm-modal');
  if (modal) modal.classList.add('active');
}

function closeHintModal() {
  const modal = document.getElementById('hint-confirm-modal');
  if (modal) modal.classList.remove('active');
}

function confirmUseHint() {
  hintsUsedFlags[currentQIndex] = true;
  closeHintModal();
  renderQuestion();
}

// Update Top Progress Bar
function updateProgressBar() {
  let answeredCount = 0;
  for (let i = 0; i < userAnswers.length; i++) {
    if (userAnswers[i] !== null) answeredCount++;
  }
  const pct = currentQuestions.length > 0 ? (answeredCount / currentQuestions.length) * 100 : 0;
  const bar = document.getElementById('exam-progress-bar');
  if (bar) {
    bar.style.width = `${pct}%`;
  }
}

// Select an option for current question
function selectOption(optionIndex) {
  userAnswers[currentQIndex] = optionIndex;
  renderQuestion();
}

// Clear selected option
function clearAnswer() {
  userAnswers[currentQIndex] = null;
  renderQuestion();
}

// Toggle Mark for Review
function toggleMarkForReview() {
  reviewFlags[currentQIndex] = !reviewFlags[currentQIndex];
  renderQuestion();
}

// Navigation Controls
function nextQuestion() {
  if (currentQIndex < currentQuestions.length - 1) {
    currentQIndex++;
    renderQuestion();
  }
}

function prevQuestion() {
  if (currentQIndex > 0) {
    currentQIndex--;
    renderQuestion();
  }
}

function jumpToQuestion(index) {
  currentQIndex = index;
  renderQuestion();
}

// Render Sidebar Question Grid with Difficulty Color Indicators (🟢 Easy, 🟡 Medium, 🔴 Hard)
function renderGridPalette() {
  const gridContainer = document.getElementById('question-grid-palette');
  if (!gridContainer) return;
  gridContainer.innerHTML = '';

  for (let i = 0; i < currentQuestions.length; i++) {
    const qData = currentQuestions[i] || {};
    const diffStr = qData.difficulty || (i % 3 === 0 ? 'Easy' : (i % 3 === 1 ? 'Medium' : 'Hard'));
    const diffLower = String(diffStr).trim().toLowerCase();

    const pill = document.createElement('div');
    let pillClass = `q-pill ${diffLower}-pill`;

    if (i === currentQIndex) {
      pillClass += ' current';
    }

    if (reviewFlags[i]) {
      pillClass += ' review';
    } else if (userAnswers[i] !== null) {
      pillClass += ' answered';
    }

    pill.className = pillClass;
    pill.innerText = i + 1;
    pill.onclick = () => jumpToQuestion(i);

    gridContainer.appendChild(pill);
  }
}

// Exam Timer Countdown
function startTimer() {
  clearInterval(timerInterval);

  updateTimerDisplay();
  timerInterval = setInterval(() => {
    secondsRemaining--;
    updateTimerDisplay();

    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert("Time is up! Submitting your examination paper automatically.");
      finalizeExamSubmission();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  const timerDisplay = document.getElementById('timer-display');
  const timerBox = document.getElementById('timer-container');
  
  if (timerDisplay) {
    timerDisplay.innerText = timeStr;
  }

  if (secondsRemaining < 180 && timerBox) {
    timerBox.classList.add('warning');
  } else if (timerBox) {
    timerBox.classList.remove('warning');
  }
}

// Modal Submission Confirmation with Dynamic Score Breakdown & Preview Marks
function confirmSubmitExam() {
  let answeredCount = 0;
  let hintsUsedCount = 0;
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;
  let maxMarks = 0;
  let estimatedMarks = 0;

  currentQuestions.forEach((q, idx) => {
    const diffStr = q.difficulty || (idx % 3 === 0 ? 'Easy' : (idx % 3 === 1 ? 'Medium' : 'Hard'));
    const diffUpper = String(diffStr).trim().toUpperCase();
    let baseMarks = 2;

    if (diffUpper === 'EASY') {
      baseMarks = 1;
      easyCount++;
    } else if (diffUpper === 'HARD') {
      baseMarks = 2;
      hardCount++;
    } else {
      baseMarks = 2;
      mediumCount++;
    }

    maxMarks += baseMarks;
    const isHintUsed = Boolean(hintsUsedFlags[idx]);
    if (isHintUsed) hintsUsedCount++;

    const availMarks = isHintUsed ? Math.max(0, baseMarks - 1) : baseMarks;
    const studentAns = userAnswers[idx];

    if (studentAns !== null && studentAns !== undefined) {
      answeredCount++;
      // Estimated score assumes answered question is scored (without exposing correct/wrong status)
      estimatedMarks += availMarks;
    }
  });

  const unansweredCount = currentQuestions.length - answeredCount;

  const summaryEl = document.getElementById('modal-summary-text');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="text-align: left; background: rgba(2, 132, 199, 0.05); border: 1px solid rgba(2, 132, 199, 0.2); padding: 1rem; border-radius: 8px; font-size: 0.88rem; line-height: 1.6; margin: 0.85rem 0;">
        <div style="font-weight: 800; color: var(--primary); margin-bottom: 0.4rem; font-size: 0.95rem;">📊 EXAM PREVIEW SUMMARY</div>
        • <strong>Total Questions:</strong> ${currentQuestions.length}<br>
        • <strong>Easy Questions:</strong> ${easyCount} × 1 = ${easyCount * 1} Marks<br>
        • <strong>Medium Questions:</strong> ${mediumCount} × 2 = ${mediumCount * 2} Marks<br>
        • <strong>Hard Questions:</strong> ${hardCount} × 2 = ${hardCount * 2} Marks<br>
        • <strong style="color: var(--primary);">Maximum Total Marks: ${maxMarks}</strong><br>
        • <strong>Answered:</strong> ${answeredCount} | <strong>Unanswered:</strong> ${unansweredCount}<br>
        • <strong>Hints Used:</strong> ${hintsUsedCount}<br>
        • <strong>Estimated Maximum Score:</strong> <span style="color: var(--success); font-weight: 800;">${estimatedMarks} Marks</span>
      </div>
      <p style="margin-top: 0.5rem; color: var(--text-sub);">Are you ready to submit your examination paper?</p>
    `;
  }
  
  document.getElementById('submit-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('submit-modal').classList.remove('active');
}

// Page 4: Finalize & Score Calculation (Submits to MongoDB Server)
async function finalizeExamSubmission() {
  closeModal();
  clearInterval(timerInterval);
  removeSecurityEventListeners();

  let backendResultDoc = null;

  try {
    const res = await fetch(`${API_BASE_URL}/results/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regNo: currentStudent.regNo,
        studentName: currentStudent.name,
        year: currentStudent.year || 'III B.Tech',
        section: currentStudent.section || 'A',
        subject: selectedSubject,
        examName: `${selectedSubject} Mid Examination`,
        examDate: new Date().toISOString().split('T')[0],
        startTime: '10:00 AM',
        userAnswers: userAnswers,
        hintsUsed: hintsUsedFlags,
        questionList: currentQuestions,
        durationMinutes: 30,
        timeTaken: '20 Mins',
        autoSubmitted: typeof isAutoSubmitted !== 'undefined' ? Boolean(isAutoSubmitted) : false,
        submissionType: (typeof isAutoSubmitted !== 'undefined' && isAutoSubmitted) ? 'AUTOMATIC' : 'MANUAL',
        fullscreenExitCount,
        tabSwitchCount,
        totalViolationsCount,
        securityLogs
      })
    });
    const data = await res.json();
    if (data.success && data.result) {
      backendResultDoc = data.result;
      console.log("✅ Recorded exam submission in MongoDB & updated Excel Sheet:", backendResultDoc);
    }
  } catch (err) {
    console.error("Failed to send submission to backend API:", err);
  }

  let correctCount = 0;
  let wrongCount = 0;
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;
  let hintsUsedTotal = 0;
  let totalMaxMarks = 0;
  let totalMarksObtained = 0;

  const breakdownContainer = document.getElementById('answer-breakdown-list');
  breakdownContainer.innerHTML = '';

  const labels = ['A', 'B', 'C', 'D'];

  if (backendResultDoc && backendResultDoc.breakdown && backendResultDoc.breakdown.length > 0) {
    correctCount = backendResultDoc.correctCount;
    wrongCount = backendResultDoc.wrongCount;
    easyCount = backendResultDoc.easyCount || 0;
    mediumCount = backendResultDoc.mediumCount || 0;
    hardCount = backendResultDoc.hardCount || 0;
    hintsUsedTotal = backendResultDoc.hintsUsed || 0;
    totalMaxMarks = backendResultDoc.maximumMarks || 20;

    backendResultDoc.breakdown.forEach((item, idx) => {
      const q = currentQuestions[idx] || { options: [] };
      const studentAnsText = item.userAnswer !== null && item.userAnswer !== undefined && q.options[item.userAnswer]
        ? `${labels[item.userAnswer]}. ${q.options[item.userAnswer]}`
        : '<span style="color: var(--warning);">Not Answered</span>';
      
      const correctAnsText = q.options[item.correctAnswer]
        ? `${labels[item.correctAnswer]}. ${q.options[item.correctAnswer]}`
        : `Option ${labels[item.correctAnswer]}`;

      const normDiff = item.difficulty || 'Medium';
      const maxM = item.maxMarks || 2;
      const isHint = Boolean(item.hintUsed);
      const mAwarded = item.marksAwarded !== undefined ? item.marksAwarded : (item.isCorrect ? (isHint ? Math.max(0, maxM - 1) : maxM) : 0);

      const reviewCard = document.createElement('div');
      reviewCard.className = `review-item ${item.isCorrect ? 'is-correct' : 'is-wrong'}`;

      reviewCard.innerHTML = `
        <div class="review-item-header">
          <div>
            <strong>Q${idx + 1}. ${item.question}</strong>
            <div style="margin-top: 0.35rem; display: flex; gap: 0.5rem; align-items: center;">
              <span class="q-diff-badge ${normDiff.toLowerCase()}">${normDiff} (${maxM}M)</span>
              ${isHint ? '<span class="status-pill warning" style="font-size: 0.7rem;"><i class="fa-solid fa-lightbulb"></i> Hint Used (-1M Penalty)</span>' : ''}
            </div>
          </div>
          <div style="color: ${item.isCorrect ? 'var(--success)' : 'var(--danger)'}; font-weight: 800; font-size: 0.95rem;">
            ${item.isCorrect ? `<i class="fa-solid fa-circle-check"></i> Correct (+${mAwarded} Mark${mAwarded === 1 ? '' : 's'})` : '<i class="fa-solid fa-circle-xmark"></i> Incorrect (0 Marks)'}
          </div>
        </div>
        <div class="answer-comparison">
          <div class="ans-box">
            <strong>Your Answer:</strong>
            ${studentAnsText}
          </div>
          <div class="ans-box">
            <strong>Correct Answer:</strong>
            <span style="color: var(--success); font-weight: 600;">${correctAnsText}</span>
          </div>
        </div>
        <div class="explanation-box">
          <i class="fa-solid fa-lightbulb" style="color: var(--warning);"></i> <strong>Explanation:</strong> ${item.explanation || q.explanation || 'Key subject principle.'}
        </div>
      `;
      breakdownContainer.appendChild(reviewCard);
    });
  } else {
    // Client-side Fallback calculation
    currentQuestions.forEach((q, idx) => {
      const studentAns = userAnswers[idx];
      const isHintUsed = Boolean(hintsUsedFlags[idx]);
      if (isHintUsed) hintsUsedTotal++;

      const diffStr = q.difficulty || (idx % 3 === 0 ? 'Easy' : (idx % 3 === 1 ? 'Medium' : 'Hard'));
      const diffUpper = String(diffStr).trim().toUpperCase();
      let normDiff = 'Medium';
      let baseMarks = 2;

      if (diffUpper === 'EASY') {
        normDiff = 'Easy';
        baseMarks = 1;
        easyCount++;
      } else if (diffUpper === 'HARD') {
        normDiff = 'Hard';
        baseMarks = 2;
        hardCount++;
      } else {
        normDiff = 'Medium';
        baseMarks = 2;
        mediumCount++;
      }

      totalMaxMarks += baseMarks;
      const availMarks = isHintUsed ? Math.max(0, baseMarks - 1) : baseMarks;
      const isCorrect = studentAns === q.correct;
      let marksAwarded = 0;

      if (isCorrect) {
        correctCount++;
        marksAwarded = availMarks;
        totalMarksObtained += marksAwarded;
      } else {
        wrongCount++;
        marksAwarded = 0;
      }

      const studentAnsText = studentAns !== null && studentAns !== undefined ? `${labels[studentAns]}. ${q.options[studentAns]}` : '<span style="color: var(--warning);">Not Answered</span>';
      const correctAnsText = `${labels[q.correct]}. ${q.options[q.correct]}`;

      const reviewCard = document.createElement('div');
      reviewCard.className = `review-item ${isCorrect ? 'is-correct' : 'is-wrong'}`;

      reviewCard.innerHTML = `
        <div class="review-item-header">
          <div>
            <strong>Q${idx + 1}. ${q.question}</strong>
            <div style="margin-top: 0.35rem; display: flex; gap: 0.5rem; align-items: center;">
              <span class="q-diff-badge ${normDiff.toLowerCase()}">${normDiff} (${baseMarks}M)</span>
              ${isHintUsed ? '<span class="status-pill warning" style="font-size: 0.7rem;"><i class="fa-solid fa-lightbulb"></i> Hint Used (-1M Penalty)</span>' : ''}
            </div>
          </div>
          <div style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}; font-weight: 800; font-size: 0.95rem;">
            ${isCorrect ? `<i class="fa-solid fa-circle-check"></i> Correct (+${marksAwarded} Mark${marksAwarded === 1 ? '' : 's'})` : '<i class="fa-solid fa-circle-xmark"></i> Incorrect (0 Marks)'}
          </div>
        </div>
        <div class="answer-comparison">
          <div class="ans-box">
            <strong>Your Answer:</strong>
            ${studentAnsText}
          </div>
          <div class="ans-box">
            <strong>Correct Answer:</strong>
            <span style="color: var(--success); font-weight: 600;">${correctAnsText}</span>
          </div>
        </div>
        <div class="explanation-box">
          <i class="fa-solid fa-lightbulb" style="color: var(--warning);"></i> <strong>Explanation:</strong> ${q.explanation || 'Key subject principle.'}
        </div>
      `;
      breakdownContainer.appendChild(reviewCard);
    });
  }

  const totalQ = backendResultDoc ? backendResultDoc.totalQuestions : currentQuestions.length;
  const percentage = backendResultDoc ? backendResultDoc.percentage : (totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0);
  const isPass = percentage >= 40;
  const displayMarksObtained = backendResultDoc ? backendResultDoc.marksObtained : `${totalMarksObtained} / ${totalMaxMarks}`;

  // Render Result Cards
  document.getElementById('res-student-name').innerText = currentStudent.name;
  document.getElementById('res-reg-no').innerText = currentStudent.regNo;
  document.getElementById('res-subject-name').innerText = selectedSubject;

  document.getElementById('res-total-q').innerText = totalQ;

  const diffBreakdownEl = document.getElementById('res-diff-breakdown');
  if (diffBreakdownEl) diffBreakdownEl.innerText = `${easyCount}E / ${mediumCount}M / ${hardCount}H`;

  const hintsCountEl = document.getElementById('res-hints-count');
  if (hintsCountEl) hintsCountEl.innerText = hintsUsedTotal;

  const maxMarksEl = document.getElementById('res-max-marks');
  if (maxMarksEl) maxMarksEl.innerText = backendResultDoc ? backendResultDoc.maximumMarks || totalMaxMarks : totalMaxMarks;

  document.getElementById('res-correct-count').innerText = correctCount;
  document.getElementById('res-wrong-count').innerText = wrongCount;
  document.getElementById('res-marks-obtained').innerText = displayMarksObtained;
  document.getElementById('res-percentage').innerText = `${percentage}%`;

  const statusBadge = document.getElementById('result-status-badge');
  if (isPass) {
    statusBadge.className = 'status-badge pass';
    statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> PASS ✅`;
  } else {
    statusBadge.className = 'status-badge fail';
    statusBadge.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> FAIL ❌`;
  }

  showPage('result-page');
}

// Helper: Client-Side Excel Exporter (.xlsx)

// Client-Side Excel Exporter (.xlsx)
function exportResultToExcel() {
  try {
    if (typeof XLSX === 'undefined') {
      alert("Excel library is loading. Please try again in a moment.");
      return;
    }

    const regNo = currentStudent.regNo || '23A91A0501';
    const studentName = currentStudent.name || 'Student';
    const subject = selectedSubject || 'Computer Networks';
    
    let correctCount = 0;
    let wrongCount = 0;
    userAnswers.forEach((ans, idx) => {
      const q = currentQuestions[idx];
      if (q && ans === q.correct) correctCount++;
      else wrongCount++;
    });

    const totalQ = currentQuestions.length || 20;
    const percentage = Math.round((correctCount / totalQ) * 100);
    const status = percentage >= 40 ? 'PASS' : 'FAIL';

    // Summary Sheet Data
    const summaryData = [
      { Parameter: 'Student Name', Value: studentName },
      { Parameter: 'Registration Number', Value: regNo },
      { Parameter: 'Subject Paper', Value: subject },
      { Parameter: 'Total Questions', Value: totalQ },
      { Parameter: 'Correct Answers', Value: correctCount },
      { Parameter: 'Wrong Answers', Value: wrongCount },
      { Parameter: 'Marks Obtained', Value: `${correctCount} / ${totalQ}` },
      { Parameter: 'Percentage', Value: `${percentage}%` },
      { Parameter: 'Evaluation Status', Value: status },
      { Parameter: 'Fullscreen Exits', Value: fullscreenExitCount },
      { Parameter: 'Tab Switches / Focus Loss', Value: tabSwitchCount },
      { Parameter: 'Total Security Violations', Value: totalViolationsCount },
      { Parameter: 'Timestamp', Value: new Date().toLocaleString() }
    ];

    // Question Breakdown Sheet Data
    const labels = ['A', 'B', 'C', 'D'];
    const breakdownData = currentQuestions.map((q, idx) => {
      const ans = userAnswers[idx];
      const isCorrect = ans === q.correct;
      const userAnsStr = ans !== null && q.options[ans] ? `${labels[ans]}. ${q.options[ans]}` : 'Not Answered';
      const correctAnsStr = q.options[q.correct] ? `${labels[q.correct]}. ${q.options[q.correct]}` : 'N/A';

      return {
        'Q.No': idx + 1,
        'Question Statement': q.question,
        'Your Answer': userAnsStr,
        'Correct Answer': correctAnsStr,
        'Result': isCorrect ? 'CORRECT (+1)' : 'WRONG (0)',
        'Explanation': q.explanation || ''
      };
    });

    // Security Log Sheet Data
    const securityData = securityLogs.length > 0 ? securityLogs.map((log, idx) => ({
      'S.No': idx + 1,
      'Event Type': log.eventType,
      'Timestamp': log.timestamp
    })) : [{ 'S.No': 1, 'Event Type': 'Clean Exam Session (No Violations Detected)', 'Timestamp': new Date().toLocaleTimeString() }];

    // Create workbook & sheets
    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsBreakdown = XLSX.utils.json_to_sheet(breakdownData);
    const wsSecurity = XLSX.utils.json_to_sheet(securityData);

    // Set column widths
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 45 }];
    wsBreakdown['!cols'] = [{ wch: 8 }, { wch: 55 }, { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 60 }];
    wsSecurity['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Exam Summary');
    XLSX.utils.book_append_sheet(wb, wsBreakdown, 'Detailed Answers');
    XLSX.utils.book_append_sheet(wb, wsSecurity, 'Security Log');

    // Download .xlsx file
    const fileName = `${regNo}_${subject.replace(/\s+/g, '_')}_Result.xlsx`;
    XLSX.writeFile(wb, fileName);

    console.log(`✅ Exported result sheet: ${fileName}`);
  } catch (err) {
    console.error("Excel export error:", err);
    alert("Failed to export Excel file: " + err.message);
  }
}

// Download Server Master Excel Database File (Exam_Results_Database.xlsx)
function downloadMasterExcel() {
  if (isBackendConnected) {
    window.location.href = `${API_BASE_URL}/results/download-excel`;
  } else {
    exportResultToExcel();
  }
}

// ==========================================================================
// ADMIN DASHBOARD & CONTROL CENTER LOGIC
// ==========================================================================
let allAdminResults = [];

function openAdminModal() {
  document.getElementById('admin-auth-modal').classList.add('active');
}

function closeAdminModal() {
  document.getElementById('admin-auth-modal').classList.remove('active');
}

function verifyAdminPasskey() {
  const passkey = document.getElementById('admin-passkey-input').value;
  if (passkey === 'admin123' || passkey === 'admin') {
    closeAdminModal();
    loadAdminDashboardData();
    showPage('admin-page');
  } else {
    alert("Invalid Administrator Passkey! (Default Passkey: admin123)");
  }
}

// --- FACULTY / ADMIN DASHBOARD LOGIC ---

let facultyUser = null;
let currentExcelImportData = null;
let allQuestionBankList = [];

// Faculty Authentication
async function handleFacultyLogin() {
  const idInput = document.getElementById('faculty-id-input')?.value.trim() || '';
  const passInput = document.getElementById('faculty-pass-input')?.value || '';
  const errBox = document.getElementById('faculty-login-error');

  if (errBox) errBox.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facultyId: idInput, password: passInput })
    });

    const data = await res.json();
    if (data.success && data.user) {
      facultyUser = data.user;
      closeAdminModal();
      showPage('admin-page');
      switchAdminSection('summary');
      loadAdminDashboardData();
    } else {
      if (errBox) {
        errBox.innerText = data.message || 'Invalid Faculty Credentials';
        errBox.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Faculty login error:', err);
    // Offline/Fallback authentication fallback for FACULTY01 / admin123
    if ((idInput.toUpperCase() === 'FACULTY01' || idInput.toUpperCase() === 'ADMIN') && passInput === 'admin123') {
      facultyUser = { id: 'FACULTY01', name: 'Faculty Coordinator', role: 'FACULTY' };
      closeAdminModal();
      showPage('admin-page');
      switchAdminSection('summary');
      loadAdminDashboardData();
    } else {
      if (errBox) {
        errBox.innerText = 'Unable to connect to server. Use FACULTY01 / admin123 for local demo.';
        errBox.style.display = 'block';
      }
    }
  }
}

function handleFacultyLogout() {
  facultyUser = null;
  showPage('login-page');
}

// Section Switching within Admin Dashboard
function switchAdminSection(sectionName) {
  document.querySelectorAll('.admin-section-pane').forEach(pane => pane.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(btn => btn.classList.remove('active'));

  const targetPane = document.getElementById(`pane-${sectionName}`);
  const targetNav = document.getElementById(`nav-btn-${sectionName}`);

  if (targetPane) targetPane.classList.add('active');
  if (targetNav) targetNav.classList.add('active');

  // Trigger data fetch per section
  if (sectionName === 'summary') loadAdminDashboardData();
  else if (sectionName === 'schedules') loadAdminSchedules();
  else if (sectionName === 'questions') loadAdminQuestionBank();
  else if (sectionName === 'students') loadAdminStudentsRoster();
  else if (sectionName === 'results') loadFacultyResultsTable();
  else if (sectionName === 'security') loadAdminSecurityReports();
  else if (sectionName === 'participation') loadExamParticipationStatus();
}

// Dashboard Summary & KPI Overview
async function loadAdminDashboardData() {
  try {
    let summary = null;
    let activities = [];

    if (isBackendConnected) {
      const res = await fetch(`${API_BASE_URL}/admin/dashboard`);
      const data = await res.json();
      if (data.success) {
        summary = data.summary;
        activities = data.recentActivities;
      }
    }

    // Update KPI Card UI values
    document.getElementById('kpi-total-students').innerText = summary?.totalStudents || 66;
    document.getElementById('kpi-total-exams').innerText = summary?.totalExams || 2;
    document.getElementById('kpi-today-exams').innerText = summary?.todayExams || 1;
    document.getElementById('kpi-upcoming-exams').innerText = summary?.upcomingExams || 1;
    document.getElementById('kpi-completed-exams').innerText = summary?.completedExams || 0;
    document.getElementById('kpi-total-violations').innerText = summary?.totalViolations || 0;

    // Render Recent Activities
    const actList = document.getElementById('admin-recent-activity-list');
    if (actList && Array.isArray(activities)) {
      actList.innerHTML = activities.map(act => `
        <div class="activity-item">
          <i class="fa-solid fa-circle-dot"></i>
          <div>
            <strong>${act.action}</strong>
            ${act.details ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${act.details}</div>` : ''}
          </div>
          <div class="activity-time">${act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : 'Recent'}</div>
        </div>
      `).join('');
    }

    // Load Quick Schedule Preview
    loadAdminSchedulesPreview();
  } catch (err) {
    console.error('Error loading admin dashboard summary:', err);
  }
}

async function loadAdminSchedulesPreview() {
  const container = document.getElementById('admin-quick-schedule-preview');
  if (!container) return;

  try {
    let exams = [];
    if (isBackendConnected) {
      const res = await fetch(`${API_BASE_URL}/admin/exams`);
      const data = await res.json();
      if (data.success) exams = data.exams;
    }

    if (exams.length === 0) {
      container.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-muted);">No examinations scheduled. Click 'Create Examination' to publish an exam.</div>`;
      return;
    }

    container.innerHTML = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Exam Name</th>
            <th>Subject</th>
            <th>Date</th>
            <th>Start Window</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${exams.map(e => `
            <tr>
              <td><strong>${e.examName || e.subject}</strong></td>
              <td>${e.subject}</td>
              <td>${e.examDate}</td>
              <td>${e.startTime} - ${e.endTime} (Latest: ${e.latestAllowedStartTime})</td>
              <td><span class="status-pill ${(e.status || 'UPCOMING').toLowerCase().replace('_', '-')}">${e.status || 'UPCOMING'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div style="padding: 1rem; color: var(--text-muted);">Loaded default exam schedules.</div>`;
  }
}

// Validate Difficulty Sum in Create Exam Form
function validateDifficultySum() {
  const total = parseInt(document.getElementById('ce-total-questions')?.value || 20, 10);
  const easy = parseInt(document.getElementById('ce-easy-count')?.value || 0, 10);
  const medium = parseInt(document.getElementById('ce-medium-count')?.value || 0, 10);
  const hard = parseInt(document.getElementById('ce-hard-count')?.value || 0, 10);

  const targetSpan = document.getElementById('ce-sum-target');
  if (targetSpan) targetSpan.innerText = total;

  const msgBox = document.getElementById('ce-diff-validation-msg');
  if (!msgBox) return;

  const sum = easy + medium + hard;
  if (sum === total) {
    msgBox.style.color = 'var(--success)';
    msgBox.innerText = `✓ Easy (${easy}) + Medium (${medium}) + Hard (${hard}) = ${total} total questions. Valid!`;
  } else {
    msgBox.style.color = 'var(--danger)';
    msgBox.innerText = `⚠️ Sum of Easy (${easy}) + Medium (${medium}) + Hard (${hard}) is ${sum}, but Total Questions is set to ${total}. Must match!`;
  }
}

// Submit Create Exam Form
async function handleAdminSubmitCreateExam() {
  const examName = document.getElementById('ce-exam-name').value.trim();
  const subject = document.getElementById('ce-subject').value;
  const examDate = document.getElementById('ce-exam-date').value;
  const startTime = document.getElementById('ce-start-time').value.trim();
  const latestAllowedStartTime = document.getElementById('ce-latest-start-time').value.trim();
  const endTime = document.getElementById('ce-end-time').value.trim();
  const durationMinutes = parseInt(document.getElementById('ce-duration').value || 30, 10);
  const totalQuestions = parseInt(document.getElementById('ce-total-questions').value || 20, 10);
  const marksPerQuestion = parseFloat(document.getElementById('ce-marks-per-q').value || 1);
  const passingPercentage = parseFloat(document.getElementById('ce-passing-pct').value || 40);

  const easyCount = parseInt(document.getElementById('ce-easy-count').value || 0, 10);
  const mediumCount = parseInt(document.getElementById('ce-medium-count').value || 0, 10);
  const hardCount = parseInt(document.getElementById('ce-hard-count').value || 0, 10);

  if (easyCount + mediumCount + hardCount !== totalQuestions) {
    alert(`Difficulty Distribution Error: Easy (${easyCount}) + Medium (${mediumCount}) + Hard (${hardCount}) = ${easyCount + mediumCount + hardCount}, which must equal Total Questions (${totalQuestions}).`);
    return;
  }

  const payload = {
    examName,
    subject,
    examDate,
    startTime,
    latestAllowedStartTime,
    endTime,
    durationMinutes,
    totalQuestions,
    marksPerQuestion,
    passingPercentage,
    easyCount,
    mediumCount,
    hardCount
  };

  try {
    const res = await fetch(`${API_BASE_URL}/admin/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 Examination '${examName}' published successfully!`);
      switchAdminSection('schedules');
    } else {
      alert(data.message || 'Failed to create exam schedule.');
    }
  } catch (err) {
    console.error('Create exam error:', err);
    alert('Exam schedule created locally!');
    switchAdminSection('schedules');
  }
}

// Load Exam Schedules Table
async function loadAdminSchedules() {
  const tbody = document.getElementById('admin-schedule-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">Loading exam schedules...</td></tr>';

  try {
    let exams = [];
    if (isBackendConnected) {
      const res = await fetch(`${API_BASE_URL}/admin/exams`);
      const data = await res.json();
      if (data.success) exams = data.exams;
    }

    if (exams.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No exam schedules found. Click "Create New Exam" to schedule an examination.</td></tr>';
      return;
    }

    tbody.innerHTML = exams.map(e => `
      <tr>
        <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--primary);">${e.examId}</td>
        <td>
          <strong style="color: var(--text-main);">${e.examName || e.subject}</strong>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${e.subject}</div>
        </td>
        <td>${e.examDate}</td>
        <td>${e.startTime} - ${e.endTime}</td>
        <td style="color: var(--danger); font-weight: 700;">${e.latestAllowedStartTime}</td>
        <td>${e.durationMinutes} mins</td>
        <td>${e.totalQuestions}</td>
        <td><span class="status-pill ${(e.status || 'UPCOMING').toLowerCase().replace('_', '-')}">${e.status || 'UPCOMING'}</span></td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button type="button" class="btn-secondary" style="padding: 0.3rem 0.5rem; font-size: 0.75rem;" onclick="toggleAdminExamStatus('${e._id}')" title="Toggle Active">
              <i class="fa-solid fa-power-off"></i>
            </button>
            <button type="button" class="btn-secondary" style="padding: 0.3rem 0.5rem; font-size: 0.75rem; color: var(--danger);" onclick="deleteAdminExam('${e._id}')" title="Delete Exam">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Load schedules error:', err);
  }
}

async function deleteAdminExam(id) {
  if (!confirm('Are you sure you want to delete this exam schedule?')) return;
  try {
    await fetch(`${API_BASE_URL}/admin/exams/${id}`, { method: 'DELETE' });
    loadAdminSchedules();
  } catch (err) {
    console.error('Delete exam error:', err);
  }
}

async function toggleAdminExamStatus(id) {
  try {
    await fetch(`${API_BASE_URL}/admin/exams/${id}/toggle`, { method: 'PATCH' });
    loadAdminSchedules();
  } catch (err) {
    console.error('Toggle exam error:', err);
  }
}

// Question Bank Management & CRUD
async function loadAdminQuestionBank() {
  const tbody = document.getElementById('question-bank-table-body');
  if (!tbody) return;

  const subject = document.getElementById('qb-filter-subject')?.value || 'ALL';
  const difficulty = document.getElementById('qb-filter-difficulty')?.value || 'ALL';
  const search = document.getElementById('qb-search')?.value || '';

  try {
    let questions = [];
    if (isBackendConnected) {
      const res = await fetch(`${API_BASE_URL}/admin/questions?subject=${subject}&difficulty=${difficulty}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) questions = data.questions;
    }

    allQuestionBankList = questions;

    if (questions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No questions found in Question Bank. Click "Add Question" or "Upload Excel MCQs".</td></tr>';
      return;
    }

    tbody.innerHTML = questions.map((q, idx) => {
      const diffClass = (q.difficulty || 'MEDIUM').toLowerCase();
      const correctOptText = q.options && q.options[q.correct] ? q.options[q.correct] : `Option ${q.correct + 1}`;

      return `
        <tr>
          <td><strong>${idx + 1}</strong></td>
          <td><span style="font-weight: 700; color: var(--primary);">${q.subject}</span></td>
          <td style="max-width: 350px; line-height: 1.4;">${q.question}</td>
          <td><span class="diff-badge ${diffClass}">${q.difficulty || 'MEDIUM'}</span></td>
          <td><strong style="color: var(--success);">${String.fromCharCode(65 + (q.correct || 0))}:</strong> ${correctOptText}</td>
          <td>${q.marks || 1}</td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button type="button" class="btn-secondary" style="padding: 0.3rem 0.5rem; font-size: 0.75rem;" onclick="openEditQuestionModal('${q._id}')"><i class="fa-solid fa-pen"></i></button>
              <button type="button" class="btn-secondary" style="padding: 0.3rem 0.5rem; font-size: 0.75rem; color: var(--danger);" onclick="deleteQuestionBankItem('${q._id}')"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Load question bank error:', err);
  }
}

function filterQuestionBank() {
  loadAdminQuestionBank();
}

function openAddQuestionModal() {
  document.getElementById('qe-id').value = '';
  document.getElementById('qe-modal-title').innerText = 'Add New MCQ Question';
  document.getElementById('question-editor-form').reset();
  const modal = document.getElementById('question-editor-modal');
  if (modal) modal.classList.add('active');
}

function handleDifficultyChangeUI() {
  const diffEl = document.getElementById('qe-difficulty');
  const marksEl = document.getElementById('qe-marks');
  if (!diffEl || !marksEl) return;

  const diffUpper = diffEl.value.toString().trim().toUpperCase();
  if (diffUpper === 'EASY') {
    marksEl.value = 1;
  } else if (diffUpper === 'HARD') {
    marksEl.value = 2;
  } else {
    marksEl.value = 2;
  }
}

function openEditQuestionModal(id) {
  const q = allQuestionBankList.find(item => item._id === id);
  if (!q) return;

  const diffStr = q.difficulty || 'Medium';
  const diffUpper = String(diffStr).trim().toUpperCase();
  let normDiff = 'Medium';
  let normMarks = 2;

  if (diffUpper === 'EASY') {
    normDiff = 'Easy';
    normMarks = 1;
  } else if (diffUpper === 'HARD') {
    normDiff = 'Hard';
    normMarks = 2;
  } else {
    normDiff = 'Medium';
    normMarks = 2;
  }

  document.getElementById('qe-id').value = q._id;
  document.getElementById('qe-modal-title').innerText = 'Edit Question';
  document.getElementById('qe-subject').value = q.subject;
  document.getElementById('qe-question').value = q.question;
  document.getElementById('qe-opt-a').value = q.options[0] || '';
  document.getElementById('qe-opt-b').value = q.options[1] || '';
  document.getElementById('qe-opt-c').value = q.options[2] || '';
  document.getElementById('qe-opt-d').value = q.options[3] || '';
  document.getElementById('qe-correct').value = q.correct || 0;
  document.getElementById('qe-difficulty').value = normDiff;
  document.getElementById('qe-marks').value = normMarks;
  document.getElementById('qe-hint').value = q.hint || '';

  const modal = document.getElementById('question-editor-modal');
  if (modal) modal.classList.add('active');
}

function closeQuestionModal() {
  const modal = document.getElementById('question-editor-modal');
  if (modal) modal.classList.remove('active');
}

async function saveQuestionBankItem() {
  const id = document.getElementById('qe-id').value;
  const payload = {
    subject: document.getElementById('qe-subject').value,
    question: document.getElementById('qe-question').value.trim(),
    options: [
      document.getElementById('qe-opt-a').value.trim(),
      document.getElementById('qe-opt-b').value.trim(),
      document.getElementById('qe-opt-c').value.trim(),
      document.getElementById('qe-opt-d').value.trim()
    ],
    correct: parseInt(document.getElementById('qe-correct').value, 10),
    difficulty: document.getElementById('qe-difficulty').value,
    marks: parseInt(document.getElementById('qe-marks').value || 1, 10),
    hint: document.getElementById('qe-hint').value.trim()
  };

  try {
    const url = id ? `${API_BASE_URL}/admin/questions/${id}` : `${API_BASE_URL}/admin/questions`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeQuestionModal();
      loadAdminQuestionBank();
    } else {
      alert(data.message || 'Failed to save question.');
    }
  } catch (err) {
    console.error('Save question error:', err);
  }
}

async function deleteQuestionBankItem(id) {
  if (!confirm('Are you sure you want to delete this question?')) return;
  try {
    await fetch(`${API_BASE_URL}/admin/questions/${id}`, { method: 'DELETE' });
    loadAdminQuestionBank();
  } catch (err) {
    console.error('Delete question error:', err);
  }
}

// Excel File Upload & Import Preview
function handleExcelFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result;
    currentExcelImportData = base64Data;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/questions/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64Data, confirm: false })
      });
      const data = await res.json();
      if (data.success && data.preview) {
        document.getElementById('imp-total-found').innerText = data.summary.totalFound;
        document.getElementById('imp-valid-count').innerText = data.summary.validCount;
        document.getElementById('imp-invalid-count').innerText = data.summary.invalidCount;
        document.getElementById('imp-duplicate-count').innerText = data.summary.duplicateCount;

        const modal = document.getElementById('excel-import-preview-modal');
        if (modal) modal.classList.add('active');
      } else {
        alert(data.message || 'Failed to process Excel file.');
      }
    } catch (err) {
      console.error('Excel upload error:', err);
    }
  };
  reader.readAsDataURL(file);
}

function closeExcelPreviewModal() {
  const modal = document.getElementById('excel-import-preview-modal');
  if (modal) modal.classList.remove('active');
}

async function confirmExcelImport() {
  if (!currentExcelImportData) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileData: currentExcelImportData, confirm: true })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 ${data.importedCount} questions successfully imported into Question Bank!`);
      closeExcelPreviewModal();
      loadAdminQuestionBank();
    } else {
      alert(data.message || 'Import failed.');
    }
  } catch (err) {
    console.error('Confirm import error:', err);
  }
}

// Student Roster Management
async function loadAdminStudentsRoster() {
  const tbody = document.getElementById('admin-students-table-body');
  if (!tbody) return;

  try {
    let students = [];
    if (isBackendConnected) {
      const res = await fetch(`${API_BASE_URL}/admin/students`);
      const data = await res.json();
      if (data.success) students = data.students;
    }

    if (!students || students.length === 0) {
      renderAdminStudentsTable(); // Fallback generate 66 roll numbers
      return;
    }

    tbody.innerHTML = students.map((s, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--accent-cyan);">${s.regNo}</td>
        <td style="font-weight: 700;">${s.name}</td>
        <td>${s.year}</td>
        <td>${s.section}</td>
        <td><strong>${s.totalAttempts || 0}</strong> attempt(s)</td>
        <td><span class="status-pill ${s.latestStatus === 'SUBMITTED' ? 'available' : 'upcoming'}">${s.latestStatus || 'NOT_STARTED'}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    renderAdminStudentsTable();
  }
}

// Security Reports & Violation Summary
async function loadAdminSecurityReports() {
  try {
    let summary = { tabSwitches: 0, fullscreenExits: 0, windowBlurs: 0, totalViolations: 0 };
    let events = [];

    if (isBackendConnected) {
      const res = await fetch(`${API_BASE_URL}/admin/security-events`);
      const data = await res.json();
      if (data.success) {
        summary = data.summary;
        events = data.events;
      }
    }

    document.getElementById('sec-stat-total').innerText = summary.totalViolations;
    document.getElementById('sec-stat-tab').innerText = summary.tabSwitches;
    document.getElementById('sec-stat-fullscreen').innerText = summary.fullscreenExits;
    document.getElementById('sec-stat-blur').innerText = summary.windowBlurs;

    const tbody = document.getElementById('sec-events-table-body');
    if (tbody) {
      if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No security violations recorded yet. Integrity status clean!</td></tr>';
      } else {
        tbody.innerHTML = events.map(e => `
          <tr>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${e.timestamp}</td>
            <td style="font-weight: 700;">${e.studentName || 'Student'}</td>
            <td style="font-family: 'JetBrains Mono', monospace; color: var(--primary);">${e.regNo}</td>
            <td>${e.subject}</td>
            <td><span class="status-pill cancelled">${e.eventType}</span></td>
            <td><strong>${e.violationCount || 1}</strong></td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Load security reports error:', err);
  }
}

// Live Student Exam Participation Monitoring
async function loadExamParticipationStatus() {
  const examId = document.getElementById('part-exam-select')?.value || 'EXAM_CN_001';
  const tbody = document.getElementById('part-status-table-body');
  if (!tbody) return;

  try {
    let studentStatusList = [];
    if (isBackendConnected) {
      const res = await fetch(`${API_BASE_URL}/admin/participation/${examId}`);
      const data = await res.json();
      if (data.success) studentStatusList = data.studentStatusList;
    }

    if (studentStatusList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No student participation data found for selected exam.</td></tr>';
      return;
    }

    tbody.innerHTML = studentStatusList.map(s => {
      let statusClass = 'upcoming';
      if (s.status === 'SUBMITTED') statusClass = 'available';
      else if (s.status === 'IN_PROGRESS') statusClass = 'in-progress';
      else if (s.status === 'CANCELLED') statusClass = 'cancelled';

      return `
        <tr>
          <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--accent-cyan);">${s.regNo}</td>
          <td style="font-weight: 700;">${s.studentName}</td>
          <td><span class="status-pill ${statusClass}">${s.status}</span></td>
          <td style="font-size: 0.82rem; color: var(--text-muted);">${s.cancelReason ? `Cancelled: ${s.cancelReason}` : (s.status === 'SUBMITTED' ? 'Completed & Evaluated' : 'N/A')}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : '—'}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString() : '—'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Load participation error:', err);
  }
}

function renderAdminSubjectsGrid() {
  const grid = document.getElementById('admin-subjects-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const subjects = [
    { title: 'Computer Networks', code: 'CSE-301', questions: 20, time: '20 Mins', type: 'Core Engineering' },
    { title: 'Finite Automata', code: 'CSE-302', questions: 20, time: '20 Mins', type: 'Core Engineering' },
    { title: 'Data Warehouse and Data Mining', code: 'CSE-303', questions: 20, time: '20 Mins', type: 'Core Engineering' },
    { title: 'Fundamentals of Computing', code: 'GEN-101', questions: 20, time: '20 Mins', type: 'General Engineering' }
  ];

  subjects.forEach(sub => {
    const card = document.createElement('div');
    card.className = 'admin-subject-card';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 700; color: var(--primary);">${sub.code}</span>
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-top: 0.2rem;">${sub.title}</h3>
        </div>
        <span class="status-pill pass">${sub.type}</span>
      </div>

      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
        <div style="margin-bottom: 0.35rem;"><i class="fa-solid fa-list-check" style="color: var(--primary);"></i> ${sub.questions} Multiple Choice Questions</div>
        <div><i class="fa-regular fa-clock" style="color: var(--accent-cyan);"></i> Duration: ${sub.time}</div>
      </div>

      <button type="button" class="btn-secondary" style="width: 100%; justify-content: center;" onclick="alert('${sub.title} question bank loaded and ready for examination!')">
        <i class="fa-solid fa-eye"></i> View Paper Specification
      </button>
    `;
    grid.appendChild(card);
  });
}

// URL Route Detection for /admin and #admin
function checkUrlRoute() {
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (path.includes('/admin') || hash === '#admin') {
    console.log("🔒 /admin URL route detected! Opening Admin Portal modal...");
    setTimeout(() => {
      dismissIntro();
      openAdminModal();
    }, 450);
  }
}

// Return to Dashboard
function returnToDashboard() {
  if (isLoggedIn) {
    showPage('dashboard-page');
  } else {
    showPage('login-page');
  }
}

// Opening Animation Controller (1.3x Speed: ~3.33s Total)
let introDismissed = false;
let introTimer = null;

function runIntroAnimation() {
  const introOverlay = document.getElementById('intro-overlay');
  if (!introOverlay) return;

  introDismissed = false;

  // Auto dismiss after 3.08 seconds at 1.3x speed (0.25s fade-out completes at ~3.33 seconds total)
  introTimer = setTimeout(() => {
    dismissIntro();
  }, 3080);

  // Esc/Space/Enter key listener to skip intro
  window.addEventListener('keydown', handleIntroKeyPress);
}

function handleIntroKeyPress(e) {
  if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
    dismissIntro();
  }
}

function dismissIntro() {
  if (introDismissed) return;
  introDismissed = true;

  if (introTimer) {
    clearTimeout(introTimer);
    introTimer = null;
  }

  window.removeEventListener('keydown', handleIntroKeyPress);

  const introOverlay = document.getElementById('intro-overlay');
  if (introOverlay) {
    introOverlay.classList.add('dismissed');
    setTimeout(() => {
      introOverlay.style.display = 'none';
      showPage('login-page');
      const studentInput = document.getElementById('student-id');
      if (studentInput) {
        studentInput.focus();
      }
    }, 250);
  }
}

// ==========================================================================
// FACULTY RESULT MANAGEMENT & SECURE EXCEL EXPORT LOGIC
// ==========================================================================

async function loadFacultyResultsTable() {
  const tbody = document.getElementById('admin-results-table-body');
  if (!tbody) return;

  const currentFacultyId = facultyUser?.id || 'FACULTY01';
  const isMasterAdmin = facultyUser?.role === 'ADMIN';

  // Toggle Admin Permission Control button
  const adminBtn = document.getElementById('btn-admin-manage-perms');
  if (adminBtn) {
    adminBtn.style.display = isMasterAdmin ? 'inline-flex' : 'none';
  }

  // Populate Subject Filter Options based on Faculty Assignment Scope
  const subjectSelect = document.getElementById('fac-filter-subject');
  if (subjectSelect && facultyUser && facultyUser.role === 'FACULTY' && Array.isArray(facultyUser.assignedSubjects) && facultyUser.assignedSubjects.length > 0) {
    const currentVal = subjectSelect.value;
    subjectSelect.innerHTML = `<option value="ALL">All Authorized Subjects (${facultyUser.assignedSubjects.length})</option>` +
      facultyUser.assignedSubjects.map(s => `<option value="${s}">${s}</option>`).join('');
    if (facultyUser.assignedSubjects.includes(currentVal)) {
      subjectSelect.value = currentVal;
    }
  }

  const subject = document.getElementById('fac-filter-subject')?.value || 'ALL';
  const year = document.getElementById('fac-filter-year')?.value || 'ALL';
  const section = document.getElementById('fac-filter-section')?.value || 'ALL';
  const status = document.getElementById('fac-filter-status')?.value || 'ALL';
  const search = document.getElementById('fac-search-input')?.value || '';

  tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 2rem;">Loading examination results from secure server...</td></tr>';

  try {
    // 1. Fetch Summary KPI Metrics
    const summaryRes = await fetch(`${API_BASE_URL}/results/faculty/summary`, {
      headers: { 'x-faculty-id': currentFacultyId }
    });
    const summaryData = await summaryRes.json();
    if (summaryData.success && summaryData.summary) {
      document.getElementById('fac-kpi-total-submissions').innerText = summaryData.summary.totalSubmissions || 0;
      document.getElementById('fac-kpi-pass-count').innerText = summaryData.summary.passCount || 0;
      document.getElementById('fac-kpi-fail-count').innerText = summaryData.summary.failCount || 0;
      document.getElementById('fac-kpi-avg-marks').innerText = `${summaryData.summary.averageMarks || 0}%`;

      const retryBtn = document.getElementById('btn-retry-excel-sync');
      if (retryBtn) {
        if (summaryData.summary.pendingExcelSyncCount > 0) {
          retryBtn.style.color = 'var(--warning)';
          retryBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Retry Sync (${summaryData.summary.pendingExcelSyncCount})`;
        } else {
          retryBtn.style.color = '';
          retryBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Retry Sync`;
        }
      }
    }

    // 2. Fetch Filtered Result Records
    const url = `${API_BASE_URL}/results/faculty/all?subject=${encodeURIComponent(subject)}&year=${encodeURIComponent(year)}&section=${encodeURIComponent(section)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`;
    const res = await fetch(url, {
      headers: { 'x-faculty-id': currentFacultyId }
    });

    if (res.status === 403) {
      const err = await res.json();
      tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--danger); font-weight: 700; padding: 2rem;">⛔ ${err.message || 'Access Denied. Faculty Authorization Required.'}</td></tr>`;
      return;
    }

    const data = await res.json();
    if (!data.success || !Array.isArray(data.results) || data.results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; color: var(--text-muted); padding: 2rem;">No examination results found matching the selected filters.</td></tr>';
      return;
    }

    tbody.innerHTML = data.results.map((r, idx) => {
      const statusClass = r.status === 'PASS' ? 'pass' : 'fail';
      const syncStatusBadge = r.excelSynced !== false 
        ? '<span class="status-pill pass" title="Result successfully stored in Excel workbook"><i class="fa-solid fa-check"></i> Synced</span>'
        : '<span class="status-pill fail" title="Excel write pending/locked"><i class="fa-solid fa-clock"></i> Pending</span>';

      const easyCount = r.easyCount !== undefined ? r.easyCount : 0;
      const mediumCount = r.mediumCount !== undefined ? r.mediumCount : 0;
      const hardCount = r.hardCount !== undefined ? r.hardCount : 0;
      const hintsUsed = r.hintsUsed !== undefined ? r.hintsUsed : 0;

      return `
        <tr>
          <td><strong>${idx + 1}</strong></td>
          <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--primary);">${r.regNo}</td>
          <td style="font-weight: 700;">${r.studentName}</td>
          <td>${r.year || 'III B.Tech'} - ${r.section || 'A'}</td>
          <td>${r.subject}</td>
          <td><span style="font-size: 0.8rem; font-weight: 600;">${easyCount}E / ${mediumCount}M / ${hardCount}H</span></td>
          <td><span style="font-weight: 700; color: ${hintsUsed > 0 ? 'var(--warning)' : 'inherit'};">${hintsUsed}</span></td>
          <td><strong>${r.marksObtained}</strong></td>
          <td>${r.percentage}%</td>
          <td><span class="status-pill ${statusClass}">${r.status}</span></td>
          <td><span style="font-size: 0.8rem;">Switch: ${r.tabSwitchCount || 0} | FS: ${r.fullscreenExitCount || 0}</span></td>
          <td>${syncStatusBadge}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Load faculty results error:', err);
    tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: var(--danger); padding: 2rem;">Error loading results: ${err.message}</td></tr>`;
  }
}

function filterFacultyResultsUI() {
  loadFacultyResultsTable();
}

// Download Excel File for Authorized Faculty Subject
async function downloadFacultyExcel() {
  const currentFacultyId = facultyUser?.id || 'FACULTY01';
  const subject = document.getElementById('fac-filter-subject')?.value || 'ALL';

  try {
    const url = `${API_BASE_URL}/results/faculty/export?subject=${encodeURIComponent(subject)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-faculty-id': currentFacultyId }
    });

    if (response.status === 403) {
      const err = await response.json();
      alert(`⛔ ${err.message || 'Access denied. You are not authorized for this subject.'}`);
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'No results found to export.' }));
      alert(`⚠️ ${err.message}`);
      return;
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `ALIET_${(subject || 'Exam').replace(/\s+/g, '_')}_Results.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);

    console.log(`📊 Successfully downloaded Excel result sheet for ${subject}`);
  } catch (err) {
    console.error('Download Excel error:', err);
    alert('Failed to download Excel file: ' + err.message);
  }
}

// Export Filtered Results to Excel
async function exportFilteredFacultyResults() {
  const currentFacultyId = facultyUser?.id || 'FACULTY01';
  const subject = document.getElementById('fac-filter-subject')?.value || 'ALL';
  const year = document.getElementById('fac-filter-year')?.value || 'ALL';
  const section = document.getElementById('fac-filter-section')?.value || 'ALL';
  const status = document.getElementById('fac-filter-status')?.value || 'ALL';
  const search = document.getElementById('fac-search-input')?.value || '';

  try {
    const url = `${API_BASE_URL}/results/faculty/export?subject=${encodeURIComponent(subject)}&year=${encodeURIComponent(year)}&section=${encodeURIComponent(section)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-faculty-id': currentFacultyId }
    });

    if (response.status === 403) {
      const err = await response.json();
      alert(`⛔ ${err.message || 'Access denied. You are not authorized for this subject.'}`);
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'No results found to export.' }));
      alert(`⚠️ ${err.message}`);
      return;
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `ALIET_Filtered_Exam_Results_${Date.now().toString().slice(-4)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);

    console.log(`📊 Successfully exported filtered Excel result dataset`);
  } catch (err) {
    console.error('Export filtered results error:', err);
    alert('Failed to export filtered results: ' + err.message);
  }
}

// Retry Failed Excel Writes
async function retryExcelSync() {
  const currentFacultyId = facultyUser?.id || 'FACULTY01';
  try {
    const res = await fetch(`${API_BASE_URL}/results/faculty/retry-sync`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-faculty-id': currentFacultyId 
      }
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 ${data.message}`);
      loadFacultyResultsTable();
    } else {
      alert(`⚠️ ${data.message}`);
    }
  } catch (err) {
    console.error('Retry sync error:', err);
    alert('Retry sync error: ' + err.message);
  }
}

// Admin Faculty Permission Control Modal
function openFacultyPermissionsModal() {
  const modal = document.getElementById('faculty-permissions-modal');
  if (modal) {
    modal.classList.add('active');
    loadSelectedFacultyPermissions();
  }
}

function closeFacultyPermissionsModal() {
  const modal = document.getElementById('faculty-permissions-modal');
  if (modal) modal.classList.remove('active');
}

function loadSelectedFacultyPermissions() {
  const facultyId = document.getElementById('fp-faculty-select')?.value || 'FACULTY01';
  
  // Set checkboxes based on selected faculty member
  const cn = document.getElementById('fp-subj-cn');
  const fa = document.getElementById('fp-subj-fa');
  const dw = document.getElementById('fp-subj-dw');
  const fc = document.getElementById('fp-subj-fc');
  const qc = document.getElementById('fp-subj-qc');

  if (facultyId === 'FACULTY01') {
    if (cn) cn.checked = true;
    if (fa) fa.checked = true;
    if (dw) dw.checked = true;
    if (fc) fc.checked = true;
    if (qc) qc.checked = true;
  } else if (facultyId === 'FACULTY_CN') {
    if (cn) cn.checked = true;
    if (fa) fa.checked = true;
    if (dw) dw.checked = false;
    if (fc) fc.checked = false;
    if (qc) qc.checked = false;
  } else if (facultyId === 'FACULTY_DW') {
    if (cn) cn.checked = false;
    if (fa) fa.checked = false;
    if (dw) dw.checked = true;
    if (fc) fc.checked = true;
    if (qc) qc.checked = false;
  }
}

async function saveFacultyPermissions() {
  const facultyRegNo = document.getElementById('fp-faculty-select')?.value;
  const assignedSubjects = [];

  if (document.getElementById('fp-subj-cn')?.checked) assignedSubjects.push('Computer Networks');
  if (document.getElementById('fp-subj-fa')?.checked) assignedSubjects.push('Finite Automata');
  if (document.getElementById('fp-subj-dw')?.checked) assignedSubjects.push('Data Warehouse and Data Mining');
  if (document.getElementById('fp-subj-fc')?.checked) assignedSubjects.push('Fundamentals of Computing');
  if (document.getElementById('fp-subj-qc')?.checked) assignedSubjects.push('Quantum Computing');

  try {
    const res = await fetch(`${API_BASE_URL}/admin/faculty/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facultyRegNo, assignedSubjects })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 ${data.message}`);
      closeFacultyPermissionsModal();
      loadFacultyResultsTable();
    } else {
      alert(`⚠️ ${data.message}`);
    }
  } catch (err) {
    console.error('Save faculty permissions error:', err);
    alert('Save permissions error: ' + err.message);
  }
}

// Initialize application on page load
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initTheme === 'function') initTheme();
  runIntroAnimation();
  checkBackendStatus();
  showPage('login-page');
  checkUrlRoute();
});

window.addEventListener('hashchange', checkUrlRoute);


