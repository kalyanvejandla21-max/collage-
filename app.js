// Dynamic API Base URL resolver (Supports Vercel serverless, custom backend endpoints, mobile browsers, & local dev)
function getApiBaseUrl() {
  if (window.ENV_API_URL && window.ENV_API_URL.trim()) {
    return window.ENV_API_URL.replace(/\/+$/, '');
  }
  const metaApi = document.querySelector('meta[name="api-base-url"]');
  if (metaApi && metaApi.content && metaApi.content.trim()) {
    return metaApi.content.replace(/\/+$/, '');
  }
  
  const hostname = window.location.hostname;
  const savedUrl = localStorage.getItem('EXAM_PORTAL_API_URL');

  // CRITICAL FIX: If running on a deployed domain (e.g. Vercel), ignore stale localhost API URLs!
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    if (savedUrl && (savedUrl.includes('localhost') || savedUrl.includes('127.0.0.1'))) {
      console.warn("⚠️ Purged stale localhost API URL on deployed origin:", savedUrl);
      localStorage.removeItem('EXAM_PORTAL_API_URL');
    } else if (savedUrl && savedUrl.trim()) {
      return savedUrl.replace(/\/+$/, '');
    }
    return `${window.location.origin}/api`;
  }

  if (savedUrl && savedUrl.trim()) {
    return savedUrl.replace(/\/+$/, '');
  }

  return `http://${hostname}:${window.location.port === '5000' ? '5000' : '5000'}/api`;
}

let API_BASE_URL = getApiBaseUrl();
let isBackendConnected = false;

// Configurable API Server URL Setter
function updateApiBaseUrl(newUrl) {
  if (newUrl && newUrl.trim()) {
    let cleanUrl = newUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/api')) {
      cleanUrl += '/api';
    }
    localStorage.setItem('EXAM_PORTAL_API_URL', cleanUrl);
  } else {
    localStorage.removeItem('EXAM_PORTAL_API_URL');
  }
  API_BASE_URL = getApiBaseUrl();
  console.log("🔗 Updated API Base URL:", API_BASE_URL);
}

function promptApiServerUrl() {
  const currentUrl = API_BASE_URL;
  const input = prompt("Enter your Backend API Base URL:\n(e.g., http://192.168.1.10:5000/api or https://your-backend.onrender.com/api)", currentUrl);
  if (input !== null) {
    if (input.trim() === '') {
      localStorage.removeItem('EXAM_PORTAL_API_URL');
      alert("API URL reset to automatic detection.");
    } else {
      updateApiBaseUrl(input.trim());
      alert("API Base URL updated to: " + API_BASE_URL);
    }
  }
}

// Format time string into standard 12-Hour HH:MM AM/PM format
function formatTime12Hour(timeStr) {
  if (!timeStr) return '';
  const str = String(timeStr).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    let ampm = match[4] ? match[4].toUpperCase() : null;
    if (!ampm) {
      ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
    } else {
      if (hours > 12) hours = hours % 12;
      if (hours === 0) hours = 12;
    }
    const padH = String(hours).padStart(2, '0');
    return `${padH}:${minutes} ${ampm}`;
  }
  return str;
}

// Parse 'YYYY-MM-DD' and 'HH:MM AM/PM' or 'HH:MM' into Date object in Asia/Kolkata (+05:30)
function parseExamTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return new Date();
  
  const dateParts = String(dateStr).trim().split('-').map(Number);
  if (dateParts.length < 3) return new Date();
  const [year, month, day] = dateParts;

  let hours = 0;
  let minutes = 0;
  const str = String(timeStr).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const ampm = match[4] ? match[4].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  } else {
    const parts = str.split(':').map(Number);
    if (parts.length >= 2) {
      hours = parts[0] || 0;
      minutes = parts[1] || 0;
    }
  }

  const pad = (num) => String(num).padStart(2, '0');
  const isoStr = `${pad(year)}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+05:30`;
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

// State Variables
let isLoggedIn = false;
let currentStudent = {
  name: "Student",
  regNo: "",
  department: "CSE",
  course: "B.Tech",
  year: "3",
  semester: "1",
  section: "A",
  photo_url: "",
  role: "STUDENT"
};

function getStudentNameByRollNo(regNo) {
  const cleanReg = (regNo || '').trim().toUpperCase();
  if (currentStudent && currentStudent.regNo === cleanReg && currentStudent.name) {
    return currentStudent.name;
  }
  return `Student (${cleanReg})`;
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

// Universal Roll Number Validation (Supports all registered student IDs)
function isValidRollNumber(regNo) {
  if (!regNo) return false;
  return String(regNo).trim().length > 0;
}

// Password Criteria Check (Min 8 chars, 1 uppercase letter, 1 special symbol)
function checkPasswordCriteria(password) {
  const passStr = String(password || '');
  const lengthOk = passStr.length >= 8;
  const upperOk = /[A-Z]/.test(passStr);
  const symbolOk = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passStr);
  const isValid = lengthOk && upperOk && symbolOk;
  return { isValid, lengthOk, upperOk, symbolOk };
}

function validatePasswordRealtime() {
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('login-submit-btn');
  if (!passwordInput) return;
  const val = passwordInput.value;
  const { lengthOk, upperOk, symbolOk } = checkPasswordCriteria(val);

  updateHintItem('hint-length', lengthOk, 'At least 8 characters');
  updateHintItem('hint-upper', upperOk, 'At least 1 uppercase letter (A-Z)');
  updateHintItem('hint-symbol', symbolOk, 'At least 1 special symbol (@, #, $, !, %, etc.)');

  if (submitBtn) {
    const hasValue = String(val).trim().length > 0;
    submitBtn.disabled = !hasValue;
    submitBtn.style.opacity = hasValue ? '1' : '0.6';
    submitBtn.style.cursor = hasValue ? 'pointer' : 'not-allowed';
  }
}

function updateHintItem(elementId, isMet, textLabel) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (isMet) {
    el.className = 'hint-item valid';
    el.style.color = '#10b981';
    el.innerHTML = `<i class="fa-solid fa-circle-check status-icon" style="color: #10b981;"></i> <span>${textLabel}</span>`;
  } else {
    el.className = 'hint-item invalid';
    el.style.color = '#ef4444';
    el.innerHTML = `<i class="fa-solid fa-circle-xmark status-icon" style="color: #ef4444;"></i> <span>${textLabel}</span>`;
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
    const studentInput = document.getElementById('student-id');
    const passwordInput = document.getElementById('password');
    if (studentInput) studentInput.value = '';
    if (passwordInput) passwordInput.value = '';
    clearLoginError();
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
  const regNo = currentStudent.regNo || currentStudent.hallticket || currentStudent.registrationId || '';
  const dept = currentStudent.department || currentStudent.branch || 'CSE';
  const yearStr = currentStudent.year || '3';
  const semStr = currentStudent.semester || '1';
  const secStr = currentStudent.section || 'A';
  const courseStr = currentStudent.course || 'B.Tech';

  // 1. Header User Badge Updates
  const headerName = document.getElementById('header-student-name');
  const headerDept = document.getElementById('header-student-dept');
  const headerReg = document.getElementById('header-student-reg');

  if (headerName) headerName.innerText = studentName;
  if (headerDept) headerDept.innerText = dept;
  if (headerReg) headerReg.innerText = regNo;

  // 2. Dashboard Student Profile Table Updates
  const dashName = document.getElementById('dash-student-name');
  const dashReg = document.getElementById('dash-reg-no');
  const dashYear = document.getElementById('dash-student-year');
  const dashSec = document.getElementById('dash-student-sec');

  if (dashName) dashName.innerText = studentName;
  if (dashReg) dashReg.innerText = regNo;
  if (dashYear) dashYear.innerText = `Year ${yearStr} • Semester ${semStr}`;
  if (dashSec) dashSec.innerText = `${dept} - Section ${secStr}`;

  // 3. Fallback compatibility for profile-student-* IDs
  const profileName = document.getElementById('profile-student-name');
  const profileReg = document.getElementById('profile-student-reg');
  const profileDept = document.getElementById('profile-student-dept');
  const profileYearSem = document.getElementById('profile-student-yearsem');
  const profileSec = document.getElementById('profile-student-section');
  const profileImg = document.getElementById('profile-student-img');

  if (profileName) profileName.innerText = studentName;
  if (profileReg) profileReg.innerText = regNo;
  if (profileDept) profileDept.innerText = `${dept} (${courseStr})`;
  if (profileYearSem) profileYearSem.innerText = `Year ${yearStr} • Sem ${semStr}`;
  if (profileSec) profileSec.innerText = `Sec ${secStr}`;

  if (profileImg) {
    profileImg.style.display = 'none';
  }

  // 4. Online Exam Page & Results Page Student Info Updates
  const examStudentName = document.getElementById('exam-student-name');
  const examRegNo = document.getElementById('exam-reg-no');
  const resStudentName = document.getElementById('res-student-name');
  const resRegNo = document.getElementById('res-reg-no');

  if (examStudentName) examStudentName.innerText = studentName;
  if (examRegNo) examRegNo.innerText = regNo;
  if (resStudentName) resStudentName.innerText = studentName;
  if (resRegNo) resRegNo.innerText = regNo;

  // 5. Update Exam Watermark & Card Badges
  const examWatermark = document.getElementById('exam-watermark-id');
  if (examWatermark) examWatermark.innerText = `${regNo} • ${studentName}`;
}

// Real-time Student Lookup & Live Details Preview on Typing Roll Number
let studentLookupDebounce = null;
async function lookupStudentRealtime() {
  const input = document.getElementById('student-id');
  const previewBox = document.getElementById('student-id-preview');
  const previewText = document.getElementById('student-preview-text');
  if (!input || !previewBox || !previewText) return;

  const rawVal = input.value.trim();
  if (!rawVal || rawVal.length < 5) {
    previewBox.style.display = 'none';
    return;
  }

  let cleanReg = rawVal.toUpperCase().replace(/[\s\-]/g, '');
  cleanReg = cleanReg.replace(/HPA10?/g, 'HP1A0').replace(/HPA1/g, 'HP1A').replace(/HP1A(\d{3})$/g, 'HP1A0$1');

  if (studentLookupDebounce) clearTimeout(studentLookupDebounce);

  studentLookupDebounce = setTimeout(async () => {
    try {
      let foundStudent = null;
      if (isBackendConnected) {
        const res = await fetch(`${API_BASE_URL}/auth/profile?regNo=${encodeURIComponent(cleanReg)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.student) foundStudent = data.student;
        }
      }
      if (foundStudent) {
        previewText.innerHTML = `<strong>${foundStudent.name}</strong> (${foundStudent.department || 'CSE'} - Year ${foundStudent.year || '3'}, Sec ${foundStudent.section || 'A'})`;
        previewBox.style.display = 'block';
      } else {
        previewBox.style.display = 'none';
      }
    } catch (e) {
      previewBox.style.display = 'none';
    }
  }, 250);
}

// ==========================================================================
// ANIME.JS INPUT VALUE ANIMATION CONTROLLER
// ==========================================================================
const utils = {
  round: (decimals = 0) => {
    const factor = Math.pow(10, decimals);
    return (val) => Math.round(Number(val) * factor) / factor;
  }
};

function animate(target, options = {}) {
  let resolvedTarget = target;
  if (target === 'input') {
    resolvedTarget = '#auth-anim-input';
  }

  if (typeof anime === 'function') {
    const endValue = options.value !== undefined ? options.value : 100;
    const isAlternate = options.alternate === true;
    const isLoop = options.loop !== undefined ? options.loop : false;

    const animConfig = {
      targets: resolvedTarget,
      value: [0, endValue],
      direction: isAlternate ? 'alternate' : 'normal',
      loop: isLoop,
      easing: options.easing || 'easeInOutSine',
      duration: options.duration || 2500,
      round: 1
    };

    if (options.modifier && typeof options.modifier === 'function') {
      const modifierFn = options.modifier;
      animConfig.update = function(anim) {
        const els = typeof resolvedTarget === 'string' ? document.querySelectorAll(resolvedTarget) : [resolvedTarget];
        els.forEach(el => {
          if (el && 'value' in el && anim.animations && anim.animations[0]) {
            el.value = modifierFn(anim.animations[0].currentValue);
          }
        });
      };
    }

    return anime(animConfig);
  }
  return null;
}

let activeInputValueAnim = null;
let activeProgressBarAnim = null;
let isLoginAuthenticating = false;

function startAuthDisplacementAnimation() {
  stopAuthDisplacementAnimation();

  const container = document.getElementById('auth-displacement-container');
  const progressBar = document.getElementById('auth-progress-bar');
  const animInput = document.getElementById('auth-anim-input');

  if (animInput) {
    animInput.value = '0';
  }

  if (container) {
    container.style.display = 'flex';
    void container.offsetWidth; // Force reflow
    container.classList.add('active');
  }

  if (progressBar) {
    progressBar.style.width = '0%';
  }

  // Respect prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (progressBar) progressBar.style.width = '100%';
    return;
  }

  // Exact Anime.js animation requirement:
  // animate('input', { value: 100, modifier: utils.round(0) });
  activeInputValueAnim = animate('input', {
    value: 100,
    modifier: utils.round(0),
  });

  if (progressBar && typeof anime === 'function') {
    activeProgressBarAnim = anime({
      targets: progressBar,
      width: '100%',
      easing: 'linear',
      duration: 3000
    });
  }
}

function stopAuthDisplacementAnimation() {
  if (activeInputValueAnim) {
    try {
      if (typeof activeInputValueAnim.pause === 'function') activeInputValueAnim.pause();
    } catch (e) {}
    activeInputValueAnim = null;
  }

  if (typeof anime === 'function') {
    try { anime.remove('#auth-anim-input'); } catch (e) {}
  }

  if (activeProgressBarAnim) {
    try { activeProgressBarAnim.pause(); } catch (e) {}
    activeProgressBarAnim = null;
  }

  const animInput = document.getElementById('auth-anim-input');
  if (animInput) {
    animInput.value = '0';
  }

  const container = document.getElementById('auth-displacement-container');
  if (container) {
    container.classList.remove('active');
    setTimeout(() => {
      if (!container.classList.contains('active')) {
        container.style.display = 'none';
      }
    }, 300);
  }
}

// Page 1: Login Handler (Universal Student Database Authentication)
async function handleLogin() {
  if (isLoginAuthenticating) return; // Prevent multiple clicks / duplicate animation instances

  clearLoginError();
  const studentIdInput = (document.getElementById('student-id')?.value || '').trim();
  const passwordInput = (document.getElementById('password')?.value || '').trim();

  if (!studentIdInput) {
    showLoginError("Please enter your Registration ID / Hall Ticket Number.");
    return;
  }

  if (!passwordInput) {
    showLoginError("Please enter your password.");
    return;
  }

  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const loginBtnText = document.getElementById('login-submit-btn-text');
  const loginBtnIcon = document.getElementById('login-btn-icon');

  // Lock UI & start SVG displacement animation on Authenticate & Enter click
  isLoginAuthenticating = true;
  if (loginSubmitBtn) {
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.classList.add('loading');
  }
  if (loginBtnText) loginBtnText.textContent = "Authenticating...";
  if (loginBtnIcon) loginBtnIcon.style.display = "none";

  const startTime = Date.now();
  startAuthDisplacementAnimation();

  let cleanReg = studentIdInput.toUpperCase().trim().replace(/[\s\-]/g, '');
  // Auto-correct common student input typos: HPA1 -> HP1A (e.g. 24HPA10566 -> 24HP1A0566)
  cleanReg = cleanReg.replace(/HPA10?/g, 'HP1A0').replace(/HPA1/g, 'HP1A').replace(/HP1A(\d{3})$/g, 'HP1A0$1');
  let data = null;
  let authSuccess = false;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/student-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: cleanReg, regNo: cleanReg, password: passwordInput })
    });

    try {
      data = await res.json();
    } catch (parseErr) {
      data = null;
    }

    if (!res.ok || !data || !data.success || !data.student) {
      // AUTH FAILED: Stop animation immediately and do NOT delay failed logins!
      stopAuthDisplacementAnimation();

      if (!res.ok) {
        if (res.status === 401 || res.status === 404 || res.status === 400) {
          showLoginError((data && data.message) || "Invalid registration ID or password.");
        } else if (res.status === 403) {
          showLoginError((data && data.message) || "Your account is currently inactive. Please contact faculty.");
        } else if (res.status >= 500) {
          showLoginError("Server temporarily unavailable. Please try again.");
        } else {
          showLoginError((data && data.message) || "Invalid registration ID or password.");
        }
      } else {
        showLoginError((data && data.message) || "Invalid registration ID or password.");
      }
      return;
    }

    // AUTH SUCCEEDED: Enforce smooth ~3.0s total visual transition before entering dashboard
    const elapsed = Date.now() - startTime;
    const remainingDelay = Math.max(0, 3000 - elapsed);
    if (remainingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
    }

    // Populate student profile from authenticated database record
    currentStudent = {
      id: data.student.id || data.student.registrationId || cleanReg,
      regNo: data.student.regNo || data.student.registrationId || cleanReg,
      hallticket: data.student.hallticket || data.student.registrationId || cleanReg,
      name: data.student.name || `Student (${cleanReg})`,
      department: data.student.department || data.student.branch || 'CSE',
      course: data.student.course || 'B.Tech',
      year: String(data.student.year || '3'),
      semester: String(data.student.semester || '1'),
      section: data.student.section || 'A',
      photo_url: data.student.photo_url || '',
      role: data.student.role || 'STUDENT',
      mustChangePassword: data.mustChangePassword !== false
    };

    if (data.token) {
      sessionStorage.setItem('student_auth_token', data.token);
    }

    authSuccess = true;

  } catch (e) {
    console.error("Backend student login fetch error:", e);
    stopAuthDisplacementAnimation();
    showLoginError("Server temporarily unavailable. Please verify network connection and try again.");
    return;
  } finally {
    // ALWAYS stop & clean up SVG displacement animation and restore button state
    stopAuthDisplacementAnimation();
    isLoginAuthenticating = false;

    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.classList.remove('loading');
    }
    if (loginBtnText) loginBtnText.textContent = "Authenticate & Enter";
    if (loginBtnIcon) loginBtnIcon.style.display = "inline-block";
  }

  if (authSuccess) {
    isLoggedIn = true;
    updateStudentProfileUI();

    // Route directly to student dashboard upon authentication
    showPage('dashboard-page');
  }
}

// Global Student Logout Handler
function handleLogout() {
  currentStudent = null;
  isLoggedIn = false;
  sessionStorage.removeItem('student_auth_token');
  const studentInput = document.getElementById('student-id');
  const passwordInput = document.getElementById('password');
  if (studentInput) studentInput.value = '';
  if (passwordInput) passwordInput.value = '';
  clearLoginError();
  showPage('login-page');
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
    const regNo = (currentStudent && (currentStudent.regNo || currentStudent.hallticket || currentStudent.registrationId)) || '24HP1A0565';
    let schedulesList = [];

    try {
      const response = await fetch(`${API_BASE_URL}/exams/schedules?regNo=${encodeURIComponent(regNo)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.success && Array.isArray(data.schedules)) {
          schedulesList = data.schedules;
        }
      }
    } catch (apiErr) {
      console.warn("Backend API schedules fetch warning:", apiErr);
    }

    // Merge custom exams created in client/localStorage
    let customExams = [];
    try {
      const stored = localStorage.getItem('aliet_custom_exams');
      if (stored) customExams = JSON.parse(stored);
    } catch (e) {}

    if (customExams && customExams.length > 0) {
      customExams.forEach(le => {
        if (!schedulesList.some(s => s.examId === le.examId || (s.subject === le.subject && s.examName === le.examName))) {
          schedulesList.unshift(le);
        }
      });
    }

    if (schedulesList.length === 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      schedulesList = [
        {
          examId: 'EXAM_CN_001',
          subject: 'Computer Networks',
          examDate: todayStr,
          startTime: '06:00 AM',
          latestAllowedStartTime: '11:59 PM',
          endTime: '11:59 PM',
          durationMinutes: 30,
          totalQuestions: 20,
          studentStatus: 'AVAILABLE'
        },
        {
          examId: 'EXAM_QC_002',
          subject: 'Quantum Computing',
          examDate: todayStr,
          startTime: '06:00 AM',
          latestAllowedStartTime: '11:59 PM',
          endTime: '11:59 PM',
          durationMinutes: 30,
          totalQuestions: 20,
          studentStatus: 'AVAILABLE'
        }
      ];
    }

    container.innerHTML = '';

    const now = new Date();

    schedulesList.forEach(sch => {
      // Dynamically evaluate status based on current time vs start/end time
      if (sch.startTime && sch.examDate && sch.studentStatus !== 'COMPLETED' && sch.studentStatus !== 'IN_PROGRESS' && sch.studentStatus !== 'CANCELLED') {
        const startDt = parseExamTimestamp(sch.examDate, sch.startTime);
        const latestStartDt = parseExamTimestamp(sch.examDate, sch.latestAllowedStartTime || sch.endTime);
        const endDt = parseExamTimestamp(sch.examDate, sch.endTime || '11:59 PM');
        if (now < startDt) {
          sch.studentStatus = 'UPCOMING';
        } else if (now >= startDt && now <= latestStartDt && now <= endDt) {
          sch.studentStatus = 'AVAILABLE';
        } else if (now > latestStartDt || now > endDt) {
          sch.studentStatus = 'EXPIRED';
        }
      }
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
        statusBadgeHtml = `<span class="exam-status-badge upcoming"><i class="fa-solid fa-clock"></i> UPCOMING (${sch.startTime})</span>`;
        actionBtnHtml = `
          <button type="button" class="btn-secondary" style="width: 100%; justify-content: center; opacity: 0.85;" onclick="alert('⏰ Examination Not Started Yet!\\n\\nThis examination for ${sch.subject} is scheduled to start at ${sch.startTime} on ${sch.examDate}.\\n\\nPlease wait until ${sch.startTime} to begin.')">
            <i class="fa-solid fa-clock"></i> [ STARTS AT ${sch.startTime} ]
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
      } else if (st === 'EXPIRED' || st === 'CANCELLED' || st === 'MISSED') {
        statusBadgeHtml = `<span class="exam-status-badge cancelled"><i class="fa-solid fa-circle-xmark"></i> EXAM CLOSED</span>`;
        if (st === 'CANCELLED' || st === 'MISSED') {
          warningBannerHtml = `
            <div class="exam-late-warning-banner">
              <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.2rem;"></i>
              <div>
                <strong>Exam Start Time Expired!</strong><br>
                Your examination start window passed at ${sch.latestAllowedStartTime || sch.endTime}. Attempt has been cancelled (START_TIME_EXPIRED).
              </div>
            </div>
          `;
        }
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

// Start Scheduled Exam with Strict Time-Gating & Backend Authorization Validation
async function startScheduledExam(examId, subject) {
  selectedSubject = subject || 'Computer Networks';
  const regNo = (currentStudent && (currentStudent.regNo || currentStudent.hallticket || currentStudent.registrationId)) || '24HP1A0565';

  // 1. Client-Side Time-Gating Check from custom/local schedules
  let schObj = null;
  try {
    const localStr = localStorage.getItem('aliet_custom_exams');
    if (localStr) {
      const list = JSON.parse(localStr);
      schObj = list.find(s => s.examId === examId);
    }
  } catch (e) {}

  const now = new Date();
  if (schObj && schObj.startTime && schObj.examDate) {
    const startDt = parseExamTimestamp(schObj.examDate, schObj.startTime);
    if (now < startDt) {
      alert(`⛔ ACCESS DENIED: EXAM NOT STARTED YET!\n\nThis examination for '${subject}' is scheduled to start at ${schObj.startTime} on ${schObj.examDate}.\n\nCurrent Time: ${now.toLocaleTimeString()}.\n\nEarly entry (e.g. at 9:45 AM) is not permitted. Please wait until ${schObj.startTime} to start your exam.`);
      return; // DO NOT OPEN EXAM!
    }
  }

  // 2. Strict Backend API Authorization Check
  try {
    const res = await fetch(`${API_BASE_URL}/exams/${encodeURIComponent(examId)}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regNo, studentName: currentStudent ? currentStudent.name : 'Student' })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(`⛔ ${data.message || 'Exam start authorization rejected. Exam has not started yet.'}`);
      loadStudentExamSchedules();
      return; // DO NOT OPEN EXAM!
    }

    console.log("✅ Backend exam start validated:", data.examSession);
    if (data.examSession && data.examSession.sessionDurationSeconds) {
      secondsRemaining = data.examSession.sessionDurationSeconds;
    }
  } catch (err) {
    console.warn("Backend start validation error:", err);
  }

  // Proceed into exam ONLY if time-gating passed
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('student_auth_token') || ''}`
      },
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

    // Summary Sheet Data (Horizontal / Tabular Format - 1 Row per Student)
    const summaryData = [
      {
        'Student Name': studentName,
        'Registration Number': regNo,
        'Subject Paper': subject,
        'Total Questions': totalQ,
        'Correct Answers': correctCount,
        'Wrong Answers': wrongCount,
        'Marks Obtained': `${correctCount} / ${totalQ}`,
        'Percentage': `${percentage}%`,
        'Evaluation Status': status,
        'Fullscreen Exits': fullscreenExitCount,
        'Tab Switches / Focus Loss': tabSwitchCount,
        'Total Security Violations': totalViolationsCount,
        'Timestamp': new Date().toLocaleString()
      }
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
    wsSummary['!cols'] = [
      { wch: 22 }, // Student Name
      { wch: 22 }, // Registration Number
      { wch: 26 }, // Subject Paper
      { wch: 16 }, // Total Questions
      { wch: 16 }, // Correct Answers
      { wch: 16 }, // Wrong Answers
      { wch: 16 }, // Marks Obtained
      { wch: 14 }, // Percentage
      { wch: 18 }, // Evaluation Status
      { wch: 18 }, // Fullscreen Exits
      { wch: 26 }, // Tab Switches / Focus Loss
      { wch: 24 }, // Total Security Violations
      { wch: 24 }  // Timestamp
    ];
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
  if (facultyUser) {
    showPage('admin-page');
    return;
  }
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
  else if (sectionName === 'passwords') loadAdminPasswordTable();
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

    // Refresh active section pane if user is currently viewing a specific tab
    const activeNav = document.querySelector('.admin-nav-item.active');
    if (activeNav) {
      const sectionId = activeNav.id.replace('nav-btn-', '');
      if (sectionId === 'schedules') loadAdminSchedules();
      else if (sectionId === 'questions') loadAdminQuestionBank();
      else if (sectionId === 'students') loadAdminStudentsRoster();
      else if (sectionId === 'passwords') loadAdminPasswordTable();
      else if (sectionId === 'results') loadFacultyResultsTable();
      else if (sectionId === 'security') loadAdminSecurityReports();
      else if (sectionId === 'participation') loadExamParticipationStatus();
    }
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
  const startTimeRaw = document.getElementById('ce-start-time').value.trim();
  const latestAllowedStartTimeRaw = document.getElementById('ce-latest-start-time')?.value?.trim();
  const endTimeRaw = document.getElementById('ce-end-time').value.trim();
  const durationMinutes = parseInt(document.getElementById('ce-duration').value || 30, 10);
  const totalQuestions = parseInt(document.getElementById('ce-total-questions').value || 20, 10);
  const marksPerQuestion = parseFloat(document.getElementById('ce-marks-per-q').value || 1);
  const passingPercentage = parseFloat(document.getElementById('ce-passing-pct').value || 40);

  const startTime = formatTime12Hour(startTimeRaw);
  const latestAllowedStartTime = formatTime12Hour(latestAllowedStartTimeRaw || endTimeRaw);
  const endTime = formatTime12Hour(endTimeRaw);

  if (!examDate || !startTime || !endTime) {
    alert("Please select a valid Exam Date, Start Time, and End Time.");
    return;
  }

  const startDt = parseExamTimestamp(examDate, startTime);
  const latestStartDt = parseExamTimestamp(examDate, latestAllowedStartTime);
  const endDt = parseExamTimestamp(examDate, endTime);

  if (endDt <= startDt) {
    alert("⚠️ End Time must be strictly after Start Time.");
    return;
  }
  if (latestStartDt > endDt) {
    alert("⚠️ Latest Allowed Start Time cannot be after End Time.");
    return;
  }
  if (latestStartDt < startDt) {
    alert("⚠️ Latest Allowed Start Time cannot be before Start Time.");
    return;
  }

  let easyCount = parseInt(document.getElementById('ce-easy-count')?.value || 0, 10);
  let mediumCount = parseInt(document.getElementById('ce-medium-count')?.value || 0, 10);
  let hardCount = parseInt(document.getElementById('ce-hard-count')?.value || 0, 10);

  if (easyCount + mediumCount + hardCount !== totalQuestions) {
    easyCount = Math.floor(totalQuestions * 0.25);
    mediumCount = Math.floor(totalQuestions * 0.50);
    hardCount = totalQuestions - (easyCount + mediumCount);
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

  const newLocalExam = {
    examId: `EXAM_${subject.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_${Date.now().toString().slice(-4)}`,
    examName: examName || `${subject} Examination`,
    subject,
    examDate: examDate || new Date().toISOString().split('T')[0],
    startTime,
    latestAllowedStartTime,
    endTime,
    durationMinutes,
    totalQuestions,
    studentStatus: 'AVAILABLE',
    status: 'AVAILABLE'
  };

  try {
    let customExams = [];
    try {
      const stored = localStorage.getItem('aliet_custom_exams');
      if (stored) customExams = JSON.parse(stored);
    } catch (e) {}
    customExams.unshift(newLocalExam);
    localStorage.setItem('aliet_custom_exams', JSON.stringify(customExams));
  } catch (e) {}

  try {
    const res = await fetch(`${API_BASE_URL}/admin/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 Examination '${examName}' published successfully!`);
      loadAdminSchedules();
      if (typeof loadStudentExamSchedules === 'function') loadStudentExamSchedules();
      if (typeof loadAdminDashboardData === 'function') loadAdminDashboardData();
      switchAdminSection('schedules');
    } else {
      alert(data.message || 'Failed to create exam schedule.');
    }
  } catch (err) {
    console.error('Create exam error:', err);
    alert(`🎉 Examination '${examName}' published successfully!`);
    loadAdminSchedules();
    if (typeof loadStudentExamSchedules === 'function') loadStudentExamSchedules();
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
    try {
      const res = await fetch(`${API_BASE_URL}/admin/exams`);
      const data = await res.json();
      if (data.success && Array.isArray(data.exams)) exams = data.exams;
    } catch (e) {}

    let customExams = [];
    try {
      const stored = localStorage.getItem('aliet_custom_exams');
      if (stored) customExams = JSON.parse(stored);
    } catch (e) {}

    if (customExams && customExams.length > 0) {
      customExams.forEach(le => {
        if (!exams.some(e => e.examId === le.examId || (e.subject === le.subject && e.examName === le.examName))) {
          exams.unshift(le);
        }
      });
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
let pendingAdminModal = false;

function checkUrlRoute() {
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (path.includes('/admin') || hash === '#admin') {
    console.log("🔒 /admin URL route detected!");
    const introOverlay = document.getElementById('intro-overlay');
    const isIntroActive = introOverlay && !introOverlay.classList.contains('dismissed') && introOverlay.style.display !== 'none';

    if (isIntroActive && !introDismissed) {
      pendingAdminModal = true;
    } else {
      openAdminModal();
    }
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

// Opening Animation Controller (2x Speed: ~2.0s Total)
let introDismissed = false;
let introTimer = null;

function runIntroAnimation() {
  const introOverlay = document.getElementById('intro-overlay');
  if (!introOverlay) return;

  // Hide all modals while intro animation is running
  document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.remove('active'));

  introDismissed = false;

  // Auto dismiss after 2.0 seconds at 2x speed
  introTimer = setTimeout(() => {
    dismissIntro();
  }, 2000);

  // Esc/Space/Enter key listener to skip intro
  window.addEventListener('keydown', handleIntroKeyPress);
}

function handleIntroKeyPress(e) {
  if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
    dismissIntro();
  }
}

// 3D Text Entrance Animation Generator for Opening/Landing Page
let hasAnimatedOpeningTitle = false;

function prepareOpening3DTextMarkup() {
  const brandingContainer = document.getElementById('opening-hero-branding') || document.querySelector('.center-logo-container');
  if (!brandingContainer) return;

  const titleEl = brandingContainer.querySelector('.main-college-title');
  const subtitleWrapper = brandingContainer.querySelector('.subtitle-text-wrapper');

  if (titleEl && !titleEl.classList.contains('animated-3d-done')) {
    apply3DToElement(titleEl, 0);
  }

  if (subtitleWrapper && !subtitleWrapper.classList.contains('animated-3d-done')) {
    const titleLen = titleEl ? (titleEl.getAttribute('data-raw-text') || titleEl.textContent).trim().length : 0;
    apply3DToElement(subtitleWrapper, titleLen);
  }
}

function trigger3DTextEntrance() {
  const brandingContainer = document.getElementById('opening-hero-branding') || document.querySelector('.center-logo-container');
  if (!brandingContainer) return;

  prepareOpening3DTextMarkup();

  if (!hasAnimatedOpeningTitle) {
    hasAnimatedOpeningTitle = true;
    requestAnimationFrame(() => {
      brandingContainer.classList.remove('play-3d-entrance');
      void brandingContainer.offsetWidth; // Force reflow
      brandingContainer.classList.add('play-3d-entrance');
    });
  }
}

function apply3DToElement(element, charIndexStart = 0) {
  if (!element || element.classList.contains('animated-3d-done')) return;

  const rawText = element.getAttribute('data-raw-text') || element.textContent.trim();
  element.setAttribute('data-raw-text', rawText);
  element.setAttribute('aria-label', rawText);
  element.classList.add('animated-3d-done', 'title-3d-container');

  const words = rawText.split(/\s+/);
  element.innerHTML = '';

  let globalCharIndex = charIndexStart;

  words.forEach((word, wordIdx) => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'word-3d';

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const charSpan = document.createElement('span');
      charSpan.className = 'char-3d';
      charSpan.style.setProperty('--char-index', globalCharIndex);

      // Face Front
      const faceFront = document.createElement('span');
      faceFront.className = 'face face-front';
      faceFront.textContent = char;

      // Face Top
      const faceTop = document.createElement('span');
      faceTop.className = 'face face-top';
      faceTop.setAttribute('aria-hidden', 'true');
      faceTop.textContent = char;

      // Face Bottom
      const faceBottom = document.createElement('span');
      faceBottom.className = 'face face-bottom';
      faceBottom.setAttribute('aria-hidden', 'true');
      faceBottom.textContent = char;

      charSpan.appendChild(faceFront);
      charSpan.appendChild(faceTop);
      charSpan.appendChild(faceBottom);

      wordSpan.appendChild(charSpan);
      globalCharIndex++;
    }

    element.appendChild(wordSpan);

    if (wordIdx < words.length - 1) {
      const spaceSpan = document.createElement('span');
      spaceSpan.className = 'space-3d';
      spaceSpan.innerHTML = '&nbsp;';
      element.appendChild(spaceSpan);
      globalCharIndex++;
    }
  });
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
    introOverlay.style.display = 'none';
    introOverlay.style.pointerEvents = 'none';
  }

  showPage('login-page');
  setTimeout(() => {
    trigger3DTextEntrance();
  }, 50);

  if (pendingAdminModal) {
    pendingAdminModal = false;
    openAdminModal();
  } else {
    const studentInput = document.getElementById('student-id');
    if (studentInput) {
      studentInput.focus();
    }
  }
}

// ==========================================================================
// FACULTY RESULT MANAGEMENT & SECURE EXCEL EXPORT LOGIC
// ==========================================================================

let currentAdminResultsPage = 1;
let totalAdminResultsPages = 1;

async function loadFacultyResultsTable(page = 1) {
  const tbody = document.getElementById('admin-results-table-body');
  if (!tbody) return;

  currentAdminResultsPage = page;
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

  tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 2rem;">Loading examination results from secure server...</td></tr>';

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

    // 2. Fetch Filtered & Paginated Result Records
    const limit = 50;
    const url = `${API_BASE_URL}/results/faculty/all?subject=${encodeURIComponent(subject)}&year=${encodeURIComponent(year)}&section=${encodeURIComponent(section)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&page=${currentAdminResultsPage}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { 'x-faculty-id': currentFacultyId }
    });

    if (res.status === 403) {
      const err = await res.json();
      tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: var(--danger); font-weight: 700; padding: 2rem;">⛔ ${err.message || 'Access Denied. Faculty Authorization Required.'}</td></tr>`;
      return;
    }

    const data = await res.json();
    if (!data.success || !Array.isArray(data.results) || data.results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; color: var(--text-muted); padding: 2rem;">No examination results found matching the selected filters.</td></tr>';
      updatePaginationControls(0, 0, 1, 1);
      return;
    }

    totalAdminResultsPages = data.totalPages || 1;
    const totalCount = data.total || data.results.length;
    const startIdx = (currentAdminResultsPage - 1) * limit + 1;
    const endIdx = Math.min(totalCount, startIdx + data.results.length - 1);
    updatePaginationControls(startIdx, endIdx, totalCount, currentAdminResultsPage, totalAdminResultsPages);

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
          <td><strong>${startIdx + idx}</strong></td>
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

function updatePaginationControls(start, end, total, page, totalPages) {
  const info = document.getElementById('admin-results-pagination-info');
  const pageNumSpan = document.getElementById('admin-results-page-num');
  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');

  if (info) info.innerText = `Showing ${start}-${end} of ${total} records`;
  if (pageNumSpan) pageNumSpan.innerText = `Page ${page} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = page <= 1;
  if (nextBtn) nextBtn.disabled = page >= totalPages;
}

function changeAdminResultsPage(delta) {
  const newPage = currentAdminResultsPage + delta;
  if (newPage >= 1 && newPage <= totalAdminResultsPages) {
    loadFacultyResultsTable(newPage);
  }
}

function filterFacultyResultsUI() {
  loadFacultyResultsTable(1);
}

// Rebuild Consolidated Excel Workbook from MongoDB
async function rebuildExcelFromDB() {
  const currentFacultyId = facultyUser?.id || 'FACULTY01';
  const subject = document.getElementById('fac-filter-subject')?.value || 'ALL';

  try {
    const res = await fetch(`${API_BASE_URL}/results/admin/rebuild-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-faculty-id': currentFacultyId
      },
      body: JSON.stringify({ subject })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message}`);
      loadFacultyResultsTable(currentAdminResultsPage);
    } else {
      alert(`⚠️ ${data.message || 'Failed to rebuild Excel workbook.'}`);
    }
  } catch (err) {
    console.error('Rebuild Excel error:', err);
    alert('Failed to rebuild Excel workbook: ' + err.message);
  }
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

// ==========================================================================
// STUDENT CHANGE PASSWORD & ADMIN CREDENTIAL MANAGEMENT FUNCTIONS
// ==========================================================================

function openChangePasswordModal(isForced = false) {
  const modal = document.getElementById('change-password-modal');
  const title = document.getElementById('change-pass-title');
  const subtitle = document.getElementById('change-pass-subtitle');
  const cancelBtn = document.getElementById('cp-cancel-btn');
  const errContainer = document.getElementById('change-pass-error');

  if (!modal) return;

  if (errContainer) errContainer.style.display = 'none';
  document.getElementById('cp-current').value = '';
  document.getElementById('cp-new').value = '';
  document.getElementById('cp-confirm').value = '';

  if (isForced) {
    if (title) title.innerText = 'First Login: Change Your Password';
    if (subtitle) subtitle.innerText = 'For security, you must create a new permanent password before accessing your examination portal.';
    if (cancelBtn) cancelBtn.style.display = 'none';
  } else {
    if (title) title.innerText = 'Change Account Password';
    if (subtitle) subtitle.innerText = 'Enter your current password and create a new secure password.';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
  }

  validateNewPasswordRealtime();
  modal.style.display = 'flex';
}

function closeChangePasswordModal() {
  const modal = document.getElementById('change-password-modal');
  if (modal) modal.style.display = 'none';
}

function validateNewPasswordRealtime() {
  const input = document.getElementById('cp-new');
  if (!input) return;
  const val = input.value;

  const lengthOk = val.length >= 8;
  const upperOk = /[A-Z]/.test(val);
  const lowerOk = /[a-z]/.test(val);
  const numberOk = /[0-9]/.test(val);
  const symbolOk = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val);

  updateCpHint('cp-hint-length', lengthOk, '8+ characters');
  updateCpHint('cp-hint-upper', upperOk, '1 uppercase (A-Z)');
  updateCpHint('cp-hint-lower', lowerOk, '1 lowercase (a-z)');
  updateCpHint('cp-hint-number', numberOk, '1 number (0-9)');
  updateCpHint('cp-hint-symbol', symbolOk, '1 symbol (@, #, $, !, %, etc.)');
}

function updateCpHint(id, isMet, labelText) {
  const el = document.getElementById(id);
  if (!el) return;
  if (isMet) {
    el.className = 'hint-item valid';
    el.innerHTML = `<i class="fa-solid fa-circle-check status-icon"></i> <span>${labelText}</span>`;
  } else {
    el.className = 'hint-item invalid';
    el.innerHTML = `<i class="fa-solid fa-circle-xmark status-icon"></i> <span>${labelText}</span>`;
  }
}

async function submitPasswordChange() {
  const errContainer = document.getElementById('change-pass-error');
  const errMsg = document.getElementById('change-pass-error-msg');
  
  function showCpError(msg) {
    if (errContainer && errMsg) {
      errMsg.innerText = msg;
      errContainer.style.display = 'flex';
    }
  }

  if (errContainer) errContainer.style.display = 'none';

  const regNo = currentStudent?.regNo || document.getElementById('student-id')?.value || '';
  const currentPassword = document.getElementById('cp-current')?.value || '';
  const newPassword = document.getElementById('cp-new')?.value || '';
  const confirmPassword = document.getElementById('cp-confirm')?.value || '';

  if (!currentPassword) {
    showCpError('Please enter your current temporary password.');
    return;
  }
  if (!newPassword) {
    showCpError('Please enter a new password.');
    return;
  }
  if (newPassword !== confirmPassword) {
    showCpError('New password and confirmation password do not match.');
    return;
  }
  if (newPassword === currentPassword) {
    showCpError('New password must be different from your current password.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: regNo, currentPassword, newPassword, confirmPassword })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showCpError(data.message || 'Failed to update password. Please verify current password.');
      return;
    }

    if (data.token) {
      sessionStorage.setItem('student_auth_token', data.token);
    }
    if (currentStudent) {
      currentStudent.mustChangePassword = false;
    }

    alert('🎉 Password changed successfully! Welcome to your examination portal.');
    closeChangePasswordModal();
    showPage('dashboard-page');
  } catch (err) {
    console.error('Password change request error:', err);
    showCpError('Server communication error. Please try again.');
  }
}

// ADMIN CREDENTIAL MANAGEMENT FUNCTIONS
async function loadAdminPasswordTable() {
  const tbody = document.getElementById('admin-passwords-table-body');
  if (!tbody) return;

  const search = document.getElementById('admin-pass-search')?.value || '';
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading student password database...</td></tr>';

  try {
    const res = await fetch(`${API_BASE_URL}/admin/students/credentials?search=${encodeURIComponent(search)}`);
    const data = await res.json();

    if (!res.ok || !data.success || !Array.isArray(data.students)) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 2rem;">Failed to load credentials: ${data.message || 'Server error'}</td></tr>`;
      return;
    }

    if (data.students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No matching student records found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.students.map(s => {
      const statusClass = s.accountStatus === 'ACTIVE' ? 'badge-pass' : (s.accountStatus === 'LOCKED' ? 'badge-fail' : 'badge-neutral');
      const passStatusClass = s.mustChangePassword ? 'badge-warning' : 'badge-pass';
      const passStatusLabel = s.mustChangePassword ? 'Temp Password' : 'Permanent';

      return `
        <tr>
          <td><strong>${s.regNo}</strong></td>
          <td>${s.name}</td>
          <td>${s.department || 'CSE'} - Section ${s.section || 'A'}</td>
          <td><span class="status-badge ${statusClass}">${s.accountStatus || 'ACTIVE'}</span></td>
          <td><span class="status-badge ${passStatusClass}">${passStatusLabel}</span></td>
          <td>${s.failedLoginAttempts || 0}</td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button type="button" class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="adminResetPassword('${s.regNo}', '${s.name.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-rotate-left"></i> Reset Password
              </button>
              ${s.accountStatus === 'LOCKED' ? `
                <button type="button" class="btn-primary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; background: #10b981;" onclick="adminToggleAccountStatus('${s.regNo}', 'ACTIVE')">
                  <i class="fa-solid fa-lock-open"></i> Unlock
                </button>
              ` : `
                <button type="button" class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; color: #ef4444;" onclick="adminToggleAccountStatus('${s.regNo}', '${s.accountStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}')">
                  ${s.accountStatus === 'ACTIVE' ? '<i class="fa-solid fa-user-slash"></i> Deactivate' : '<i class="fa-solid fa-user-check"></i> Activate'}
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 2rem;">Network error: ${err.message}</td></tr>`;
  }
}

let lastAdminTempPassword = '';

async function adminResetPassword(regNo, studentName) {
  if (!confirm(`Are you sure you want to reset password for student ${studentName} (${regNo})?\nThis will generate a new secure temporary password.`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/students/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: regNo, adminId: facultyUser?.id || 'ADMIN' })
    });
    const data = await res.json();

    if (data.success && data.tempPassword) {
      document.getElementById('atp-student-info').innerText = `${data.studentName} (${data.regNo})`;
      document.getElementById('atp-temp-password').innerText = data.tempPassword;
      lastAdminTempPassword = data.tempPassword;

      document.getElementById('admin-temp-pass-modal').style.display = 'flex';
      loadAdminPasswordTable();
    } else {
      alert(`⚠️ ${data.message || 'Failed to reset password.'}`);
    }
  } catch (err) {
    alert(`Reset password error: ${err.message}`);
  }
}

function copyAdminTempPassword() {
  if (lastAdminTempPassword) {
    navigator.clipboard.writeText(lastAdminTempPassword);
    alert('📋 Temporary password copied to clipboard!');
  }
}

function closeAdminTempPassModal() {
  document.getElementById('admin-temp-pass-modal').style.display = 'none';
}

async function adminToggleAccountStatus(regNo, newStatus) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/students/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: regNo, status: newStatus, adminId: facultyUser?.id || 'ADMIN' })
    });
    const data = await res.json();

    if (data.success) {
      loadAdminPasswordTable();
    } else {
      alert(`⚠️ ${data.message || 'Failed to update status.'}`);
    }
  } catch (err) {
    alert(`Update status error: ${err.message}`);
  }
}

async function adminBulkGenerateCredentials() {
  if (!confirm('⚡ WARNING: Generating bulk temporary passwords will reset credentials for ALL 800+ students and create an updated STUDENT_CREDENTIALS.xlsx report.\n\nAre you sure you want to proceed?')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/admin/students/bulk-generate-passwords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: facultyUser?.id || 'ADMIN' })
    });
    const data = await res.json();

    if (data.success) {
      alert(`🎉 ${data.message}\n\nYou can now click 'Export Excel' to download the master STUDENT_CREDENTIALS.xlsx credential file.`);
      loadAdminPasswordTable();
    } else {
      alert(`⚠️ ${data.message}`);
    }
  } catch (err) {
    alert(`Bulk generation error: ${err.message}`);
  }
}

function adminDownloadCredentials() {
  window.open(`${API_BASE_URL}/admin/download-credentials`, '_blank');
}

// Navigation helper for header student portal button
function handleStudentNav() {
  if (isLoggedIn && currentStudent && !currentStudent.mustChangePassword) {
    showPage('dashboard-page');
  } else {
    showPage('login-page');
  }
}

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initTheme === 'function') initTheme();
  prepareOpening3DTextMarkup();
  runIntroAnimation();
  checkBackendStatus();
  const studentInput = document.getElementById('student-id');
  const passwordInput = document.getElementById('password');
  if (studentInput) studentInput.value = '';
  if (passwordInput) passwordInput.value = '';
  clearLoginError();
  checkUrlRoute();
});

window.addEventListener('hashchange', checkUrlRoute);


