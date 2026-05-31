document.addEventListener('DOMContentLoaded', async () => {
  const leagueId = getLeagueId();
  const playerId = getPlayerId();
  if (!leagueId || !playerId) {
    window.location.href = '/';
    return;
  }

  const content = document.getElementById('knockout-content');
  const saveBtn = document.getElementById('save-knockout-btn');

  let league = null;
  let existingPredictions = { predictions: [] };

  try {
    [league, existingPredictions] = await Promise.all([
      API.get(`/api/leagues/${leagueId}`),
      API.get(`/api/leagues/${leagueId}/predictions/knockout/${playerId}`)
    ]);
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
    return;
  }

  const isLocked = league.knockout_predictions_locked;
  const predMap = {};
  existingPredictions.predictions.forEach(p => {
    predMap[p.match_id] = p;
  });

  const stages = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];
  const knockoutMatches = league.matches.filter(m => m.stage !== 'group');

  let html = '';

  if (isLocked) {
    html += `<div class="card mb-2" style="border-color: var(--danger); text-align: center;">
      <span style="font-size: 1.5rem;">🔒</span>
      <p class="text-gold" style="font-weight: 600; margin-top: 0.5rem;">Knockout predictions are locked</p>
    </div>`;
  }

  stages.forEach(stage => {
    const matches = knockoutMatches.filter(m => m.stage === stage);
    if (!matches.length) return;

    html += `
      <div class="round-section fade-in">
        <div class="round-header">${getStageName(stage)}</div>
        ${matches.map(m => renderKnockoutMatch(m, predMap[m.id], isLocked)).join('')}
      </div>
    `;
  });

  if (!knockoutMatches.length) {
    html = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Knockout stage matches will appear once the group stage results are entered.</p></div>';
  }

  content.innerHTML = html;

  // ET toggle logic
  content.querySelectorAll('.et-toggle').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const match = toggle.closest('.knockout-match');
      const etFields = match.querySelector('.et-fields');
      if (toggle.checked) {
        etFields.classList.remove('hidden');
      } else {
        etFields.classList.add('hidden');
        match.querySelector('.pen-toggle').checked = false;
        match.querySelector('.pen-fields').classList.add('hidden');
      }
    });
  });

  content.querySelectorAll('.pen-toggle').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const match = toggle.closest('.knockout-match');
      const penFields = match.querySelector('.pen-fields');
      if (toggle.checked) {
        penFields.classList.remove('hidden');
        // Auto-check ET if penalties
        match.querySelector('.et-toggle').checked = true;
        match.querySelector('.et-fields').classList.remove('hidden');
      } else {
        penFields.classList.add('hidden');
      }
    });
  });

  // Winner button selection
  content.querySelectorAll('.winner-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isLocked) return;
      const matchEl = btn.closest('.knockout-match');
      matchEl.querySelectorAll('.winner-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Save predictions
  saveBtn.addEventListener('click', async () => {
    if (isLocked) {
      showToast('Knockout predictions are locked', 'error');
      return;
    }

    const predictions = [];
    content.querySelectorAll('.knockout-match').forEach(matchEl => {
      const matchId = parseInt(matchEl.dataset.matchId);
      const homeInput = matchEl.querySelector('.ko-home-score');
      const awayInput = matchEl.querySelector('.ko-away-score');
      const etToggle = matchEl.querySelector('.et-toggle');
      const penToggle = matchEl.querySelector('.pen-toggle');
      const winnerBtn = matchEl.querySelector('.winner-btn.selected');

      if (!homeInput || homeInput.value === '') return;

      const pred = {
        matchId,
        homeScore: parseInt(homeInput.value),
        awayScore: parseInt(awayInput.value),
        extraTime: etToggle ? etToggle.checked : false,
        penalties: penToggle ? penToggle.checked : false,
        winnerId: winnerBtn ? parseInt(winnerBtn.dataset.teamId) : null
      };

      predictions.push(pred);
    });

    try {
      await API.post(`/api/leagues/${leagueId}/predictions/knockout`, {
        playerId: parseInt(playerId),
        predictions
      });
      showToast('Knockout predictions saved!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  function renderKnockoutMatch(match, pred, locked) {
    const homeName = match.home_team_name || 'TBD';
    const awayName = match.away_team_name || 'TBD';
    const homeFlag = match.home_flag || '⬜';
    const awayFlag = match.away_flag || '⬜';
    const hasBothTeams = match.home_team_id && match.away_team_id;
    const disabled = locked || !hasBothTeams ? 'disabled' : '';

    return `
      <div class="knockout-match" data-match-id="${match.id}">
        <div class="match-row" style="margin-bottom: 0;">
          <div class="team-name team-home">
            <span style="${!hasBothTeams ? 'color: var(--text-muted);' : ''}">${homeName}</span>
            <span class="flag-emoji">${homeFlag}</span>
          </div>
          <div class="match-score-area">
            <input type="number" class="score-input ko-home-score" min="0" max="20"
              value="${pred ? pred.predicted_home_score ?? '' : ''}" ${disabled}>
            <span class="score-separator">–</span>
            <input type="number" class="score-input ko-away-score" min="0" max="20"
              value="${pred ? pred.predicted_away_score ?? '' : ''}" ${disabled}>
          </div>
          <div class="team-name team-away">
            <span class="flag-emoji">${awayFlag}</span>
            <span style="${!hasBothTeams ? 'color: var(--text-muted);' : ''}">${awayName}</span>
          </div>
        </div>

        ${hasBothTeams ? `
          <div class="knockout-options">
            <label class="knockout-toggle">
              <label class="toggle">
                <input type="checkbox" class="et-toggle" ${pred && pred.predicted_extra_time ? 'checked' : ''} ${locked ? 'disabled' : ''}>
                <span class="toggle-slider"></span>
              </label>
              <span>Extra Time</span>
            </label>
            <label class="knockout-toggle">
              <label class="toggle">
                <input type="checkbox" class="pen-toggle" ${pred && pred.predicted_penalties ? 'checked' : ''} ${locked ? 'disabled' : ''}>
                <span class="toggle-slider"></span>
              </label>
              <span>Penalties</span>
            </label>
          </div>

          <div class="et-fields ${pred && pred.predicted_extra_time ? '' : 'hidden'}" style="margin-top: 0.5rem;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">ET prediction is tracked via the toggles above</span>
          </div>

          <div class="pen-fields ${pred && pred.predicted_penalties ? '' : 'hidden'}" style="margin-top: 0.5rem;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Penalty prediction is tracked via the toggle above</span>
          </div>

          <div class="winner-select">
            <span style="font-size: 0.8rem; color: var(--text-muted); margin-right: 0.5rem;">Winner:</span>
            <button class="winner-btn ${pred && pred.predicted_winner_id === match.home_team_id ? 'selected' : ''}"
              data-team-id="${match.home_team_id}" ${locked ? 'disabled' : ''}>
              ${homeFlag} ${homeName}
            </button>
            <button class="winner-btn ${pred && pred.predicted_winner_id === match.away_team_id ? 'selected' : ''}"
              data-team-id="${match.away_team_id}" ${locked ? 'disabled' : ''}>
              ${awayFlag} ${awayName}
            </button>
          </div>
        ` : `
          <div style="text-align: center; padding: 0.5rem; color: var(--text-muted); font-size: 0.85rem;">
            Teams will be determined after the group stage
          </div>
        `}
      </div>
    `;
  }
});
