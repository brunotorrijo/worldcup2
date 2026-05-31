document.addEventListener('DOMContentLoaded', () => {
  const codeInput = document.getElementById('join-code');
  const nameInput = document.getElementById('join-name');
  const preview = document.getElementById('league-preview');
  const badge = document.getElementById('league-name-badge');
  const form = document.getElementById('join-form');

  // Pre-fill from URL params
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    codeInput.value = code.toUpperCase();
    lookupLeague(code);
  }

  let leagueId = null;

  // Lookup league when code changes
  let lookupTimeout;
  codeInput.addEventListener('input', () => {
    const val = codeInput.value.trim();
    if (val.length === 6) {
      clearTimeout(lookupTimeout);
      lookupTimeout = setTimeout(() => lookupLeague(val), 300);
    } else {
      preview.classList.add('hidden');
      leagueId = null;
    }
  });

  async function lookupLeague(code) {
    try {
      const data = await API.get(`/api/leagues/invite/${code.toUpperCase()}`);
      leagueId = data.id;
      badge.textContent = `${data.name} · ${data.playerCount} player${data.playerCount !== 1 ? 's' : ''}`;
      preview.classList.remove('hidden');
    } catch (err) {
      preview.classList.add('hidden');
      leagueId = null;
      showToast(err.message, 'error');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeInput.value.trim().toUpperCase();
    const displayName = nameInput.value.trim();

    if (!code) return showToast('Please enter an invite code', 'error');
    if (!displayName) return showToast('Please enter your name', 'error');

    try {
      // If we haven't looked up the league yet
      if (!leagueId) {
        const leagueData = await API.get(`/api/leagues/invite/${code}`);
        leagueId = leagueData.id;
      }

      const data = await API.post(`/api/leagues/${leagueId}/join`, { displayName });
      setPlayerInfo(data.leagueId, data.playerId, data.displayName, false);

      showToast(`Welcome to ${data.leagueName}!`);
      setTimeout(() => window.location.href = '/predict-groups.html', 800);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
});
