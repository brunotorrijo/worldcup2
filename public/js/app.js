/* ===== API Helper ===== */
const API = {
  async get(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  }
};

/* ===== Toast Notifications ===== */
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ===== Local Storage Helpers ===== */
function getLeagueId() { return localStorage.getItem('leagueId'); }
function getPlayerId() { return localStorage.getItem('playerId'); }
function getPlayerName() { return localStorage.getItem('playerName'); }
function isCreator() { return localStorage.getItem('isCreator') === 'true'; }

function setPlayerInfo(leagueId, playerId, playerName, creator = false) {
  localStorage.setItem('leagueId', leagueId);
  localStorage.setItem('playerId', playerId);
  localStorage.setItem('playerName', playerName);
  localStorage.setItem('isCreator', creator.toString());
}

function clearPlayerInfo() {
  localStorage.removeItem('leagueId');
  localStorage.removeItem('playerId');
  localStorage.removeItem('playerName');
  localStorage.removeItem('isCreator');
}

/* ===== Navigation ===== */
function initNav() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  const leagueId = getLeagueId();
  const playerName = getPlayerName();
  const creator = isCreator();

  let linksHTML = '';
  if (leagueId) {
    linksHTML += `<a href="/predict-groups.html" class="nav-link">Groups</a>`;
    linksHTML += `<a href="/predict-knockout.html" class="nav-link">Knockout</a>`;
    linksHTML += `<a href="/results.html" class="nav-link">Results</a>`;
    linksHTML += `<a href="/leaderboard.html" class="nav-link">Leaderboard</a>`;
    if (creator) {
      linksHTML += `<a href="/dashboard.html" class="nav-link nav-link-accent">Dashboard</a>`;
    }
  }

  let userHTML = '';
  if (playerName) {
    userHTML = `<span class="nav-username">${escapeHtml(playerName)}</span>`;
  }

  nav.innerHTML = `
    <div class="nav-inner">
      <a href="/" class="nav-logo">⚽ WC26</a>
      <div class="nav-links">${linksHTML}</div>
      <div class="nav-user">${userHTML}</div>
    </div>
  `;
}

/* ===== Helpers ===== */
function showLoader(container) {
  container.innerHTML = '<div class="flex-center" style="padding: 3rem;"><div class="loader"></div></div>';
}

function formatDate(dateStr) {
  if (!dateStr) return 'TBD';
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getStageName(stage) {
  const names = {
    'group': 'Group Stage',
    'R32': 'Round of 32',
    'R16': 'Round of 16',
    'QF': 'Quarter-Finals',
    'SF': 'Semi-Finals',
    '3RD': 'Third Place',
    'FINAL': 'Final'
  };
  return names[stage] || stage;
}

/* ===== Init on DOM Ready ===== */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
});
