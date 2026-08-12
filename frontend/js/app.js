window.parseExpToMonths = function (expStr) {
    if (!expStr) return 0;
    const str = String(expStr).trim();
    if (!str) return 0;
    const plainNum = parseFloat(str);
    if (!isNaN(plainNum) && /^\d+(?:\.\d+)?$/.test(str)) {
        return Math.round(plainNum * 12);
    }
    let totalYears = 0;
    const yearMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y)/i);
    const monthMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:months?|mos?|m)/i);
    if (yearMatch) totalYears += parseFloat(yearMatch[1]);
    if (monthMatch) totalYears += parseFloat(monthMatch[1]) / 12;
    if (!yearMatch && !monthMatch && !isNaN(plainNum)) {
        totalYears = plainNum;
    }
    return Math.round(totalYears * 12);
};

// ─────────────────────────────────────────────
// Global State
// ─────────────────────────────────────────────
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : 'https://employee-skillpulse.onrender.com';
const state = {
    token: localStorage.getItem('token') || '',
    role: localStorage.getItem('role') || '',
    username: localStorage.getItem('username') || '',
    myProfile: null,
    employeesList: [],
    activeTab: '',
    notificationsEnabled: localStorage.getItem('notificationsEnabled') !== 'false',
    theme: localStorage.getItem('theme') || 'dark',
    // new pages
    myAttendance: null,
    mySchedule: null,
    myCertSkills: null,
    mySkillTargets: [],
    adminAllEmployees: [],
    currentAdminAttEmpId: null,
    currentTimesheetWeek: '',
    currentTimesheetData: null,
    adminSkillTargetsOverview: [],
};


// ─────────────────────────────────────────────
// API Helper
// ─────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const cleanBase = API_BASE_URL ? API_BASE_URL.replace(/\/+$/, '') : '';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const response = await fetch(`${cleanBase}${cleanEndpoint}`, {
        ...options,
        headers
    });
    if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
        showToast('Session expired. Please log in again.', 'warning');
        logout();
        throw new Error('Unauthorized');
    }
    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'An error occurred' }));
        let msg = 'API request failed';
        if (typeof err.detail === 'string') {
            msg = err.detail;
        } else if (Array.isArray(err.detail) && err.detail.length > 0) {
            msg = err.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
        } else if (err.message) {
            msg = err.message;
        }
        throw new Error(msg);
    }
    return response.json();
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────
function triggerPageRefreshMovement(targetEl = null) {
    const el = targetEl || document.querySelector('.tab-pane.active') || document.getElementById('main-content') || document.body;
    if (!el) return;
    el.classList.remove('page-refresh-anim');
    void el.offsetWidth; // Force reflow for animation restart
    el.classList.add('page-refresh-anim');
    setTimeout(() => { el.classList.remove('page-refresh-anim'); }, 500);
}

function showToast(message, type = 'info') {
    if (type === 'success') {
        // Replace popup notifications on save with smooth page refreshing movement!
        triggerPageRefreshMovement();
        return;
    }
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'info';
    if (type === 'warning') icon = 'warning';
    if (type === 'error') icon = 'error_outline';
    toast.innerHTML = `<span class="material-icons-round toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out'); toast.addEventListener('animationend', () => toast.remove()); }, 4000);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateString; }
}

// ─────────────────────────────────────────────
// Resume Helpers
// ─────────────────────────────────────────────
async function downloadResumeFile(endpoint, defaultFilename) {
    try {
        showToast("Downloading file...", "info");
        const headers = {};
        if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

        const response = await fetch(endpoint, { headers });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ detail: 'Download failed' }));
            throw new Error(err.detail || 'Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function updateResumePanelUI(profile) {
    const statusDiv = document.getElementById('uploaded-resume-status');
    const nameSpan = document.getElementById('uploaded-resume-name');
    const uploadBtn = document.getElementById('upload-self-resume-btn');

    if (profile && profile.resume_path) {
        const parts = profile.resume_path.split(/[/\\]/);
        const filename = parts[parts.length - 1];

        if (nameSpan) nameSpan.textContent = filename;
        if (statusDiv) statusDiv.classList.remove('hidden');
        if (uploadBtn) uploadBtn.innerHTML = `<span class="material-icons-round">upload_file</span><span>Replace Resume</span>`;
    } else {
        if (statusDiv) statusDiv.classList.add('hidden');
        if (uploadBtn) uploadBtn.innerHTML = `<span class="material-icons-round">upload_file</span><span>Upload Resume</span>`;
    }
}

window.openResumePreviewModal = async function (employeeId) {
    const modal = document.getElementById('resume-preview-modal');
    if (!modal) return;

    // Reset/clear modal fields
    document.getElementById('res-edit-name').value = '';
    document.getElementById('res-edit-job-title').value = '';
    document.getElementById('res-edit-linkedin').value = '';
    document.getElementById('res-edit-email').value = '';
    document.getElementById('res-edit-phone').value = '';
    document.getElementById('res-edit-location').value = '';

    document.getElementById('res-edit-executive-summary').value = '';
    document.getElementById('res-edit-core-competencies').value = '';
    document.getElementById('res-edit-key-clients').value = '';

    document.getElementById('res-edit-arohak-title').value = '';
    document.getElementById('res-edit-arohak-start').value = '';
    document.getElementById('res-edit-arohak-resp').value = '';

    document.getElementById('res-edit-prev-company').value = '';
    document.getElementById('res-edit-prev-location').value = '';
    document.getElementById('res-edit-prev-title').value = '';
    document.getElementById('res-edit-prev-tenure').value = '';
    document.getElementById('res-edit-prev-resp').value = '';

    document.getElementById('res-edit-achievements').value = '';
    document.getElementById('res-edit-education').value = '';
    document.getElementById('res-edit-industry-experience').value = '';
    document.getElementById('res-edit-certifications').value = '';
    document.getElementById('res-edit-tools-technologies').value = '';

    modal.classList.add('active');

    try {
        showToast("Fetching resume data...", "info");
        const emp = await apiFetch(`/api/employees/${employeeId}`);

        // Populate fields
        document.getElementById('res-edit-name').value = emp.name || '';
        document.getElementById('res-edit-job-title').value = emp.primary_skill || 'Technical Associate';
        document.getElementById('res-edit-linkedin').value = `www.linkedin.com/in/${emp.username}`;
        document.getElementById('res-edit-email').value = emp.email || `${emp.username}@arohak.com`;
        document.getElementById('res-edit-phone').value = '+91-0000000000';
        document.getElementById('res-edit-location').value = 'HYDERABAD, INDIA';

        // Executive Summary
        let exec = emp.summary || '';
        if (!exec) {
            exec = `A dedicated professional with experience in technical execution, system configuration, and software application processes. Proven capabilities in ${emp.primary_skill || 'key technology areas'}, focused on driving efficiency and high-quality deliverables.`;
            if (emp.project_name) {
                exec += ` Currently assigned to the ${emp.project_name} project at Arohak Technologies.`;
            }
        }
        document.getElementById('res-edit-executive-summary').value = exec;

        // Core Competencies
        let comps = [];
        if (emp.primary_skill) comps.push(`* ${emp.primary_skill}: expert in application engineering and support`);
        if (emp.secondary_skill) comps.push(`* ${emp.secondary_skill}: proficient developer and administrator`);
        if (emp.third_skill) comps.push(`* ${emp.third_skill}: knowledgeable technical support specialist`);
        let compsText = comps.length > 0 ? comps.join('\n') : "Technical operations and development support";
        document.getElementById('res-edit-core-competencies').value = compsText;

        // Key Clients Supported
        document.getElementById('res-edit-key-clients').value = "Internal and client-assigned development projects";

        // Arohak Experience
        document.getElementById('res-edit-arohak-title').value = `Technical Associate - ${emp.primary_skill || 'Developer'}`;
        document.getElementById('res-edit-arohak-start').value = "Dec 2025 – Present";

        let arohakExp = emp.arohak_exp || '';
        if (!arohakExp) {
            arohakExp = "Active team member participating in project delivery and system execution matching primary skills.";
        }
        document.getElementById('res-edit-arohak-resp').value = arohakExp;

        // Previous Experience
        document.getElementById('res-edit-prev-company').value = "Previous Company Name";
        document.getElementById('res-edit-prev-location').value = "Location";
        document.getElementById('res-edit-prev-title').value = "Job Title";
        document.getElementById('res-edit-prev-tenure').value = "Start Date – End Date";
        document.getElementById('res-edit-prev-resp').value = emp.previous_exp || "* Summaries your Job role in your company , Roles & Responsibilities";

        // Other standard fields
        document.getElementById('res-edit-achievements').value = "* List your achievements throughout your career";
        document.getElementById('res-edit-education').value = "List your educational achievements with details about your college and pass out year (MM/YYYY)";
        document.getElementById('res-edit-industry-experience').value = "Banking & Financial Services | Manufacturing | Retail & Consumer Goods | Energy & Utilities | Enterprise Technology Services | Infrastructure & Managed Services";
        document.getElementById('res-edit-certifications').value = emp.certifications || "List your certifications . Name of the certification , Exam ID and pass out year and month";

        let tools = [emp.primary_skill, emp.secondary_skill, emp.third_skill].filter(Boolean).join(', ');
        document.getElementById('res-edit-tools-technologies').value = tools || "ServiceNow, SAP";

        // Setup download button click
        const downloadBtn = document.getElementById('download-preview-pdf-btn');
        if (downloadBtn) {
            downloadBtn.onclick = async () => {
                const payload = {
                    name: document.getElementById('res-edit-name').value.trim(),
                    job_title: document.getElementById('res-edit-job-title').value.trim() || null,
                    linkedin: document.getElementById('res-edit-linkedin').value.trim() || null,
                    email: document.getElementById('res-edit-email').value.trim() || null,
                    phone: document.getElementById('res-edit-phone').value.trim() || null,
                    location: document.getElementById('res-edit-location').value.trim() || null,

                    executive_summary: document.getElementById('res-edit-executive-summary').value.trim() || null,
                    core_competencies: document.getElementById('res-edit-core-competencies').value.trim() || null,
                    key_clients: document.getElementById('res-edit-key-clients').value.trim() || null,

                    arohak_title: document.getElementById('res-edit-arohak-title').value.trim() || null,
                    arohak_start: document.getElementById('res-edit-arohak-start').value.trim() || null,
                    arohak_resp: document.getElementById('res-edit-arohak-resp').value.trim() || null,

                    prev_company: document.getElementById('res-edit-prev-company').value.trim() || null,
                    prev_location: document.getElementById('res-edit-prev-location').value.trim() || null,
                    prev_title: document.getElementById('res-edit-prev-title').value.trim() || null,
                    prev_tenure: document.getElementById('res-edit-prev-tenure').value.trim() || null,
                    prev_resp: document.getElementById('res-edit-prev-resp').value.trim() || null,

                    achievements: document.getElementById('res-edit-achievements').value.trim() || null,
                    education: document.getElementById('res-edit-education').value.trim() || null,
                    industry_experience: document.getElementById('res-edit-industry-experience').value.trim() || null,
                    certifications: document.getElementById('res-edit-certifications').value.trim() || null,
                    tools_technologies: document.getElementById('res-edit-tools-technologies').value.trim() || null
                };

                try {
                    showToast("Downloading customized PDF...", "info");
                    const headers = { 'Content-Type': 'application/json' };
                    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

                    const response = await fetch(`/api/employees/${employeeId}/resume/download-generated-custom`, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const err = await response.json().catch(() => ({ detail: 'Failed to download PDF' }));
                        throw new Error(err.detail || 'Download failed');
                    }

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${employeeId}_custom_generated_resume.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    showToast("PDF downloaded successfully!", "success");
                } catch (err) {
                    showToast(err.message, 'error');
                }
            };
        }

    } catch (err) {
        showToast(`Failed to load preview: ${err.message}`, 'error');
        closeResumePreviewModal();
    }
};

window.closeResumePreviewModal = function () {
    const modal = document.getElementById('resume-preview-modal');
    if (modal) modal.classList.remove('active');
};

window.downloadEmployeeUploadedResume = function (employeeId, ext = 'pdf') {
    downloadResumeFile(`/api/employees/${employeeId}/resume/download-uploaded`, `${employeeId}_resume.${ext}`);
};

function checkSixMonthsUpdate(lastUpdatedString) {
    if (!lastUpdatedString) return false;
    try {
        const last = new Date(lastUpdatedString);
        return Math.ceil(Math.abs(new Date() - last) / (1000 * 60 * 60 * 24)) >= 180;
    } catch { return false; }
}

function getStarsHtml(rating) {
    let html = '';
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    for (let i = 1; i <= 5; i++) {
        if (i <= full) html += '<span class="material-icons-round">star</span>';
        else if (i === full + 1 && half) html += '<span class="material-icons-round">star_half</span>';
        else html += '<span class="material-icons-round empty">star_outline</span>';
    }
    return html;
}

function statusBadgeHtml(status) {
    const map = {
        P: { cls: 's-p', label: 'Present' },
        WFH: { cls: 's-wfh', label: 'WFH' },
        Ab: { cls: 's-ab', label: 'Absent' },
        L: { cls: 's-l', label: 'Leave' },
        H: { cls: 's-h', label: 'Holiday' }
    };
    const val = map[status] || (status === '—' || !status ? { cls: 's-ab', label: 'Absent' } : { cls: 's-none', label: status });
    return `<span class="att-status-badge ${val.cls}">${val.label}</span>`;
}

function statusClass(status) {
    const map = { P: 'status-p', WFH: 'status-wfh', Ab: 'status-ab', H: 'status-h', L: 'status-l' };
    return map[status] || '';
}

function targetStatusClass(status) {
    if (status === 'Planned') return 'status-planned';
    if (status === 'In Progress' || status === 'On-Going' || status === 'In-Progress') return 'status-inprogress';
    if (status === 'Completed' || status === 'Target Completed') return 'status-completed';
    return 'status-planned';
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// ─────────────────────────────────────────────
// Tab Switching
// ─────────────────────────────────────────────
function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });

    // Tab-specific loaders
    if (tabId === 'emp-directory') loadEmployeeDirectory();
    else if (tabId === 'admin-dashboard') loadAdminDashboardAnalytics();
    else if (tabId === 'admin-directory') loadAdminDirectory();
    else if (tabId === 'emp-profile') loadMyProfile(false);
    else if (tabId === 'emp-attendance') loadMyAttendance();
    else if (tabId === 'emp-schedule') loadMySchedule();
    else if (tabId === 'emp-certskills') loadMyCertSkills();
    else if (tabId === 'emp-skilltargets') loadMySkillTargets();
    else if (tabId === 'emp-timesheet') loadTimesheet();
    else if (tabId === 'admin-attendance') loadAdminAttendanceOverview();
    else if (tabId === 'admin-schedule') loadAdminSchedules();
    else if (tabId === 'emp-assets') loadOfficeAssets();
    else if (tabId === 'admin-projects') loadAdminProjectsOverview();
    else if (tabId === 'admin-skilltargets') loadAdminSkillTargetsOverview();
    else if (tabId === 'admin-timesheets') loadAdminTimesheets();
    else if (tabId === 'admin-emp-timesheets') loadAdminEmpTimesheetsView();
}

function clearUserSessionState() {
    state.myProfile = null;
    state.myProfileLoaded = false;
    state.myAttendance = null;
    state.mySchedule = null;
    state.myCertSkills = null;
    state.mySkillTargets = [];
    state.currentTimesheetData = null;
    state.currentTimesheetWeek = '';
    state.employeesList = [];
    state.adminAllEmployees = [];
    state.adminSkillTargetsOverview = [];
    state.adminSelectedTsWeek = '';
    state.adminSelectedTsDetailWeek = '';
    state.adminSelectedTsDetailEmpId = '';
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    try {
        clearUserSessionState();
        const data = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                username: document.getElementById('login-username').value,
                password: document.getElementById('login-password').value,
            }),
        });
        state.token = data.access_token;
        state.role = data.role;
        state.username = data.username;
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('username', data.username);
        showToast('Signed in successfully!', 'success');
        setupAppInterface();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function logout() {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
    clearUserSessionState();
    state.token = '';
    state.role = '';
    state.username = '';
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    document.getElementById('login-form').reset();
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('update-alert-banner').classList.add('hidden');
}

function setupAppInterface() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    document.getElementById('user-display-id').textContent = state.username.toUpperCase();
    const roleBadge = document.getElementById('role-badge');
    roleBadge.textContent = state.role;
    roleBadge.className = `badge badge-${state.role}`;

    if (state.role === 'admin') {
        document.getElementById('nav-admin-group').classList.remove('hidden');
        document.getElementById('nav-employee-group').classList.add('hidden');
        document.getElementById('user-display-name').textContent = 'System Administrator';
        switchTab('admin-dashboard');
    } else {
        document.getElementById('nav-admin-group').classList.add('hidden');
        document.getElementById('nav-employee-group').classList.remove('hidden');
        loadMyProfile(true);
        switchTab('emp-profile');
    }
}

// ─────────────────────────────────────────────
// PAGE 1: Employee Profile (existing logic preserved)
// ─────────────────────────────────────────────
function animateScoreCircle(targetScore) {
    const scoreRing = document.getElementById('score-ring-fill');
    const scoreValue = document.getElementById('prof-score-value');
    if (!scoreRing || !scoreValue) return;
    const circumference = 251.2;
    scoreRing.style.strokeDasharray = `${circumference} ${circumference}`;
    scoreRing.style.strokeDashoffset = circumference;
    scoreValue.textContent = '0%';

    // Default fallback styles
    scoreValue.style.removeProperty('color');
    scoreRing.style.removeProperty('stroke');
    scoreValue.classList.remove('gradient-text');

    // Step 1: Animate sweep to 100% first
    setTimeout(() => {
        const fullDuration = 600; // 0.6s to complete full circle
        const start = performance.now();

        function animateToFull(now) {
            const progress = Math.min((now - start) / fullDuration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // Ease out cubic

            scoreRing.style.strokeDashoffset = circumference - ease * circumference;
            scoreValue.textContent = Math.round(ease * 100) + '%';

            if (progress < 1) {
                requestAnimationFrame(animateToFull);
            } else {
                // Step 2: Once it reaches 100%, wait 150ms then animate to targetScore
                setTimeout(() => {
                    animateToTarget();
                }, 150);
            }
        }
        requestAnimationFrame(animateToFull);
    }, 50);

    function animateToTarget() {
        // If final score is 100%, apply the custom blue gradient colors
        if (targetScore === 100) {
            scoreValue.classList.add('gradient-text');
            scoreRing.style.setProperty('stroke', 'url(#scoreGradient)', 'important');
        } else {
            scoreValue.classList.remove('gradient-text');
            scoreRing.style.removeProperty('stroke');
        }

        const targetDuration = 800; // 0.8s to animate to final score
        const start = performance.now();

        function step(now) {
            const progress = Math.min((now - start) / targetDuration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);

            const currentScore = 100 - ease * (100 - targetScore);
            scoreRing.style.strokeDashoffset = circumference - (currentScore / 100) * circumference;
            scoreValue.textContent = Math.round(currentScore) + '%';

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                scoreValue.textContent = targetScore + '%';
            }
        }
        requestAnimationFrame(step);
    }
}

function updateRealtimeOverallRating() {
    const r1 = parseFloat(document.getElementById('prof-rating1').value) || 0;
    const r2 = parseFloat(document.getElementById('prof-rating2').value) || 0;
    const r3 = parseFloat(document.getElementById('prof-rating3').value) || 0;
    const wr = parseFloat(document.getElementById('prof-work-rating').value) || 0;
    document.getElementById('rating1-val').textContent = r1.toFixed(1);
    document.getElementById('rating2-val').textContent = r2.toFixed(1);
    document.getElementById('rating3-val').textContent = r3.toFixed(1);
    document.getElementById('work-rating-val').textContent = wr.toFixed(1);
    const active = [r1, r2, r3, wr].filter(r => r > 0);
    const avg = active.length > 0 ? active.reduce((a, b) => a + b, 0) / active.length : 0;
    document.getElementById('prof-overall-rating').textContent = avg.toFixed(2);
}

/** Parse an experience string like "3 Years, 5 Months", "3.5 Yrs", or "42 Months" */
/** Parse an experience value string into decimal years (e.g., "2.3", "3.5", "2 Years 3 Months") */
function parseExpToYears(expStr) {
    if (!expStr) return 0;
    const str = String(expStr).trim();
    if (!str) return 0;

    const plainNum = parseFloat(str);
    if (!isNaN(plainNum) && /^\d+(?:\.\d+)?$/.test(str)) {
        return plainNum;
    }

    let totalYears = 0;
    const yearMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y)/i);
    const monthMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:months?|mos?|m)/i);

    if (yearMatch) totalYears += parseFloat(yearMatch[1]);
    if (monthMatch) totalYears += parseFloat(monthMatch[1]) / 12;

    if (!yearMatch && !monthMatch && !isNaN(plainNum)) {
        totalYears = plainNum;
    }
    return Math.round(totalYears * 10) / 10;
}

function parseExpToMonths(expStr) {
    return Math.round(parseExpToYears(expStr) * 12);
}

function formatDecimalYears(yearsVal) {
    if (!yearsVal || yearsVal <= 0) return '0.0 Years';
    const num = Math.round(yearsVal * 10) / 10;
    return `${num.toFixed(1)} Years`;
}

function monthsToString(totalMonths) {
    if (!totalMonths || totalMonths <= 0) return '0.0 Years';
    return formatDecimalYears(totalMonths / 12);
}

function updateTotalExp() {
    const prevVal = document.getElementById('prof-prev-exp')?.value || '';
    const arohakVal = document.getElementById('prof-arohak-exp')?.value || '';
    const prevYears = parseExpToYears(prevVal);
    const arohakYears = parseExpToYears(arohakVal);
    const total = Math.round((prevYears + arohakYears) * 10) / 10;
    const el = document.getElementById('prof-total-exp-text');
    if (el) el.textContent = total > 0 ? formatDecimalYears(total) : '0.0 Years';
}

function updateUserAvatarUI() {
    const key = `userAvatar_${state.username || 'default'}`;
    const avatarUrl = localStorage.getItem(key);

    const profImg = document.getElementById('profile-avatar-img');
    const profIcon = document.getElementById('profile-avatar-icon');
    const headImg = document.getElementById('header-avatar-img');
    const headIcon = document.getElementById('header-avatar-icon');
    const removeBtn = document.getElementById('btn-remove-photo');

    if (avatarUrl) {
        if (profImg) {
            profImg.src = avatarUrl;
            profImg.classList.remove('hidden');
        }
        if (profIcon) profIcon.classList.add('hidden');
        if (headImg) {
            headImg.src = avatarUrl;
            headImg.classList.remove('hidden');
        }
        if (headIcon) headIcon.classList.add('hidden');
        if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
        if (profImg) {
            profImg.src = '';
            profImg.classList.add('hidden');
        }
        if (profIcon) profIcon.classList.remove('hidden');
        if (headImg) {
            headImg.src = '';
            headImg.classList.add('hidden');
        }
        if (headIcon) headIcon.classList.remove('hidden');
        if (removeBtn) removeBtn.classList.add('hidden');
    }
}

async function loadMyProfile(force = true) {
    try {
        if (!force && state.myProfileLoaded) return;
        const profile = await apiFetch('/api/employees/me');
        state.myProfile = profile;
        state.myProfileLoaded = true;
        
        updateUserAvatarUI();
        document.getElementById('user-display-name').textContent = profile.name;
        document.getElementById('prof-emp-id').value = profile.employee_id;
        document.getElementById('prof-name').value = profile.name || '';
        document.getElementById('prof-email').value = profile.email || '';
        document.getElementById('prof-contact').value = profile.contact_number || '';
        let cleanJoiningDate = profile.joining_date ? profile.joining_date.split('(')[0].trim() : '';
        document.getElementById('prof-joining-date').value = cleanJoiningDate;
        
        const daysBadge = document.getElementById('prof-joining-days-badge');
        if (daysBadge && cleanJoiningDate) {
            const jDate = new Date(cleanJoiningDate + 'T00:00:00');
            if (!isNaN(jDate.getTime())) {
                const now = new Date();
                const daysDiff = Math.max(0, Math.floor((now - jDate) / (1000 * 60 * 60 * 24)));
                daysBadge.textContent = `📅 Tenure: ${daysDiff} days since joining date`;
            } else {
                daysBadge.textContent = '';
            }
        }
        document.getElementById('prof-project-name').value = profile.project_name || '';
        document.getElementById('prof-project-date').value = profile.project_assignment_date || '';
        document.getElementById('prof-project-end-date').value = profile.project_end_date || '';
        animateScoreCircle(profile.score || 100);
        document.getElementById('profile-last-updated').textContent = formatDate(profile.last_updated);
        document.getElementById('prof-skill1').value = profile.primary_skill || '';
        document.getElementById('prof-rating1').value = profile.primary_rating || 0;
        document.getElementById('prof-skill2').value = profile.secondary_skill || '';
        document.getElementById('prof-rating2').value = profile.secondary_rating || 0;
        document.getElementById('prof-skill3').value = profile.third_skill || '';
        document.getElementById('prof-rating3').value = profile.third_rating || 0;
        document.getElementById('prof-work-rating').value = profile.work_exp_skills_rating || 0;
        updateRealtimeOverallRating();
        document.getElementById('prof-prev-exp').value = profile.previous_exp || '';
        document.getElementById('prof-arohak-exp').value = profile.arohak_exp || '';
        updateTotalExp();
        document.getElementById('prof-certifications').value = profile.certifications || '';
        document.getElementById('prof-cert-start').value = profile.cert_start_date || '';
        document.getElementById('prof-cert-end').value = profile.cert_end_date || '';
        document.getElementById('prof-cert-expiry').value = profile.expiry_date || '';
        if (document.getElementById('prof-has-laptop')) document.getElementById('prof-has-laptop').value = profile.has_laptop || 'No';
        if (document.getElementById('prof-laptop-details')) document.getElementById('prof-laptop-details').value = profile.laptop_details || '';
        if (document.getElementById('prof-has-headset')) document.getElementById('prof-has-headset').value = profile.has_headset || 'No';
        if (document.getElementById('prof-headset-details')) document.getElementById('prof-headset-details').value = profile.headset_details || '';

        const needsUpdate = checkSixMonthsUpdate(profile.last_updated);
        document.getElementById('update-alert-banner').classList.toggle('hidden', !needsUpdate);
        const statusBadge = document.getElementById('profile-status-badge');
        if (statusBadge) {
            statusBadge.textContent = needsUpdate ? 'Outdated' : 'Up to Date';
            statusBadge.className = `badge ${needsUpdate ? 'badge-danger' : 'badge-success'}`;
            statusBadge.classList.remove('hidden');
        }
        updateResumePanelUI(profile);
    } catch (err) {
        showToast(`Failed to load profile: ${err.message}`, 'error');
    }
}

async function handleProfileUpdate(e) {
    if (e && e.preventDefault) e.preventDefault();
    const saveBtn = document.getElementById('save-all-profile-btn');
    const originalBtnText = saveBtn ? saveBtn.innerHTML : '';

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0;"></span> <span>Updating Profile &amp; Syncing...</span>';
    }

    const payload = {
        name: document.getElementById('prof-name').value,
        email: document.getElementById('prof-email').value || null,
        contact_number: document.getElementById('prof-contact').value || null,
        joining_date: document.getElementById('prof-joining-date').value || null,
        primary_skill: document.getElementById('prof-skill1').value || null,
        primary_rating: parseFloat(document.getElementById('prof-rating1').value) || 0.0,
        secondary_skill: document.getElementById('prof-skill2').value || null,
        secondary_rating: parseFloat(document.getElementById('prof-rating2').value) || 0.0,
        third_skill: document.getElementById('prof-skill3').value || null,
        third_rating: parseFloat(document.getElementById('prof-rating3').value) || 0.0,
        previous_exp: document.getElementById('prof-prev-exp').value || null,
        arohak_exp: document.getElementById('prof-arohak-exp').value || null,
        certifications: document.getElementById('prof-certifications').value || null,
        cert_start_date: document.getElementById('prof-cert-start').value || null,
        cert_end_date: document.getElementById('prof-cert-end').value || null,
        expiry_date: document.getElementById('prof-cert-expiry').value || null,
        project_name: document.getElementById('prof-project-name').value || null,
        project_assignment_date: document.getElementById('prof-project-date').value || null,
        project_end_date: document.getElementById('prof-project-end-date').value || null,
        work_exp_skills_rating: parseFloat(document.getElementById('prof-work-rating').value) || 0.0,
        has_laptop: document.getElementById('prof-has-laptop')?.value || "No",
        laptop_details: document.getElementById('prof-laptop-details')?.value || null,
        has_headset: document.getElementById('prof-has-headset')?.value || "No",
        headset_details: document.getElementById('prof-headset-details')?.value || null,
    };
    try {
        const updated = await apiFetch('/api/employees/me', { method: 'PUT', body: JSON.stringify(payload) });
        state.myProfile = updated;
        window.location.reload();
    } catch (err) {
        showToast(`Update failed: ${err.message}`, 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
        }
    }
}

// ─────────────────────────────────────────────
// ADMIN DASHBOARD ANALYTICS & 3 PIE CHARTS
// ─────────────────────────────────────────────
let chartSkillsRating = null;
let chartDomains = null;
let chartSkillsCount = null;

const CHART_VIBRANT_COLORS = [
    '#3b82f6', // Bright Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#10b981', // Emerald Green
    '#f59e0b', // Amber / Orange
    '#06b6d4', // Cyan
    '#6366f1', // Indigo
    '#ef4444', // Red
    '#14b8a6', // Teal
    '#f97316'  // Orange-Red
];

async function loadAdminDashboardAnalytics() {
    if (state.adminAllEmployees && state.adminAllEmployees.length > 0) {
        updateAdminStatsUI(state.adminAllEmployees);
        renderAdminPieCharts(state.adminAllEmployees);
    }
    try {
        const employees = await apiFetch('/api/employees');
        state.adminAllEmployees = employees;
        updateAdminStatsUI(employees);
        renderAdminPieCharts(employees);
    } catch (err) {
        showToast(`Failed to load dashboard analytics: ${err.message}`, 'error');
    }
}

function updateAdminStatsUI(employees) {
    const totalEmpEl = document.getElementById('stat-total-emp');
    const pendingUpdatesEl = document.getElementById('stat-pending-updates');
    const certifiedCountEl = document.getElementById('stat-certified-count');

    if (!employees || employees.length === 0) return;

    if (totalEmpEl) totalEmpEl.textContent = employees.length;

    let pendingCount = 0;
    let certifiedCount = 0;
    const pendingListEl = document.getElementById('pending-update-list');
    if (pendingListEl) pendingListEl.innerHTML = '';

    employees.forEach(emp => {
        const isOutdated = checkSixMonthsUpdate(emp.last_updated);
        if (isOutdated) {
            pendingCount++;
            if (pendingListEl) {
                const item = document.createElement('div');
                item.className = 'pending-item';
                item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--border-color);';
                item.innerHTML = `
                    <div>
                        <strong style="color:var(--text-primary); font-size:0.9rem;">${emp.name}</strong>
                        <span style="font-size:0.8rem; color:var(--text-muted); margin-left:6px;">(${emp.employee_id})</span>
                    </div>
                    <span class="badge badge-warning" style="font-size:0.72rem;">Last Updated: ${formatDate(emp.last_updated)}</span>
                `;
                pendingListEl.appendChild(item);
            }
        }

        if (emp.certifications && emp.certifications.trim()) {
            certifiedCount++;
        }
    });

    if (pendingUpdatesEl) pendingUpdatesEl.textContent = pendingCount;
    if (certifiedCountEl) certifiedCountEl.textContent = certifiedCount;

    if (pendingListEl && pendingCount === 0) {
        pendingListEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--success);">All employee profiles are up to date!</div>';
    }
}

function renderAdminPieCharts(employees) {
    if (!window.Chart) {
        console.warn('Chart.js library not loaded yet.');
        return;
    }

    // Executive Base Donut Options
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        hoverOffset: 7,
        animation: {
            animateScale: true,
            animateRotate: true,
            duration: 800
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#e2e8f0',
                    font: { family: 'Inter', size: 10, weight: 500 },
                    boxWidth: 10,
                    boxHeight: 10,
                    padding: 12,
                    usePointStyle: true
                }
            }
        }
    };

    // ── 1st Chart: Top Technology Skillsets by Rating ─────────────────────
    const ratingMap = {};
    employees.forEach(emp => {
        if (emp.primary_skill && emp.primary_rating > 0) {
            const sk = emp.primary_skill.trim();
            ratingMap[sk] = (ratingMap[sk] || 0) + emp.primary_rating;
        }
        if (emp.secondary_skill && emp.secondary_rating > 0) {
            const sk = emp.secondary_skill.trim();
            ratingMap[sk] = (ratingMap[sk] || 0) + emp.secondary_rating;
        }
        if (emp.third_skill && emp.third_rating > 0) {
            const sk = emp.third_skill.trim();
            ratingMap[sk] = (ratingMap[sk] || 0) + emp.third_rating;
        }
    });

    const sortedRatingSkills = Object.keys(ratingMap)
        .sort((a, b) => ratingMap[b] - ratingMap[a])
        .slice(0, 7);

    const ratingLabels = sortedRatingSkills.length > 0 ? sortedRatingSkills : ['No Skills Added'];
    const ratingData = sortedRatingSkills.length > 0 ? sortedRatingSkills.map(s => Math.round(ratingMap[s])) : [0];
    const totalRatingSum = ratingData.reduce((a, b) => a + b, 0);

    // ── Chart 1 Palette: Light Soft Pastel Canva Tech Palette ──────────────────
    const ratingColors = ['#818cf8', '#60a5fa', '#fcd34d', '#34d399', '#fca5a5', '#c084fc', '#38bdf8'];

    const ctx1 = document.getElementById('chart-skills-by-rating')?.getContext('2d');
    if (ctx1) {
        if (chartSkillsRating) chartSkillsRating.destroy();
        chartSkillsRating = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ratingLabels,
                datasets: [{
                    data: ratingData,
                    backgroundColor: ratingColors.slice(0, ratingLabels.length),
                    borderWidth: 2,
                    borderColor: '#1e293b'
                }]
            },
            options: {
                ...baseOptions,
                plugins: {
                    ...baseOptions.plugins,
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleColor: '#ffffff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw || 0;
                                const pct = totalRatingSum > 0 ? ((val / totalRatingSum) * 100).toFixed(1) : '0.0';
                                return ` ${ctx.label}: ${val} pts (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ── 2nd Chart: Total Types of Domains in Arohak ───────────────────────
    const domainCounts = {
        'DevOps': 0,
        'SAP': 0,
        'Full Stack': 0,
        'ServiceNow': 0,
        'AIML': 0,
        'HR': 0,
        'Accounts': 0,
        'Operations': 0,
        'Networking': 0,
        'Development': 0
    };

    employees.forEach(emp => {
        const text = `${emp.primary_skill || ''} ${emp.secondary_skill || ''} ${emp.third_skill || ''} ${emp.project_name || ''} ${emp.name || ''}`.toLowerCase();

        if (text.includes('devops') || text.includes('kubernetes') || text.includes('docker') || text.includes('ci/cd') || text.includes('jenkins')) {
            domainCounts['DevOps']++;
        } else if (text.includes('sap') || text.includes('abap') || text.includes('hana') || text.includes('basis')) {
            domainCounts['SAP']++;
        } else if (text.includes('servicenow') || text.includes('snow') || text.includes('itsm')) {
            domainCounts['ServiceNow']++;
        } else if (text.includes('aiml') || text.includes('ai') || text.includes('ml') || text.includes('machine learning') || text.includes('nlp') || text.includes('data science')) {
            domainCounts['AIML']++;
        } else if (text.includes('hr') || text.includes('human resource') || text.includes('recruitment') || text.includes('people')) {
            domainCounts['HR']++;
        } else if (text.includes('account') || text.includes('finance') || text.includes('audit') || text.includes('billing')) {
            domainCounts['Accounts']++;
        } else if (text.includes('operation') || text.includes('admin') || text.includes('support') || text.includes('helpdesk')) {
            domainCounts['Operations']++;
        } else if (text.includes('network') || text.includes('cisco') || text.includes('security') || text.includes('ccna') || text.includes('firewall')) {
            domainCounts['Networking']++;
        } else if (text.includes('full stack') || text.includes('fullstack') || (text.includes('react') && text.includes('java')) || (text.includes('angular') && text.includes('node'))) {
            domainCounts['Full Stack']++;
        } else {
            domainCounts['Development']++;
        }
    });

    const activeDomains = Object.keys(domainCounts).filter(k => domainCounts[k] > 0);
    const domainLabels = activeDomains.length > 0 ? activeDomains : ['No Domain Data'];
    const domainData = activeDomains.length > 0 ? activeDomains.map(k => domainCounts[k]) : [0];
    const totalDomainEmployees = domainData.reduce((a, b) => a + b, 0);

    // ── Chart 2 Palette: Light Soft Pastel Canva Domain Palette ───────────────
    const domainColors = ['#a5b4fc', '#2dd4bf', '#f472b6', '#fb7185', '#ff8a65', '#ffc107', '#6ee7b7', '#38bdf8', '#a78bfa', '#a3e635'];

    const ctx2 = document.getElementById('chart-domain-distribution')?.getContext('2d');
    if (ctx2) {
        if (chartDomains) chartDomains.destroy();
        chartDomains = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: domainLabels,
                datasets: [{
                    data: domainData,
                    backgroundColor: domainColors.slice(0, domainLabels.length),
                    borderWidth: 2,
                    borderColor: '#1e293b'
                }]
            },
            options: {
                ...baseOptions,
                plugins: {
                    ...baseOptions.plugins,
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleColor: '#ffffff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw || 0;
                                const pct = totalDomainEmployees > 0 ? ((val / totalDomainEmployees) * 100).toFixed(1) : '0.0';
                                return ` ${ctx.label}: ${val} Employees (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ── 3rd Chart: Top Skills in Arohak (Employee Count) ────────────────
    const countMap = {};
    employees.forEach(emp => {
        [emp.primary_skill, emp.secondary_skill, emp.third_skill].forEach(sk => {
            if (sk && sk.trim()) {
                const cleanSkill = sk.trim();
                countMap[cleanSkill] = (countMap[cleanSkill] || 0) + 1;
            }
        });
    });

    const sortedCountSkills = Object.keys(countMap)
        .sort((a, b) => countMap[b] - countMap[a])
        .slice(0, 7);

    const headcountLabels = sortedCountSkills.length > 0 ? sortedCountSkills : ['No Skills Added'];
    const headcountData = sortedCountSkills.length > 0 ? sortedCountSkills.map(s => countMap[s]) : [0];
    const totalHeadcountSum = headcountData.reduce((a, b) => a + b, 0);

    // ── Chart 3 Palette: Light Soft Pastel Canva Headcount Palette ────────────
    const headcountColors = ['#67e8f9', '#ffab91', '#4ade80', '#93c5fd', '#ffe082', '#d8b4fe', '#f472b6'];

    const ctx3 = document.getElementById('chart-top-skills-count')?.getContext('2d');
    if (ctx3) {
        if (chartSkillsCount) chartSkillsCount.destroy();
        chartSkillsCount = new Chart(ctx3, {
            type: 'doughnut',
            data: {
                labels: headcountLabels,
                datasets: [{
                    data: headcountData,
                    backgroundColor: headcountColors.slice(0, headcountLabels.length),
                    borderWidth: 2,
                    borderColor: '#1e293b'
                }]
            },
            options: {
                ...baseOptions,
                plugins: {
                    ...baseOptions.plugins,
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleColor: '#ffffff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw || 0;
                                const pct = totalHeadcountSum > 0 ? ((val / totalHeadcountSum) * 100).toFixed(1) : '0.0';
                                return ` ${ctx.label}: ${val} Employees (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

// ─────────────────────────────────────────────
// PAGE 2: Employee Directory (existing)
// ─────────────────────────────────────────────
async function loadEmployeeDirectory(skill = '', project = '', exp = '') {
    const grid = document.getElementById('directory-grid');

    // Check if any filter is entered
    if (!skill.trim() && !project.trim() && !exp.trim()) {
        grid.innerHTML = `
            <div class="col-span-2 text-center" style="padding: 60px 20px; border: 1px dashed var(--border-color); border-radius: var(--radius-md); background: rgba(255,255,255,0.01); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; grid-column: 1 / -1;">
                <span class="material-icons-round" style="font-size: 48px; color: var(--text-muted);">search</span>
                <h3 style="margin: 0; color: var(--text-secondary); font-size: 1.2rem;">Search Employee Directory</h3>
                <p style="font-size: 0.875rem; color: var(--text-muted); max-width: 400px; margin: 0; line-height: 1.5;">
                    Enter a skill, project, or experience level above and click "Apply Filter" to search the Arohak directory.
                </p>
            </div>
        `;
        document.getElementById('directory-count').textContent = '0';
        return;
    }

    grid.innerHTML = '<div class="col-span-2 text-center" style="padding:40px;"><div class="spinner"></div>Loading directory...</div>';
    try {
        let query = `/api/employees?`;
        if (skill) query += `skill=${encodeURIComponent(skill)}&`;
        if (project) query += `project=${encodeURIComponent(project)}&`;
        if (exp) query += `experience=${encodeURIComponent(exp)}&`;
        const data = await apiFetch(query);
        state.employeesList = data;
        document.getElementById('directory-count').textContent = data.length;
        grid.innerHTML = '';
        if (data.length === 0) {
            grid.innerHTML = '<div class="col-span-2 text-center" style="padding:40px; color:var(--text-muted); grid-column: 1 / -1;">No employees found matching the filters.</div>';
            return;
        }
        data.forEach(emp => {
            const skills = [emp.primary_skill, emp.secondary_skill, emp.third_skill].filter(Boolean);
            const isOutdated = checkSixMonthsUpdate(emp.last_updated);
            const card = document.createElement('div');
            card.className = 'emp-card';
            card.setAttribute('data-id', emp.employee_id);
            card.addEventListener('click', () => openEmployeeDetailsModal(emp.employee_id));
            card.innerHTML = `
                <div class="emp-card-header">
                    <div class="emp-card-name-group">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <h3>${emp.name}</h3>
                            ${isOutdated ? '<span class="badge badge-warning" style="font-size:0.6rem;padding:2px 6px;">Outdated</span>' : ''}
                        </div>
                        <span class="emp-card-id">${emp.employee_id}</span>
                    </div>
                    <div class="emp-card-project-badge">${emp.project_name || 'Bench'}</div>
                </div>
                <div class="emp-card-section">
                    <h4>Technical Skillset</h4>
                    <div class="emp-card-skills">
                        ${skills.map((s, i) => `<span class="skill-tag ${i === 0 ? 'primary' : ''}">${s}</span>`).join('') || '<span class="text-muted">None listed</span>'}
                    </div>
                </div>
                <div class="emp-card-info-row">
                    <div class="info-item"><span class="lbl">Arohak Exp</span><span class="val">${emp.arohak_exp || '-'}</span></div>
                    <div class="info-item"><span class="lbl">Past Exp</span><span class="val">${emp.previous_exp || '-'}</span></div>
                </div>`;
            grid.appendChild(card);
        });
    } catch (err) {
        showToast(err.message, 'error');
        grid.innerHTML = '<div class="col-span-2 text-center" style="color:var(--danger)">Failed to load data.</div>';
    }
}

// ─────────────────────────────────────────────
// PAGE 7: Office Assets (new)
// ─────────────────────────────────────────────
async function loadOfficeAssets() {
    const tableBody = document.getElementById('assets-employees-tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;"><div class="spinner"></div>Loading asset details...</td></tr>';
    try {
        const data = await apiFetch('/api/employees');
        state.adminAllEmployees = data;
        renderAssetsTable(data);
    } catch (err) {
        showToast(err.message, 'error');
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--danger);padding:20px;">Failed to load assets data.</td></tr>';
    }
}

function renderAssetsTable(employees) {
    const tableBody = document.getElementById('assets-employees-tbody');
    const countEl = document.getElementById('assets-count');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    // Apply filters from inputs
    const searchVal = document.getElementById('assets-search-name').value.toLowerCase().trim();
    const laptopVal = document.getElementById('assets-filter-laptop').value;
    const headsetVal = document.getElementById('assets-filter-headset').value;

    const filtered = employees.filter(emp => {
        const matchesSearch = !searchVal ||
            emp.name.toLowerCase().includes(searchVal) ||
            emp.employee_id.toLowerCase().includes(searchVal);

        const matchesLaptop = !laptopVal || emp.has_laptop === laptopVal;
        const matchesHeadset = !headsetVal || emp.has_headset === headsetVal;

        return matchesSearch && matchesLaptop && matchesHeadset;
    });

    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);">No employees found matching the filters.</td></tr>';
        return;
    }

    filtered.forEach(emp => {
        const tr = document.createElement('tr');

        const laptopBadge = emp.has_laptop === 'Yes'
            ? `<span class="badge badge-success" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;"><span class="material-icons-round" style="font-size:14px;">laptop</span> ${emp.laptop_details || 'Yes'}</span>`
            : `<span style="color:var(--text-muted);font-weight:bold;">—</span>`;

        const headsetBadge = emp.has_headset === 'Yes'
            ? `<span class="badge badge-success" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;"><span class="material-icons-round" style="font-size:14px;">headphones</span> Yes</span>`
            : `<span style="color:var(--text-muted);font-weight:bold;">—</span>`;

        tr.innerHTML = `
            <td><strong>${emp.employee_id}</strong></td>
            <td>${emp.name}</td>
            <td>${laptopBadge}</td>
            <td>${headsetBadge}</td>
        `;

        tableBody.appendChild(tr);
    });
}

function openEditAssetsModal(emp) {
    const modal = document.getElementById('assets-edit-modal');
    if (!modal) return;

    document.getElementById('assets-edit-emp-id').value = emp.employee_id;
    document.getElementById('assets-edit-emp-name').value = emp.name;

    const laptopSelect = document.getElementById('assets-edit-laptop');
    const laptopDetailsInput = document.getElementById('assets-edit-laptop-details');
    const headsetSelect = document.getElementById('assets-edit-headset');

    laptopSelect.value = emp.has_laptop || 'No';
    laptopDetailsInput.value = emp.laptop_details || '';
    headsetSelect.value = emp.has_headset || 'No';

    toggleLaptopDetailsVisibility();
    modal.classList.add('active');
}

function toggleLaptopDetailsVisibility() {
    const laptopSelect = document.getElementById('assets-edit-laptop');
    const detailsGroup = document.getElementById('assets-edit-laptop-details-group');
    if (laptopSelect && detailsGroup) {
        detailsGroup.style.display = laptopSelect.value === 'Yes' ? 'block' : 'none';
    }
}

async function handleAssetsEditSubmit(e) {
    e.preventDefault();
    const empId = document.getElementById('assets-edit-emp-id').value;
    const hasLaptop = document.getElementById('assets-edit-laptop').value;
    const laptopDetails = document.getElementById('assets-edit-laptop-details').value;
    const hasHeadset = document.getElementById('assets-edit-headset').value;

    const payload = {
        has_laptop: hasLaptop,
        laptop_details: hasLaptop === 'Yes' ? laptopDetails : null,
        has_headset: hasHeadset,
        headset_details: hasHeadset === 'Yes' ? (document.getElementById('assets-edit-headset-details')?.value || null) : null
    };

    try {
        const updated = await apiFetch(`/api/employees/${empId}/assets`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        showToast('Assets updated successfully!', 'success');
        closeAllModals();

        // Refresh local cache and list
        if (state.adminAllEmployees) {
            state.adminAllEmployees = state.adminAllEmployees.map(emp =>
                emp.employee_id === empId ? { ...emp, ...payload } : emp
            );
            renderAssetsTable(state.adminAllEmployees);
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─────────────────────────────────────────────
// ADMIN: Projects & Teams Overview (new)
// ─────────────────────────────────────────────
async function loadAdminProjectsOverview() {
    const container = document.getElementById('admin-projects-list-container');
    if (!container) return;

    container.innerHTML = '<div class="text-center" style="padding:60px;"><div class="spinner"></div>Loading Arohak Projects & Teams...</div>';
    try {
        const data = await apiFetch('/api/admin/projects-overview');
        state.adminProjectsOverview = data;
        populateProjectFilterDropdown(data);
        renderAdminProjectsOverview();
    } catch (err) {
        showToast(`Failed to load projects & teams: ${err.message}`, 'error');
        container.innerHTML = '<div class="panel text-center" style="color:var(--danger);padding:40px;">Error loading project data.</div>';
    }
}

function populateProjectFilterDropdown(accounts) {
    const filterSelect = document.getElementById('admin-projects-filter');
    if (!filterSelect) return;
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All Projects & Accounts</option>';
    (accounts || []).forEach(acc => {
        const optGroup = document.createElement('optgroup');
        optGroup.label = acc.client_account;
        (acc.projects || []).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.project_name;
            opt.textContent = `${acc.client_account} — ${p.project_name}`;
            optGroup.appendChild(opt);
        });
        filterSelect.appendChild(optGroup);
    });
    filterSelect.value = currentVal;
}

function renderAdminProjectsOverview() {
    const container = document.getElementById('admin-projects-list-container');
    const countEl = document.getElementById('admin-projects-count');
    if (!container) return;

    const searchInput = document.getElementById('admin-projects-search');
    const filterSelect = document.getElementById('admin-projects-filter');

    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const filterVal = filterSelect ? filterSelect.value : '';

    const allAccounts = state.adminProjectsOverview || [];

    let totalProjectsCount = 0;
    const filteredAccounts = [];

    allAccounts.forEach(acc => {
        const filteredProjects = acc.projects.filter(p => {
            const matchesFilter = !filterVal || p.project_name === filterVal || acc.client_account === filterVal;
            const matchesSearch = !searchVal ||
                acc.client_account.toLowerCase().includes(searchVal) ||
                p.project_name.toLowerCase().includes(searchVal) ||
                p.project_manager.toLowerCase().includes(searchVal) ||
                p.team_lead.toLowerCase().includes(searchVal) ||
                p.members.some(m => m.name.toLowerCase().includes(searchVal) || m.employee_id.toLowerCase().includes(searchVal));

            return matchesFilter && matchesSearch;
        });

        if (filteredProjects.length > 0) {
            totalProjectsCount += filteredProjects.length;
            filteredAccounts.push({
                ...acc,
                projects: filteredProjects,
                total_account_members: filteredProjects.reduce((sum, p) => sum + p.members.length, 0)
            });
        }
    });

    if (countEl) countEl.textContent = totalProjectsCount;

    if (filteredAccounts.length === 0) {
        container.innerHTML = '<div class="panel text-center" style="padding:40px;color:var(--text-muted);">No projects found matching the search/filter criteria.</div>';
        return;
    }

    container.innerHTML = filteredAccounts.map(acc => {
        return `
            <div class="panel client-account-panel" style="margin-bottom:28px;border:1px solid rgba(99,102,241,0.3);border-radius:16px;overflow:hidden;background:rgba(15,23,42,0.85);box-shadow:0 8px 24px rgba(0,0,0,0.3);">
                <!-- Parent Account Header Banner -->
                <div class="account-header-banner" style="padding:20px 24px;background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);border-bottom:1px solid rgba(99,102,241,0.25);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;">
                    <div style="display:flex;align-items:center;gap:14px;">
                        <div style="width:46px;height:46px;border-radius:12px;background:rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;border:1px solid rgba(99,102,241,0.4);">
                            <span class="material-icons-round" style="color:#818cf8;font-size:26px;">domain</span>
                        </div>
                        <div>
                            <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:#818cf8;font-weight:700;">Client Account</div>
                            <h2 style="font-size:1.45rem;margin:2px 0 0 0;color:#ffffff;font-weight:800;letter-spacing:-0.3px;">${acc.client_account}</h2>
                        </div>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;">
                        <span style="background:rgba(99,102,241,0.18);color:#a5b4fc;border:1px solid rgba(99,102,241,0.35);font-size:0.85rem;padding:6px 14px;border-radius:20px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
                            <span class="material-icons-round" style="font-size:16px;">folder_special</span> ${acc.projects.length} Projects under ${acc.client_account}
                        </span>
                        <span style="background:rgba(52,211,153,0.18);color:#6ee7b7;border:1px solid rgba(52,211,153,0.35);font-size:0.85rem;padding:6px 14px;border-radius:20px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
                            <span class="material-icons-round" style="font-size:16px;">groups</span> ${acc.total_account_members} Total Employees
                        </span>
                    </div>
                </div>

                <!-- Sub-Projects Container -->
                <div class="account-body" style="padding:24px;display:flex;flex-direction:column;gap:24px;background:rgba(15,23,42,0.4);">
                    ${acc.projects.map(p => `
                        <div class="subproject-card" style="border:1px solid rgba(148,163,184,0.25);border-radius:14px;overflow:hidden;background:#0f172a;box-shadow:0 4px 16px rgba(0,0,0,0.2);">
                            <!-- Project Header -->
                            <div class="subproject-header" style="padding:16px 22px;background:rgba(30,41,59,0.9);border-bottom:1px solid rgba(148,163,184,0.2);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;">
                                <div>
                                    <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:700;">Project Name</div>
                                    <div style="display:flex;align-items:center;gap:10px;margin-top:2px;">
                                        <span class="material-icons-round" style="color:#60a5fa;font-size:22px;">topic</span>
                                        <h3 style="font-size:1.2rem;margin:0;color:#ffffff;font-weight:700;">${p.project_name}</h3>
                                        <span class="badge" style="background:rgba(96,165,250,0.15);color:#93c5fd;border:1px solid rgba(96,165,250,0.3);font-size:0.75rem;padding:3px 10px;border-radius:12px;font-weight:600;">${p.total_members} Employees Assigned</span>
                                    </div>
                                </div>
                                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;">
                                    <div style="font-size:0.85rem;display:inline-flex;align-items:center;gap:6px;background:rgba(168,85,247,0.18);padding:6px 14px;border-radius:12px;border:1px solid rgba(168,85,247,0.35);color:#e9d5ff;font-weight:600;">
                                        <span class="material-icons-round" style="font-size:16px;color:#c084fc;">person_pin</span> Project Manager: <strong style="color:#ffffff;margin-left:4px;">${p.project_manager}</strong>
                                    </div>
                                    <div style="font-size:0.85rem;display:inline-flex;align-items:center;gap:6px;background:rgba(245,158,11,0.18);padding:6px 14px;border-radius:12px;border:1px solid rgba(245,158,11,0.35);color:#fef3c7;font-weight:600;">
                                        <span class="material-icons-round" style="font-size:16px;color:#fbbf24;">stars</span> Team Lead: <strong style="color:#ffffff;margin-left:4px;">${p.team_lead}</strong>
                                    </div>
                                </div>
                            </div>

                            <!-- Team Members Table -->
                            <div class="subproject-body" style="padding:0;">
                                <div class="table-container">
                                    <table class="admin-table" style="width:100%;border-collapse:collapse;">
                                        <thead>
                                            <tr style="background:#0f172a;border-bottom:2px solid rgba(148,163,184,0.2);">
                                                <th style="color:#94a3b8;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.5px;padding:12px 16px;">Emp ID</th>
                                                <th style="color:#94a3b8;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.5px;padding:12px 16px;">Employee Name</th>
                                                <th style="color:#94a3b8;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.5px;padding:12px 16px;">Task Details</th>
                                                <th style="color:#94a3b8;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.5px;padding:12px 16px;">Overall Rating</th>
                                                <th style="color:#94a3b8;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.5px;padding:12px 16px;">Assignment Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${p.total_members === 0 ? '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8;font-style:italic;">No employees assigned to this project.</td></tr>' :
                                            p.members.map((m, idx) => `
                                                <tr style="background:${idx % 2 === 0 ? 'rgba(30,41,59,0.3)' : 'transparent'};border-bottom:1px solid rgba(148,163,184,0.1);">
                                                    <td style="padding:14px 16px;"><strong style="color:#60a5fa;font-family:monospace;font-size:0.9rem;">${m.employee_id.toUpperCase()}</strong></td>
                                                    <td style="padding:14px 16px;"><strong style="color:#ffffff;font-size:0.92rem;">${m.name}</strong></td>
                                                    <td style="padding:14px 16px;"><span class="badge" style="background:rgba(99,102,241,0.2);color:#a5b4fc;border:1px solid rgba(99,102,241,0.35);font-size:0.82rem;padding:4px 12px;border-radius:12px;font-weight:600;">${m.task_details || 'Developer'}</span></td>
                                                    <td style="padding:14px 16px;"><strong style="color:#fbbf24;font-size:0.9rem;">${m.overall_rating > 0 ? m.overall_rating.toFixed(1) + ' ★' : '—'}</strong></td>
                                                    <td style="padding:14px 16px;color:#cbd5e1;font-size:0.88rem;">${m.project_assignment_date}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}


// ─────────────────────────────────────────────
// Admin Skill Targets Tracker (new)
// ─────────────────────────────────────────────

async function loadAdminSkillTargetsOverview() {
    const tableBody = document.getElementById('admin-skilltargets-employees-tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;"><div class="spinner"></div>Loading skill targets sheet...</td></tr>';

    const yearSelect = document.getElementById('admin-st-filter-year');
    const year = yearSelect ? yearSelect.value : new Date().getFullYear();

    try {
        const data = await apiFetch(`/api/admin/skilltargets-overview?year=${year}`);
        state.adminSkillTargetsOverview = data;
        renderAdminSkillTargetsOverview();
    } catch (err) {
        showToast(`Failed to load skill targets: ${err.message}`, 'error');
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:20px;">Error: ${err.message}</td></tr>`;
    }
}

function renderAdminSkillTargetsOverview() {
    const tableBody = document.getElementById('admin-skilltargets-employees-tbody');
    if (!tableBody) return;

    const searchVal = document.getElementById('admin-st-search-name').value.toLowerCase().trim();
    const statusVal = document.getElementById('admin-st-filter-status').value;

    // Filter employees
    const filtered = (state.adminSkillTargetsOverview || []).filter(item => {
        const matchesSearch = !searchVal ||
            item.name.toLowerCase().includes(searchVal) ||
            item.employee_id.toLowerCase().includes(searchVal);

        const matchesStatus = !statusVal || item.targets_status === statusVal ||
            (statusVal === 'Target Completed' && item.targets_status === 'Target is onpoint') ||
            (statusVal === 'In-Progress' && (item.targets_status === 'Pending' || item.targets_status === 'In-Progress'));

        return matchesSearch && matchesStatus;
    });

    // Update stats counts (based on total loaded records)
    let totalCount = (state.adminSkillTargetsOverview || []).length;
    let onpointCount = (state.adminSkillTargetsOverview || []).filter(item => item.targets_status === 'Target Completed' || item.targets_status === 'Target is onpoint').length;
    let pendingCount = (state.adminSkillTargetsOverview || []).filter(item => item.targets_status === 'In-Progress' || item.targets_status === 'Pending').length;
    let noneCount = (state.adminSkillTargetsOverview || []).filter(item => item.targets_status === 'No Targets Set').length;

    // Update summary DOM elements
    document.getElementById('admin-st-total-count').textContent = totalCount;
    document.getElementById('admin-st-onpoint-count').textContent = onpointCount;
    document.getElementById('admin-st-pending-count').textContent = pendingCount;
    document.getElementById('admin-st-none-count').textContent = noneCount;

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">No employees found matching the filters.</td></tr>';
        return;
    }

    tableBody.innerHTML = '';

    filtered.forEach(item => {
        let badgeClass = 'badge-none';
        if (item.targets_status === 'Target Completed' || item.targets_status === 'Target is onpoint') {
            badgeClass = 'badge-onpoint';
        } else if (item.targets_status === 'In-Progress' || item.targets_status === 'Pending') {
            badgeClass = 'badge-pending';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.employee_id.toUpperCase()}</strong></td>
            <td>${item.name}</td>
            <td><span class="emp-card-project-badge">${item.project_name}</span></td>
            <td><span class="${badgeClass}">${item.targets_status}</span></td>
            <td>
                <button class="toggle-details-btn" onclick="toggleTargetDetails('${item.employee_id}')" id="st-toggle-${item.employee_id}">
                    <span class="material-icons-round" style="font-size:16px;">expand_more</span>
                    <span>Show (${item.targets.length})</span>
                </button>
            </td>
        `;
        tableBody.appendChild(tr);

        // Details Row
        const detailsTr = document.createElement('tr');
        detailsTr.id = `st-details-row-${item.employee_id}`;
        detailsTr.className = 'admin-targets-details-row';
        detailsTr.style.display = 'none';

        let targetsListHtml = '';
        if (item.targets.length === 0) {
            targetsListHtml = '<p style="color:var(--text-muted);font-style:italic;margin:0;">No targets declared for this year.</p>';
        } else {
            targetsListHtml = `
                <table class="admin-targets-subtable">
                    <thead>
                        <tr>
                            <th>Skill Name</th>
                            <th>Target Level</th>
                            <th>Start Date</th>
                            <th>Target End Date</th>
                            <th>Finished Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${item.targets.map(t => {
                const startDate = t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB') : '—';
                const targetEndDate = t.target_completion_date ? new Date(t.target_completion_date + 'T00:00:00').toLocaleDateString('en-GB') : '—';
                const finishedDate = t.status === 'Completed' && t.updated_at ? new Date(t.updated_at).toLocaleDateString('en-GB') : '—';

                let displayStatus = (t.status === 'In Progress' || t.status === 'In-Progress') ? 'On-Going' : t.status;
                let statusClass = 'status-planned';
                if (t.status === 'In Progress' || t.status === 'On-Going' || t.status === 'In-Progress') statusClass = 'status-inprogress';
                if (t.status === 'Completed') statusClass = 'status-completed';

                return `
                                <tr>
                                    <td><strong>${t.skill_name}</strong></td>
                                    <td><span class="skill-target-level-badge">${t.target_level || '—'}</span></td>
                                    <td>${startDate}</td>
                                    <td>${targetEndDate}</td>
                                    <td>${finishedDate}</td>
                                    <td><span class="skill-target-status-badge ${statusClass}">${displayStatus}</span></td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
            `;
        }

        detailsTr.innerHTML = `
            <td colspan="5" style="padding:0;">
                <div class="admin-targets-details-box">
                    <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-primary);">Target Skills Details for ${item.name}</h3>
                    ${targetsListHtml}
                </div>
            </td>
        `;
        tableBody.appendChild(detailsTr);
    });
}

// Global scope details toggle
window.toggleTargetDetails = function (empId) {
    const row = document.getElementById(`st-details-row-${empId}`);
    const btn = document.getElementById(`st-toggle-${empId}`);
    if (!row || !btn) return;

    const isCollapsed = row.style.display === 'none';
    row.style.display = isCollapsed ? 'table-row' : 'none';

    const icon = btn.querySelector('.material-icons-round');
    const label = btn.querySelector('span:not(.material-icons-round)');

    if (isCollapsed) {
        icon.textContent = 'expand_less';
    } else {
        icon.textContent = 'expand_more';
    }

    const targetCount = row.querySelectorAll('.admin-targets-subtable tbody tr').length;
    label.textContent = isCollapsed ? `Hide (${targetCount})` : `Show (${targetCount})`;
};

// ─────────────────────────────────────────────
// PAGE 3: Employee Attendance (new)
// ─────────────────────────────────────────────
function renderAttCalendar(containerId, records, isAdmin = false, empId = null) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    if (!records || records.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px;">No attendance records found.</div>';
        return;
    }
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    grid.innerHTML = '';
    records.forEach(r => {
        const d = new Date(r.date + 'T00:00:00');
        const cell = document.createElement('div');
        cell.className = `att-day-cell ${statusClass(r.status)} ${isAdmin ? 'admin-editable' : ''}`;
        cell.title = r.notes ? `Note: ${r.notes}` : r.date;
        cell.innerHTML = `
            <span class="att-day-date">${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('default', { month: 'short' })}</span>
            <span class="att-day-weekday">${weekdays[d.getDay()]}</span>
            <span class="att-day-status">${r.status}</span>`;
        if (isAdmin && empId) {
            cell.addEventListener('click', () => openAdminAttModal(empId, r.date, r.status, r.notes || ''));
        }
        grid.appendChild(cell);
    });
}

async function loadMyAttendance() {
    try {
        const data = await apiFetch('/api/attendance/me');
        state.myAttendance = data;
        // Stats
        const records = data.records || [];
        document.getElementById('att-stat-p').textContent = records.filter(r => r.status === 'P').length;
        document.getElementById('att-stat-wfh').textContent = records.filter(r => r.status === 'WFH').length;
        document.getElementById('att-stat-ab').textContent = records.filter(r => r.status === 'Ab').length;
        document.getElementById('att-stat-h').textContent = records.filter(r => r.status === 'H').length;
        document.getElementById('att-stat-l').textContent = records.filter(r => r.status === 'L').length;
        renderAttCalendar('att-calendar-grid', records.slice(0, 30));
    } catch (err) {
        showToast(`Failed to load attendance: ${err.message}`, 'error');
    }
}

// ── Weekly Timesheet Functions ──────────────────────────────────────────────

function formatMinutes(mins) {
    if (!mins || mins <= 0) return '0:00';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
}

function parseMinutes(str) {
    if (!str || str.trim() === '' || str === 'hh:mm') return 0;
    const parts = str.split(':');
    if (parts.length === 1) {
        const val = parseFloat(parts[0]);
        return isNaN(val) ? 0 : Math.round(val * 60);
    }
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return (h * 60) + m;
}

function getWeekLabelText(weekStartStr) {
    const monday = new Date(weekStartStr + 'T00:00:00');
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const options1 = { day: 'numeric', month: 'short' };
    const options2 = { day: 'numeric', month: 'short', year: 'numeric' };

    return `This week, ${monday.toLocaleDateString('en-US', options1)} - ${sunday.toLocaleDateString('en-US', options2)}`;
}

function updateTimesheetHeaders(weekStartStr) {
    const monday = new Date(weekStartStr + 'T00:00:00');
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const ids = ['ts-header-mon', 'ts-header-tue', 'ts-header-wed', 'ts-header-thu', 'ts-header-fri'];

    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        const header = document.getElementById(ids[i]);
        if (header) {
            header.innerHTML = `${dayNames[i]}<br><span style="font-size:0.7rem; font-weight:normal; text-transform:none; color:var(--text-muted);">${label}</span>`;
        }
    }
}

async function loadTimesheet(weekStartStr) {
    try {
        if (!weekStartStr) {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - (day === 0 ? 6 : day - 1);
            const monday = new Date(today.setDate(diff));
            weekStartStr = monday.toISOString().split('T')[0];
        }
        state.currentTimesheetWeek = weekStartStr;

        const weekLabel = document.getElementById('ts-week-label');
        if (weekLabel) weekLabel.textContent = getWeekLabelText(weekStartStr);

        const weekPicker = document.getElementById('ts-week-picker');
        if (weekPicker) weekPicker.value = weekStartStr;

        updateTimesheetHeaders(weekStartStr);

        const data = await apiFetch(`/api/timesheet/me?week_start=${weekStartStr}`);
        state.currentTimesheetData = data;

        renderTimesheet(data);
    } catch (err) {
        showToast(`Failed to load timesheet: ${err.message}`, 'error');
    }
}

function createTimesheetRowHtml(row, index, attendance = {}) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const disabledAttrs = days.map((day) => {
        let status = 'P';
        if (Array.isArray(attendance)) {
            const rec = attendance.find(a => a.day_key === day || a.day === day);
            if (rec) status = rec.status;
        } else if (attendance && typeof attendance === 'object') {
            status = attendance[day] || 'P';
        }
        if (status === 'Ab' || status === 'L' || status === 'H') {
            return {
                disabled: true,
                title: `${status} (Non-Working)`,
                value: 0,
                status: status
            };
        }
        return {
            disabled: false,
            title: '',
            value: row[day] || 0,
            status: status
        };
    });

    const rowTotal = days.reduce((sum, day, idx) => {
        const val = disabledAttrs[idx].disabled ? 0 : (row[day] || 0);
        return sum + val;
    }, 0);

    const clientVal = row.client_project || '';
    const taskVal = row.task || '';
    const assignedProj = state.myProfile?.project_name || '';

    // 7 Exact Task / Leave options requested
    const taskOptions = [
        'Sick Leave',
        'Loss of Pay',
        'Comp-off',
        'Privilege Leave',
        'WFH',
        'Bereavement',
        'Marriage Leave'
    ];

    // Leave & Absence Task options check
    const isLeaveTaskOption = (taskStr) => {
        if (!taskStr) return false;
        const str = String(taskStr).trim().toLowerCase();
        const leaveKeywords = ['sick leave', 'loss of pay', 'comp-off', 'privilege leave', 'wfh', 'bereavement', 'marriage leave', 'leave', 'absent', 'holiday'];
        return leaveKeywords.some(opt => str.includes(opt));
    };

    const getLeaveBadgeMarkup = (leaveName, title) => {
        let badgeClass = 'badge-leave';
        let colorStyle = 'background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);';
        const lower = String(leaveName).toLowerCase();
        if (lower.includes('absent')) {
            badgeClass = 'badge-absent';
            colorStyle = 'background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);';
        } else if (lower.includes('holiday')) {
            badgeClass = 'badge-holiday';
            colorStyle = 'background: rgba(56, 189, 248, 0.18); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4);';
        }

        return `<div style="display: flex; justify-content: center; align-items: center; height: 32px;">
            <span class="ts-status-badge ${badgeClass}" style="font-size:0.75rem; padding: 4px 10px; border-radius: 6px; font-weight:600; text-transform: uppercase; letter-spacing:0.04em; ${colorStyle}" title="${title || leaveName}">${leaveName}</span>
        </div>`;
    };

    // Build day columns dynamically with status badges if non-working or leave selected
    let dayCellsHtml = '';
    days.forEach((day, idx) => {
        const attr = disabledAttrs[idx];
        if (attr.status === 'Ab') {
            dayCellsHtml += `<td style="text-align: center;">${getLeaveBadgeMarkup('Absent', attr.title)}</td>`;
        } else if (attr.status === 'L') {
            dayCellsHtml += `<td style="text-align: center;">${getLeaveBadgeMarkup('Leave', attr.title)}</td>`;
        } else if (attr.status === 'H') {
            dayCellsHtml += `<td style="text-align: center;">${getLeaveBadgeMarkup('Holiday', attr.title)}</td>`;
        } else if (isLeaveTaskOption(taskVal) && !row[day]) {
            dayCellsHtml += `<td style="text-align: center;" class="ts-leave-cell" data-day="${day}">${getLeaveBadgeMarkup(taskVal, taskVal)}</td>`;
        } else {
            const val = row[day] ? formatMinutes(row[day]) : '';
            dayCellsHtml += `<td class="ts-input-cell" data-day="${day}"><input type="text" class="ts-day-input" data-day="${day}" placeholder="hh:mm" value="${val}"></td>`;
        }
    });

    return `
        <tr class="ts-row" data-row-id="${row.id || ''}">
            <td style="min-width: 210px;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <input type="text" class="ts-client-project-input ts-client-project" placeholder="Type or edit project name..." value="${clientVal || assignedProj || 'Bench'}">
                    <select class="ts-client-project-select form-control" style="font-size: 0.8rem; padding: 4px 8px; border-radius: 4px;">
                        <option value="">-- Quick Select --</option>
                        <option value="Bench" ${clientVal.toLowerCase() === 'bench' ? 'selected' : ''}>Bench</option>
                    </select>
                </div>
            </td>
            <td style="min-width: 210px;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <input type="text" class="ts-task-input ts-task" placeholder="Type task or role description..." value="${taskVal}">
                    <select class="ts-task-select form-control" style="font-size: 0.8rem; padding: 4px 8px; border-radius: 4px;">
                        <option value="">-- Select Leave / Activity --</option>
                        ${taskOptions.map(opt => `<option value="${opt}" ${taskVal === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                </div>
            </td>
            ${dayCellsHtml}
            <td class="ts-row-total" style="text-align: center;">
                <span class="ts-row-total-pill">${formatMinutes(rowTotal)}</span>
            </td>
            <td style="text-align: center;">
                <button class="btn btn-secondary btn-icon-only ts-delete-row-btn" title="Delete Row">
                    <span class="material-icons-round" style="font-size: 1.1rem;">delete</span>
                </button>
            </td>
        </tr>
    `;
}

function renderTimesheet(data) {
    const tbody = document.getElementById('timesheet-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const status = data.status || 'Draft';
    const canEdit = data.can_edit !== false;
    const statusBadge = document.getElementById('ts-status-badge');
    const lockBanner = document.getElementById('ts-lock-banner');

    if (statusBadge) {
        statusBadge.textContent = status === 'Released' ? 'Released (Pending Admin Review)' : status;
        statusBadge.className = 'badge ' + (
            status === 'Approved' ? 'badge-success' :
            status === 'Released' ? 'badge-warning' :
            status === 'Rejected' ? 'badge-danger' : 'badge-secondary'
        );
    }

    if (lockBanner) {
        if (!canEdit) {
            lockBanner.classList.remove('hidden');
            if (status === 'Approved') {
                lockBanner.className = 'alert alert-success';
                lockBanner.innerHTML = '<strong><span class="material-icons-round" style="vertical-align:middle;">check_circle</span> Timesheet Approved:</strong> Your timesheet for this week has been accepted and approved by Admin. Controls are locked.';
            } else if (status === 'Released') {
                lockBanner.className = 'alert alert-warning';
                lockBanner.innerHTML = '<strong><span class="material-icons-round" style="vertical-align:middle;">lock</span> Timesheet Released:</strong> Your timesheet has been submitted to Admin for review. Editing is temporarily locked.';
            }
        } else if (status === 'Rejected') {
            lockBanner.classList.remove('hidden');
            lockBanner.className = 'alert alert-danger';
            lockBanner.innerHTML = '<strong><span class="material-icons-round" style="vertical-align:middle;">warning</span> Timesheet Rejected:</strong> Admin has rejected your timesheet submission. Please review your hours/tasks and click <strong>Release Timesheet</strong> again when ready.';
        } else {
            lockBanner.classList.add('hidden');
        }
    }

    let rows = data.rows || [];
    if (rows.length === 0) {
        const defaultProject = state.myProfile?.project_name || 'Bench';
        rows.push({
            id: null,
            client_project: defaultProject,
            task: '',
            monday: 0,
            tuesday: 0,
            wednesday: 0,
            thursday: 0,
            friday: 0
        });
    }

    rows.forEach((row, index) => {
        const trHtml = createTimesheetRowHtml(row, index, data.attendance);
        tbody.insertAdjacentHTML('beforeend', trHtml);
    });

    // Disable inputs and buttons if locked
    tbody.querySelectorAll('input, select').forEach(el => {
        el.disabled = !canEdit;
    });

    const addBtn = document.getElementById('ts-add-row-btn');
    const copyBtn = document.getElementById('ts-copy-prev-btn');
    const saveBtn = document.getElementById('ts-save-btn');
    const releaseBtn = document.getElementById('ts-release-btn');

    if (addBtn) addBtn.disabled = !canEdit;
    if (copyBtn) copyBtn.disabled = !canEdit;
    if (saveBtn) saveBtn.disabled = !canEdit;
    if (releaseBtn) releaseBtn.disabled = !canEdit;

    // Bind dropdown selects
    tbody.querySelectorAll('.ts-client-project-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            if (!canEdit) return;
            const tr = e.target.closest('.ts-row');
            const input = tr.querySelector('.ts-client-project-input');
            if (input && e.target.value) {
                input.value = e.target.value;
            }
        });
    });

    tbody.querySelectorAll('.ts-task-select, .ts-task-input').forEach(el => {
        el.addEventListener('change', (e) => {
            if (!canEdit) return;
            const tr = e.target.closest('.ts-row');
            if (!tr) return;
            const input = tr.querySelector('.ts-task-input');
            const select = tr.querySelector('.ts-task-select');
            if (e.target === select && e.target.value) {
                if (input) input.value = e.target.value;
            }
            
            const taskVal = (input?.value || '').trim();
            const leaveKeywords = ['sick leave', 'loss of pay', 'comp-off', 'privilege leave', 'wfh', 'bereavement', 'marriage leave', 'leave', 'absent', 'holiday'];
            const isLeave = leaveKeywords.some(opt => taskVal.toLowerCase().includes(opt));
            
            const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
            dayKeys.forEach(day => {
                const cell = tr.querySelector(`td[data-day="${day}"]`) || tr.querySelector(`.ts-day-input[data-day="${day}"]`)?.closest('td');
                if (!cell) return;
                
                // Do not override if attendance status badge is fixed for absent/holiday/leave
                if (cell.querySelector('.badge-absent, .badge-holiday') && !cell.classList.contains('ts-leave-cell')) return;

                if (isLeave) {
                    const existingInput = cell.querySelector('.ts-day-input');
                    const hasManualValue = existingInput && existingInput.value.trim() && existingInput.value.trim() !== '0:00' && existingInput.value.trim() !== '0';
                    if (!hasManualValue) {
                        let badgeClass = 'badge-leave';
                        let colorStyle = 'background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);';
                        if (taskVal.toLowerCase().includes('absent')) {
                            badgeClass = 'badge-absent';
                            colorStyle = 'background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);';
                        } else if (taskVal.toLowerCase().includes('holiday')) {
                            badgeClass = 'badge-holiday';
                            colorStyle = 'background: rgba(56, 189, 248, 0.18); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4);';
                        }

                        cell.className = 'ts-leave-cell';
                        cell.style.textAlign = 'center';
                        cell.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; height: 32px;"><span class="ts-status-badge ${badgeClass}" style="font-size:0.75rem; padding: 4px 10px; border-radius: 6px; font-weight:600; text-transform: uppercase; letter-spacing:0.04em; ${colorStyle}" title="${taskVal}">${taskVal}</span></div>`;
                    }
                } else if (cell.classList.contains('ts-leave-cell')) {
                    cell.className = 'ts-input-cell';
                    cell.style.textAlign = 'left';
                    cell.innerHTML = `<input type="text" class="ts-day-input" data-day="${day}" placeholder="hh:mm" value="">`;
                    cell.querySelector('.ts-day-input')?.addEventListener('input', calculateTimesheetTotals);
                }
            });

            calculateTimesheetTotals();
        });
    });

    // Bind deletes
    tbody.querySelectorAll('.ts-delete-row-btn').forEach(btn => {
        btn.disabled = !canEdit;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!canEdit) return;
            const tr = e.target.closest('.ts-row');
            if (tr) {
                tr.remove();
                calculateTimesheetTotals();
            }
        });
    });

    calculateTimesheetTotals();
}

function calculateTimesheetTotals() {
    const rows = document.querySelectorAll('.ts-row');
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const colTotals = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0 };
    let grandTotal = 0;

    rows.forEach(row => {
        let rowTotal = 0;
        dayKeys.forEach(day => {
            const input = row.querySelector(`.ts-day-input[data-day="${day}"]`);
            if (input) {
                const mins = parseMinutes(input.value);
                rowTotal += mins;
                colTotals[day] += mins;
            }
        });
        grandTotal += rowTotal;
        const totalPill = row.querySelector('.ts-row-total-pill');
        if (totalPill) totalPill.textContent = formatMinutes(rowTotal);
    });

    // Update footer
    dayKeys.forEach(day => {
        const totalCell = document.getElementById(`ts-total-${day.substring(0, 3)}`);
        if (totalCell) totalCell.textContent = formatMinutes(colTotals[day]);
    });

    const grandTotalCell = document.getElementById('ts-total-weekly');
    if (grandTotalCell) grandTotalCell.textContent = formatMinutes(grandTotal);

    // Validation
    const limitStatus = document.getElementById('ts-limit-status');
    const saveBtn = document.getElementById('ts-save-btn');

    if (limitStatus) {
        limitStatus.textContent = `Total: ${formatMinutes(grandTotal)} / 45:00`;

        if (grandTotal > 2700) {
            limitStatus.style.color = 'var(--danger)';
            grandTotalCell.style.color = 'var(--danger)';
            if (saveBtn) saveBtn.disabled = true;
        } else if (grandTotal === 2700) {
            limitStatus.style.color = 'var(--success)'; // green
            grandTotalCell.style.color = 'var(--success)';
            if (saveBtn) saveBtn.disabled = false;
        } else {
            limitStatus.style.color = 'var(--text-secondary)';
            grandTotalCell.style.color = 'var(--accent-primary)';
            if (saveBtn) saveBtn.disabled = false;
        }
    }
}

function addTimesheetRow() {
    const tbody = document.getElementById('timesheet-tbody');
    if (!tbody || !state.currentTimesheetData) return;

    const defaultProject = state.myProfile?.project_name || '';
    const newRow = {
        id: null,
        client_project: defaultProject,
        task: '',
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0
    };

    const trHtml = createTimesheetRowHtml(newRow, tbody.children.length, state.currentTimesheetData.attendance);
    tbody.insertAdjacentHTML('beforeend', trHtml);

    const newTr = tbody.lastElementChild;
    newTr.querySelector('.ts-delete-row-btn').addEventListener('click', (e) => {
        e.preventDefault();
        newTr.remove();
        calculateTimesheetTotals();
    });

    newTr.querySelector('.ts-client-project')?.focus();
    calculateTimesheetTotals();
}

async function copyPreviousWeekTimesheet() {
    if (!state.currentTimesheetWeek) return;
    try {
        const weekStart = state.currentTimesheetWeek;
        const data = await apiFetch(`/api/timesheet/me/copy-previous?week_start=${weekStart}`, {
            method: 'POST'
        });
        state.currentTimesheetData = data;
        renderTimesheet(data);
        showToast('Copied previous week structure successfully!', 'success');
    } catch (err) {
        showToast(`Failed to copy: ${err.message}`, 'error');
    }
}

async function saveTimesheet(silent = false) {
    if (!state.currentTimesheetWeek) return;

    const trs = document.querySelectorAll('.ts-row');
    const rows = [];

    trs.forEach(tr => {
        const id = tr.getAttribute('data-row-id');
        const clientProject = tr.querySelector('.ts-client-project').value.trim();
        const task = tr.querySelector('.ts-task').value.trim();

        const monVal = tr.querySelector('.ts-day-input[data-day="monday"]').value;
        const tueVal = tr.querySelector('.ts-day-input[data-day="tuesday"]').value;
        const wedVal = tr.querySelector('.ts-day-input[data-day="wednesday"]').value;
        const thuVal = tr.querySelector('.ts-day-input[data-day="thursday"]').value;
        const friVal = tr.querySelector('.ts-day-input[data-day="friday"]').value;

        if (!clientProject && !task && !monVal && !tueVal && !wedVal && !thuVal && !friVal) {
            return;
        }

        const monday = parseMinutes(monVal);
        const tuesday = parseMinutes(tueVal);
        const wednesday = parseMinutes(wedVal);
        const thursday = parseMinutes(thuVal);
        const friday = parseMinutes(friVal);

        rows.push({
            id: id ? parseInt(id, 10) : null,
            client_project: clientProject || 'General',
            task: task || 'Work',
            monday,
            tuesday,
            wednesday,
            thursday,
            friday
        });
    });

    const payload = {
        week_start: state.currentTimesheetWeek,
        rows
    };

    try {
        const saveBtn = document.getElementById('ts-save-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0;"></span> Saving...';
        }

        const data = await apiFetch('/api/timesheet/me/save', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        state.currentTimesheetData = data;
        renderTimesheet(data);
        showToast('Timesheet saved successfully!', 'success');
    } catch (err) {
        showToast(`Failed to save timesheet: ${err.message}`, 'error');
    } finally {
        const saveBtn = document.getElementById('ts-save-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1.2rem;">save</span> Save Timesheet';
        }
    }
}

function shiftTimesheetWeek(days) {
    if (!state.currentTimesheetWeek) return;
    const current = new Date(state.currentTimesheetWeek + 'T00:00:00');
    current.setDate(current.getDate() + days);
    const newMondayStr = current.toISOString().split('T')[0];
    loadTimesheet(newMondayStr);
}

function handleWeekPickerChange(e) {
    const val = e.target.value;
    if (!val) return;
    const selected = new Date(val + 'T00:00:00');
    const day = selected.getDay();
    const diff = selected.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(selected.setDate(diff));
    const mondayStr = monday.toISOString().split('T')[0];
    loadTimesheet(mondayStr);
}

async function releaseTimesheet() {
    if (!state.currentTimesheetWeek) return;
    if (!confirm('Are you sure you want to RELEASE your timesheet to Admin? Once released, your timesheet will be locked until Admin reviews it.')) return;

    try {
        await saveTimesheet(true);
        const data = await apiFetch(`/api/timesheet/me/release?week_start=${state.currentTimesheetWeek}`, {
            method: 'POST'
        });
        state.currentTimesheetData = data;
        renderTimesheet(data);
        showToast('Timesheet released successfully to Admin!', 'success');
    } catch (err) {
        showToast(`Failed to release timesheet: ${err.message}`, 'error');
    }
}

async function loadAdminTimesheets(weekStartStr) {
    try {
        if (!weekStartStr) {
            const picker = document.getElementById('admin-ts-week-picker');
            if (picker && picker.value) {
                weekStartStr = picker.value;
            } else {
                const today = new Date();
                const day = today.getDay();
                const diff = today.getDate() - (day === 0 ? 6 : day - 1);
                const monday = new Date(today.setDate(diff));
                weekStartStr = monday.toISOString().split('T')[0];
            }
        }

        const picker = document.getElementById('admin-ts-week-picker');
        if (picker) picker.value = weekStartStr;
        state.adminSelectedTsWeek = weekStartStr;

        const list = await apiFetch(`/api/admin/timesheets?week_start=${weekStartStr}`);
        state.adminTimesheetList = list;
        renderAdminTimesheetsList(list);
    } catch (err) {
        showToast(`Failed to load admin timesheets: ${err.message}`, 'error');
    }
}

async function renderAdminTimesheetsList(list) {
    const container = document.getElementById('admin-released-timesheets-container');
    if (!container) return;

    const filterText = (document.getElementById('admin-ts-search-input')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('admin-ts-status-filter')?.value || 'Released';

    const filtered = (list || []).filter(item => {
        const matchesSearch = !filterText || item.employee_id.toLowerCase().includes(filterText) || item.name.toLowerCase().includes(filterText);
        if (!matchesSearch) return false;

        if (statusFilter === 'Released') return item.status === 'Released';
        if (statusFilter === 'Approved') return item.status === 'Approved';
        if (statusFilter === 'Rejected') return item.status === 'Rejected';
        if (statusFilter === 'Draft') return item.status === 'Draft' || item.status === 'Not Released';
        return true; // ALL
    });

    if (filtered.length === 0) {
        let emptyHeader = 'No Pending Approvals';
        let emptyDesc = `No released timesheets awaiting approval for week starting <strong>${state.adminSelectedTsWeek}</strong>.<br><span style="font-size:0.85rem;color:var(--text-muted);">When employees click "Release Timesheet" in their portal, their detailed timesheet cards will appear here for review.</span>`;

        if (statusFilter === 'Approved') {
            emptyHeader = 'No Approved Timesheets';
            emptyDesc = `No approved timesheets found for week starting <strong>${state.adminSelectedTsWeek}</strong>.`;
        } else if (statusFilter === 'Rejected') {
            emptyHeader = 'No Rejected Timesheets';
            emptyDesc = `No rejected timesheets found for week starting <strong>${state.adminSelectedTsWeek}</strong>.`;
        } else if (statusFilter !== 'Released') {
            emptyHeader = 'No Matching Timesheets';
            emptyDesc = `No employee timesheets found matching status "${statusFilter}" for week starting <strong>${state.adminSelectedTsWeek}</strong>.`;
        }

        container.innerHTML = `
            <div class="panel" style="padding: 48px 24px; text-align: center;">
                <span class="material-icons-round" style="font-size: 3.5rem; color: var(--border-color); margin-bottom: 12px;">assignment_turned_in</span>
                <h3 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 1.2rem;">${emptyHeader}</h3>
                <p style="margin: 0; color: var(--text-muted); font-size: 0.9rem; line-height: 1.6;">${emptyDesc}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="text-center" style="padding:60px;"><div class="spinner"></div>Loading detailed employee timesheets...</div>';

    try {
        const detailPromises = filtered.map(emp =>
            apiFetch(`/api/admin/timesheets/${emp.employee_id}?week_start=${state.adminSelectedTsWeek}`)
                .then(detail => ({ emp, detail }))
                .catch(err => ({ emp, detail: null, error: err.message }))
        );

        const results = await Promise.all(detailPromises);
        container.innerHTML = '';

        results.forEach(({ emp, detail }) => {
            if (!detail) return;
            const card = document.createElement('div');
            card.className = 'panel';
            card.style.marginBottom = '24px';

            const statusClass = (
                emp.status === 'Approved' ? 'badge-success' :
                emp.status === 'Released' ? 'badge-warning' :
                emp.status === 'Rejected' ? 'badge-danger' : 'badge-secondary'
            );
            const statusText = emp.status === 'Released' ? 'Released (Pending Approval)' : emp.status;

            const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday"];
            const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];

            const attBadges = dayNames.map((d, idx) => {
                const st = detail.attendance ? detail.attendance[d] : 'P';
                const attColor = st === 'P' ? 'var(--success)' : st === 'Ab' ? 'var(--danger)' : st === 'L' ? 'var(--warning)' : 'var(--accent-primary)';
                return `<span style="font-size:0.75rem; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-color); color: ${attColor};">
                    <strong>${dayLabels[idx]}:</strong> ${st || 'P'}
                </span>`;
            }).join(' ');

            const colTotals = [0, 0, 0, 0, 0];
            let grandTotalMins = 0;

            const rowsHtml = (detail.rows || []).map(r => {
                const rowMins = (r.monday || 0) + (r.tuesday || 0) + (r.wednesday || 0) + (r.thursday || 0) + (r.friday || 0);
                colTotals[0] += r.monday || 0;
                colTotals[1] += r.tuesday || 0;
                colTotals[2] += r.wednesday || 0;
                colTotals[3] += r.thursday || 0;
                colTotals[4] += r.friday || 0;
                grandTotalMins += rowMins;

                const isLeaveTaskOption = (taskStr) => {
                    if (!taskStr) return false;
                    const str = String(taskStr).trim().toLowerCase();
                    const leaveKeywords = ['sick leave', 'loss of pay', 'comp-off', 'privilege leave', 'wfh', 'bereavement', 'marriage leave', 'leave', 'absent', 'holiday'];
                    return leaveKeywords.some(opt => str.includes(opt));
                };

                const dayCellsHtml = dayNames.map((d) => {
                    const mins = r[d] || 0;
                    const st = detail.attendance ? detail.attendance[d] : 'P';
                    if (st === 'Ab') {
                        return `<td style="text-align: center;"><span class="badge badge-danger" style="font-size:0.72rem; padding:3px 8px; background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.4);">Absent</span></td>`;
                    } else if (st === 'L') {
                        return `<td style="text-align: center;"><span class="badge badge-warning" style="font-size:0.72rem; padding:3px 8px; background:rgba(245,158,11,0.18); color:#fbbf24; border:1px solid rgba(245,158,11,0.4);">Leave</span></td>`;
                    } else if (st === 'H') {
                        return `<td style="text-align: center;"><span class="badge badge-info" style="font-size:0.72rem; padding:3px 8px; background:rgba(56,189,248,0.18); color:#38bdf8; border:1px solid rgba(56,189,248,0.4);">Holiday</span></td>`;
                    } else if (isLeaveTaskOption(r.task) && mins === 0) {
                        return `<td style="text-align: center;"><span class="badge badge-warning" style="font-size:0.72rem; padding:3px 8px; background:rgba(245,158,11,0.18); color:#fbbf24; border:1px solid rgba(245,158,11,0.4);">${r.task}</span></td>`;
                    }
                    return `<td style="text-align: center;">${formatMinutes(mins)}</td>`;
                }).join('');

                return `
                    <tr>
                        <td><strong>${r.client_project || 'Internal / Default'}</strong></td>
                        <td>${r.task || 'General Development / Support'}</td>
                        ${dayCellsHtml}
                        <td style="text-align: center; font-weight: 600; color: var(--accent-secondary);">${formatMinutes(rowMins)}</td>
                    </tr>
                `;
            }).join('');

            const relAtText = emp.released_at ? formatDate(emp.released_at) : '—';

            card.innerHTML = `
                <div class="panel-header" style="justify-content: space-between; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="material-icons-round" style="font-size: 2rem; color: var(--accent-primary);">account_circle</span>
                        <div>
                            <h2 style="margin: 0; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                ${emp.name}
                                <span class="badge badge-secondary" style="font-size: 0.75rem;">${emp.employee_id}</span>
                            </h2>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">
                                Project: <strong style="color: var(--text-secondary);">${emp.project_name || 'Bench'}</strong> | Released: <strong>${relAtText}</strong>
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="badge ${statusClass}" style="font-size: 0.85rem; padding: 4px 10px;">${statusText}</span>
                        <div style="font-size: 0.9rem; font-weight: 700; background: var(--bg-tertiary); padding: 4px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); color: var(--success);">
                            Total: ${emp.total_formatted || formatMinutes(grandTotalMins)}
                        </div>
                    </div>
                </div>

                <div class="panel-body" style="padding: 16px 20px;">
                    <!-- Attendance Info Bar -->
                    <div style="margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; background: var(--bg-card); padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Daily Attendance Status:</span>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">${attBadges}</div>
                    </div>

                    <!-- Detailed Timesheet Rows Table -->
                    <div class="table-responsive">
                        <table class="admin-table" style="min-width: 700px; font-size: 0.88rem;">
                            <thead>
                                <tr>
                                    <th style="width: 22%;">Client / Project</th>
                                    <th style="width: 32%;">Task Description</th>
                                    <th style="width: 8%; text-align: center;">Mon</th>
                                    <th style="width: 8%; text-align: center;">Tue</th>
                                    <th style="width: 8%; text-align: center;">Wed</th>
                                    <th style="width: 8%; text-align: center;">Thu</th>
                                    <th style="width: 8%; text-align: center;">Fri</th>
                                    <th style="width: 8%; text-align: center;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml || '<tr><td colspan="8" class="text-center" style="padding: 20px; color: var(--text-muted);">No task rows logged by employee.</td></tr>'}
                                <tr style="font-weight: 600; background: var(--bg-tertiary);">
                                    <td colspan="2" style="text-align: right; font-size: 0.82rem; color: var(--text-secondary);">Daily Totals:</td>
                                    <td style="text-align: center;">${formatMinutes(colTotals[0])}</td>
                                    <td style="text-align: center;">${formatMinutes(colTotals[1])}</td>
                                    <td style="text-align: center;">${formatMinutes(colTotals[2])}</td>
                                    <td style="text-align: center;">${formatMinutes(colTotals[3])}</td>
                                    <td style="text-align: center;">${formatMinutes(colTotals[4])}</td>
                                    <td style="text-align: center; color: var(--success); font-size: 0.95rem;">${formatMinutes(grandTotalMins)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Approval Action Controls & Admin Notes Directly Below Timesheet -->
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 12px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Admin Review Notes / Feedback (Optional):</label>
                            <input type="text" class="form-control admin-ts-notes-input" placeholder="e.g. Approved, or Please verify Thursday project hours..." style="font-size: 0.85rem;" value="${detail.admin_notes || ''}">
                        </div>
                        <div style="display: flex; gap: 12px; justify-content: flex-end; align-items: center;">
                            <button class="btn btn-danger btn-ts-reject" data-emp="${emp.employee_id}" ${!emp.can_reject ? 'disabled' : ''} style="display: flex; align-items: center; gap: 6px; padding: 8px 16px; ${emp.is_past_month ? 'opacity: 0.55; cursor: not-allowed;' : ''}" title="${emp.is_past_month ? 'Timesheets from ended months cannot be rejected' : ''}">
                                <span class="material-icons-round">${emp.is_past_month ? 'lock' : 'cancel'}</span>
                                <span>${emp.is_past_month ? 'Reject Disabled (Month Ended)' : 'Reject Timesheet'}</span>
                            </button>
                            <button class="btn btn-success btn-ts-approve" data-emp="${emp.employee_id}" ${!emp.can_accept ? 'disabled' : ''} style="display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: #10b981; border-color: #10b981; color: white;">
                                <span class="material-icons-round">check_circle</span>
                                <span>Accept &amp; Approve</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            card.querySelector('.btn-ts-approve')?.addEventListener('click', () => {
                const notes = card.querySelector('.admin-ts-notes-input')?.value || '';
                reviewTimesheet(emp.employee_id, 'accept', notes);
            });

            card.querySelector('.btn-ts-reject')?.addEventListener('click', () => {
                const notes = card.querySelector('.admin-ts-notes-input')?.value || '';
                reviewTimesheet(emp.employee_id, 'reject', notes);
            });

            container.appendChild(card);
        });

    } catch (err) {
        container.innerHTML = `<div style="color:var(--danger);padding:40px;text-align:center;">Failed to render detailed timesheets: ${err.message}</div>`;
    }
}

async function reviewTimesheet(employeeId, action, notes = '') {
    const targetWeek = state.adminSelectedTsWeek || state.adminSelectedTsDetailWeek;
    if (!targetWeek) {
        showToast("Error: No week selected.", "error");
        return;
    }
    const actionLabel = action === 'accept' ? 'ACCEPT & APPROVE' : 'REJECT';
    if (!confirm(`Are you sure you want to ${actionLabel} the timesheet for ${employeeId}?`)) return;

    try {
        await apiFetch(`/api/admin/timesheets/${employeeId}/review`, {
            method: 'PUT',
            body: JSON.stringify({
                week_start: targetWeek,
                action: action,
                notes: notes
            })
        });
        showToast(`Timesheet for ${employeeId} set to ${action === 'accept' ? 'Approved' : 'Rejected'}.`, 'success');
        if (state.adminSelectedTsWeek) loadAdminTimesheets(state.adminSelectedTsWeek);
        if (state.adminSelectedTsDetailWeek) loadAdminEmpTimesheetsView(state.adminSelectedTsDetailWeek);
    } catch (err) {
        showToast(`Action failed: ${err.message}`, 'error');
    }
}

async function loadAdminEmpTimesheetsView(weekStartStr) {
    try {
        if (!weekStartStr) {
            const picker = document.getElementById('admin-tsdetail-week-picker');
            if (picker && picker.value) {
                weekStartStr = picker.value;
            } else {
                const today = new Date();
                const day = today.getDay();
                const diff = today.getDate() - (day === 0 ? 6 : day - 1);
                const monday = new Date(today.setDate(diff));
                weekStartStr = monday.toISOString().split('T')[0];
            }
        }

        const picker = document.getElementById('admin-tsdetail-week-picker');
        if (picker) picker.value = weekStartStr;
        state.adminSelectedTsDetailWeek = weekStartStr;

        const container = document.getElementById('admin-approved-timesheets-container');
        if (container) {
            container.innerHTML = '<div class="text-center" style="padding:40px;"><div class="spinner"></div>Loading approved timesheets...</div>';
        }

        const masterList = await apiFetch(`/api/admin/timesheets?week_start=${weekStartStr}`);
        
        // FILTER ONLY APPROVED TIMESHEETS (DRAFT, RELEASED & REJECTED ARE HIDDEN)
        const approvedSummaryList = (masterList || []).filter(item => item.status === 'Approved');

        if (approvedSummaryList.length === 0) {
            if (container) {
                container.innerHTML = `
                    <div class="panel" style="padding: 40px; text-align: center; color: var(--text-muted);">
                        <span class="material-icons-round" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 12px;">assignment_late</span>
                        <h3>No Approved Timesheets Found</h3>
                        <p style="color: var(--text-secondary); margin-top: 8px;">There are no approved employee timesheets for week starting <strong>${weekStartStr}</strong>.<br>Timesheets will appear here once Admin accepts &amp; approves them in the <strong>Timesheet Approvals</strong> page.</p>
                    </div>`;
            }
            state.adminApprovedDetailedList = [];
            return;
        }

        // Fetch full timesheet detail for EACH approved employee in parallel
        const fullDetailsPromises = approvedSummaryList.map(emp => 
            apiFetch(`/api/admin/timesheets/${emp.employee_id}?week_start=${weekStartStr}`)
                .then(data => ({
                    ...emp,
                    rows: data.rows || [],
                    attendance: data.attendance || {}
                }))
                .catch(() => ({
                    ...emp,
                    rows: [],
                    attendance: {}
                }))
        );

        const fullApprovedList = await Promise.all(fullDetailsPromises);
        state.adminApprovedDetailedList = fullApprovedList;
        renderAdminApprovedTimesheetsCards(fullApprovedList);
    } catch (err) {
        showToast(`Failed to load approved timesheets: ${err.message}`, 'error');
    }
}

function renderAdminApprovedTimesheetsCards(list) {
    const container = document.getElementById('admin-approved-timesheets-container');
    if (!container) return;

    const filterText = (document.getElementById('admin-tsdetail-search-input')?.value || '').toLowerCase().trim();
    const filtered = (list || []).filter(emp => {
        if (!filterText) return true;
        return emp.employee_id.toLowerCase().includes(filterText) || emp.name.toLowerCase().includes(filterText);
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="panel" style="padding: 30px; text-align: center; color: var(--text-muted);">
                No approved employee timesheets match your search.
            </div>`;
        return;
    }

    container.innerHTML = '';

    filtered.forEach(emp => {
        let totalMinsMon = 0, totalMinsTue = 0, totalMinsWed = 0, totalMinsThu = 0, totalMinsFri = 0;
        let grandTotalMins = 0;

        const rowsHtml = (emp.rows || []).map(r => {
            const mon = r.monday || 0;
            const tue = r.tuesday || 0;
            const wed = r.wednesday || 0;
            const thu = r.thursday || 0;
            const fri = r.friday || 0;
            const rowTot = mon + tue + wed + thu + fri;

            totalMinsMon += mon;
            totalMinsTue += tue;
            totalMinsWed += wed;
            totalMinsThu += thu;
            totalMinsFri += fri;
            grandTotalMins += rowTot;

            return `
                <tr>
                    <td><strong>${r.client_project || 'General'}</strong></td>
                    <td>${r.task || 'Work'}</td>
                    <td style="text-align: center;">${formatMinutes(mon)}</td>
                    <td style="text-align: center;">${formatMinutes(tue)}</td>
                    <td style="text-align: center;">${formatMinutes(wed)}</td>
                    <td style="text-align: center;">${formatMinutes(thu)}</td>
                    <td style="text-align: center;">${formatMinutes(fri)}</td>
                    <td style="text-align: center;"><strong>${formatMinutes(rowTot)}</strong></td>
                </tr>
            `;
        }).join('');

        const cardHtml = `
            <div class="panel">
                <div class="panel-header" style="justify-content: space-between; display: flex; align-items: center; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="material-icons-round" style="color: var(--success);">check_circle</span>
                        <h2>${emp.name} (${emp.employee_id})</h2>
                        <span class="badge badge-success">Approved</span>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">
                        Project: <strong style="color: var(--text-primary);">${emp.project_name || 'Bench'}</strong>
                    </div>
                </div>
                <div class="panel-body">
                    <div style="margin-bottom: 12px; font-size: 0.88rem; color: var(--text-secondary); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                        <span><strong>Week Start:</strong> ${emp.week_start}</span>
                        <span><strong>Released Timestamp:</strong> ${emp.released_at ? formatDate(emp.released_at) : '—'}</span>
                        <span><strong>Total Approved Hours:</strong> <strong style="color: var(--success); font-size: 1rem;">${formatMinutes(grandTotalMins)}</strong></span>
                    </div>
                    <div class="table-responsive" style="overflow-x: auto;">
                        <table class="admin-table" style="min-width: 800px;">
                            <thead>
                                <tr>
                                    <th style="width: 28%;">Client &amp; Project</th>
                                    <th style="width: 28%;">Task</th>
                                    <th style="text-align: center; width: 8%;">Mon</th>
                                    <th style="text-align: center; width: 8%;">Tue</th>
                                    <th style="text-align: center; width: 8%;">Wed</th>
                                    <th style="text-align: center; width: 8%;">Thu</th>
                                    <th style="text-align: center; width: 8%;">Fri</th>
                                    <th style="text-align: center; width: 10%;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml || '<tr><td colspan="8" class="text-center" style="padding: 20px; color: var(--text-muted);">No rows recorded.</td></tr>'}
                            </tbody>
                            <tfoot>
                                <tr style="font-weight: 600; background: var(--bg-tertiary);">
                                    <td colspan="2" style="text-align: right; padding-right: 20px;">Total</td>
                                    <td style="text-align: center;">${formatMinutes(totalMinsMon)}</td>
                                    <td style="text-align: center;">${formatMinutes(totalMinsTue)}</td>
                                    <td style="text-align: center;">${formatMinutes(totalMinsWed)}</td>
                                    <td style="text-align: center;">${formatMinutes(totalMinsThu)}</td>
                                    <td style="text-align: center;">${formatMinutes(totalMinsFri)}</td>
                                    <td style="text-align: center; color: var(--success);">${formatMinutes(grandTotalMins)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <!-- Admin Action Bar to Revoke/Reject Approved Timesheet in current month -->
                    <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div style="font-size: 0.82rem; color: var(--text-muted);">
                            <span class="material-icons-round" style="font-size: 15px; vertical-align: middle; color: var(--success);">verified</span>
                            <span>${emp.is_past_month ? 'Archived past month timesheet (Read-only).' : 'Approved for current month. Admin can reject when needed during this month.'}</span>
                        </div>
                        <button class="btn btn-danger btn-sm btn-revoke-approved" data-emp="${emp.employee_id}" ${emp.is_past_month ? 'disabled style="opacity:0.55;cursor:not-allowed;"' : ''} title="${emp.is_past_month ? 'Timesheets from ended months cannot be rejected' : 'Click to reject/revoke approval for corrections'}">
                            <span class="material-icons-round" style="font-size: 15px; vertical-align: middle;">${emp.is_past_month ? 'lock' : 'cancel'}</span>
                            <span>${emp.is_past_month ? 'Locked (Month Ended)' : 'Reject / Revoke Approval'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHtml.trim();
        const cardEl = tempDiv.firstElementChild;

        cardEl.querySelector('.btn-revoke-approved')?.addEventListener('click', () => {
            if (emp.is_past_month) return;
            const notes = prompt(`Reject approved timesheet for ${emp.name} (${emp.employee_id})?\nEnter optional rejection reason below:`, 'Rejection requested by Admin for corrections');
            if (notes !== null) {
                reviewTimesheet(emp.employee_id, 'reject', notes);
            }
        });

        container.appendChild(cardEl);
    });
}



// ── Shift Options (dropdown list) ────────────────────────────────────────────
const SHIFT_OPTIONS = [
    { value: '6 AM - 3 PM', label: '6 AM – 3 PM  (Early Morning)' },
    { value: '7 AM - 4 PM', label: '7 AM – 4 PM  (Morning)' },
    { value: '8 AM - 5 PM', label: '8 AM – 5 PM  (Morning+)' },
    { value: '9 AM - 6 PM', label: '9 AM – 6 PM  (Day Shift)' },
    { value: '10 AM - 7 PM', label: '10 AM – 7 PM (Mid-Day)' },
    { value: '11 AM - 8 PM', label: '11 AM – 8 PM (Late Day)' },
    { value: '12 PM - 9 PM', label: '12 PM – 9 PM (Afternoon)' },
    { value: '1 PM - 10 PM', label: '1 PM – 10 PM  (Afternoon+)' },
    { value: '2 PM - 11 PM', label: '2 PM – 11 PM (Evening)' },
    { value: '4 PM - 1 AM', label: '4 PM – 1 AM  (Evening+)' },
    { value: '6 PM - 3 AM', label: '6 PM – 3 AM  (Night)' },
    { value: '8 PM - 5 AM', label: '8 PM – 5 AM  (Night+)' },
    { value: '10 PM - 7 AM', label: '10 PM – 7 AM (Night Shift)' },
    { value: '11 PM - 8 AM', label: '11 PM – 8 AM (Graveyard)' },
    { value: 'Flexible', label: 'Flexible Hours' },
];

function generateShiftSelectHtml(dayKey, currentValue) {
    const opts = SHIFT_OPTIONS.map(o => {
        const sel = (o.value === currentValue) ? 'selected' : '';
        return `<option value="${o.value}" ${sel}>${o.label}</option>`;
    }).join('');
    return `
        <select id="shift-select-${dayKey}" class="shift-dropdown form-control" data-shift-day="${dayKey}">
            ${opts}
        </select>
    `;
}

function normalizeShiftValue(raw) {
    if (!raw) return '9 AM - 6 PM';
    if (SHIFT_OPTIONS.find(o => o.value === raw)) return raw;
    const match = raw.match(/(\d+\s*(?:AM|PM))\s*[-–]\s*(\d+\s*(?:AM|PM))/i);
    if (match) return `${match[1].trim()} - ${match[2].trim()}`;
    if (raw.toLowerCase().includes('night')) return '10 PM - 7 AM';
    if (raw.toLowerCase().includes('afternoon')) return '2 PM - 11 PM';
    if (raw.toLowerCase().includes('flexible')) return 'Flexible';
    return '9 AM - 6 PM';
}

function formatActiveHours(hours) {
    if (!hours || hours.length === 0) return 'No shift hours selected';
    const sorted = [...hours].sort((a, b) => a - b);

    let intervals = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === prev + 1) {
            prev = sorted[i];
        } else {
            intervals.push([start, prev]);
            start = sorted[i];
            prev = sorted[i];
        }
    }
    intervals.push([start, prev]);

    if (intervals.length > 1) {
        const first = intervals[0];
        const last = intervals[intervals.length - 1];
        if (last[1] === 23 && first[0] === 0) {
            intervals[0] = [last[0], first[1]];
            intervals.pop();
        }
    }

    return intervals.map(([s, e]) => {
        const formatHour = (h) => {
            const period = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 === 0 ? 12 : h % 12;
            return `${displayH} ${period}`;
        };
        const nextHour = (e + 1) % 24;
        return `${formatHour(s)} - ${formatHour(nextHour)}`;
    }).join(', ');
}

function parseShiftStringToHours(shiftStr) {
    if (!shiftStr) return [];

    let str = shiftStr.trim();
    try {
        const parsed = JSON.parse(str);
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        for (let d of days) {
            if (parsed[d] && parsed[d] !== 'Off') {
                str = parsed[d];
                break;
            }
        }
    } catch (e) { }

    const parts = str.split(',');
    const hours = new Set();

    for (let part of parts) {
        const match = part.match(/(\d+)\s*(AM|PM)\s*[-–]\s*(\d+)\s*(AM|PM)/i);
        if (match) {
            let startH = parseInt(match[1]);
            const startPeriod = match[2].toUpperCase();
            let endH = parseInt(match[3]);
            const endPeriod = match[4].toUpperCase();

            if (startPeriod === 'PM' && startH !== 12) startH += 12;
            if (startPeriod === 'AM' && startH === 12) startH = 0;
            if (endPeriod === 'PM' && endH !== 12) endH += 12;
            if (endPeriod === 'AM' && endH === 12) endH = 0;

            if (startH <= endH) {
                for (let h = startH; h < endH; h++) {
                    hours.add(h);
                }
            } else {
                for (let h = startH; h < 24; h++) {
                    hours.add(h);
                }
                for (let h = 0; h < endH; h++) {
                    hours.add(h);
                }
            }
        }
    }

    if (hours.size === 0) {
        if (str.toLowerCase().includes('day shift')) {
            return [9, 10, 11, 12, 13, 14, 15, 16, 17];
        } else if (str.toLowerCase().includes('afternoon shift')) {
            return [13, 14, 15, 16, 17, 18, 19, 20, 21];
        } else if (str.toLowerCase().includes('night shift')) {
            return [22, 23, 0, 1, 2, 3, 4, 5, 6];
        }
    }

    return Array.from(hours);
}

function formatShiftSummary(shiftStr) {
    if (!shiftStr) return '9 AM - 6 PM';
    try {
        const data = JSON.parse(shiftStr);
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const activeShifts = days.map(d => data[d] || '9 AM - 6 PM');
        const first = activeShifts[0];
        const allSame = activeShifts.every(s => s === first);
        return allSame ? first : 'Mixed Shifts';
    } catch (e) {
        return normalizeShiftValue(shiftStr);
    }
}



// ─────────────────────────────────────────────
// PAGE 4: Weekly Schedule
// ─────────────────────────────────────────────

// Render a read-only view card (default mode)
function renderScheduleViewCard(containerId, sched, empData) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const days = [
        { key: 'monday', label: 'Monday', tasksKey: 'monday_tasks' },
        { key: 'tuesday', label: 'Tuesday', tasksKey: 'tuesday_tasks' },
        { key: 'wednesday', label: 'Wednesday', tasksKey: 'wednesday_tasks' },
        { key: 'thursday', label: 'Thursday', tasksKey: 'thursday_tasks' },
        { key: 'friday', label: 'Friday', tasksKey: 'friday_tasks' },
    ];
    const project = empData ? (empData.project_name || 'Bench') : '—';
    const workingCount = days.filter(d => sched[d.key] === 'Working').length;

    let shiftData = {};
    try {
        shiftData = JSON.parse(sched.shift || '{}');
    } catch (e) {
        const def = sched.shift || '9 AM - 6 PM';
        shiftData = { monday: def, tuesday: def, wednesday: def, thursday: def, friday: def };
    }

    el.innerHTML = `
        <!-- Meta info -->
        <div class="panel" style="margin-bottom:20px;">
            <div class="panel-body" style="padding:16px 20px;">
                <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;">
                    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
                        <div class="schedule-meta-item">
                            <span class="material-icons-round">folder_open</span>
                            <span>Project: <strong>${project}</strong></span>
                        </div>
                        <div class="schedule-meta-item">
                            <span class="material-icons-round">person</span>
                            <span>Manager: <strong>${sched.manager_name || 'Not assigned'}</strong></span>
                        </div>
                        <div class="schedule-meta-item">
                            <span class="material-icons-round">event_available</span>
                            <span>Working Days: <strong>${workingCount} / 5</strong></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Day cards (read-only) -->
        <div style="display:flex;flex-direction:column;gap:10px;">
            ${days.map(d => {
        const isWorking = sched[d.key] === 'Working';
        const taskValue = sched[d.tasksKey] || '';
        const taskCount = taskValue ? taskValue.split('\n').filter(t => t.trim()).length : 0;
        const rawShift = shiftData[d.key] || '9 AM - 6 PM';
        const shiftLabel = normalizeShiftValue(rawShift);
        return `
                <div class="sched-view-card ${isWorking ? 'sched-view-working' : 'sched-view-off'}">
                    <div class="sched-view-card-header">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div class="sched-day-dot ${isWorking ? 'dot-on' : 'dot-off'}"></div>
                            <span class="sched-day-name">${d.label}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            ${isWorking ? `
                                <span class="sched-shift-badge">
                                    <span class="material-icons-round" style="font-size:14px;vertical-align:middle;">schedule</span>
                                    ${shiftLabel}
                                </span>
                            ` : ''}
                            <span class="sched-status-badge ${isWorking ? 'badge-working' : 'badge-off'}">${isWorking ? 'Working' : 'Off'}</span>
                        </div>
                    </div>
                    ${isWorking && taskCount > 0 ? `
                        <div class="sched-view-tasks">
                            ${taskValue.split('\n').filter(t => t.trim()).map(t => `
                                <div class="sched-task-row">
                                    <span class="material-icons-round" style="font-size:14px;color:var(--accent-secondary);">task_alt</span>
                                    <span>${t.trim().replace(/^[•\-*]\s*/, '')}</span>
                                </div>`).join('')}
                        </div>` : (isWorking ? `<div class="sched-view-tasks" style="color:var(--text-secondary);font-size:0.85rem;font-style:italic;">No tasks set for this day.</div>` : '')}
                </div>`;
    }).join('')}
        </div>

        ${sched.notes ? `
        <div class="panel" style="margin-top:20px;">
            <div class="panel-header"><span class="material-icons-round">notes</span><h2>Notes</h2></div>
            <div class="panel-body" style="font-size:0.9rem;color:var(--text-secondary);white-space:pre-wrap;">${sched.notes}</div>
        </div>` : ''}
    `;

    // Show the Edit button
    const editBtn = document.getElementById('edit-schedule-btn');
    if (editBtn) {
        editBtn.style.display = 'flex';
        editBtn.onclick = () => renderScheduleEditForm('emp-schedule-content', sched, empData);
    }
}

// Render the full edit form
function renderScheduleEditForm(containerId, sched, empData) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const days = [
        { key: 'monday', label: 'Monday', tasksKey: 'monday_tasks' },
        { key: 'tuesday', label: 'Tuesday', tasksKey: 'tuesday_tasks' },
        { key: 'wednesday', label: 'Wednesday', tasksKey: 'wednesday_tasks' },
        { key: 'thursday', label: 'Thursday', tasksKey: 'thursday_tasks' },
        { key: 'friday', label: 'Friday', tasksKey: 'friday_tasks' },
    ];
    const project = empData ? (empData.project_name || 'Bench') : '—';
    const workingCount = days.filter(d => sched[d.key] === 'Working').length;

    let shiftData = {};
    try {
        shiftData = JSON.parse(sched.shift || '{}');
    } catch (e) {
        const def = sched.shift || '9 AM - 6 PM';
        shiftData = { monday: def, tuesday: def, wednesday: def, thursday: def, friday: def };
    }
    // Normalize all shift values
    days.forEach(d => {
        shiftData[d.key] = normalizeShiftValue(shiftData[d.key] || '9 AM - 6 PM');
    });

    // Hide the Edit button while editing
    const editBtn = document.getElementById('edit-schedule-btn');
    if (editBtn) editBtn.style.display = 'none';

    el.innerHTML = `
        <form id="user-schedule-form">
            <!-- Top info bar -->
            <div class="panel" style="margin-bottom:20px;">
                <div class="panel-body" style="padding:16px 20px;">
                    <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;width:100%;">
                        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
                            <div class="schedule-meta-item"><span class="material-icons-round">folder_open</span><span>Project: <strong>${project}</strong></span></div>
                            <div class="schedule-meta-item"><span class="material-icons-round">person</span><span>Manager: <strong>${sched.manager_name || 'Not assigned'}</strong></span></div>
                            <div class="schedule-meta-item"><span class="material-icons-round">event_available</span><span>Working Days: <strong id="working-count-badge">${workingCount} / 5</strong></span></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Instruction banner -->
            <div style="background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.18);border-radius:var(--radius-md);padding:10px 16px;margin-bottom:18px;display:flex;align-items:center;gap:10px;">
                <span class="material-icons-round" style="color:var(--accent-secondary);font-size:18px;">info</span>
                <span style="font-size:0.875rem;color:var(--text-secondary);">Toggle days <strong>on/off</strong>, choose a shift from the dropdown, and add tasks. Click the arrow <strong>▾</strong> on each day to expand. Hit <strong>Save</strong> when done.</span>
            </div>

            <!-- Day cards -->
            <div style="display:flex;flex-direction:column;gap:12px;">
                ${days.map(d => {
        const isWorking = sched[d.key] === 'Working';
        const taskValue = sched[d.tasksKey] || '';
        const taskCount = taskValue ? taskValue.split('\n').filter(t => t.trim()).length : 0;
        const dayShiftVal = shiftData[d.key];
        return `
                    <div class="schedule-day-card-new" data-day-card="${d.key}" style="
                        border: 1px solid ${isWorking ? 'rgba(37,99,235,0.3)' : 'var(--border-color)'};
                        border-radius: var(--radius-md);
                        overflow: hidden;
                        background: ${isWorking ? 'rgba(37,99,235,0.04)' : 'rgba(255,255,255,0.01)'};
                    ">
                        <!-- Day header row -->
                        <div class="sched-day-header" style="
                            display:flex; align-items:center; justify-content:space-between;
                            padding:14px 18px; cursor:pointer; user-select:none; background:rgba(0,0,0,0.1);
                        " data-toggle-day="${d.key}">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <div style="
                                    width:36px;height:36px;border-radius:50%;
                                    background:${isWorking ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)'};
                                    display:flex;align-items:center;justify-content:center;
                                " class="day-icon-circle">
                                    <span class="material-icons-round day-icon" style="font-size:18px;color:${isWorking ? 'var(--accent-secondary)' : 'var(--text-muted)'};"
                                    >${isWorking ? 'work' : 'weekend'}</span>
                                </div>
                                <div>
                                    <div style="font-weight:700;font-size:1rem;color:var(--text-primary);">${d.label}</div>
                                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                                        <span class="day-task-count" style="font-size:0.75rem;color:var(--text-muted);">${isWorking ? (taskCount > 0 ? taskCount + ' task' + (taskCount > 1 ? 's' : '') : 'No tasks yet') : 'Day off'}</span>
                                    </div>
                                </div>
                            </div>
                            <div style="display:flex;align-items:center;gap:14px;">
                                <span class="day-status-chip" style="
                                    font-size:0.78rem;font-weight:700;padding:4px 10px; border-radius:20px;
                                    background:${isWorking ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)'};
                                    color:${isWorking ? '#10b981' : 'var(--text-muted)'};
                                    border:1px solid ${isWorking ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'};
                                ">${isWorking ? 'Working' : 'Off'}</span>
                                <div onclick="event.stopPropagation();" style="display:flex;align-items:center;gap:6px;">
                                    <label class="switch" style="margin-bottom:0;">
                                        <input type="checkbox" class="day-working-toggle" data-day="${d.key}" ${isWorking ? 'checked' : ''}>
                                        <span class="slider round"></span>
                                    </label>
                                </div>
                                <span class="material-icons-round day-chevron" style="
                                    color:var(--text-muted);transition:transform 0.25s ease;
                                    font-size:20px;${isWorking ? '' : 'opacity:0.4;'}
                                ">expand_more</span>
                            </div>
                        </div>

                        <!-- Collapsible body -->
                        <div class="day-task-body" data-day-body="${d.key}" style="
                            display:none;padding:16px 18px; border-top:1px solid var(--border-color); background:rgba(0,0,0,0.05);
                        ">
                            <!-- Shift Dropdown -->
                            <div class="shift-select-row" style="${isWorking ? '' : 'pointer-events:none;opacity:0.45;'}" id="shift-select-row-${d.key}">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                                    <span class="material-icons-round" style="font-size:16px;color:var(--accent-secondary);">schedule</span>
                                    <label style="font-size:0.82rem;font-weight:600;color:var(--text-secondary);margin:0;">Shift Timing</label>
                                </div>
                                ${generateShiftSelectHtml(d.key, dayShiftVal)}
                            </div>

                            <label style="font-size:0.82rem;font-weight:600;color:var(--text-secondary);margin-bottom:8px;display:flex;align-items:center;gap:6px;margin-top:14px;">
                                <span class="material-icons-round" style="font-size:16px;">checklist</span>
                                ${d.label}'s Tasks
                                <span style="font-weight:400;color:var(--text-muted);font-size:0.78rem;">(one task per line)</span>
                            </label>
                            <textarea
                                class="day-tasks-input form-control"
                                data-day-tasks="${d.tasksKey}"
                                rows="4"
                                style="resize:vertical;width:100%;font-family:inherit;line-height:1.6;box-sizing:border-box;"
                                ${isWorking ? '' : 'disabled'}
                            >${taskValue}</textarea>
                            <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-size:0.73rem;color:var(--text-muted);">Enter each task on a new line</span>
                                <span class="task-char-count" style="font-size:0.73rem;color:var(--text-muted);">${taskValue.length} chars</span>
                            </div>
                        </div>
                    </div>`;
    }).join('')}
            </div>

            <!-- Save / Cancel buttons -->
            <div style="display:flex;justify-content:flex-end;margin-top:24px;gap:12px;">
                <button type="button" class="btn btn-secondary" id="sched-cancel-btn" style="padding:11px 20px;">
                    <span class="material-icons-round">close</span>
                    <span>Cancel</span>
                </button>
                <button type="submit" class="btn btn-primary" style="padding:11px 24px;font-size:1rem;">
                    <span class="material-icons-round">save</span>
                    <span>Save Schedule &amp; Tasks</span>
                </button>
            </div>
        </form>
    `;

    // ── Expand/collapse on header click ──
    el.querySelectorAll('.sched-day-header').forEach(header => {
        header.addEventListener('click', () => {
            const dayKey = header.dataset.toggleDay;
            const body = el.querySelector(`[data-day-body="${dayKey}"]`);
            const chevron = header.querySelector('.day-chevron');
            const isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : 'block';
            chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            if (!isOpen) body.querySelector('textarea')?.focus();
        });
    });

    // ── Live char counter + task count ──
    el.querySelectorAll('.day-tasks-input').forEach(ta => {
        ta.addEventListener('input', () => {
            const counter = ta.closest('.day-task-body').querySelector('.task-char-count');
            if (counter) counter.textContent = `${ta.value.length} chars`;
            const dayKey = ta.dataset.dayTasks.replace('_tasks', '');
            const countEl = el.querySelector(`[data-day-card="${dayKey}"] .day-task-count`);
            const toggled = el.querySelector(`[data-day="${dayKey}"]`)?.checked;
            if (countEl && toggled) {
                const n = ta.value.split('\n').filter(t => t.trim()).length;
                countEl.textContent = n > 0 ? `${n} task${n > 1 ? 's' : ''}` : 'No tasks yet';
            }
        });
    });

    // ── Working-day toggle switch ──
    el.querySelectorAll('.day-working-toggle').forEach(chk => {
        chk.addEventListener('change', e => {
            const dayKey = e.target.dataset.day;
            const card = el.querySelector(`[data-day-card="${dayKey}"]`);
            const body = el.querySelector(`[data-day-body="${dayKey}"]`);
            const icon = card.querySelector('.day-icon');
            const circle = card.querySelector('.day-icon-circle');
            const chip = card.querySelector('.day-status-chip');
            const chevron = card.querySelector('.day-chevron');
            const countLbl = card.querySelector('.day-task-count');
            const ta = card.querySelector('textarea');
            const shiftRow = body.querySelector(`#shift-select-row-${dayKey}`);
            const on = e.target.checked;

            card.style.border = on ? '1px solid rgba(37,99,235,0.3)' : '1px solid var(--border-color)';
            card.style.background = on ? 'rgba(37,99,235,0.04)' : 'rgba(255,255,255,0.01)';
            icon.textContent = on ? 'work' : 'weekend';
            icon.style.color = on ? 'var(--accent-secondary)' : 'var(--text-muted)';
            circle.style.background = on ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)';
            chip.textContent = on ? 'Working' : 'Off';
            chip.style.background = on ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)';
            chip.style.color = on ? '#10b981' : 'var(--text-muted)';
            chip.style.borderColor = on ? 'rgba(16,185,129,0.25)' : 'var(--border-color)';
            chevron.style.opacity = on ? '1' : '0.4';

            if (on) {
                ta.removeAttribute('disabled');
                if (shiftRow) { shiftRow.style.pointerEvents = 'auto'; shiftRow.style.opacity = '1'; }
                countLbl.textContent = 'No tasks yet';
                body.style.display = 'block';
                chevron.style.transform = 'rotate(180deg)';
                ta.focus();
            } else {
                ta.setAttribute('disabled', 'true');
                if (shiftRow) { shiftRow.style.pointerEvents = 'none'; shiftRow.style.opacity = '0.4'; }
                countLbl.textContent = 'Day off';
                body.style.display = 'none';
                chevron.style.transform = 'rotate(0deg)';
            }

            const totalOn = [...el.querySelectorAll('.day-working-toggle')].filter(c => c.checked).length;
            const wBadge = document.getElementById('working-count-badge');
            if (wBadge) wBadge.textContent = `${totalOn} / 5`;
        });
    });

    // ── Cancel button ──
    el.querySelector('#sched-cancel-btn').addEventListener('click', () => {
        renderScheduleViewCard('emp-schedule-content', sched, empData);
    });

    // ── Form submit ──
    el.querySelector('#user-schedule-form').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = el.querySelector('[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round">hourglass_top</span><span>Saving…</span>';

        const shiftPayload = {};
        days.forEach(d => {
            const sel = el.querySelector(`#shift-select-${d.key}`);
            shiftPayload[d.key] = sel ? sel.value : '9 AM - 6 PM';
        });

        const payload = {
            monday: el.querySelector('[data-day="monday"]').checked ? 'Working' : 'Off',
            tuesday: el.querySelector('[data-day="tuesday"]').checked ? 'Working' : 'Off',
            wednesday: el.querySelector('[data-day="wednesday"]').checked ? 'Working' : 'Off',
            thursday: el.querySelector('[data-day="thursday"]').checked ? 'Working' : 'Off',
            friday: el.querySelector('[data-day="friday"]').checked ? 'Working' : 'Off',
            shift: JSON.stringify(shiftPayload),
            monday_tasks: el.querySelector('[data-day-tasks="monday_tasks"]').value,
            tuesday_tasks: el.querySelector('[data-day-tasks="tuesday_tasks"]').value,
            wednesday_tasks: el.querySelector('[data-day-tasks="wednesday_tasks"]').value,
            thursday_tasks: el.querySelector('[data-day-tasks="thursday_tasks"]').value,
            friday_tasks: el.querySelector('[data-day-tasks="friday_tasks"]').value
        };

        try {
            const res = await apiFetch(`/api/schedule/${sched.employee_id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            state.mySchedule = res;
            showToast('✅ Schedule and tasks saved!', 'success');
            loadMySchedule();
        } catch (err) {
            showToast(`Failed to save: ${err.message}`, 'error');
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">save</span><span>Save Schedule &amp; Tasks</span>';
        }
    });
}

async function loadMySchedule() {
    const container = document.getElementById('emp-schedule-content');
    // Hide edit button while loading
    const editBtn = document.getElementById('edit-schedule-btn');
    if (editBtn) editBtn.style.display = 'none';
    container.innerHTML = '<div class="text-center" style="padding:60px;"><div class="spinner"></div>Loading schedule…</div>';
    try {
        const sched = await apiFetch('/api/schedule/me');
        state.mySchedule = sched;
        const profile = state.myProfile || await apiFetch('/api/employees/me');
        renderScheduleViewCard('emp-schedule-content', sched, profile);
    } catch (err) {
        container.innerHTML = `<div style="color:var(--danger);padding:40px;text-align:center;">${err.message}</div>`;
    }
}

// ─────────────────────────────────────────────
// PAGE 5: Certifications & Skills (new)
// ─────────────────────────────────────────────
function renderCertSkills(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!data) {
        el.innerHTML = '<div style="color:var(--text-muted);padding:40px;text-align:center;">No profile data available.</div>';
        return;
    }

    const skills = [
        { name: data.primary_skill, rating: data.primary_rating, label: 'Primary Skill' },
        { name: data.secondary_skill, rating: data.secondary_rating, label: 'Secondary Skill' },
        { name: data.third_skill, rating: data.third_rating, label: 'Third Skill' },
        { name: 'Work Experience Alignment', rating: data.work_exp_skills_rating, label: 'Work Exp Skill' },
    ].filter(s => s.name && String(s.name).trim() !== '');

    const certList = (data.certifications || '').split(',').map(c => c.trim()).filter(Boolean);
    
    // Safely calculate experience
    let totalExpDisplay = '0.0 Years';
    try {
        const prevYears = parseExpToYears(data.previous_exp);
        const arohakYears = parseExpToYears(data.arohak_exp);
        const sumYears = Math.round((prevYears + arohakYears) * 10) / 10;
        totalExpDisplay = data.total_exp || (sumYears > 0 ? `${sumYears.toFixed(1)} Years` : '0.0 Years');
    } catch (e) {
        totalExpDisplay = data.total_exp || '0.0 Years';
    }

    const starsHtml = getStarsHtml(data.overall_rating || 0);

    el.innerHTML = `
        <div class="cert-skills-grid">
            <!-- Left: Skills -->
            <div class="panel">
                <div class="panel-header">
                    <span class="material-icons-round">psychology</span>
                    <h2>Technical Skills &amp; Ratings</h2>
                </div>
                <div class="panel-body">
                    ${skills.length === 0
            ? '<p style="color:var(--text-muted);">No skills listed yet. Update your profile to add skills.</p>'
            : skills.map(s => `
                        <div class="skill-rating-bar-row">
                            <span class="skill-rating-bar-name">${s.name} <span style="font-size:0.72rem;color:var(--text-muted);font-weight:400;">(${s.label})</span></span>
                            <div class="skill-rating-bar-level">
                                <div class="skill-rating-bar-fill" style="width:${Math.min(100, Math.max(0, Math.round(((s.rating || 0) / 5) * 100)))}%"></div>
                            </div>
                            <span class="skill-rating-num">${(s.rating || 0).toFixed(1)}</span>
                        </div>`).join('')}
                    <div style="margin-top:20px;padding:14px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);">Overall Rating</span>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <div style="display:flex;gap:2px;color:var(--warning);">${starsHtml}</div>
                            <span style="font-weight:700;color:var(--accent-secondary);">${(data.overall_rating || 0).toFixed(2)} / 5</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right: Certifications & Experience -->
            <div>
                <div class="panel" style="margin-bottom:20px;">
                    <div class="panel-header">
                        <span class="material-icons-round">workspace_premium</span>
                        <h2>Certifications</h2>
                    </div>
                    <div class="panel-body">
                        ${certList.length === 0
            ? '<p style="color:var(--text-muted);">No certifications on record.</p>'
            : `<div class="cert-list">${certList.map(c => `
                                <div class="cert-item">
                                    <span class="material-icons-round">verified</span>
                                    <div>
                                        <div class="cert-item-name">${c}</div>
                                        ${data.cert_start_date ? `<div class="cert-item-date">Completed: ${data.cert_start_date}</div>` : ''}
                                        ${data.expiry_date ? `<div class="cert-item-date">Expires: ${formatDate(data.expiry_date)}</div>` : ''}
                                    </div>
                                </div>`).join('')}</div>`}
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <span class="material-icons-round">history_edu</span>
                        <h2>Experience Summary</h2>
                    </div>
                    <div class="panel-body" style="display:flex;flex-direction:column;gap:12px;">
                        <div class="schedule-meta-item">
                            <span class="material-icons-round">work_history</span>
                            <div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px;">Previous Experience</div><strong>${data.previous_exp || 'Not documented'}</strong></div>
                        </div>
                        <div class="schedule-meta-item">
                            <span class="material-icons-round">corporate_fare</span>
                            <div><div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px;">Arohak Experience</div><strong>${data.arohak_exp || 'Not documented'}</strong></div>
                        </div>
                        <div class="total-exp-badge">
                            <span class="material-icons-round">work_history</span>
                            <span>Total Experience: ${totalExpDisplay}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

async function loadMyCertSkills() {
    const el = document.getElementById('certskills-content');
    if (!el) return;
    el.innerHTML = '<div class="text-center" style="padding:60px;"><div class="spinner"></div>Loading…</div>';
    try {
        const data = await apiFetch('/api/certskills/me');
        state.myCertSkills = data;
        renderCertSkills('certskills-content', data);
    } catch (err) {
        el.innerHTML = `<div style="color:var(--danger);padding:40px;text-align:center;">${err.message}</div>`;
    }
}

// ─────────────────────────────────────────────
// PAGE 6: Yearly Skill Targets (new)
// ─────────────────────────────────────────────
function renderSkillTargets(targets) {
    const grid = document.getElementById('skill-targets-grid');
    if (!grid) return;

    // Populate year filter
    const yearFilter = document.getElementById('targets-year-filter');
    const years = [...new Set(targets.map(t => t.year))].sort((a, b) => b - a);
    const currentOptions = [...yearFilter.options].map(o => o.value);
    years.forEach(y => {
        if (!currentOptions.includes(String(y))) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearFilter.appendChild(opt);
        }
    });

    const filterYear = yearFilter.value;
    const filtered = filterYear ? targets.filter(t => String(t.year) === filterYear) : targets;

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:48px;">
            <span class="material-icons-round" style="font-size:3rem;display:block;margin-bottom:12px;color:var(--border-color);">flag</span>
            No skill targets set${filterYear ? ` for ${filterYear}` : ''}. Click <strong>Add Skill Target</strong> to begin.
        </div>`;
        return;
    }

    grid.innerHTML = filtered.map(t => {
        const sc = targetStatusClass(t.status);
        return `
        <div class="skill-target-card ${sc}" data-target-id="${t.id}">
            <div class="skill-target-skill-name">${t.skill_name}</div>
            ${t.description ? `<div class="skill-target-description">${t.description}</div>` : ''}
            <div class="skill-target-meta">
                <span class="skill-target-status-badge ${sc}">${(t.status === 'In Progress' || t.status === 'In-Progress') ? 'On-Going' : t.status}</span>
                ${t.target_level ? `<span class="skill-target-level-badge">${t.target_level}</span>` : ''}
                <span style="font-size:0.72rem;color:var(--text-muted);">${t.year}</span>
            </div>
            ${t.target_completion_date ? `<div class="skill-target-deadline"><span class="material-icons-round">event</span>Target: ${formatDate(t.target_completion_date)}</div>` : ''}
            <div class="skill-target-actions">
                <button class="btn btn-secondary btn-icon-only" onclick="openEditTargetModal(${t.id})" title="Edit">
                    <span class="material-icons-round">edit</span>
                </button>
                <button class="btn btn-danger btn-icon-only" onclick="deleteSkillTarget(${t.id})" title="Delete">
                    <span class="material-icons-round">delete_outline</span>
                </button>
            </div>
        </div>`;
    }).join('');
}

async function loadMySkillTargets(year = '') {
    const grid = document.getElementById('skill-targets-grid');
    grid.innerHTML = '<div class="text-center" style="padding:60px;"><div class="spinner"></div>Loading targets…</div>';
    try {
        let url = '/api/skilltargets/me';
        if (year) url += `?year=${year}`;
        const data = await apiFetch(url);
        state.mySkillTargets = data;
        renderSkillTargets(data);
    } catch (err) {
        grid.innerHTML = `<div style="color:var(--danger);padding:40px;text-align:center;">${err.message}</div>`;
    }
}

function openAddTargetModal() {
    document.getElementById('skill-target-modal-title').textContent = 'Add Skill Target';
    document.getElementById('st-edit-id').value = '';
    document.getElementById('st-skill-name').value = '';
    document.getElementById('st-description').value = '';
    document.getElementById('st-level').value = '';
    document.getElementById('st-status').value = 'Planned';
    document.getElementById('st-completion-date').value = '';
    document.getElementById('st-submit-label').textContent = 'Save Target';
    document.getElementById('skill-target-modal').classList.add('active');
}

function openEditTargetModal(targetId) {
    const target = state.mySkillTargets.find(t => t.id === targetId);
    if (!target) return;
    document.getElementById('skill-target-modal-title').textContent = 'Edit Skill Target';
    document.getElementById('st-edit-id').value = target.id;
    document.getElementById('st-skill-name').value = target.skill_name;
    document.getElementById('st-description').value = target.description || '';
    document.getElementById('st-level').value = target.target_level || '';
    document.getElementById('st-status').value = target.status;
    document.getElementById('st-completion-date').value = target.target_completion_date || '';
    document.getElementById('st-submit-label').textContent = 'Update Target';
    document.getElementById('skill-target-modal').classList.add('active');
}

async function handleSkillTargetSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('st-edit-id').value;
    const payload = {
        skill_name: document.getElementById('st-skill-name').value,
        description: document.getElementById('st-description').value || null,
        target_level: document.getElementById('st-level').value || null,
        status: document.getElementById('st-status').value,
        target_completion_date: document.getElementById('st-completion-date').value || null,
    };
    try {
        if (editId) {
            await apiFetch(`/api/skilltargets/me/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
            showToast('Skill target updated!', 'success');
        } else {
            await apiFetch('/api/skilltargets/me', { method: 'POST', body: JSON.stringify(payload) });
            showToast('Skill target added!', 'success');
        }
        closeAllModals();
        loadMySkillTargets();
    } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
    }
}

async function deleteSkillTarget(targetId) {
    if (!confirm('Delete this skill target?')) return;
    try {
        await apiFetch(`/api/skilltargets/me/${targetId}`, { method: 'DELETE' });
        showToast('Skill target deleted.', 'success');
        loadMySkillTargets();
    } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
    }
}

// ─────────────────────────────────────────────
// ADMIN: Dashboard (existing)
// ─────────────────────────────────────────────
async function loadAdminStats() {
    try {
        const data = await apiFetch('/api/employees');
        document.getElementById('stat-total-emp').textContent = data.length;
        const rated = data.filter(e => e.overall_rating > 0);
        const avg = rated.length > 0 ? rated.reduce((s, e) => s + e.overall_rating, 0) / rated.length : 0;
        document.getElementById('stat-avg-rating').textContent = avg.toFixed(1);
        const pending = data.filter(e => checkSixMonthsUpdate(e.last_updated));
        document.getElementById('stat-pending-updates').textContent = pending.length;
        const certified = data.filter(e => e.certifications && e.certifications.trim() !== '');
        document.getElementById('stat-certified-count').textContent = certified.length;

        const pendingList = document.getElementById('pending-update-list');
        pendingList.innerHTML = '';
        if (pending.length === 0) {
            pendingList.innerHTML = '<div style="color:var(--text-muted);font-size:0.875rem;">All profiles up to date!</div>';
        } else {
            pending.slice(0, 5).forEach(emp => {
                const item = document.createElement('div');
                item.className = 'pending-item';
                item.innerHTML = `
                    <div class="pending-item-info">
                        <span class="pending-item-name">${emp.name} (${emp.employee_id})</span>
                        <span class="pending-item-meta">Last Updated: <span>${formatDate(emp.last_updated)}</span></span>
                    </div>
                    <button class="btn btn-secondary btn-icon-only" onclick="openEmployeeDetailsModal('${emp.employee_id}')">
                        <span class="material-icons-round">visibility</span>
                    </button>`;
                pendingList.appendChild(item);
            });
        }

        const skillCounts = {};
        data.forEach(emp => {
            [emp.primary_skill, emp.secondary_skill, emp.third_skill].forEach(sk => {
                if (sk) {
                    const k = sk.trim().split(',')[0].trim();
                    skillCounts[k] = (skillCounts[k] || 0) + 1;
                }
            });
        });
        const sorted = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const skillsChart = document.getElementById('skills-chart-list');
        skillsChart.innerHTML = '';
        if (sorted.length === 0) {
            skillsChart.innerHTML = '<div style="color:var(--text-muted);font-size:0.875rem;">No skill records found.</div>';
        } else {
            const maxVal = Math.max(...sorted.map(s => s[1]));
            sorted.forEach(([name, count]) => {
                const pct = (count / maxVal) * 100;
                const row = document.createElement('div');
                row.className = 'skill-bar-row';
                row.innerHTML = `
                    <div class="skill-bar-info"><span class="skill-bar-name">${name}</span><span class="skill-bar-count">${count} employees</span></div>
                    <div class="skill-bar-track"><div class="skill-bar-fill" style="width:${pct}%"></div></div>`;
                skillsChart.appendChild(row);
            });
        }
    } catch (err) {
        showToast(`Failed to load admin stats: ${err.message}`, 'error');
    }
}

// ─────────────────────────────────────────────
// ADMIN: Directory (existing)
// ─────────────────────────────────────────────
async function loadAdminDirectory(skill = '', project = '', exp = '', rating = '') {
    const tbody = document.getElementById('admin-employees-tbody');

    // Check if any filter is entered
    if (!skill.trim() && !project.trim() && !exp.trim() && !rating.trim()) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center;padding:60px 20px;color:var(--text-muted);">
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;">
                        <span class="material-icons-round" style="font-size: 40px; color: var(--text-muted);">search</span>
                        <h4 style="margin:0;color:var(--text-secondary);">Filter Admin Directory</h4>
                        <p style="font-size:0.85rem;margin:0;max-width:400px;line-height:1.4;">
                            Use the search inputs above (Skills, Project, Experience, or Rating) and click "Apply Filter" to search.
                        </p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;"><div class="spinner"></div>Loading…</td></tr>';
    try {
        let q = `/api/employees?`;
        if (skill) q += `skill=${encodeURIComponent(skill)}&`;
        if (project) q += `project=${encodeURIComponent(project)}&`;
        if (exp) q += `experience=${encodeURIComponent(exp)}&`;
        if (rating) q += `min_rating=${encodeURIComponent(rating)}&`;
        const data = await apiFetch(q);
        state.employeesList = data;
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:30px;">No records match.</td></tr>';
            return;
        }
        data.forEach(emp => {
            const skills = [emp.primary_skill, emp.secondary_skill, emp.third_skill].filter(Boolean);
            const isOutdated = checkSixMonthsUpdate(emp.last_updated);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${emp.employee_id}</strong></td>
                <td>${emp.name}</td>
                <td><div class="top-skills-cell">${skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}</div></td>
                <td><div class="table-rating"><span class="material-icons-round">star</span><span>${emp.overall_rating ? emp.overall_rating.toFixed(2) : '0.0'}</span></div></td>
                <td>${emp.arohak_exp || '-'}</td>
                <td>${emp.project_name || '<span class="text-muted">Bench</span>'}</td>
                <td>
                    <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">
                        <span class="badge ${emp.score >= 80 ? 'badge-success' : 'badge-warning'}">${emp.score}%</span>
                        ${isOutdated ? '<span class="badge badge-danger" style="font-size:0.65rem;padding:2px 6px;">Outdated</span>' : ''}
                    </div>
                </td>
                <td>${formatDate(emp.last_updated)}</td>
                <td>
                    <button class="btn btn-secondary btn-icon-only" onclick="openEmployeeDetailsModal('${emp.employee_id}')" title="View Profile">
                        <span class="material-icons-round">visibility</span>
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        showToast(err.message, 'error');
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--danger);">Error loading records.</td></tr>';
    }
}

function exportDirectoryCSV() {
    if (state.employeesList.length === 0) { showToast('No records to export.', 'warning'); return; }
    const headers = ['Employee ID', 'Name', 'Email', 'Contact Number', 'Joining Date', 'Primary Skill', 'Primary Rating', 'Secondary Skill', 'Secondary Rating', 'Third Skill', 'Third Rating', 'Previous Exp', 'Arohak Exp', 'Total Exp', 'Certifications', 'Cert Start', 'Cert End', 'Expiry Date', 'Project Name', 'Project Assignment Date', 'Project End Date', 'Work Rating', 'Overall Rating', 'Score'];
    const rows = [headers.join(',')];
    state.employeesList.forEach(emp => {
        const v = (s) => `"${(s || '').replace(/"/g, '""')}"`;
        rows.push([emp.employee_id, v(emp.name), emp.email || '', v(emp.contact_number), emp.joining_date || '', v(emp.primary_skill), emp.primary_rating || 0, v(emp.secondary_skill), emp.secondary_rating || 0, v(emp.third_skill), emp.third_rating || 0, v(emp.previous_exp), v(emp.arohak_exp), v(emp.total_exp || monthsToString(parseExpToMonths(emp.previous_exp) + parseExpToMonths(emp.arohak_exp))), v(emp.certifications), emp.cert_start_date || '', emp.cert_end_date || '', emp.expiry_date || '', v(emp.project_name), emp.project_assignment_date || '', emp.project_end_date || '', emp.work_exp_skills_rating || 0, emp.overall_rating || 0, emp.score || 0].join(','));
    });
    const link = document.createElement('a');
    link.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURI(rows.join('\n')));
    link.setAttribute('download', `Arohak_Employees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Report downloaded!', 'success');
}

// ─────────────────────────────────────────────
// ADMIN: Attendance Tracker (new)
// ─────────────────────────────────────────────
async function loadAdminAttendanceOverview() {
    const todayFormatted = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    const dateBadge = document.getElementById('admin-att-today-date');
    if (dateBadge) dateBadge.textContent = todayFormatted;

    const tbody = document.getElementById('admin-att-today-tbody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;"><div class="spinner"></div></td></tr>';
    try {
        const data = await apiFetch('/api/admin/attendance-overview');
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">No employees found.</td></tr>';
            return;
        }
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.employee_id}</strong></td>
                <td>${row.name}</td>
                <td>${row.project}</td>
                <td><span style="font-weight:600;color:var(--accent-secondary);">${formatShiftSummary(row.shift)}</span></td>
                <td>${statusBadgeHtml(row.today_status)}</td>
                <td>
                    <button class="btn btn-secondary btn-icon-only" onclick="viewAdminAttDetail('${row.employee_id}','${row.name}')" title="View Full Attendance">
                        <span class="material-icons-round">event_note</span>
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });

    } catch (err) {
        showToast(`Failed to load attendance overview: ${err.message}`, 'error');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger);">Error loading data.</td></tr>';
    }
}

async function viewAdminAttDetail(empId, empName) {
    state.currentAdminAttEmpId = empId;
    const panel = document.getElementById('admin-att-detail-panel');
    const title = document.getElementById('admin-att-detail-title');
    const calGrid = document.getElementById('admin-att-detail-calendar');
    title.textContent = `${empName} — Attendance History`;
    calGrid.innerHTML = '<div class="text-center" style="padding:20px;"><div class="spinner"></div></div>';
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth' });
    try {
        const data = await apiFetch(`/api/attendance/${empId}`);
        renderAttCalendar('admin-att-detail-calendar', data.records.slice(0, 30), true, empId);
    } catch (err) {
        calGrid.innerHTML = `<div style="color:var(--danger);">${err.message}</div>`;
    }
}

function openAdminAttModal(empId, date = '', status = 'P', notes = '') {
    document.getElementById('admin-att-emp-id').value = empId;
    document.getElementById('admin-att-date').value = date || new Date().toISOString().slice(0, 10);
    document.getElementById('admin-att-status').value = status || 'P';
    document.getElementById('admin-att-notes').value = notes;
    document.getElementById('admin-att-modal').classList.add('active');
}

async function handleAdminAttSubmit(e) {
    e.preventDefault();
    const empId = document.getElementById('admin-att-emp-id').value;
    const payload = {
        date: document.getElementById('admin-att-date').value,
        status: document.getElementById('admin-att-status').value,
        notes: document.getElementById('admin-att-notes').value || null,
        source: 'manual',
    };
    try {
        await apiFetch(`/api/attendance/${empId}/record`, { method: 'POST', body: JSON.stringify(payload) });
        showToast('Attendance record saved!', 'success');
        closeAllModals();
        loadAdminAttendanceOverview();
        if (state.currentAdminAttEmpId === empId) {
            const data = await apiFetch(`/api/attendance/${empId}`);
            renderAttCalendar('admin-att-detail-calendar', data.records.slice(0, 30), true, empId);
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
    }
}

// ─────────────────────────────────────────────
// ADMIN: Weekly Schedules (new)
// ─────────────────────────────────────────────
async function loadAdminSchedules(nameFilter = '', projectFilter = '') {
    const grid = document.getElementById('admin-schedules-grid');
    grid.innerHTML = '<div class="text-center" style="padding:60px;"><div class="spinner"></div>Loading schedules…</div>';
    try {
        let q = '/api/employees?';
        if (projectFilter) q += `project=${encodeURIComponent(projectFilter)}&`;
        let employees = await apiFetch(q);
        if (nameFilter) {
            const f = nameFilter.toLowerCase();
            employees = employees.filter(e => e.name.toLowerCase().includes(f) || e.employee_id.toLowerCase().includes(f));
        }
        state.adminAllEmployees = employees;
        if (employees.length === 0) {
            grid.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px;">No employees found.</div>';
            return;
        }
        // Load schedules for all employees
        const schedulePromises = employees.map(emp =>
            apiFetch(`/api/schedule/${emp.employee_id}`).catch(() => null)
        );
        const schedules = await Promise.all(schedulePromises);
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        grid.innerHTML = '';
        employees.forEach((emp, i) => {
            const sched = schedules[i];
            const card = document.createElement('div');
            card.className = 'schedule-emp-card';
            card.innerHTML = `
                <div class="schedule-emp-card-header">
                    <div>
                        <div class="schedule-emp-card-name">${emp.name}</div>
                        <div class="schedule-emp-card-id">${emp.employee_id}</div>
                    </div>
                    <div class="schedule-emp-card-project">${emp.project_name || 'Bench'}</div>
                </div>
                <div class="schedule-mini-days">
                    ${sched ? days.map((d, di) => `<span class="schedule-mini-day ${sched[d] === 'Working' ? 'working' : 'off'}">${dayLabels[di]}</span>`).join('') : '<span style="color:var(--text-muted);font-size:0.8rem;">No schedule</span>'}
                </div>
                <div class="schedule-emp-card-footer">
                    <div class="schedule-manager-name">
                        <span class="material-icons-round">person</span>
                        ${sched && sched.manager_name ? sched.manager_name : 'No manager assigned'}
                    </div>
                    <button class="btn btn-primary btn-icon-only" onclick="openAdminSchedModal('${emp.employee_id}','${emp.name}')" title="Edit Schedule">
                        <span class="material-icons-round">edit</span>
                    </button>
                </div>`;
            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = `<div style="color:var(--danger);text-align:center;padding:40px;">${err.message}</div>`;
    }
}

async function openAdminSchedModal(empId, empName) {
    document.getElementById('admin-sched-modal-title').textContent = `Edit Schedule — ${empName}`;
    document.getElementById('admin-sched-emp-id').value = empId;
    try {
        const sched = await apiFetch(`/api/schedule/${empId}`);
        document.getElementById('admin-sched-manager').value = sched.manager_name || '';
        document.getElementById('sched-mon').checked = sched.monday === 'Working';
        document.getElementById('sched-tue').checked = sched.tuesday === 'Working';
        document.getElementById('sched-wed').checked = sched.wednesday === 'Working';
        document.getElementById('sched-thu').checked = sched.thursday === 'Working';
        document.getElementById('sched-fri').checked = sched.friday === 'Working';
        document.getElementById('admin-sched-notes').value = sched.notes || '';

        // Dynamically build and set up shift timings hour selector
        const activeHours = parseShiftStringToHours(sched.shift);
        const formattedShift = formatActiveHours(activeHours);
        document.getElementById('admin-sched-shift-display').textContent = formattedShift;
        document.getElementById('admin-sched-shift-hidden').value = sched.shift || '';

        const grid = document.getElementById('admin-sched-shift-grid');
        grid.innerHTML = '';
        for (let h = 0; h < 24; h++) {
            const isActive = activeHours.includes(h);
            const activeClass = isActive ? 'active' : '';
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h === 0 ? 12 : (h > 12 ? h - 12 : h);
            const padHour = String(displayH).padStart(2, '0');

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `hour-toggle-btn ${activeClass}`;
            btn.dataset.hour = h;
            btn.title = `${displayH} ${ampm}`;
            btn.innerHTML = `
                <span>${padHour}</span>
                <span class="hour-toggle-label">${ampm}</span>
            `;
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const selected = [...grid.querySelectorAll('.hour-toggle-btn.active')].map(b => parseInt(b.dataset.hour));
                const formatted = formatActiveHours(selected);
                document.getElementById('admin-sched-shift-display').textContent = formatted;
                document.getElementById('admin-sched-shift-hidden').value = formatted;
            });
            grid.appendChild(btn);
        }

        document.getElementById('admin-sched-modal').classList.add('active');
    } catch (err) {
        showToast(`Failed to load schedule: ${err.message}`, 'error');
    }
}

async function handleAdminSchedSubmit(e) {
    e.preventDefault();
    const empId = document.getElementById('admin-sched-emp-id').value;
    const payload = {
        manager_name: document.getElementById('admin-sched-manager').value || null,
        monday: document.getElementById('sched-mon').checked ? 'Working' : 'Off',
        tuesday: document.getElementById('sched-tue').checked ? 'Working' : 'Off',
        wednesday: document.getElementById('sched-wed').checked ? 'Working' : 'Off',
        thursday: document.getElementById('sched-thu').checked ? 'Working' : 'Off',
        friday: document.getElementById('sched-fri').checked ? 'Working' : 'Off',
        shift: document.getElementById('admin-sched-shift-hidden').value || 'Day Shift',
        notes: document.getElementById('admin-sched-notes').value || null,
    };
    try {
        await apiFetch(`/api/schedule/${empId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Schedule updated successfully!', 'success');
        closeAllModals();
        loadAdminSchedules(
            document.getElementById('sched-search-name').value,
            document.getElementById('sched-search-project').value,
        );
    } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
    }
}

// ─────────────────────────────────────────────
// Employee Details Modal (existing)
// ─────────────────────────────────────────────
async function openEmployeeDetailsModal(employeeId) {
    const modal = document.getElementById('detail-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body-content');
    title.textContent = 'Loading profile details...';
    body.innerHTML = '<div class="text-center" style="padding:40px;"><div class="spinner"></div>Loading profile...</div>';
    modal.classList.add('active');
    try {
        const emp = await apiFetch(`/api/employees/${employeeId}`);
        title.textContent = `${emp.name} Details`;
        const isFullDetails = ('overall_rating' in emp) && ('score' in emp);
        let html = '';
        if (isFullDetails) {
            html = `<div class="detail-grid">
                <div class="detail-overall-badge">
                    <div class="detail-rating-circle">${emp.overall_rating ? emp.overall_rating.toFixed(1) : '0.0'}</div>
                    <div class="detail-rating-text"><h4>Overall Profile Rating</h4><p>Portal Score: <strong>${emp.score}%</strong> (Last Updated: ${formatDate(emp.last_updated)})</p></div>
                </div>
                <div class="detail-section"><h3>Employee Information</h3><div class="detail-row-grid">
                    <div class="detail-item"><span class="detail-item-lbl">Employee ID</span><span class="detail-item-val">${emp.employee_id}</span></div>
                    <div class="detail-item"><span class="detail-item-lbl">Email</span><span class="detail-item-val">${emp.email || '-'}</span></div>
                    <div class="detail-item"><span class="detail-item-lbl">Contact Number</span><span class="detail-item-val">${emp.contact_number || '-'}</span></div>
                    <div class="detail-item"><span class="detail-item-lbl">Joining Date</span><span class="detail-item-val">${formatDate(emp.joining_date)}</span></div>
                    <div class="detail-item"><span class="detail-item-lbl">Project</span><span class="detail-item-val">${emp.project_name || 'Bench'}</span></div>
                    <div class="detail-item"><span class="detail-item-lbl">Assignment Date</span><span class="detail-item-val">${formatDate(emp.project_assignment_date)}</span></div>
                    <div class="detail-item"><span class="detail-item-lbl">Project End Date</span><span class="detail-item-val">${formatDate(emp.project_end_date)}</span></div>
                </div></div>
                <div class="detail-section"><h3>Technical Skills</h3><div class="detail-skills-list">
                    <div class="detail-skill-row"><strong>Primary: ${emp.primary_skill || 'Unspecified'}</strong><div class="detail-skill-stars">${getStarsHtml(emp.primary_rating)}</div></div>
                    <div class="detail-skill-row"><strong>Secondary: ${emp.secondary_skill || 'Unspecified'}</strong><div class="detail-skill-stars">${getStarsHtml(emp.secondary_rating)}</div></div>
                    <div class="detail-skill-row"><strong>Third: ${emp.third_skill || 'Unspecified'}</strong><div class="detail-skill-stars">${getStarsHtml(emp.third_rating)}</div></div>
                </div></div>
                <div class="detail-section"><h3>Experience</h3><div class="detail-skills-list" style="gap:16px;">
                    <div class="detail-item"><span class="detail-item-lbl">Previous Exp</span><span class="detail-item-val">${emp.previous_exp || '-'}</span></div>
                    <div class="detail-item"><span class="detail-item-lbl">Arohak Exp</span><span class="detail-item-val">${emp.arohak_exp || '-'}</span></div>
                    <div class="detail-item col-span-2"><span class="detail-item-lbl">Total Exp</span><span class="detail-item-val">${emp.total_exp || monthsToString(parseExpToMonths(emp.previous_exp) + parseExpToMonths(emp.arohak_exp)) || '-'}</span></div>
                </div></div>
                <div class="detail-section"><h3>Certifications</h3><div class="detail-skills-list" style="gap:10px;">
                    <div class="detail-item"><span class="detail-item-lbl">Certificates</span><span class="detail-item-val highlight">${emp.certifications || 'No certifications added.'}</span></div>
                    <div class="detail-row-grid" style="margin-top:6px;">
                        <div class="detail-item"><span class="detail-item-lbl">Start / Year</span><span class="detail-item-val">${emp.cert_start_date || '-'}</span></div>
                        <div class="detail-item"><span class="detail-item-lbl">End Date</span><span class="detail-item-val">${formatDate(emp.cert_end_date)}</span></div>
                        <div class="detail-item col-span-2"><span class="detail-item-lbl">Expiry</span><span class="detail-item-val">${formatDate(emp.expiry_date)}</span></div>
                    </div>
                </div></div>
                <div class="detail-section col-span-2" style="grid-column: 1 / -1; margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <h3>Resumes</h3>
                    <div class="detail-resume-actions">
                        <button class="btn btn-secondary btn-sm" onclick="openResumePreviewModal('${emp.employee_id}')" style="display:flex; align-items:center; gap:6px; padding: 6px 12px; font-size:0.85rem;">
                            <span class="material-icons-round" style="font-size:1.1rem;">visibility</span>
                            View Auto Resume
                        </button>
                        ${emp.resume_path ? `
                        <button class="btn btn-primary btn-sm" onclick="downloadEmployeeUploadedResume('${emp.employee_id}', '${emp.resume_path.split('.').pop()}')" style="display:flex; align-items:center; gap:6px; padding: 6px 12px; font-size:0.85rem;">
                            <span class="material-icons-round" style="font-size:1.1rem;">file_download</span>
                            Download Resume
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>`;
        } else {
            html = `<div class="detail-grid">
                <div class="detail-section"><h3>Employee Details</h3><div class="detail-row-grid">
                    <div class="detail-item"><span class="detail-item-lbl">Employee ID</span><span class="detail-item-val">${emp.employee_id}</span></div>
                    <div class="detail-item"><span class="detail-item-lbl">Project</span><span class="detail-item-val">${emp.project_name || 'Bench'}</span></div>
                </div></div>
                <div class="detail-section"><h3>Technical Skills</h3><div class="detail-skills-list" style="gap:8px;">
                    <div class="detail-skill-row"><strong>Primary:</strong> ${emp.primary_skill || '-'}</div>
                    <div class="detail-skill-row"><strong>Secondary:</strong> ${emp.secondary_skill || '-'}</div>
                    <div class="detail-skill-row"><strong>Third:</strong> ${emp.third_skill || '-'}</div>
                </div></div>
                <div class="detail-section"><h3>Certifications</h3>
                    <div class="detail-item"><span class="detail-item-lbl">Certificates</span><span class="detail-item-val highlight">${emp.certifications || 'No certifications.'}</span></div>
                </div>
                <div class="detail-section col-span-2" style="grid-column: 1 / -1; margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <h3>Resumes</h3>
                    <div class="detail-resume-actions">
                        <button class="btn btn-secondary btn-sm" onclick="openResumePreviewModal('${emp.employee_id}')" style="display:flex; align-items:center; gap:6px; padding: 6px 12px; font-size:0.85rem;">
                            <span class="material-icons-round" style="font-size:1.1rem;">visibility</span>
                            View Auto Resume
                        </button>
                        ${emp.resume_path ? `
                        <button class="btn btn-primary btn-sm" onclick="downloadEmployeeUploadedResume('${emp.employee_id}', '${emp.resume_path.split('.').pop()}')" style="display:flex; align-items:center; gap:6px; padding: 6px 12px; font-size:0.85rem;">
                            <span class="material-icons-round" style="font-size:1.1rem;">file_download</span>
                            Download Resume
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>`;
        }
        body.innerHTML = html;
    } catch (err) {
        title.textContent = 'Error';
        body.innerHTML = `<div style="color:var(--danger);padding:40px;">${err.message}</div>`;
    }
}

// ─────────────────────────────────────────────
// Password Change (existing)
// ─────────────────────────────────────────────
async function handlePasswordChange(e) {
    e.preventDefault();
    const cur = document.getElementById('settings-pass-current').value;
    const nw = document.getElementById('settings-pass-new').value;
    const conf = document.getElementById('settings-pass-confirm').value;
    if (nw !== conf) { showToast('New passwords do not match.', 'error'); return; }
    try {
        await apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: cur, new_password: nw }) });
        showToast('Password changed successfully!', 'success');
        document.getElementById('settings-change-password-form').reset();
    } catch (err) {
        showToast(err.message, 'error');
    }
}



// ─────────────────────────────────────────────
// Document Event Bindings
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Theme
    if (state.theme === 'light') {
        document.body.classList.add('light-theme');
        document.getElementById('theme-btn-light')?.classList.add('active');
    } else {
        document.getElementById('theme-btn-dark')?.classList.add('active');
    }

    const notifToggle = document.getElementById('settings-notifications-toggle');
    if (notifToggle) notifToggle.checked = state.notificationsEnabled;

    // Auto-login check & session validation
    if (state.token) {
        if (state.role === 'admin') {
            setupAppInterface();
        } else {
            apiFetch('/api/employees/me')
                .then(profile => {
                    state.myProfile = profile;
                    setupAppInterface();
                })
                .catch(() => {
                    logout();
                });
        }
    } else {
        logout();
    }

    // Auth
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Tab nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => switchTab(link.getAttribute('data-tab')));
    });

    // Profile
    ['prof-rating1', 'prof-rating2', 'prof-rating3', 'prof-work-rating'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateRealtimeOverallRating);
    });
    document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);

    // Resume actions bindings
    const uploadInput = document.getElementById('upload-self-resume-input');
    const uploadBtn = document.getElementById('upload-self-resume-btn');
    const viewGenBtn = document.getElementById('view-generated-resume-btn');
    const downloadUpBtn = document.getElementById('download-uploaded-resume-btn');
    const deleteBtn = document.getElementById('delete-uploaded-resume-btn');

    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const empId = state.myProfile ? state.myProfile.employee_id : null;
            if (!empId) {
                showToast("Cannot upload: employee ID is missing.", "error");
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            try {
                showToast("Uploading resume...", "info");
                const headers = {};
                if (state.token) {
                    headers['Authorization'] = `Bearer ${state.token}`;
                }

                const response = await fetch(`/api/employees/${empId}/resume/upload`, {
                    method: 'POST',
                    headers: headers,
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
                    throw new Error(errorData.detail || "Upload failed");
                }

                await response.json();
                showToast("Resume uploaded successfully!", "success");
                await loadMyProfile();
            } catch (err) {
                showToast(`Upload failed: ${err.message}`, "error");
            } finally {
                uploadInput.value = '';
            }
        });
    }

    if (viewGenBtn) {
        viewGenBtn.addEventListener('click', () => {
            const empId = state.myProfile ? state.myProfile.employee_id : null;
            if (!empId) return;
            openResumePreviewModal(empId);
        });
    }

    if (downloadUpBtn) {
        downloadUpBtn.addEventListener('click', () => {
            const empId = state.myProfile ? state.myProfile.employee_id : null;
            if (!empId) return;
            const ext = state.myProfile.resume_path ? state.myProfile.resume_path.split('.').pop() : 'pdf';
            downloadResumeFile(`/api/employees/${empId}/resume/download-uploaded`, `${empId}_resume.${ext}`);
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const empId = state.myProfile ? state.myProfile.employee_id : null;
            if (!empId) return;

            if (!confirm("Are you sure you want to delete your uploaded custom resume?")) return;

            try {
                await apiFetch(`/api/employees/${empId}/resume`, { method: 'DELETE' });
                showToast("Resume deleted successfully.", "success");
                await loadMyProfile();
            } catch (err) {
                showToast(`Deletion failed: ${err.message}`, "error");
            }
        });
    }

    // Modals
    document.querySelectorAll('.modal-close, .modal-cancel-btn').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) closeAllModals(); });
    });

    // Settings
    document.getElementById('header-settings-btn')?.addEventListener('click', () => switchTab('settings'));
    document.getElementById('settings-change-password-form')?.addEventListener('submit', handlePasswordChange);

    // Theme
    document.getElementById('theme-btn-dark')?.addEventListener('click', () => {
        state.theme = 'dark';
        localStorage.setItem('theme', 'dark');
        document.body.classList.remove('light-theme');
        document.getElementById('theme-btn-dark').classList.add('active');
        document.getElementById('theme-btn-light').classList.remove('active');
        showToast('Dark mode activated', 'success');
    });
    document.getElementById('theme-btn-light')?.addEventListener('click', () => {
        state.theme = 'light';
        localStorage.setItem('theme', 'light');
        document.body.classList.add('light-theme');
        document.getElementById('theme-btn-light').classList.add('active');
        document.getElementById('theme-btn-dark').classList.remove('active');
        showToast('Light mode activated', 'success');
    });

    // Notification toggle
    document.getElementById('settings-notifications-toggle')?.addEventListener('change', (e) => {
        state.notificationsEnabled = e.target.checked;
        localStorage.setItem('notificationsEnabled', e.target.checked);
        showToast(`Email notifications ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
    });

    // Directory search
    document.getElementById('apply-search-btn').addEventListener('click', () => {
        loadEmployeeDirectory(
            document.getElementById('search-skill').value,
            document.getElementById('search-project').value,
            document.getElementById('search-exp').value,
        );
    });
    document.getElementById('clear-search-btn').addEventListener('click', () => {
        document.getElementById('search-skill').value = '';
        document.getElementById('search-project').value = '';
        document.getElementById('search-exp').value = '';
        loadEmployeeDirectory();
    });

    // Admin directory search
    document.getElementById('admin-apply-btn').addEventListener('click', () => {
        loadAdminDirectory(
            document.getElementById('admin-search-skill').value,
            document.getElementById('admin-search-project').value,
            document.getElementById('admin-search-exp').value,
            document.getElementById('admin-search-rating').value,
        );
    });
    document.getElementById('admin-clear-btn').addEventListener('click', () => {
        ['admin-search-skill', 'admin-search-project', 'admin-search-exp', 'admin-search-rating'].forEach(id => { document.getElementById(id).value = ''; });
        loadAdminDirectory();
    });
    document.getElementById('admin-export-btn').addEventListener('click', exportDirectoryCSV);
    document.getElementById('alert-banner-dismiss').addEventListener('click', () => {
        document.getElementById('update-alert-banner').classList.add('hidden');
    });

    // Skill Target page
    document.getElementById('add-target-btn')?.addEventListener('click', openAddTargetModal);
    document.getElementById('skill-target-form')?.addEventListener('submit', handleSkillTargetSubmit);
    document.getElementById('targets-year-filter')?.addEventListener('change', () => {
        renderSkillTargets(state.mySkillTargets);
    });

    // Admin attendance
    document.getElementById('admin-att-refresh-btn')?.addEventListener('click', loadAdminAttendanceOverview);
    document.getElementById('admin-att-close-detail')?.addEventListener('click', () => {
        document.getElementById('admin-att-detail-panel').classList.add('hidden');
    });
    document.getElementById('admin-att-form')?.addEventListener('submit', handleAdminAttSubmit);

    // Admin schedule modal
    document.getElementById('admin-sched-form')?.addEventListener('submit', handleAdminSchedSubmit);

    // Admin schedule search
    document.getElementById('sched-search-btn')?.addEventListener('click', () => {
        loadAdminSchedules(
            document.getElementById('sched-search-name').value,
            document.getElementById('sched-search-project').value,
        );
    });

    // Office Assets bindings
    document.getElementById('assets-search-name')?.addEventListener('input', () => {
        renderAssetsTable(state.adminAllEmployees);
    });
    document.getElementById('assets-filter-laptop')?.addEventListener('change', () => {
        renderAssetsTable(state.adminAllEmployees);
    });
    document.getElementById('assets-filter-headset')?.addEventListener('change', () => {
        renderAssetsTable(state.adminAllEmployees);
    });
    document.getElementById('assets-clear-btn')?.addEventListener('click', () => {
        document.getElementById('assets-search-name').value = '';
        document.getElementById('assets-filter-laptop').value = '';
        document.getElementById('assets-filter-headset').value = '';
        renderAssetsTable(state.adminAllEmployees);
    });
    document.getElementById('assets-edit-laptop')?.addEventListener('change', toggleLaptopDetailsVisibility);
    // Admin Projects & Teams bindings
    document.getElementById('admin-projects-search')?.addEventListener('input', renderAdminProjectsOverview);
    document.getElementById('admin-projects-filter')?.addEventListener('change', renderAdminProjectsOverview);
    document.getElementById('admin-projects-refresh-btn')?.addEventListener('click', loadAdminProjectsOverview);


    // Admin Skill Targets bindings
    document.getElementById('admin-st-search-name')?.addEventListener('input', () => {
        renderAdminSkillTargetsOverview();
    });
    document.getElementById('admin-st-filter-status')?.addEventListener('change', () => {
        renderAdminSkillTargetsOverview();
    });
    document.getElementById('admin-st-filter-year')?.addEventListener('change', () => {
        loadAdminSkillTargetsOverview();
    });


    // Modal cancel buttons and background close triggers
    document.querySelectorAll('.modal-close, .modal-cancel-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.target.closest('.modal').classList.remove('active');
        });
    });

    // Timesheet Bindings
    document.getElementById('ts-prev-week-btn')?.addEventListener('click', () => shiftTimesheetWeek(-7));
    document.getElementById('ts-next-week-btn')?.addEventListener('click', () => shiftTimesheetWeek(7));
    document.getElementById('ts-calendar-btn')?.addEventListener('click', () => {
        const picker = document.getElementById('ts-week-picker');
        picker?.showPicker?.() || picker?.click();
    });
    document.getElementById('ts-week-picker')?.addEventListener('change', handleWeekPickerChange);
    document.getElementById('ts-add-row-btn')?.addEventListener('click', addTimesheetRow);
    document.getElementById('ts-copy-prev-btn')?.addEventListener('click', copyPreviousWeekTimesheet);
    document.getElementById('ts-save-btn')?.addEventListener('click', () => saveTimesheet(false));
    document.getElementById('ts-release-btn')?.addEventListener('click', releaseTimesheet);

    document.getElementById('timesheet-tbody')?.addEventListener('input', (e) => {
        if (e.target.classList.contains('ts-day-input')) {
            calculateTimesheetTotals();
        }
    });

    // Admin Timesheet Approvals bindings
    document.getElementById('admin-ts-week-picker')?.addEventListener('change', (e) => {
        loadAdminTimesheets(e.target.value);
    });
    // Profile Avatar Photo Upload & Options Popup Modal Functions
    window.openProfilePhotoOptionsModal = function(e) {
        if (e) e.preventDefault();
        const modal = document.getElementById('modal-profile-photo-actions');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
        }
    };

    window.closeProfilePhotoOptionsModal = function() {
        const modal = document.getElementById('modal-profile-photo-actions');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
    };

    window.handleUploadPhotoFromPopup = function() {
        window.closeProfilePhotoOptionsModal();
        setTimeout(() => {
            const fileInput = document.getElementById('profile-avatar-file-input');
            if (fileInput) fileInput.click();
        }, 150);
    };

    window.handleRemovePhotoFromPopup = function() {
        window.closeProfilePhotoOptionsModal();
        const key = `userAvatar_${state.username || 'default'}`;
        const existing = localStorage.getItem(key);
        if (existing) {
            localStorage.removeItem(key);
            const fileInput = document.getElementById('profile-avatar-file-input');
            if (fileInput) fileInput.value = '';
            updateUserAvatarUI();
            showToast('Profile image deleted successfully.', 'info');
        } else {
            showToast('No uploaded profile image to remove.', 'warning');
        }
    };

    const avatarFileInput = document.getElementById('profile-avatar-file-input');
    avatarFileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file (JPG, PNG, WebP).', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('File size must be under 5MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            const dataUrl = evt.target.result;
            const key = `userAvatar_${state.username || 'default'}`;
            localStorage.setItem(key, dataUrl);
            updateUserAvatarUI();
            showToast('Profile photo updated successfully!', 'success');
        };
        reader.readAsDataURL(file);
    });

    // Admin Timesheet Approvals bindings
    document.getElementById('admin-ts-week-picker')?.addEventListener('change', (e) => {
        loadAdminTimesheets(e.target.value);
    });
    document.getElementById('admin-ts-refresh-btn')?.addEventListener('click', () => {
        loadAdminTimesheets();
    });
    document.getElementById('admin-ts-search-input')?.addEventListener('input', () => {
        renderAdminTimesheetsList(state.adminTimesheetList);
    });
    document.getElementById('admin-ts-status-filter')?.addEventListener('change', () => {
        renderAdminTimesheetsList(state.adminTimesheetList);
    });

    // 7th Admin Tab Employee Timesheets Detail bindings
    document.getElementById('admin-tsdetail-week-picker')?.addEventListener('change', (e) => {
        loadAdminEmpTimesheetsView(e.target.value);
    });
    document.getElementById('admin-tsdetail-emp-select')?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
            loadAdminEmpTimesheetDetail(val, state.adminSelectedTsDetailWeek);
        }
    });
    document.getElementById('admin-tsdetail-search-input')?.addEventListener('input', () => {
        renderAdminEmpTimesheetsRosterTable(state.adminApprovedTsList);
    });
    document.getElementById('admin-tsdetail-refresh-btn')?.addEventListener('click', () => {
        loadAdminEmpTimesheetsView(state.adminSelectedTsDetailWeek, state.adminSelectedTsDetailEmpId);
    });
});

