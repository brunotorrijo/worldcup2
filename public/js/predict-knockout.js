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
  const knockoutMatches = league.matches.filter(m => m.stage !== 'group').sort((a, b) => a.match_number - b.match_number);

  // Maintain an in-memory draft of predictions to persist state across re-renders
  let draftPredictions = {};
  existingPredictions.predictions.forEach(p => {
    draftPredictions[p.match_id] = {
      homeScore: p.predicted_home_score,
      awayScore: p.predicted_away_score,
      extraTime: p.predicted_extra_time,
      penalties: p.predicted_penalties,
      winnerId: p.predicted_winner_id
    };
  });

  const KNOCKOUT_PROGRESSION = {
    // R32 -> R16
    74: { nextMatch: 89, slot: 'home' }, 77: { nextMatch: 89, slot: 'away' },
    73: { nextMatch: 90, slot: 'home' }, 75: { nextMatch: 90, slot: 'away' },
    76: { nextMatch: 91, slot: 'home' }, 78: { nextMatch: 91, slot: 'away' },
    79: { nextMatch: 92, slot: 'home' }, 80: { nextMatch: 92, slot: 'away' },
    83: { nextMatch: 93, slot: 'home' }, 84: { nextMatch: 93, slot: 'away' },
    81: { nextMatch: 94, slot: 'home' }, 82: { nextMatch: 94, slot: 'away' },
    86: { nextMatch: 95, slot: 'home' }, 88: { nextMatch: 95, slot: 'away' },
    85: { nextMatch: 96, slot: 'home' }, 87: { nextMatch: 96, slot: 'away' },
    // R16 -> QF
    89: { nextMatch: 97, slot: 'home' }, 90: { nextMatch: 97, slot: 'away' },
    93: { nextMatch: 98, slot: 'home' }, 94: { nextMatch: 98, slot: 'away' },
    91: { nextMatch: 99, slot: 'home' }, 92: { nextMatch: 99, slot: 'away' },
    95: { nextMatch: 100, slot: 'home' }, 96: { nextMatch: 100, slot: 'away' },
    // QF -> SF
    97: { nextMatch: 101, slot: 'home' }, 98: { nextMatch: 101, slot: 'away' },
    99: { nextMatch: 102, slot: 'home' }, 100: { nextMatch: 102, slot: 'away' },
    // SF -> Final & 3rd Place
    101: { nextMatch: 104, slot: 'home', thirdPlaceMatch: 103, thirdPlaceSlot: 'home' },
    102: { nextMatch: 104, slot: 'away', thirdPlaceMatch: 103, thirdPlaceSlot: 'away' }
  };

  // Sync current DOM inputs to draftPredictions before rebuilding
  function syncDOMToDraft() {
    content.querySelectorAll('.knockout-match').forEach(matchEl => {
      const matchId = parseInt(matchEl.dataset.matchId);
      const homeInput = matchEl.querySelector('.ko-home-score');
      const awayInput = matchEl.querySelector('.ko-away-score');
      const etToggle = matchEl.querySelector('.et-toggle');
      const penToggle = matchEl.querySelector('.pen-toggle');
      const winnerBtn = matchEl.querySelector('.winner-btn.selected');

      draftPredictions[matchId] = {
        homeScore: homeInput && homeInput.value !== '' ? parseInt(homeInput.value) : null,
        awayScore: awayInput && awayInput.value !== '' ? parseInt(awayInput.value) : null,
        extraTime: etToggle ? etToggle.checked : false,
        penalties: penToggle ? penToggle.checked : false,
        winnerId: winnerBtn ? parseInt(winnerBtn.dataset.teamId) : null
      };
    });
  }

  // Rebuild the bracket by cascading predicted winners
  function rebuildBracket() {
    // Deep clone the base bracket
    const derivedMatches = JSON.parse(JSON.stringify(knockoutMatches));
    const matchByNumber = {};
    derivedMatches.forEach(m => matchByNumber[m.match_number] = m);

    // Run through matches in order, propagating winners
    derivedMatches.forEach(match => {
      const draft = draftPredictions[match.id];
      if (draft && draft.winnerId) {
        // Ensure the predicted winner is actually playing in this match! (They might have changed an earlier prediction)
        if (draft.winnerId !== match.home_team_id && draft.winnerId !== match.away_team_id) {
          draft.winnerId = null; // Invalidate
        } else {
          // Propagate winner
          const prog = KNOCKOUT_PROGRESSION[match.match_number];
          if (prog && matchByNumber[prog.nextMatch]) {
            const nextM = matchByNumber[prog.nextMatch];
            const slotCol = prog.slot === 'home' ? 'home_team_id' : 'away_team_id';
            const nameCol = prog.slot === 'home' ? 'home_team_name' : 'away_team_name';
            const flagCol = prog.slot === 'home' ? 'home_flag' : 'away_flag';
            
            const isHomeWinner = draft.winnerId === match.home_team_id;
            nextM[slotCol] = draft.winnerId;
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
      }
    });

    renderBracket(derivedMatches);
  }

  function renderBracket(matchesToRender) {
    const stages = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];
    let html = '';

    if (isLocked) {
      html += `<div class="card mb-2" style="border-color: var(--danger); text-align: center;">
        <span style="font-size: 1.5rem;">🔒</span>
        <p class="text-gold" style="font-weight: 600; margin-top: 0.5rem;">Knockout predictions are locked</p>
      </div>`;
    }

    stages.forEach(stage => {
      const matches = matchesToRender.filter(m => m.stage === stage);
      if (!matches.length) return;

      html += `
        <div class="round-section fade-in">
          <div class="round-header">${getStageName(stage)}</div>
          ${matches.map(m => renderKnockoutMatch(m, draftPredictions[m.id], isLocked)).join('')}
        </div>
      `;
    });

    if (!matchesToRender.length) {
      html = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Knockout stage matches will appear once the group stage results are entered.</p></div>';
    }

    content.innerHTML = html;
    attachEventListeners();
  }

  function renderKnockoutMatch(match, draft, locked) {
    const homeName = match.home_team_name || 'TBD';
    const awayName = match.away_team_name || 'TBD';
    const homeFlag = match.home_flag || '⬜';
    const awayFlag = match.away_flag || '⬜';
    const hasBothTeams = match.home_team_id && match.away_team_id;
    const disabled = locked || !hasBothTeams ? 'disabled' : '';

    // Fix invalid draft selections if teams changed
    if (draft && draft.winnerId && draft.winnerId !== match.home_team_id && draft.winnerId !== match.away_team_id) {
      draft.winnerId = null;
    }

    const homeScoreVal = draft && draft.homeScore !== null && draft.homeScore !== undefined ? draft.homeScore : '';
    const awayScoreVal = draft && draft.awayScore !== null && draft.awayScore !== undefined ? draft.awayScore : '';
    const etChecked = draft && draft.extraTime ? 'checked' : '';
    const penChecked = draft && draft.penalties ? 'checked' : '';

    return `
      <div class="knockout-match" data-match-id="${match.id}">
        <div class="match-row" style="margin-bottom: 0;">
          <div class="team-name team-home">
            <span style="${!hasBothTeams ? 'color: var(--text-muted);' : ''}">${homeName}</span>
            <span class="flag-emoji">${homeFlag}</span>
          </div>
          <div class="match-score-area">
            <input type="number" class="score-input ko-home-score" min="0" max="20"
              value="${homeScoreVal}" ${disabled}>
            <span class="score-separator">–</span>
            <input type="number" class="score-input ko-away-score" min="0" max="20"
              value="${awayScoreVal}" ${disabled}>
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
                <input type="checkbox" class="et-toggle" ${etChecked} ${locked ? 'disabled' : ''}>
                <span class="toggle-slider"></span>
              </label>
              <span>Extra Time</span>
            </label>
            <label class="knockout-toggle">
              <label class="toggle">
                <input type="checkbox" class="pen-toggle" ${penChecked} ${locked ? 'disabled' : ''}>
                <span class="toggle-slider"></span>
              </label>
              <span>Penalties</span>
            </label>
          </div>

          <div class="et-fields ${etChecked ? '' : 'hidden'}" style="margin-top: 0.5rem;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">ET prediction is tracked via the toggles above</span>
          </div>

          <div class="pen-fields ${penChecked ? '' : 'hidden'}" style="margin-top: 0.5rem;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Penalty prediction is tracked via the toggle above</span>
          </div>

          <div class="winner-select">
            <span style="font-size: 0.8rem; color: var(--text-muted); margin-right: 0.5rem;">Winner:</span>
            <button class="winner-btn ${draft && draft.winnerId === match.home_team_id ? 'selected' : ''}"
              data-team-id="${match.home_team_id}" ${locked ? 'disabled' : ''}>
              ${homeFlag} ${homeName}
            </button>
            <button class="winner-btn ${draft && draft.winnerId === match.away_team_id ? 'selected' : ''}"
              data-team-id="${match.away_team_id}" ${locked ? 'disabled' : ''}>
              ${awayFlag} ${awayName}
            </button>
          </div>
        ` : `
          <div style="text-align: center; padding: 0.5rem; color: var(--text-muted); font-size: 0.85rem;">
            Teams will be populated based on previous predictions
          </div>
        `}
      </div>
    `;
  }

  function attachEventListeners() {
    // ET / PEN toggles
    content.querySelectorAll('.et-toggle').forEach(toggle => {
      toggle.addEventListener('change', () => {
        const match = toggle.closest('.knockout-match');
        if (toggle.checked) {
          match.querySelector('.et-fields').classList.remove('hidden');
        } else {
          match.querySelector('.et-fields').classList.add('hidden');
          const penToggle = match.querySelector('.pen-toggle');
          if (penToggle) penToggle.checked = false;
          const penFields = match.querySelector('.pen-fields');
          if (penFields) penFields.classList.add('hidden');
        }
        syncDOMToDraft();
      });
    });

    content.querySelectorAll('.pen-toggle').forEach(toggle => {
      toggle.addEventListener('change', () => {
        const match = toggle.closest('.knockout-match');
        if (toggle.checked) {
          match.querySelector('.pen-fields').classList.remove('hidden');
          match.querySelector('.et-toggle').checked = true;
          match.querySelector('.et-fields').classList.remove('hidden');
        } else {
          match.querySelector('.pen-fields').classList.add('hidden');
        }
        syncDOMToDraft();
      });
    });

    // Score inputs sync
    content.querySelectorAll('.score-input').forEach(input => {
      input.addEventListener('change', syncDOMToDraft);
      input.addEventListener('keyup', syncDOMToDraft);
    });

    // Winner button clicks trigger a bracket rebuild
    content.querySelectorAll('.winner-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isLocked) return;
        const matchEl = btn.closest('.knockout-match');
        matchEl.querySelectorAll('.winner-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        syncDOMToDraft();
        rebuildBracket();
      });
    });
  }

  // Save logic
  saveBtn.addEventListener('click', async () => {
    if (isLocked) {
      showToast('Knockout predictions are locked', 'error');
      return;
    }

    syncDOMToDraft();
    const predictions = [];
    Object.keys(draftPredictions).forEach(matchId => {
      const pred = draftPredictions[matchId];
      if (pred.homeScore !== null && pred.homeScore !== undefined && pred.homeScore !== '') {
        predictions.push({
          matchId: parseInt(matchId),
          homeScore: pred.homeScore,
          awayScore: pred.awayScore,
          extraTime: pred.extraTime || false,
          penalties: pred.penalties || false,
          winnerId: pred.winnerId || null
        });
      }
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

  // Initial render
  rebuildBracket();
});
