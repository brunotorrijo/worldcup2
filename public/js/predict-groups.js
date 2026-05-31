document.addEventListener('DOMContentLoaded', async () => {
  const leagueId = getLeagueId();
  const playerId = getPlayerId();
  if (!leagueId || !playerId) {
    window.location.href = '/';
    return;
  }

  const groupContent = document.getElementById('group-content');
  const groupTabs = document.getElementById('group-tabs');
  const progressArea = document.getElementById('progress-area');
  const saveBtn = document.getElementById('save-all-btn');

  let league = null;
  let existingPredictions = { matchPredictions: [], groupPredictions: [] };
  let activeGroup = 'A';

  // Load data
  try {
    [league, existingPredictions] = await Promise.all([
      API.get(`/api/leagues/${leagueId}`),
      API.get(`/api/leagues/${leagueId}/predictions/groups/${playerId}`)
    ]);
  } catch (err) {
    groupContent.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
    return;
  }

  const isLocked = league.group_predictions_locked;
  const groups = Object.keys(league.groups).sort();

  // Show lock deadline info
  if (!isLocked && league.group_lock_deadline) {
    const deadline = new Date(league.group_lock_deadline);
    const now = new Date();
    const diff = deadline - now;
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      progressArea.insertAdjacentHTML('beforeend',
        `<div class="badge badge-warning" style="margin-bottom: 0.75rem;">⏰ Predictions lock in ${days}d ${hours}h (${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</div>`
      );
    }
  } else if (isLocked) {
    saveBtn.disabled = true;
    saveBtn.textContent = '🔒 Locked';
  }

  // Build prediction lookup maps
  const matchPredMap = {};
  existingPredictions.matchPredictions.forEach(p => {
    matchPredMap[p.match_id] = p;
  });
  const groupPredMap = {};
  existingPredictions.groupPredictions.forEach(p => {
    const key = `${p.group_letter}_${p.position}`;
    groupPredMap[key] = p;
  });

  // Render group tabs
  groupTabs.innerHTML = groups.map(g =>
    `<button class="group-tab ${g === activeGroup ? 'active' : ''}" data-group="${g}">${g}</button>`
  ).join('');

  groupTabs.querySelectorAll('.group-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      groupTabs.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeGroup = tab.dataset.group;
      renderGroup(activeGroup);
    });
  });

  // Update progress
  function updateProgress() {
    const matchInputs = document.querySelectorAll('.score-input[data-match-id]');
    let filledMatches = 0;
    const matchIds = new Set();
    matchInputs.forEach(input => {
      const mid = input.dataset.matchId;
      if (!matchIds.has(mid) && input.value !== '') {
        matchIds.add(mid);
      }
    });
    // Count pairs
    const allMatchIds = new Set();
    matchInputs.forEach(i => allMatchIds.add(i.dataset.matchId));
    allMatchIds.forEach(mid => {
      const inputs = document.querySelectorAll(`.score-input[data-match-id="${mid}"]`);
      if (inputs.length === 2 && inputs[0].value !== '' && inputs[1].value !== '') {
        filledMatches++;
      }
    });

    // Count from existing predictions not on current page
    const totalMatchPreds = Object.keys(matchPredMap).length;
    const visibleMatchIds = new Set();
    document.querySelectorAll('.score-input[data-match-id]').forEach(i => visibleMatchIds.add(i.dataset.matchId));

    let offScreenPreds = 0;
    for (const mid of Object.keys(matchPredMap)) {
      if (!visibleMatchIds.has(mid)) offScreenPreds++;
    }

    const totalPredicted = filledMatches + offScreenPreds;

    progressArea.innerHTML = `
      <div class="progress-text">${totalPredicted} / 72 match predictions</div>
      <div class="progress-bar"><div class="progress-fill" style="width: ${(totalPredicted / 72) * 100}%"></div></div>
    `;
  }

  function renderGroup(groupLetter) {
    const teams = league.groups[groupLetter];
    const matches = league.matches.filter(m => m.stage === 'group' && m.group_letter === groupLetter);

    groupContent.innerHTML = `
      <div class="group-card fade-in ${isLocked ? 'relative' : ''}">
        ${isLocked ? `
          <div class="locked-overlay">
            <div class="locked-message">
              <div class="lock-icon">🔒</div>
              <p>Predictions are locked</p>
            </div>
          </div>
        ` : ''}
        <div class="group-header">
          <div class="flex items-center gap-2">
            <span class="group-letter">Group ${groupLetter}</span>
            <div class="group-teams-preview">
              ${teams.map(t => `<span class="group-team-chip">${t.flag_emoji} ${t.code}</span>`).join('')}
            </div>
          </div>
        </div>

        <h4 class="text-secondary mb-2" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">Match Predictions</h4>
        ${matches.map(m => {
          const pred = matchPredMap[m.id];
          return `
            <div class="match-row">
              <div class="team-name team-home">
                <span>${m.home_team_name}</span>
                <span class="flag-emoji">${m.home_flag}</span>
              </div>
              <div class="match-score-area">
                <input type="number" class="score-input" data-match-id="${m.id}" data-side="home"
                  min="0" max="20" value="${pred ? pred.predicted_home_score : ''}" ${isLocked ? 'disabled' : ''}>
                <span class="score-separator">–</span>
                <input type="number" class="score-input" data-match-id="${m.id}" data-side="away"
                  min="0" max="20" value="${pred ? pred.predicted_away_score : ''}" ${isLocked ? 'disabled' : ''}>
              </div>
              <div class="team-name team-away">
                <span class="flag-emoji">${m.away_flag}</span>
                <span>${m.away_team_name}</span>
              </div>
            </div>
          `;
        }).join('')}

        <div class="standings-section">
          <h4 class="standings-title">Predicted Final Standings</h4>
          ${[1, 2, 3, 4].map(pos => {
            const predKey = `${groupLetter}_${pos}`;
            const pred = groupPredMap[predKey];
            return `
              <div class="standing-item">
                <div class="position-number">${pos}</div>
                <select class="standing-select" data-group="${groupLetter}" data-position="${pos}" ${isLocked ? 'disabled' : ''}>
                  <option value="">Select team...</option>
                  ${teams.map(t => `<option value="${t.id}" ${pred && pred.team_id === t.id ? 'selected' : ''}>${t.flag_emoji} ${t.name}</option>`).join('')}
                </select>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Update progress after render
    updateProgress();

    // Listen for input changes
    groupContent.querySelectorAll('.score-input').forEach(input => {
      input.addEventListener('input', updateProgress);
    });
  }

  // Save all predictions
  saveBtn.addEventListener('click', async () => {
    if (isLocked) {
      showToast('Predictions are locked', 'error');
      return;
    }

    // Collect ALL predictions across all groups (current view + saved)
    const matchPredictions = [];
    const groupPredictions = [];

    // From existing (saved) predictions that aren't on current page
    for (const [matchId, pred] of Object.entries(matchPredMap)) {
      matchPredictions.push({
        matchId: parseInt(matchId),
        homeScore: pred.predicted_home_score,
        awayScore: pred.predicted_away_score
      });
    }

    // From current page inputs (overwrite existing for this group)
    const currentGroupMatchIds = new Set();
    document.querySelectorAll('.score-input[data-match-id]').forEach(input => {
      currentGroupMatchIds.add(input.dataset.matchId);
    });

    // Remove current group matches from the existing list
    const filteredMatchPreds = matchPredictions.filter(p => !currentGroupMatchIds.has(p.matchId.toString()));

    // Add current page inputs
    const matchIdPairs = {};
    document.querySelectorAll('.score-input[data-match-id]').forEach(input => {
      const mid = input.dataset.matchId;
      if (!matchIdPairs[mid]) matchIdPairs[mid] = {};
      matchIdPairs[mid][input.dataset.side] = input.value;
    });

    for (const [matchId, scores] of Object.entries(matchIdPairs)) {
      if (scores.home !== '' && scores.away !== '') {
        filteredMatchPreds.push({
          matchId: parseInt(matchId),
          homeScore: parseInt(scores.home),
          awayScore: parseInt(scores.away)
        });
      }
    }

    // Group standing predictions - from existing
    for (const [key, pred] of Object.entries(groupPredMap)) {
      groupPredictions.push({
        groupLetter: pred.group_letter,
        position: pred.position,
        teamId: pred.team_id
      });
    }

    // Override with current page selects
    document.querySelectorAll('.standing-select').forEach(select => {
      if (select.value) {
        const g = select.dataset.group;
        const pos = parseInt(select.dataset.position);
        // Remove old entry for this group+position
        const idx = groupPredictions.findIndex(p => p.groupLetter === g && p.position === pos);
        if (idx >= 0) groupPredictions.splice(idx, 1);
        groupPredictions.push({
          groupLetter: g,
          position: pos,
          teamId: parseInt(select.value)
        });
      }
    });

    try {
      await API.post(`/api/leagues/${leagueId}/predictions/groups`, {
        playerId: parseInt(playerId),
        matchPredictions: filteredMatchPreds,
        groupPredictions
      });

      // Update local maps
      filteredMatchPreds.forEach(p => {
        matchPredMap[p.matchId] = {
          match_id: p.matchId,
          predicted_home_score: p.homeScore,
          predicted_away_score: p.awayScore
        };
      });
      groupPredictions.forEach(p => {
        groupPredMap[`${p.groupLetter}_${p.position}`] = {
          group_letter: p.groupLetter,
          position: p.position,
          team_id: p.teamId
        };
      });

      showToast('Predictions saved!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Initial render
  renderGroup(activeGroup);
});
