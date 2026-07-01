document.addEventListener('DOMContentLoaded', async () => {
  const leagueId = getLeagueId();
  const currentPlayerId = getPlayerId();

  if (!leagueId) {
    window.location.href = '/';
    return;
  }

  const content = document.getElementById('leaderboard-content');

  // Scoring rules toggle
  document.getElementById('scoring-toggle').addEventListener('click', () => {
    const c = document.getElementById('scoring-content');
    const arrow = document.getElementById('scoring-arrow');
    c.classList.toggle('show');
    arrow.textContent = c.classList.contains('show') ? '▲' : '▼';
  });

  try {
    const leaderboard = await API.get(`/api/leagues/${leagueId}/leaderboard`);

    if (!leaderboard.length) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <p>No players yet. Share your invite code to get started!</p>
        </div>
      `;
      return;
    }

    // Render header
    let html = `
      <div class="leaderboard-header">
        <span>#</span>
        <span>Player</span>
        <span>Groups</span>
        <span>Standings</span>
        <span>Knockout</span>
        <span>Total</span>
      </div>
    `;

    // Render rows
    leaderboard.forEach((entry, i) => {
      const rankClass = entry.rank <= 3 ? `rank-${entry.rank}` : '';
      const currentClass = entry.playerId.toString() === currentPlayerId ? 'current-player' : '';
      const delay = i * 0.05;

      const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
      const medal = medals[entry.rank] || '';

      html += `
        <div class="leaderboard-row ${rankClass} ${currentClass} player-row-clickable" data-player-id="${entry.playerId}" data-player-name="${escapeHtml(entry.displayName)}" style="animation-delay: ${delay}s; cursor: pointer;" title="Click to view predictions">
          <div class="rank-number">${medal || entry.rank}</div>
          <div class="player-name">
            ${escapeHtml(entry.displayName)}
            ${entry.isCreator ? '<span class="badge badge-gold" style="margin-left: 0.35rem;">Creator</span>' : ''}
            <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">👁 View Picks</span>
          </div>
          <div class="points-cell">${entry.groupMatchPoints}</div>
          <div class="points-cell">${entry.groupStandingPoints}</div>
          <div class="points-cell">${entry.knockoutPoints}</div>
          <div class="total-points">${entry.totalPoints}</div>
        </div>
      `;
    });

    content.innerHTML = html;

    // Attach click listeners
    document.querySelectorAll('.player-row-clickable').forEach(row => {
      row.addEventListener('click', () => {
        showPlayerPredictions(leagueId, row.dataset.playerId, row.dataset.playerName);
      });
    });

  } catch (err) {
    content.innerHTML = `<div class="empty-state"><p>Failed to load leaderboard: ${err.message}</p></div>`;
  }
});

async function showPlayerPredictions(leagueId, playerId, playerName) {
  let overlay = document.getElementById('pred-modal-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'pred-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(3px);';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const modal = document.createElement('div');
  modal.style.cssText = 'background:var(--surface);border-radius:12px;max-width:650px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);display:flex;flex-direction:column;';

  modal.innerHTML = `
    <div style="padding:1.25rem 1.5rem 0 1.5rem;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface);z-index:10;border-radius:12px 12px 0 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1.1rem;">📋 ${escapeHtml(playerName)}'s Predictions</h3>
        <button id="close-pred-modal" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted);padding:0 0.25rem;">✕</button>
      </div>
      <div style="display:flex;gap:1.5rem;">
        <button id="tab-groups" style="background:none;border:none;padding:0.5rem 0;color:var(--primary);border-bottom:2px solid var(--primary);font-weight:600;cursor:pointer;">Groups</button>
        <button id="tab-knockouts" style="background:none;border:none;padding:0.5rem 0;color:var(--text-muted);border-bottom:2px solid transparent;font-weight:600;cursor:pointer;">Knockout</button>
      </div>
    </div>
    <div id="pred-modal-body" style="padding:1.25rem 1.5rem;flex:1;overflow-y:auto;">
      <div class="flex-center" style="padding:2rem;"><div class="loader"></div></div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modal.querySelector('#close-pred-modal').addEventListener('click', () => overlay.remove());

  const tabGroups = modal.querySelector('#tab-groups');
  const tabKnockouts = modal.querySelector('#tab-knockouts');
  const body = modal.querySelector('#pred-modal-body');

  let leagueData = null;
  let groupsData = null;
  let knockoutsData = null;

  try {
    const [leagueRes, groupRes, koRes] = await Promise.all([
      API.get(`/api/leagues/${leagueId}`),
      API.get(`/api/leagues/${leagueId}/predictions/groups/${playerId}`),
      API.get(`/api/leagues/${leagueId}/predictions/knockout/${playerId}`)
    ]);
    leagueData = leagueRes;
    groupsData = groupRes;
    knockoutsData = koRes;
    
    renderGroups();
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><p>Failed to load: ${err.message}</p></div>`;
    return;
  }

  tabGroups.addEventListener('click', () => {
    tabGroups.style.color = 'var(--primary)';
    tabGroups.style.borderBottomColor = 'var(--primary)';
    tabKnockouts.style.color = 'var(--text-muted)';
    tabKnockouts.style.borderBottomColor = 'transparent';
    renderGroups();
  });

  tabKnockouts.addEventListener('click', () => {
    tabKnockouts.style.color = 'var(--primary)';
    tabKnockouts.style.borderBottomColor = 'var(--primary)';
    tabGroups.style.color = 'var(--text-muted)';
    tabGroups.style.borderBottomColor = 'transparent';
    renderKnockouts();
  });

  function renderGroups() {
    let html = '';
    const groupLetters = Object.keys(leagueData.groups).sort();
    const matchPredMap = {};
    (groupsData.matchPredictions || []).forEach(p => { matchPredMap[p.match_id] = p; });

    const groupStandingMap = {};
    (groupsData.groupPredictions || []).forEach(p => {
      if (!groupStandingMap[p.group_letter]) groupStandingMap[p.group_letter] = {};
      groupStandingMap[p.group_letter][p.position] = p.team_id;
    });

    const teamMap = {};
    for (const gl of groupLetters) {
      leagueData.groups[gl].forEach(t => { teamMap[t.id] = t; });
    }

    for (const gl of groupLetters) {
      const groupMatches = leagueData.matches.filter(m => m.stage === 'group' && m.group_letter === gl);
      const hasPreds = groupMatches.some(m => matchPredMap[m.id]) || groupStandingMap[gl];

      if (!hasPreds) continue;

      html += `<div style="margin-bottom:1rem;">
        <h4 style="margin:0 0 0.5rem;font-size:0.95rem;color:var(--primary);">Group ${gl}</h4>`;

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

    body.innerHTML = html || '<div class="empty-state"><p>No group predictions submitted yet.</p></div>';
  }

  function renderKnockouts() {
    const knockoutMatches = leagueData.matches.filter(m => m.stage !== 'group').sort((a, b) => a.match_number - b.match_number);
    if (!knockoutMatches.length || !knockoutsData.predictions || !knockoutsData.predictions.length) {
      body.innerHTML = '<div class="empty-state"><p>No knockout predictions submitted yet.</p></div>';
      return;
    }

    const KNOCKOUT_PROGRESSION = {
      74: { nextMatch: 89, slot: 'home' }, 77: { nextMatch: 89, slot: 'away' },
      73: { nextMatch: 90, slot: 'home' }, 75: { nextMatch: 90, slot: 'away' },
      76: { nextMatch: 91, slot: 'home' }, 78: { nextMatch: 91, slot: 'away' },
      79: { nextMatch: 92, slot: 'home' }, 80: { nextMatch: 92, slot: 'away' },
      83: { nextMatch: 93, slot: 'home' }, 84: { nextMatch: 93, slot: 'away' },
      81: { nextMatch: 94, slot: 'home' }, 82: { nextMatch: 94, slot: 'away' },
      86: { nextMatch: 95, slot: 'home' }, 88: { nextMatch: 95, slot: 'away' },
      85: { nextMatch: 96, slot: 'home' }, 87: { nextMatch: 96, slot: 'away' },
      89: { nextMatch: 97, slot: 'home' }, 90: { nextMatch: 97, slot: 'away' },
      93: { nextMatch: 98, slot: 'home' }, 94: { nextMatch: 98, slot: 'away' },
      91: { nextMatch: 99, slot: 'home' }, 92: { nextMatch: 99, slot: 'away' },
      95: { nextMatch: 100, slot: 'home' }, 96: { nextMatch: 100, slot: 'away' },
      97: { nextMatch: 101, slot: 'home' }, 98: { nextMatch: 101, slot: 'away' },
      99: { nextMatch: 102, slot: 'home' }, 100: { nextMatch: 102, slot: 'away' },
      101: { nextMatch: 104, slot: 'home', thirdPlaceMatch: 103, thirdPlaceSlot: 'home' },
      102: { nextMatch: 104, slot: 'away', thirdPlaceMatch: 103, thirdPlaceSlot: 'away' }
    };

    const draft = {};
    const predMap = {};
    knockoutsData.predictions.forEach(p => {
      draft[p.match_id] = p.predicted_winner_id;
      predMap[p.match_id] = p;
    });

    const derivedMatches = JSON.parse(JSON.stringify(knockoutMatches));
    const matchByNumber = {};
    derivedMatches.forEach(m => matchByNumber[m.match_number] = m);

    derivedMatches.forEach(match => {
      const winnerId = draft[match.id];
      if (winnerId && (winnerId === match.home_team_id || winnerId === match.away_team_id)) {
        const prog = KNOCKOUT_PROGRESSION[match.match_number];
        if (prog && matchByNumber[prog.nextMatch]) {
          const nextM = matchByNumber[prog.nextMatch];
          const slotCol = prog.slot === 'home' ? 'home_team_id' : 'away_team_id';
          const nameCol = prog.slot === 'home' ? 'home_team_name' : 'away_team_name';
          const flagCol = prog.slot === 'home' ? 'home_flag' : 'away_flag';
          
          const isHomeWinner = winnerId === match.home_team_id;
          nextM[slotCol] = winnerId;
          nextM[nameCol] = isHomeWinner ? match.home_team_name : match.away_team_name;
          nextM[flagCol] = isHomeWinner ? match.home_flag : match.away_flag;

          if (prog.thirdPlaceMatch && matchByNumber[prog.thirdPlaceMatch]) {
            const thirdM = matchByNumber[prog.thirdPlaceMatch];
            const thirdSlotCol = prog.thirdPlaceSlot === 'home' ? 'home_team_id' : 'away_team_id';
            const thirdNameCol = prog.thirdPlaceSlot === 'home' ? 'home_team_name' : 'away_team_name';
            const thirdFlagCol = prog.thirdPlaceSlot === 'home' ? 'home_flag' : 'away_flag';
            const loserId = isHomeWinner ? match.away_team_id : match.home_team_id;
            if (loserId) {
              thirdM[thirdSlotCol] = loserId;
              thirdM[thirdNameCol] = isHomeWinner ? match.away_team_name : match.home_team_name;
              thirdM[thirdFlagCol] = isHomeWinner ? match.away_flag : match.home_flag;
            }
          }
        }
      }
    });

    let html = '';
    const stages = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];

    const stageNames = {
      'R32': 'Round of 32',
      'R16': 'Round of 16',
      'QF': 'Quarter-Finals',
      'SF': 'Semi-Finals',
      '3RD': 'Third Place Match',
      'FINAL': 'Final'
    };

    stages.forEach(stage => {
      const matches = derivedMatches.filter(m => m.stage === stage);
      if (!matches.length) return;

      let stageHasPreds = false;
      let stageHtml = `<div style="margin-bottom:1.5rem;">
        <h4 style="margin:0 0 0.5rem;font-size:1rem;color:var(--primary);border-bottom:1px solid var(--border);padding-bottom:0.25rem;">${stageNames[stage] || stage}</h4>`;

      for (const m of matches) {
        const pred = predMap[m.id];
        if (!pred) continue;
        
        stageHasPreds = true;
        const homeName = m.home_team_name || 'TBD';
        const awayName = m.away_team_name || 'TBD';
        const homeFlag = m.home_flag || '⬜';
        const awayFlag = m.away_flag || '⬜';
        
        const hScore = pred.predicted_home_score;
        const aScore = pred.predicted_away_score;
        const hBold = pred.predicted_winner_id === m.home_team_id ? 'font-weight:bold;color:var(--text);' : 'color:var(--text-muted);';
        const aBold = pred.predicted_winner_id === m.away_team_id ? 'font-weight:bold;color:var(--text);' : 'color:var(--text-muted);';
        
        let extraText = '';
        if (pred.predicted_penalties) extraText = ' <span style="font-size:0.75rem;color:var(--primary);">(PEN)</span>';
        else if (pred.predicted_extra_time) extraText = ' <span style="font-size:0.75rem;color:var(--primary);">(ET)</span>';

        stageHtml += `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.5rem;background:var(--bg-alt);border-radius:6px;margin-bottom:0.4rem;font-size:0.9rem;">
          <div style="flex:1;text-align:right;${hBold}">${homeName} ${homeFlag}</div>
          <div style="padding:0 1rem;font-weight:700;">${hScore} – ${aScore}${extraText}</div>
          <div style="flex:1;text-align:left;${aBold}">${awayFlag} ${awayName}</div>
        </div>`;
      }
      stageHtml += `</div>`;
      
      if (stageHasPreds) html += stageHtml;
    });

    body.innerHTML = html || '<div class="empty-state"><p>No knockout predictions submitted yet.</p></div>';
  }
}
