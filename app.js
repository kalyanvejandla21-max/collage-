// API Base URL for Node.js Express Backend
const API_BASE_URL = 'http://localhost:5000/api';
let isBackendConnected = false;

// State Variables
let isLoggedIn = false;
let currentStudent = {
  name: "Kalyan",
  regNo: "23A91A0501",
  year: "III B.Tech",
  section: "A"
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

// Page 1: Login Handler (Strict Validation & Backend Authentication)
async function handleLogin() {
  clearLoginError();
  const studentIdInput = document.getElementById('student-id')?.value.trim() || '';
  const passwordInput = document.getElementById('password')?.value || '';

  // 1. Strict Roll Number Validation (24HP1A0501 - 24HP1A0566)
  if (!isValidRollNumber(studentIdInput)) {
    showLoginError("Invalid Roll Number! Only registered students can access the exam.");
    return;
  }

  // 2. Strict Password Validation (8+ chars, 1 uppercase, 1 symbol)
  const passCheck = checkPasswordCriteria(passwordInput);
  if (!passCheck.isValid) {
    showLoginError("Password must have 8+ characters, 1 uppercase, 1 symbol");
    return;
  }

  currentStudent.regNo = studentIdInput.toUpperCase();

  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regNo: currentStudent.regNo, password: passwordInput })
      });
      const data = await res.json();
      if (data.success && data.student) {
        currentStudent.name = data.student.name;
        currentStudent.year = data.student.year || 'III B.Tech';
        currentStudent.section = data.student.section || 'A';
      } else {
        showLoginError(data.message || "Invalid Roll Number! Only registered students can access the exam.");
        return;
      }
    } catch (e) {
      console.error("Backend login error:", e);
      currentStudent.name = getStudentNameByRollNo(currentStudent.regNo);
    }
  } else {
    currentStudent.name = getStudentNameByRollNo(currentStudent.regNo);
  }

  isLoggedIn = true;

  // Update UI headers across all screens
  document.getElementById('header-student-name').innerText = currentStudent.name;
  document.getElementById('header-student-reg').innerText = currentStudent.regNo;
  document.getElementById('dash-student-name').innerText = currentStudent.name;
  document.getElementById('dash-reg-no').innerText = currentStudent.regNo;

  // Update header avatar initials
  const avatarEl = document.getElementById('avatar-initials');
  if (avatarEl) {
    avatarEl.innerText = currentStudent.name.charAt(0).toUpperCase();
  }

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

// Render Sidebar Question Grid
function renderGridPalette() {
  const gridContainer = document.getElementById('question-grid-palette');
  if (!gridContainer) return;
  gridContainer.innerHTML = '';

  for (let i = 0; i < currentQuestions.length; i++) {
    const pill = document.createElement('div');
    let pillClass = 'q-pill';

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

// Modal Submission Confirmation
function confirmSubmitExam() {
  let answeredCount = 0;
  for (let i = 0; i < userAnswers.length; i++) {
    if (userAnswers[i] !== null) answeredCount++;
  }
  const unansweredCount = currentQuestions.length - answeredCount;

  document.getElementById('modal-summary-text').innerText = 
    `You have answered ${answeredCount} out of ${currentQuestions.length} questions (${unansweredCount} unanswered). Are you ready to submit your paper?`;
  
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
        subject: selectedSubject,
        userAnswers: userAnswers,
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
  const breakdownContainer = document.getElementById('answer-breakdown-list');
  breakdownContainer.innerHTML = '';

  const labels = ['A', 'B', 'C', 'D'];

  if (backendResultDoc && backendResultDoc.breakdown && backendResultDoc.breakdown.length > 0) {
    correctCount = backendResultDoc.correctCount;
    wrongCount = backendResultDoc.wrongCount;

    backendResultDoc.breakdown.forEach((item, idx) => {
      const q = currentQuestions[idx] || { options: [] };
      const studentAnsText = item.userAnswer !== null && item.userAnswer !== undefined && q.options[item.userAnswer]
        ? `${labels[item.userAnswer]}. ${q.options[item.userAnswer]}`
        : '<span style="color: var(--warning);">Not Answered</span>';
      
      const correctAnsText = q.options[item.correctAnswer]
        ? `${labels[item.correctAnswer]}. ${q.options[item.correctAnswer]}`
        : `Option ${labels[item.correctAnswer]}`;

      const reviewCard = document.createElement('div');
      reviewCard.className = `review-item ${item.isCorrect ? 'is-correct' : 'is-wrong'}`;

      reviewCard.innerHTML = `
        <div class="review-item-header">
          <div>Q${idx + 1}. ${item.question}</div>
          <div style="color: ${item.isCorrect ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">
            ${item.isCorrect ? '<i class="fa-solid fa-circle-check"></i> Correct (+1)' : '<i class="fa-solid fa-circle-xmark"></i> Incorrect (0)'}
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
          <i class="fa-solid fa-lightbulb" style="color: var(--warning);"></i> <strong>Explanation:</strong> ${item.explanation}
        </div>
      `;
      breakdownContainer.appendChild(reviewCard);
    });
  } else {
    // Client-side Fallback calculation
    currentQuestions.forEach((q, idx) => {
      const studentAns = userAnswers[idx];
      const isCorrect = studentAns === q.correct;

      if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }

      const studentAnsText = studentAns !== null ? `${labels[studentAns]}. ${q.options[studentAns]}` : '<span style="color: var(--warning);">Not Answered</span>';
      const correctAnsText = `${labels[q.correct]}. ${q.options[q.correct]}`;

      const reviewCard = document.createElement('div');
      reviewCard.className = `review-item ${isCorrect ? 'is-correct' : 'is-wrong'}`;

      reviewCard.innerHTML = `
        <div class="review-item-header">
          <div>Q${idx + 1}. ${q.question}</div>
          <div style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">
            ${isCorrect ? '<i class="fa-solid fa-circle-check"></i> Correct (+1)' : '<i class="fa-solid fa-circle-xmark"></i> Incorrect (0)'}
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
          <i class="fa-solid fa-lightbulb" style="color: var(--warning);"></i> <strong>Explanation:</strong> ${q.explanation}
        </div>
      `;
      breakdownContainer.appendChild(reviewCard);
    });
  }

  const totalQ = backendResultDoc ? backendResultDoc.totalQuestions : currentQuestions.length;
  const percentage = backendResultDoc ? backendResultDoc.percentage : Math.round((correctCount / totalQ) * 100);
  const isPass = percentage >= 40;

  // Render Result Cards
  document.getElementById('res-student-name').innerText = currentStudent.name;
  document.getElementById('res-reg-no').innerText = currentStudent.regNo;
  document.getElementById('res-subject-name').innerText = selectedSubject;

  document.getElementById('res-total-q').innerText = totalQ;
  document.getElementById('res-correct-count').innerText = correctCount;
  document.getElementById('res-wrong-count').innerText = wrongCount;
  document.getElementById('res-marks-obtained').innerText = `${correctCount} / ${totalQ}`;
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
  else if (sectionName === 'results') loadAdminResultsTable();
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

function openEditQuestionModal(id) {
  const q = allQuestionBankList.find(item => item._id === id);
  if (!q) return;

  document.getElementById('qe-id').value = q._id;
  document.getElementById('qe-modal-title').innerText = 'Edit Question';
  document.getElementById('qe-subject').value = q.subject;
  document.getElementById('qe-question').value = q.question;
  document.getElementById('qe-opt-a').value = q.options[0] || '';
  document.getElementById('qe-opt-b').value = q.options[1] || '';
  document.getElementById('qe-opt-c').value = q.options[2] || '';
  document.getElementById('qe-opt-d').value = q.options[3] || '';
  document.getElementById('qe-correct').value = q.correct || 0;
  document.getElementById('qe-difficulty').value = q.difficulty || 'MEDIUM';
  document.getElementById('qe-marks').value = q.marks || 1;
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

// Opening Animation Controller
let introDismissed = false;
let introTimer = null;

function runIntroAnimation() {
  const introOverlay = document.getElementById('intro-overlay');
  if (!introOverlay) return;

  introDismissed = false;

  // Auto dismiss after 4.0 seconds (exact requested animation duration)
  introTimer = setTimeout(() => {
    dismissIntro();
  }, 4000);

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
    }, 450);
  }
}

// Logout Handler
function handleLogout() {
  isLoggedIn = false;
  clearInterval(timerInterval);
  removeSecurityEventListeners();
  showPage('login-page');
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


