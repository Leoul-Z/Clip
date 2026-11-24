/**
 * Clipper Admin Portal - Application Logic
 */

// Global State
const state = {
  token: localStorage.getItem('clipper_admin_token') || '',
  activeTab: 'users', // 'users' | 'submissions'
  stats: {},
  users: [],
  submissions: [],
  // Users tab state
  usersSearch: '',
  usersFilter: 'all',
  allPasswordsRevealed: false,
  revealedPasswordIds: new Set(),
  // Submissions tab state
  submissionsStatus: 'all',
  submissionsPlatform: 'all',
  submissionsSearch: '',
  // UI timers
  autoRefreshTimer: null,
};

// --- API CLIENT ---
async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(endpoint, { ...options, headers });
    if (res.status === 401) {
      // Unauthorized -> show login modal
      state.token = '';
      localStorage.removeItem('clipper_admin_token');
      showLoginModal(true);
      throw new Error('Authentication required');
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300',
    error: 'bg-rose-950/90 border-rose-500/40 text-rose-300',
    info: 'bg-indigo-950/90 border-indigo-500/40 text-indigo-300',
  };
  const icon = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    info: 'fa-circle-info',
  }[type] || 'fa-bell';

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs font-medium backdrop-blur-md transition-all duration-300 pointer-events-auto transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <i class="fa-solid ${icon} text-sm"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- UTILITIES ---
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString();
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '$0.00';
  return `$${Number(amount).toFixed(2)}`;
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

function copyToClipboard(text, label = 'Copied') {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`${label} copied to clipboard!`, 'info');
  }).catch(() => {
    // Fallback
    const input = document.createElement('textarea');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    showToast(`${label} copied!`, 'info');
  });
}

function getPlatformIcon(platform) {
  const map = {
    tiktok: '<i class="fa-brands fa-tiktok text-slate-100"></i>',
    youtube: '<i class="fa-brands fa-youtube text-red-500"></i>',
    twitter: '<i class="fa-brands fa-x-twitter text-slate-200"></i>',
    instagram: '<i class="fa-brands fa-instagram text-pink-400"></i>',
  };
  return map[(platform || '').toLowerCase()] || '<i class="fa-solid fa-globe text-slate-400"></i>';
}

function getStatusBadge(status) {
  const map = {
    pending: '<span class="px-2.5 py-1 rounded-full text-xs font-semibold badge-pending"><i class="fa-solid fa-clock mr-1 text-[10px]"></i>Pending</span>',
    under_review: '<span class="px-2.5 py-1 rounded-full text-xs font-semibold badge-under_review"><i class="fa-solid fa-magnifying-glass mr-1 text-[10px]"></i>Under Review</span>',
    approved: '<span class="px-2.5 py-1 rounded-full text-xs font-semibold badge-approved"><i class="fa-solid fa-check mr-1 text-[10px]"></i>Approved</span>',
    rejected: '<span class="px-2.5 py-1 rounded-full text-xs font-semibold badge-rejected"><i class="fa-solid fa-xmark mr-1 text-[10px]"></i>Rejected</span>',
  };
  return map[status] || `<span class="px-2 py-0.5 rounded text-xs">${escapeHtml(status)}</span>`;
}

// --- AUTHENTICATION ---
function showLoginModal(show = true) {
  const modal = document.getElementById('modal-login');
  if (!modal) return;
  if (show) {
    modal.classList.remove('hidden');
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-password').focus();
  } else {
    modal.classList.add('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-submit-login');
  const errorBox = document.getElementById('login-error');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Unlocking...';
  errorBox.classList.add('hidden');

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Invalid password');
    }

    state.token = data.token;
    localStorage.setItem('clipper_admin_token', state.token);
    showLoginModal(false);
    showToast('Admin access granted!', 'success');
    await loadAllData();
  } catch (err) {
    errorBox.textContent = err.message || 'Invalid admin password';
    errorBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Unlock Admin Portal</span><i class="fa-solid fa-arrow-right text-xs ml-2"></i>';
  }
}

function handleLogout() {
  state.token = '';
  localStorage.removeItem('clipper_admin_token');
  showLoginModal(true);
  showToast('Logged out of admin portal', 'info');
}

// --- DATA FETCHING ---
async function fetchStats() {
  try {
    const stats = await apiCall('/api/admin/stats');
    state.stats = stats;
    renderStats();
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

async function fetchUsers() {
  try {
    const users = await apiCall('/api/admin/users');
    state.users = users;
    renderUsers();
  } catch (e) {
    console.error('Failed to load users:', e);
  }
}

async function fetchSubmissions() {
  try {
    const submissions = await apiCall('/api/admin/submissions');
    state.submissions = submissions;
    renderSubmissions();
  } catch (e) {
    console.error('Failed to load submissions:', e);
  }
}

async function loadAllData() {
  const refreshIcon = document.getElementById('refresh-icon');
  if (refreshIcon) refreshIcon.classList.add('fa-spin');

  try {
    await Promise.all([fetchStats(), fetchUsers(), fetchSubmissions()]);
    document.getElementById('last-updated-text').textContent =
      `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  } catch (e) {
    // Error handled in apiCall
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('fa-spin');
  }
}

// --- RENDERING METRICS & TABS ---
function renderStats() {
  const s = state.stats;
  document.getElementById('stat-total-users').textContent = formatNumber(s.total_users || 0);
  document.getElementById('stat-total-submissions').textContent = formatNumber(s.total_submissions || 0);
  document.getElementById('stat-pending-submissions').textContent = formatNumber(s.pending_submissions || 0);
  document.getElementById('stat-total-views').textContent = formatNumber(s.total_views || 0);
  document.getElementById('stat-total-payments').textContent = formatCurrency(s.total_payments || 0);
  document.getElementById('stat-total-socials').textContent = formatNumber(s.total_social_accounts || 0);

  // Submissions status pill counts
  document.getElementById('count-status-all').textContent = s.total_submissions || 0;
  document.getElementById('count-status-pending').textContent = s.pending_submissions || 0;
  document.getElementById('count-status-under_review').textContent = s.under_review_submissions || 0;
  document.getElementById('count-status-approved').textContent = s.approved_submissions || 0;
  document.getElementById('count-status-rejected').textContent = s.rejected_submissions || 0;

  // Pending alert badge on submissions tab
  const pendingBadge = document.getElementById('tab-pending-badge');
  if (s.pending_submissions > 0) {
    pendingBadge.textContent = s.pending_submissions;
    pendingBadge.classList.remove('hidden');
  } else {
    pendingBadge.classList.add('hidden');
  }
}

function switchTab(tab) {
  state.activeTab = tab;
  const usersSec = document.getElementById('section-users');
  const subsSec = document.getElementById('section-submissions');
  const btnUsers = document.getElementById('tab-btn-users');
  const btnSubs = document.getElementById('tab-btn-submissions');

  if (tab === 'users') {
    usersSec.classList.remove('hidden');
    subsSec.classList.add('hidden');
    btnUsers.className = 'px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 bg-indigo-600 text-white shadow-lg shadow-indigo-600/30';
    btnSubs.className = 'px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300';
  } else {
    usersSec.classList.add('hidden');
    subsSec.classList.remove('hidden');
    btnSubs.className = 'px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 bg-indigo-600 text-white shadow-lg shadow-indigo-600/30';
    btnUsers.className = 'px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300';
  }
}

// --- RENDERING USERS TABLE ---
function renderUsers() {
  const tbody = document.getElementById('users-table-body');
  const countSpan = document.getElementById('tab-count-users');
  const summarySpan = document.getElementById('users-count-summary');

  let list = [...state.users];

  // Search Filter
  const q = state.usersSearch.trim().toLowerCase();
  if (q) {
    list = list.filter(u => {
      const uname = (u.telegram_username || '').toLowerCase();
      const cid = String(u.chat_id || '');
      const bank = (u.payment_details || '').toLowerCase();
      const handles = (u.social_accounts || []).map(sa => (sa.handle || '').toLowerCase()).join(' ');
      return uname.includes(q) || cid.includes(q) || bank.includes(q) || handles.includes(q);
    });
  }

  // Dropdown Filter
  if (state.usersFilter === 'has_bank') {
    list = list.filter(u => u.payment_details && u.payment_details.trim().length > 0);
  } else if (state.usersFilter === 'missing_bank') {
    list = list.filter(u => !u.payment_details || u.payment_details.trim().length === 0);
  } else if (state.usersFilter === 'has_socials') {
    list = list.filter(u => (u.social_accounts || []).length > 0);
  } else if (state.usersFilter === 'has_submissions') {
    list = list.filter(u => (u.submission_count || 0) > 0);
  }

  countSpan.textContent = state.users.length;
  summarySpan.textContent = `Showing ${list.length} of ${state.users.length} clippers`;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-5 py-12 text-center text-slate-500">
          <i class="fa-solid fa-user-slash text-2xl mb-2 text-slate-600"></i>
          <p class="text-sm">No clippers match your search or filter.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(u => {
    const rawUsername = u.telegram_username || '';
    const cleanUsername = rawUsername.startsWith('@') ? rawUsername.substring(1) : rawUsername;
    const tgLink = cleanUsername ? `https://t.me/${cleanUsername}` : null;

    // Social accounts badges
    const socials = u.social_accounts || [];
    let socialsHtml = '';
    if (socials.length === 0) {
      socialsHtml = '<span class="text-slate-600 text-xs italic">No accounts linked</span>';
    } else {
      socialsHtml = `
        <div class="flex flex-wrap gap-1.5">
          ${socials.map(sa => `
            <div class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200">
              ${getPlatformIcon(sa.platform)}
              <span class="font-medium">${escapeHtml(sa.handle)}</span>
              <button onclick="copyToClipboard('${escapeHtml(sa.handle)}', 'Handle')" title="Copy Handle" class="text-slate-500 hover:text-slate-300 ml-0.5">
                <i class="fa-solid fa-copy text-[10px]"></i>
              </button>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Account Passwords column (Decrypted / Unencrypted passwords!)
    let passwordsHtml = '';
    if (socials.length === 0) {
      passwordsHtml = '<span class="text-slate-600 text-xs italic">None</span>';
    } else {
      passwordsHtml = `
        <div class="flex flex-col gap-1.5">
          ${socials.map(sa => {
            const isRevealed = state.allPasswordsRevealed || state.revealedPasswordIds.has(sa.id);
            const passValue = sa.password || '';
            return `
              <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono transition ${isRevealed ? 'password-unmasked' : 'text-slate-400'}">
                <span class="text-[11px] uppercase tracking-wider text-slate-500 font-sans">${escapeHtml(sa.platform)}:</span>
                <span class="password-text tracking-wide select-all" id="pass-val-${sa.id}">
                  ${isRevealed ? (escapeHtml(passValue) || '<i class="text-slate-600">empty</i>') : '••••••••'}
                </span>
                <div class="flex items-center gap-1 ml-auto">
                  <button onclick="togglePasswordVisibility(${sa.id})" class="text-slate-400 hover:text-white p-0.5 rounded transition" title="${isRevealed ? 'Hide password' : 'View unencrypted password'}">
                    <i class="fa-solid ${isRevealed ? 'fa-eye-slash text-indigo-400' : 'fa-eye'} text-xs"></i>
                  </button>
                  <button onclick="copyToClipboard('${escapeHtml(passValue)}', 'Password')" class="text-slate-400 hover:text-emerald-400 p-0.5 rounded transition" title="Copy unencrypted password">
                    <i class="fa-solid fa-copy text-xs"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Bank Details
    let bankHtml = '';
    if (u.payment_details && u.payment_details.trim().length > 0) {
      bankHtml = `
        <div class="flex items-start gap-1.5 max-w-[220px]">
          <span class="font-mono text-xs text-emerald-400/90 break-words">${escapeHtml(u.payment_details)}</span>
          <button onclick="copyToClipboard('${escapeHtml(u.payment_details)}', 'Bank Info')" class="text-slate-500 hover:text-slate-300 shrink-0 mt-0.5" title="Copy Bank Info">
            <i class="fa-solid fa-copy text-xs"></i>
          </button>
          <button onclick="openEditBankModal(${u.chat_id}, '${escapeHtml(u.telegram_username || '')}', '${escapeHtml(u.payment_details)}')" class="text-slate-500 hover:text-indigo-400 shrink-0 mt-0.5" title="Edit Bank Info">
            <i class="fa-solid fa-pencil text-xs"></i>
          </button>
        </div>
      `;
    } else {
      bankHtml = `
        <div class="flex items-center gap-1.5">
          <span class="text-slate-500 text-xs italic">Not provided</span>
          <button onclick="openEditBankModal(${u.chat_id}, '${escapeHtml(u.telegram_username || '')}', '')" class="text-indigo-400 hover:underline text-xs" title="Add Bank Info">
            <i class="fa-solid fa-plus text-[10px]"></i> Add
          </button>
        </div>
      `;
    }

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <!-- Clipper info -->
        <td class="px-5 py-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
              ${cleanUsername ? cleanUsername[0] : 'U'}
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                ${tgLink 
                  ? `<a href="${tgLink}" target="_blank" class="font-semibold text-white hover:text-indigo-400 transition">${escapeHtml(rawUsername || 'Anonymous')}</a>`
                  : `<span class="font-semibold text-white">${escapeHtml(rawUsername || 'Anonymous')}</span>`
                }
                ${tgLink ? '<i class="fa-brands fa-telegram text-indigo-400 text-xs"></i>' : ''}
              </div>
              <div class="text-[11px] text-slate-500 font-mono">ID: ${u.chat_id}</div>
            </div>
          </div>
        </td>

        <!-- Bank details -->
        <td class="px-4 py-4">${bankHtml}</td>

        <!-- Linked socials -->
        <td class="px-4 py-4">${socialsHtml}</td>

        <!-- Passwords -->
        <td class="px-4 py-4">${passwordsHtml}</td>

        <!-- Approved Stats -->
        <td class="px-4 py-4 text-right">
          <div class="font-mono font-semibold text-cyan-400 text-xs">${formatNumber(u.views)} <span class="text-slate-500 font-normal">views</span></div>
          <div class="font-mono font-bold text-emerald-400 text-xs">${formatCurrency(u.money)}</div>
        </td>

        <!-- Clips Count -->
        <td class="px-4 py-4 text-center">
          <button onclick="filterSubmissionsByUser('${escapeHtml(rawUsername)}')" class="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition" title="Filter this user's submissions">
            ${u.submission_count || 0}
          </button>
        </td>

        <!-- Actions -->
        <td class="px-5 py-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openAdjustStatsModal(${u.chat_id}, '${escapeHtml(rawUsername)}', ${u.views || 0}, ${u.money || 0})" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition" title="Adjust Stats Manually">
              <i class="fa-solid fa-sliders text-indigo-400"></i>
            </button>
            <button onclick="filterSubmissionsByUser('${escapeHtml(rawUsername)}')" class="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 transition">
              View Clips
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Password toggle individual
window.togglePasswordVisibility = function(socialAccountId) {
  if (state.revealedPasswordIds.has(socialAccountId)) {
    state.revealedPasswordIds.delete(socialAccountId);
  } else {
    state.revealedPasswordIds.add(socialAccountId);
  }
  renderUsers();
};

// Global toggle for all passwords
function toggleAllPasswords() {
  state.allPasswordsRevealed = !state.allPasswordsRevealed;
  const icon = document.getElementById('toggle-all-passwords-icon');
  const text = document.getElementById('toggle-all-passwords-text');
  const btn = document.getElementById('btn-toggle-all-passwords');

  if (state.allPasswordsRevealed) {
    icon.className = 'fa-solid fa-eye-slash';
    text.textContent = 'Hide All Passwords';
    btn.classList.add('bg-indigo-600/20', 'border-indigo-500');
    showToast('All passwords unmasked unencrypted', 'info');
  } else {
    icon.className = 'fa-solid fa-eye';
    text.textContent = 'Show All Passwords';
    btn.classList.remove('bg-indigo-600/20', 'border-indigo-500');
    state.revealedPasswordIds.clear();
  }
  renderUsers();
}

// --- RENDERING SUBMISSIONS TABLE ---
function renderSubmissions() {
  const tbody = document.getElementById('submissions-table-body');
  const countSpan = document.getElementById('tab-count-submissions');
  const summarySpan = document.getElementById('submissions-count-summary');

  let list = [...state.submissions];

  // Status Filter
  if (state.submissionsStatus !== 'all') {
    list = list.filter(s => s.status === state.submissionsStatus);
  }

  // Platform Filter
  if (state.submissionsPlatform !== 'all') {
    list = list.filter(s => (s.platform || '').toLowerCase() === state.submissionsPlatform.toLowerCase());
  }

  // Search Filter
  const q = state.submissionsSearch.trim().toLowerCase();
  if (q) {
    list = list.filter(s => {
      const uname = (s.telegram_username || '').toLowerCase();
      const link = (s.link || '').toLowerCase();
      const caption = (s.caption || '').toLowerCase();
      const handle = (s.handle || '').toLowerCase();
      const id = String(s.id || '');
      return uname.includes(q) || link.includes(q) || caption.includes(q) || handle.includes(q) || id.includes(q);
    });
  }

  countSpan.textContent = state.submissions.length;
  summarySpan.textContent = `Showing ${list.length} of ${state.submissions.length} submissions`;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-5 py-12 text-center text-slate-500">
          <i class="fa-solid fa-film text-2xl mb-2 text-slate-600"></i>
          <p class="text-sm">No submissions found matching your filters.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(sub => {
    const rawUsername = sub.telegram_username || 'Anonymous';
    const cleanUsername = rawUsername.startsWith('@') ? rawUsername.substring(1) : rawUsername;

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <!-- ID & Date -->
        <td class="px-4 py-3.5">
          <div class="font-mono font-bold text-slate-200 text-xs">#${sub.id}</div>
          <div class="text-[11px] text-slate-500">${formatDate(sub.submitted_at)}</div>
        </td>

        <!-- Clipper -->
        <td class="px-4 py-3.5">
          <div class="font-semibold text-white text-xs">${escapeHtml(rawUsername)}</div>
          <div class="text-[10px] text-slate-500 font-mono">Chat ID: ${sub.chat_id}</div>
        </td>

        <!-- Platform & Account -->
        <td class="px-4 py-3.5">
          <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs text-slate-200">
            ${getPlatformIcon(sub.platform)}
            <span class="font-medium font-mono">${escapeHtml(sub.handle || sub.platform)}</span>
          </div>
        </td>

        <!-- Video Link -->
        <td class="px-4 py-3.5">
          <div class="flex items-center gap-1.5 max-w-[200px]">
            <a href="${escapeHtml(sub.link)}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:text-indigo-300 font-mono text-xs truncate underline" title="${escapeHtml(sub.link)}">
              ${escapeHtml(sub.link)}
            </a>
            <button onclick="copyToClipboard('${escapeHtml(sub.link)}', 'Link')" class="text-slate-500 hover:text-slate-300 shrink-0" title="Copy Link">
              <i class="fa-solid fa-copy text-xs"></i>
            </button>
          </div>
        </td>

        <!-- Caption -->
        <td class="px-4 py-3.5">
          <div class="max-w-[220px] text-xs text-slate-300 truncate" title="${escapeHtml(sub.caption || '')}">
            ${sub.caption ? `<span class="italic text-slate-300">"${escapeHtml(sub.caption)}"</span>` : '<span class="text-slate-600 italic">None</span>'}
          </div>
        </td>

        <!-- Views -->
        <td class="px-4 py-3.5 text-right font-mono font-semibold text-cyan-400 text-xs">
          ${formatNumber(sub.views)}
        </td>

        <!-- Payment Amount ($) -->
        <td class="px-4 py-3.5 text-right font-mono font-bold text-emerald-400 text-xs">
          ${formatCurrency(sub.payment_amount)}
        </td>

        <!-- Status -->
        <td class="px-4 py-3.5 text-center">
          ${getStatusBadge(sub.status)}
        </td>

        <!-- Action: Manual Edit -->
        <td class="px-5 py-3.5 text-right">
          <button onclick="openEditSubmissionModal(${sub.id})" class="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold border border-indigo-500/30 transition flex items-center gap-1.5 ml-auto shadow-sm">
            <i class="fa-solid fa-pen-to-square text-xs"></i>
            <span>Edit Views &amp; Pay</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter submissions by a specific user from the Users tab
window.filterSubmissionsByUser = function(username) {
  switchTab('submissions');
  state.submissionsSearch = username;
  document.getElementById('submissions-search').value = username;
  document.getElementById('submissions-clear-search').classList.remove('hidden');
  renderSubmissions();
};

// --- MODAL: EDIT SUBMISSION (VIEWS & PAYMENT) ---
window.openEditSubmissionModal = function(submissionId) {
  const sub = state.submissions.find(s => s.id === submissionId);
  if (!sub) return;

  document.getElementById('edit-sub-id').value = sub.id;
  document.getElementById('modal-sub-subtitle').textContent = `Submission #${sub.id} • ${formatDate(sub.submitted_at)}`;
  document.getElementById('modal-sub-user').textContent = `${sub.telegram_username || 'Anonymous'} (Chat ID: ${sub.chat_id})`;
  document.getElementById('modal-sub-account').textContent = `${(sub.platform || '').toUpperCase()} - ${sub.handle || 'No handle'}`;

  const linkEl = document.getElementById('modal-sub-link');
  linkEl.href = sub.link;
  linkEl.textContent = sub.link;

  document.getElementById('modal-sub-caption').textContent = sub.caption || 'No caption provided';
  document.getElementById('edit-sub-views').value = sub.views || 0;
  document.getElementById('edit-sub-payment').value = Number(sub.payment_amount || 0).toFixed(2);

  // Status radio selection
  const radios = document.getElementsByName('edit-sub-status');
  radios.forEach(r => {
    r.checked = (r.value === sub.status);
  });

  document.getElementById('modal-edit-submission').classList.remove('hidden');
  document.getElementById('edit-sub-views').focus();
};

function closeEditSubmissionModal() {
  document.getElementById('modal-edit-submission').classList.add('hidden');
}

async function handleEditSubmissionSubmit(e) {
  e.preventDefault();
  const subId = parseInt(document.getElementById('edit-sub-id').value, 10);
  const views = parseInt(document.getElementById('edit-sub-views').value, 10);
  const payment_amount = parseFloat(document.getElementById('edit-sub-payment').value);
  const statusRadio = document.querySelector('input[name="edit-sub-status"]:checked');
  const status = statusRadio ? statusRadio.value : 'approved';
  const notify_user = document.getElementById('edit-sub-notify').checked;

  const btn = document.getElementById('btn-save-sub-modal');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';

  try {
    const res = await apiCall(`/api/admin/submissions/${subId}/update`, {
      method: 'POST',
      body: JSON.stringify({ views, payment_amount, status, notify_user }),
    });

    showToast(`Submission #${subId} updated: ${formatNumber(views)} views, ${formatCurrency(payment_amount)} (${status})`, 'success');
    closeEditSubmissionModal();
    await loadAllData();
  } catch (err) {
    showToast(`Failed to update submission: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i> <span>Save &amp; Update</span>';
  }
}

// --- MODAL: EDIT BANK DETAILS ---
window.openEditBankModal = function(chatId, username, currentBank) {
  document.getElementById('edit-bank-chat-id').value = chatId;
  document.getElementById('modal-bank-user').textContent = `${username || 'Anonymous'} (Chat ID: ${chatId})`;
  document.getElementById('edit-bank-text').value = currentBank || '';
  document.getElementById('modal-edit-bank').classList.remove('hidden');
  document.getElementById('edit-bank-text').focus();
};

function closeEditBankModal() {
  document.getElementById('modal-edit-bank').classList.add('hidden');
}

async function handleEditBankSubmit(e) {
  e.preventDefault();
  const chatId = parseInt(document.getElementById('edit-bank-chat-id').value, 10);
  const payment_details = document.getElementById('edit-bank-text').value.trim();

  try {
    await apiCall(`/api/admin/users/${chatId}/update-payment`, {
      method: 'POST',
      body: JSON.stringify({ payment_details }),
    });
    showToast('Bank details updated successfully!', 'success');
    closeEditBankModal();
    await fetchUsers();
  } catch (err) {
    showToast(`Failed to update bank info: ${err.message}`, 'error');
  }
}

// --- MODAL: ADJUST USER STATS ---
window.openAdjustStatsModal = function(chatId, username, currentViews, currentMoney) {
  document.getElementById('adjust-user-chat-id').value = chatId;
  document.getElementById('modal-adjust-username').textContent = `${username || 'Anonymous'} (Chat ID: ${chatId})`;
  document.getElementById('adjust-views').value = currentViews || 0;
  document.getElementById('adjust-money').value = Number(currentMoney || 0).toFixed(2);
  document.getElementById('modal-adjust-user').classList.remove('hidden');
  document.getElementById('adjust-views').focus();
};

function closeAdjustStatsModal() {
  document.getElementById('modal-adjust-user').classList.add('hidden');
}

async function handleAdjustStatsSubmit(e) {
  e.preventDefault();
  const chatId = parseInt(document.getElementById('adjust-user-chat-id').value, 10);
  const views = parseInt(document.getElementById('adjust-views').value, 10);
  const money = parseFloat(document.getElementById('adjust-money').value);

  try {
    await apiCall(`/api/admin/users/${chatId}/update-stats`, {
      method: 'POST',
      body: JSON.stringify({ views, money }),
    });
    showToast('User stats adjusted successfully!', 'success');
    closeAdjustStatsModal();
    await loadAllData();
  } catch (err) {
    showToast(`Failed to adjust stats: ${err.message}`, 'error');
  }
}

// --- SETUP EVENT LISTENERS ---
function initEventListeners() {
  // Navigation Tabs
  document.getElementById('tab-btn-users').addEventListener('click', () => switchTab('users'));
  document.getElementById('tab-btn-submissions').addEventListener('click', () => switchTab('submissions'));
  document.getElementById('card-pending-filter').addEventListener('click', () => {
    switchTab('submissions');
    setSubmissionsStatusFilter('pending');
  });

  // Top Action Buttons
  document.getElementById('btn-refresh').addEventListener('click', loadAllData);
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // Global Passwords Reveal
  document.getElementById('btn-toggle-all-passwords').addEventListener('click', toggleAllPasswords);

  // Users Tab Search & Filter
  const uSearch = document.getElementById('users-search');
  const uClear = document.getElementById('users-clear-search');
  uSearch.addEventListener('input', (e) => {
    state.usersSearch = e.target.value;
    uClear.classList.toggle('hidden', !e.target.value);
    renderUsers();
  });
  uClear.addEventListener('click', () => {
    uSearch.value = '';
    state.usersSearch = '';
    uClear.classList.add('hidden');
    renderUsers();
  });
  document.getElementById('users-filter').addEventListener('change', (e) => {
    state.usersFilter = e.target.value;
    renderUsers();
  });

  // Submissions Status Tabs
  document.querySelectorAll('.sub-status-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status');
      setSubmissionsStatusFilter(status);
    });
  });

  // Submissions Platform Filter & Search
  document.getElementById('submissions-platform-filter').addEventListener('change', (e) => {
    state.submissionsPlatform = e.target.value;
    renderSubmissions();
  });
  const sSearch = document.getElementById('submissions-search');
  const sClear = document.getElementById('submissions-clear-search');
  sSearch.addEventListener('input', (e) => {
    state.submissionsSearch = e.target.value;
    sClear.classList.toggle('hidden', !e.target.value);
    renderSubmissions();
  });
  sClear.addEventListener('click', () => {
    sSearch.value = '';
    state.submissionsSearch = '';
    sClear.classList.add('hidden');
    renderSubmissions();
  });

  // Modals closing & forms
  document.getElementById('modal-close-sub').addEventListener('click', closeEditSubmissionModal);
  document.getElementById('btn-cancel-sub-modal').addEventListener('click', closeEditSubmissionModal);
  document.getElementById('form-edit-submission').addEventListener('submit', handleEditSubmissionSubmit);

  document.getElementById('modal-close-bank').addEventListener('click', closeEditBankModal);
  document.getElementById('btn-cancel-bank').addEventListener('click', closeEditBankModal);
  document.getElementById('form-edit-bank').addEventListener('submit', handleEditBankSubmit);

  document.getElementById('modal-close-adjust').addEventListener('click', closeAdjustStatsModal);
  document.getElementById('btn-cancel-adjust').addEventListener('click', closeAdjustStatsModal);
  document.getElementById('form-adjust-user').addEventListener('submit', handleAdjustStatsSubmit);

  // Login Form
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('btn-toggle-login-pass').addEventListener('click', () => {
    const input = document.getElementById('login-password');
    input.type = (input.type === 'password' ? 'text' : 'password');
  });

  // Auto Refresh Checkbox
  const autoCheckbox = document.getElementById('toggle-autorefresh');
  autoCheckbox.addEventListener('change', () => {
    if (autoCheckbox.checked) {
      startAutoRefresh();
      showToast('Auto-refresh active (30s)', 'info');
    } else {
      stopAutoRefresh();
      showToast('Auto-refresh paused', 'info');
    }
  });

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditSubmissionModal();
      closeEditBankModal();
      closeAdjustStatsModal();
    }
  });
}

function setSubmissionsStatusFilter(status) {
  state.submissionsStatus = status;
  document.querySelectorAll('.sub-status-tab').forEach(btn => {
    const s = btn.getAttribute('data-status');
    if (s === status) {
      btn.className = 'sub-status-tab px-3 py-1.5 rounded-lg text-xs font-medium transition bg-indigo-600 text-white shadow-md';
    } else {
      btn.className = 'sub-status-tab px-3 py-1.5 rounded-lg text-xs font-medium transition bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700/60';
    }
  });
  renderSubmissions();
}

function startAutoRefresh() {
  stopAutoRefresh();
  state.autoRefreshTimer = setInterval(() => {
    if (state.token) {
      loadAllData();
    }
  }, 30000);
}

function stopAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

// --- APP INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
  initEventListeners();
  startAutoRefresh();

  if (!state.token) {
    showLoginModal(true);
  } else {
    try {
      await apiCall('/api/admin/me');
      await loadAllData();
    } catch {
      showLoginModal(true);
    }
  }
});
