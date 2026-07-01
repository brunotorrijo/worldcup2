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

        <!-- Populate Knockout Bracket (temporary) -->
        <div class="card mb-3" id="populate-knockout-card">
          <h3 class="mb-2">⚽ Knockout Controls</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Use these controls to manage the bracket teams.</p>
          <div class="flex gap-2">
            <button class="btn btn-primary" id="populate-knockout-btn">Populate R32 Teams</button>
            <button class="btn btn-ghost" id="reset-knockout-btn" style="color: var(--danger); border: 1px solid var(--danger);">Reset Bracket (R16-Final)</button>
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

    // Populate knockout bracket
    document.getElementById('populate-knockout-btn').addEventListener('click', async () => {
      const btn = document.getElementById('populate-knockout-btn');
      btn.disabled = true;
      btn.textContent = 'Populating...';
      try {
        await API.post('/api/populate-knockout');
        showToast('R32 bracket populated! 🎉');
        btn.textContent = '✅ Done!';
        setTimeout(() => { document.getElementById('populate-knockout-card').style.display = 'none'; }, 2000);
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Populate R32 Teams';
      }
    });

    // Reset knockout bracket
    document.getElementById('reset-knockout-btn')?.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to reset all team assignments from the Round of 16 through the Final? This will not affect the scores you entered in the R32.')) return;
      
      const btn = document.getElementById('reset-knockout-btn');
      btn.disabled = true;
      try {
        await API.post('/api/reset-knockout');
        showToast('Bracket successfully reset! 🧹');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
      }
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

    list.innerHTML = players.map(p => {
      const prog = p.predictionProgress || {};
      const gm = prog.groupMatches || 0;
      const gmT = prog.groupMatchesTotal || 72;
      const gs = prog.groupStandings || 0;
      const gsT = prog.groupStandingsTotal || 36;
      const ko = prog.knockout || 0;

      const gmPct = gmT > 0 ? Math.round((gm / gmT) * 100) : 0;
      const gsPct = gsT > 0 ? Math.round((gs / gsT) * 100) : 0;
      const allDone = gm === gmT && gs === gsT;

      const statusIcon = allDone ? '✅' : (gm > 0 || gs > 0) ? '🟡' : '⬜';

      return `
      <div class="player-card-row" data-player="${p.id}">
        <div class="player-card-header flex-between">
          <div class="flex items-center gap-1">
            <span style="font-size: 1.1rem;">${statusIcon}</span>
            <span style="font-weight: 600; font-size: 0.95rem;">${escapeHtml(p.display_name)}</span>
            ${p.is_creator ? '<span class="badge badge-gold">Creator</span>' : ''}
          </div>
          <div class="flex gap-1">
            <button class="btn btn-primary btn-sm view-preds-btn" data-id="${p.id}" data-name="${escapeHtml(p.display_name)}">👁 View</button>
            <button class="btn btn-ghost btn-sm edit-name-btn" data-id="${p.id}" data-name="${escapeHtml(p.display_name)}">✏️</button>
            ${!p.is_creator ? `
              <button class="btn btn-ghost btn-sm delete-player-btn" data-id="${p.id}" style="color: var(--danger);">✕</button>
            ` : ''}
          </div>
        </div>
        <div style="padding: 0.4rem 0 0.6rem; display: flex; gap: 1rem; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 120px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px;">Match Scores <strong>${gm}/${gmT}</strong></div>
            <div style="background: var(--bg-alt); border-radius: 6px; height: 6px; overflow: hidden;">
              <div style="width: ${gmPct}%; height: 100%; background: ${gmPct === 100 ? 'var(--success)' : 'var(--accent)'}; border-radius: 6px; transition: width 0.3s;"></div>
            </div>
          </div>
          <div style="flex: 1; min-width: 120px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px;">Group Standings <strong>${gs}/${gsT}</strong></div>
            <div style="background: var(--bg-alt); border-radius: 6px; height: 6px; overflow: hidden;">
              <div style="width: ${gsPct}%; height: 100%; background: ${gsPct === 100 ? 'var(--success)' : 'var(--accent)'}; border-radius: 6px; transition: width 0.3s;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    }).join('');

    // View predictions handler
    list.querySelectorAll('.view-preds-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        showPlayerPredictions(leagueId, btn.dataset.id, btn.dataset.name);
      });
    });

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

  async function showPlayerPredictions(leagueId, playerId, playerName) {
    // Create modal overlay
    let overlay = document.getElementById('pred-modal-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'pred-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(3px);';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--surface);border-radius:12px;max-width:650px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    modal.innerHTML = `
      <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--surface);z-index:1;border-radius:12px 12px 0 0;">
        <h3 style="margin:0;font-size:1.1rem;">📋 ${escapeHtml(playerName)}'s Predictions</h3>
        <button id="close-pred-modal" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted);padding:0 0.25rem;">✕</button>
      </div>
      <div id="pred-modal-body" style="padding:1.25rem 1.5rem;">
        <div class="flex-center" style="padding:2rem;"><div class="loader"></div></div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    modal.querySelector('#close-pred-modal').addEventListener('click', () => overlay.remove());

    try {
      const [league, preds] = await Promise.all([
        API.get(`/api/leagues/${leagueId}`),
        API.get(`/api/leagues/${leagueId}/predictions/groups/${playerId}`)
      ]);

      const body = modal.querySelector('#pred-modal-body');
      let html = '';

      // Group match predictions
      const groupLetters = Object.keys(league.groups).sort();
      const matchPredMap = {};
      (preds.matchPredictions || []).forEach(p => { matchPredMap[p.match_id] = p; });

      const groupStandingMap = {};
      (preds.groupPredictions || []).forEach(p => {
        if (!groupStandingMap[p.group_letter]) groupStandingMap[p.group_letter] = {};
        groupStandingMap[p.group_letter][p.position] = p.team_id;
      });

      // Build a team lookup
      const teamMap = {};
      for (const gl of groupLetters) {
        league.groups[gl].forEach(t => { teamMap[t.id] = t; });
      }

      for (const gl of groupLetters) {
        const groupMatches = league.matches.filter(m => m.stage === 'group' && m.group_letter === gl);
        const hasPreds = groupMatches.some(m => matchPredMap[m.id]) || groupStandingMap[gl];

        if (!hasPreds) continue;

        html += `<div style="margin-bottom:1rem;">
          <h4 style="margin:0 0 0.5rem;font-size:0.95rem;color:var(--primary);">Group ${gl}</h4>`;

        // Match scores
        for (const m of groupMatches) {
          const pred = matchPredMap[m.id];
          if (!pred) continue;
          const homeFlag = m.home_flag || '';
          const awayFlag = m.away_flag || '';
          html += `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;font-size:0.85rem;">
            <span style="min-width:110px;text-align:right;">${homeFlag} ${m.home_team_code || '?'}</span>
            <span style="font-weight:700;min-width:40px;text-align:center;background:var(--bg-alt);padding:2px 6px;border-radius:4px;">${pred.predicted_home_score} – ${pred.predicted_away_score}</span>
            <span>${m.away_team_code || '?'} ${awayFlag}</span>
          </div>`;
        }

        // Group standing predictions
        const standings = groupStandingMap[gl];
        if (standings) {
          html += `<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;background:var(--bg-alt);border-radius:6px;font-size:0.82rem;">`;
          for (let pos = 1; pos <= 3; pos++) {
            const teamId = standings[pos];
            const team = teamId ? teamMap[teamId] : null;
            const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉';
            html += `<div>${medal} ${team ? team.flag_emoji + ' ' + team.name : '—'}</div>`;
          }
          html += `</div>`;
        }

        html += `</div>`;
      }

      if (!html) {
        html = '<div class="empty-state"><p>This player has not submitted any predictions yet.</p></div>';
      }

      body.innerHTML = html;
    } catch (err) {
      modal.querySelector('#pred-modal-body').innerHTML = `<div class="empty-state"><p>Failed to load: ${err.message}</p></div>`;
    }
  }

  function renderResultsTabs(matches, leagueId) {
    const stages = ['group', 'R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];
    const tabsEl = document.getElementById('results-tabs');
    const matchesEl = document.getElementById('results-matches');

    tabsEl.innerHTML = stages.map((s, i) => `
      <button class="tab ${i === 0 ? 'active' : ''}" data-stage="${s}">${getStageName(s)}</button>
    `).join('');

    function formatMatchDate(dateStr) {
      if (!dateStr) return 'Date TBD';
      const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00Z');
      return d.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    }

    function renderStage(stage) {
      const stageMatches = matches.filter(m => m.stage === stage);
      if (!stageMatches.length) {
        matchesEl.innerHTML = '<div class="empty-state"><p>No matches in this stage</p></div>';
        return;
      }

      // Sort chronologically
      stageMatches.sort((a, b) => {
        const dateA = a.match_date || '9999';
        const dateB = b.match_date || '9999';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.match_number || 0) - (b.match_number || 0);
      });

      // Group by date
      let html = '';
      let currentDate = null;
      for (const match of stageMatches) {
        const dateLabel = formatMatchDate(match.match_date);
        if (dateLabel !== currentDate) {
          currentDate = dateLabel;
          html += `<div style="margin-top: 1.25rem; margin-bottom: 0.5rem; padding-bottom: 0.35rem; border-bottom: 2px solid var(--primary-light);">
            <span style="font-weight: 700; font-size: 0.9rem; color: var(--primary);">📅 ${dateLabel}</span>
          </div>`;
        }
        html += renderMatchResult(match, leagueId, stage !== 'group');
      }

      matchesEl.innerHTML = html;

      // Attach save handlers
      matchesEl.querySelectorAll('.save-result-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const matchId = btn.dataset.matchId;
          const row = btn.closest('.result-entry');
          const homeVal = row.querySelector('.home-score').value;
          const awayVal = row.querySelector('.away-score').value;
          
          const data = {
            homeScore: homeVal === '' ? null : parseInt(homeVal),
            awayScore: awayVal === '' ? null : parseInt(awayVal)
          };

          // If one is filled but not the other
          if ((data.homeScore === null && data.awayScore !== null) || 
              (data.awayScore === null && data.homeScore !== null)) {
            return showToast('Please enter both scores, or leave both empty to clear', 'error');
          }

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
            const winnerRadio = row.querySelector('input[name="winner-' + matchId + '"]:checked');
            if (winnerRadio) {
              data.winnerId = parseInt(winnerRadio.value);
            }
          }

          try {
            await API.post(`/api/matches/${matchId}/result`, data);
            showToast('Result saved!');
            btn.textContent = '✓ Saved';
            
            // If this is a knockout match, reload to show bracket updates
            const isKnockout = !!row.querySelector('.knockout-options') || row.querySelector('input[type="radio"]');
            setTimeout(() => {
              btn.textContent = 'Save';
              if (isKnockout) {
                location.reload();
              }
            }, 1000);
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
    const groupBadge = match.group_letter ? `<span class="badge badge-muted" style="font-size: 0.65rem; margin-right: 0.25rem;">Grp ${match.group_letter}</span>` : '';

    return `
      <div class="result-entry" style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.85rem; margin-bottom: 0.5rem;">
        <div class="flex items-center gap-1" style="flex-wrap: wrap;">
          ${groupBadge}
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
          <div class="mt-1 flex items-center">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Winner:</span>
            <label style="font-size: 0.85rem; margin-left: 0.5rem; cursor: pointer;">
              <input type="radio" name="winner-${match.id}" value="${match.home_team_id}" ${match.winner_team_id === match.home_team_id ? 'checked' : ''}> ${homeFlag} ${escapeHtml(homeName)}
            </label>
            <label style="font-size: 0.85rem; margin-left: 0.5rem; cursor: pointer;">
              <input type="radio" name="winner-${match.id}" value="${match.away_team_id}" ${match.winner_team_id === match.away_team_id ? 'checked' : ''}> ${awayFlag} ${escapeHtml(awayName)}
            </label>
            <button class="btn btn-ghost" style="padding: 0 4px; font-size: 0.75rem; margin-left: 0.5rem; color: var(--text-muted);" onclick="this.parentElement.querySelectorAll('input[type=radio]').forEach(r=>r.checked=false); return false;">(Clear)</button>
          </div>
        ` : ''}
      </div>
    `;
  }
});
