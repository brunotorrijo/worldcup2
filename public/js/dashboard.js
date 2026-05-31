document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('dashboard-content');

  // Check auth
  try {
    const user = await API.get('/api/auth/me');
    if (user.league) {
      setPlayerInfo(user.league.id, user.playerId, user.username, true);
      loadDashboard(user);
    } else {
      showCreateLeague(user);
    }
  } catch {
    window.location.href = '/login.html';
  }

  function showCreateLeague(user) {
    content.innerHTML = `
      <div class="fade-in" style="max-width: 500px; margin: 2rem auto;">
        <div class="text-center mb-4">
          <h1 style="font-size: 1.5rem;">Welcome, ${escapeHtml(user.username)} 👋</h1>
          <p class="text-muted mt-1">Create your prediction league to get started</p>
        </div>
        <div class="card">
          <form id="create-league-form">
            <div class="form-group">
              <label class="form-label" for="league-name">League Name</label>
              <input type="text" class="form-input" id="league-name" placeholder="e.g. The Prediction Kings" required maxlength="50">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Create League</button>
          </form>
        </div>
      </div>
    `;
    document.getElementById('create-league-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('league-name').value.trim();
      if (!name) return;
      try {
        const league = await API.post('/api/leagues', { name });
        setPlayerInfo(league.id, league.playerId, user.username, true);
        // Set player token cookie
        document.cookie = `player_token=${league.playerToken};path=/;max-age=${30*24*60*60};SameSite=Lax`;
        showToast('League created!');
        loadDashboard({ ...user, league: { id: league.id, name: league.name, inviteCode: league.inviteCode } });
        initNav();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  async function loadDashboard(user) {
    const leagueId = user.league.id;
    let league;
    try {
      league = await API.get(`/api/leagues/${leagueId}`);
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><p>Failed to load league</p></div>`;
      return;
    }

    content.innerHTML = `
      <div class="fade-in">
        <div class="flex-between mb-3">
          <div>
            <h1 style="font-size: 1.5rem;">${escapeHtml(league.name)}</h1>
            <p class="text-muted" style="font-size: 0.85rem;">League Dashboard</p>
          </div>
          <a href="/leaderboard.html" class="btn btn-outline btn-sm">View Leaderboard</a>
        </div>

        <!-- Invite Code -->
        <div class="card mb-3">
          <h3 class="mb-2">Invite Code</h3>
          <p class="text-muted mb-2" style="font-size: 0.85rem;">Share this code with friends so they can join</p>
          <div class="invite-code-display">
            <span class="invite-code-value" id="invite-code">${league.invite_code}</span>
            <button class="copy-btn" id="copy-code-btn">Copy</button>
          </div>
        </div>

        <!-- Lock Controls -->
        <div class="card mb-3">
          <h3 class="mb-2">Prediction Locks</h3>
          <div class="flex-col gap-2">
            <div class="flex-between">
              <div>
                <span style="font-size: 0.9rem; font-weight: 500;">Group Stage Predictions</span>
                <span class="badge ${league.group_predictions_locked ? 'badge-danger' : 'badge-success'} ml-1" id="group-lock-badge">${league.group_predictions_locked ? '🔒 Locked' : '🔓 Open'}</span>
              </div>
              <label class="toggle">
                <input type="checkbox" id="group-lock-toggle" ${league.group_predictions_locked ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="flex-between">
              <div>
                <span style="font-size: 0.9rem; font-weight: 500;">Knockout Predictions</span>
                <span class="badge ${league.knockout_predictions_locked ? 'badge-danger' : 'badge-success'}" id="knockout-lock-badge">${league.knockout_predictions_locked ? '🔒 Locked' : '🔓 Open'}</span>
              </div>
              <label class="toggle">
                <input type="checkbox" id="knockout-lock-toggle" ${league.knockout_predictions_locked ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Players -->
        <div class="card mb-3">
          <div class="flex-between mb-2">
            <h3>Players (${league.players.length})</h3>
          </div>
          <div id="players-list"></div>
        </div>

        <!-- Results Entry -->
        <div class="card mb-3">
          <div class="flex-between mb-2">
            <h3>Enter Results</h3>
            <button class="btn btn-secondary btn-sm" id="recalc-btn">Recalculate Points</button>
          </div>
          <div class="tabs" id="results-tabs"></div>
          <div id="results-matches"></div>
        </div>
      </div>
    `;

    // Copy invite code
    document.getElementById('copy-code-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(league.invite_code).then(() => {
        showToast('Invite code copied!');
      });
    });

    // Lock toggles
    document.getElementById('group-lock-toggle').addEventListener('change', async (e) => {
      try {
        await API.put(`/api/leagues/${leagueId}/lock`, { groupLocked: e.target.checked });
        const badge = document.getElementById('group-lock-badge');
        badge.textContent = e.target.checked ? '🔒 Locked' : '🔓 Open';
        badge.className = `badge ${e.target.checked ? 'badge-danger' : 'badge-success'}`;
        showToast(e.target.checked ? 'Group predictions locked' : 'Group predictions unlocked');
      } catch (err) {
        showToast(err.message, 'error');
        e.target.checked = !e.target.checked;
      }
    });

    document.getElementById('knockout-lock-toggle').addEventListener('change', async (e) => {
      try {
        await API.put(`/api/leagues/${leagueId}/lock`, { knockoutLocked: e.target.checked });
        const badge = document.getElementById('knockout-lock-badge');
        badge.textContent = e.target.checked ? '🔒 Locked' : '🔓 Open';
        badge.className = `badge ${e.target.checked ? 'badge-danger' : 'badge-success'}`;
        showToast(e.target.checked ? 'Knockout predictions locked' : 'Knockout predictions unlocked');
      } catch (err) {
        showToast(err.message, 'error');
        e.target.checked = !e.target.checked;
      }
    });

    // Render players
    renderPlayers(league.players, leagueId);

    // Recalculate points
    document.getElementById('recalc-btn').addEventListener('click', async () => {
      try {
        await API.post(`/api/leagues/${leagueId}/calculate-points`);
        showToast('Points recalculated!');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Results tabs & matches
    renderResultsTabs(league.matches, leagueId);
  }

  function renderPlayers(players, leagueId) {
    const list = document.getElementById('players-list');
    if (!players.length) {
      list.innerHTML = '<div class="empty-state"><p>No players yet. Share your invite code!</p></div>';
      return;
    }

    list.innerHTML = players.map(p => `
      <div class="flex-between" style="padding: 0.6rem 0; border-bottom: 1px solid var(--border);" data-player="${p.id}">
        <div class="flex items-center gap-1">
          <span style="font-weight: 500; font-size: 0.9rem;">${escapeHtml(p.display_name)}</span>
          ${p.is_creator ? '<span class="badge badge-gold">Creator</span>' : ''}
        </div>
        <div class="flex gap-1">
          ${!p.is_creator ? `
            <button class="btn btn-ghost btn-sm edit-name-btn" data-id="${p.id}" data-name="${escapeHtml(p.display_name)}">✏️</button>
            <button class="btn btn-ghost btn-sm delete-player-btn" data-id="${p.id}" style="color: var(--danger);">✕</button>
          ` : ''}
        </div>
      </div>
    `).join('');

    // Edit name handlers
    list.querySelectorAll('.edit-name-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newName = prompt('New display name:', btn.dataset.name);
        if (!newName || !newName.trim()) return;
        try {
          await API.put(`/api/leagues/${leagueId}/players/${btn.dataset.id}`, { displayName: newName.trim() });
          showToast('Name updated');
          location.reload();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Delete handlers
    list.querySelectorAll('.delete-player-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this player? Their predictions will be deleted.')) return;
        try {
          await API.delete(`/api/leagues/${leagueId}/players/${btn.dataset.id}`);
          showToast('Player removed');
          location.reload();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  function renderResultsTabs(matches, leagueId) {
    const stages = ['group', 'R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];
    const tabsEl = document.getElementById('results-tabs');
    const matchesEl = document.getElementById('results-matches');

    tabsEl.innerHTML = stages.map((s, i) => `
      <button class="tab ${i === 0 ? 'active' : ''}" data-stage="${s}">${getStageName(s)}</button>
    `).join('');

    function renderStage(stage) {
      const stageMatches = matches.filter(m => m.stage === stage);
      if (!stageMatches.length) {
        matchesEl.innerHTML = '<div class="empty-state"><p>No matches in this stage</p></div>';
        return;
      }

      // Group by group_letter for group stage
      if (stage === 'group') {
        const grouped = {};
        stageMatches.forEach(m => {
          const g = m.group_letter;
          if (!grouped[g]) grouped[g] = [];
          grouped[g].push(m);
        });

        matchesEl.innerHTML = Object.keys(grouped).sort().map(g => `
          <div style="margin-bottom: 1.5rem;">
            <h4 class="text-gold mb-1">Group ${g}</h4>
            ${grouped[g].map(m => renderMatchResult(m, leagueId)).join('')}
          </div>
        `).join('');
      } else {
        matchesEl.innerHTML = stageMatches.map(m => renderMatchResult(m, leagueId, true)).join('');
      }

      // Attach save handlers
      matchesEl.querySelectorAll('.save-result-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const matchId = btn.dataset.matchId;
          const row = btn.closest('.result-entry');
          const data = {
            homeScore: parseInt(row.querySelector('.home-score').value),
            awayScore: parseInt(row.querySelector('.away-score').value)
          };

          if (isNaN(data.homeScore) || isNaN(data.awayScore)) {
            return showToast('Please enter both scores', 'error');
          }

          // Knockout extras
          const etCheck = row.querySelector('.et-check');
          if (etCheck) {
            data.extraTime = etCheck.checked;
            if (data.extraTime) {
              const etHome = row.querySelector('.et-home-score');
              const etAway = row.querySelector('.et-away-score');
              if (etHome && etAway) {
                data.homeScoreEt = parseInt(etHome.value) || null;
                data.awayScoreEt = parseInt(etAway.value) || null;
              }
            }
            const penCheck = row.querySelector('.pen-check');
            if (penCheck) {
              data.penalties = penCheck.checked;
              if (data.penalties) {
                const penHome = row.querySelector('.pen-home-score');
                const penAway = row.querySelector('.pen-away-score');
                if (penHome && penAway) {
                  data.homePenalties = parseInt(penHome.value) || null;
                  data.awayPenalties = parseInt(penAway.value) || null;
                }
              }
            }
            // Winner
            const winnerRadio = row.querySelector('input[name="winner-' + matchId + '"]:checked');
            if (winnerRadio) {
              data.winnerId = parseInt(winnerRadio.value);
            }
          }

          try {
            await API.post(`/api/matches/${matchId}/result`, data);
            showToast('Result saved!');
            btn.textContent = '✓ Saved';
            setTimeout(() => btn.textContent = 'Save', 1500);
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    }

    tabsEl.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabsEl.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderStage(tab.dataset.stage);
      });
    });

    renderStage('group');
  }

  function renderMatchResult(match, leagueId, isKnockout = false) {
    const homeName = match.home_team_name || 'TBD';
    const awayName = match.away_team_name || 'TBD';
    const homeFlag = match.home_flag || '⬜';
    const awayFlag = match.away_flag || '⬜';
    const hasResult = match.home_score !== null;

    return `
      <div class="result-entry" style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.85rem; margin-bottom: 0.5rem;">
        <div class="flex items-center gap-1" style="flex-wrap: wrap;">
          <span class="flag-emoji">${homeFlag}</span>
          <span style="font-size: 0.85rem; font-weight: 500; min-width: 80px;">${escapeHtml(homeName)}</span>
          <input type="number" class="score-input home-score" min="0" max="20" value="${hasResult ? match.home_score : ''}">
          <span class="score-separator">–</span>
          <input type="number" class="score-input away-score" min="0" max="20" value="${hasResult ? match.away_score : ''}">
          <span style="font-size: 0.85rem; font-weight: 500; min-width: 80px;">${escapeHtml(awayName)}</span>
          <span class="flag-emoji">${awayFlag}</span>
          <button class="btn btn-primary btn-sm save-result-btn" data-match-id="${match.id}" style="margin-left: auto;">Save</button>
        </div>
        ${isKnockout && match.home_team_id ? `
          <div class="knockout-options mt-1">
            <label class="knockout-toggle">
              <label class="toggle"><input type="checkbox" class="et-check" ${match.extra_time ? 'checked' : ''}><span class="toggle-slider"></span></label>
              <span>Extra Time</span>
            </label>
            <label class="knockout-toggle">
              <label class="toggle"><input type="checkbox" class="pen-check" ${match.penalties ? 'checked' : ''}><span class="toggle-slider"></span></label>
              <span>Penalties</span>
            </label>
          </div>
          <div class="flex gap-1 mt-1" style="flex-wrap: wrap;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">ET:</span>
            <input type="number" class="score-input et-home-score" min="0" max="20" value="${match.home_score_et || ''}" style="width: 44px; height: 34px; font-size: 0.9rem;">
            <span class="score-separator" style="font-size: 1rem;">–</span>
            <input type="number" class="score-input et-away-score" min="0" max="20" value="${match.away_score_et || ''}" style="width: 44px; height: 34px; font-size: 0.9rem;">
            <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">PEN:</span>
            <input type="number" class="score-input pen-home-score" min="0" max="20" value="${match.home_penalties || ''}" style="width: 44px; height: 34px; font-size: 0.9rem;">
            <span class="score-separator" style="font-size: 1rem;">–</span>
            <input type="number" class="score-input pen-away-score" min="0" max="20" value="${match.away_penalties || ''}" style="width: 44px; height: 34px; font-size: 0.9rem;">
          </div>
          <div class="mt-1">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Winner:</span>
            <label style="font-size: 0.85rem; margin-left: 0.5rem; cursor: pointer;">
              <input type="radio" name="winner-${match.id}" value="${match.home_team_id}" ${match.winner_team_id === match.home_team_id ? 'checked' : ''}> ${homeFlag} ${escapeHtml(homeName)}
            </label>
            <label style="font-size: 0.85rem; margin-left: 0.5rem; cursor: pointer;">
              <input type="radio" name="winner-${match.id}" value="${match.away_team_id}" ${match.winner_team_id === match.away_team_id ? 'checked' : ''}> ${awayFlag} ${escapeHtml(awayName)}
            </label>
          </div>
        ` : ''}
      </div>
    `;
  }
});
