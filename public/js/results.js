document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('results-content');
  const leagueId = getLeagueId();

  if (!leagueId) {
    window.location.href = '/';
    return;
  }

  let league;
  try {
    league = await API.get('/api/leagues/' + leagueId);
  } catch (err) {
    content.innerHTML = '<div class="empty-state"><div class="empty-icon">😕</div><p>Failed to load results</p></div>';
    return;
  }

  const matches = league.matches || [];
  const stages = ['group', 'R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];

  // Render stage tabs + match content
  content.innerHTML = `
    <div class="tabs" id="results-tabs"></div>
    <div id="results-matches"></div>
  `;

  const tabsEl = document.getElementById('results-tabs');
  const matchesEl = document.getElementById('results-matches');

  tabsEl.innerHTML = stages.map((s, i) => `
    <button class="tab ${i === 0 ? 'active' : ''}" data-stage="${s}">${getStageName(s)}</button>
  `).join('');

  function formatMatchDate(dateStr) {
    if (!dateStr) return '';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Amsterdam'
    });
  }

  function renderStage(stage) {
    const stageMatches = matches.filter(m => m.stage === stage);
    if (!stageMatches.length) {
      matchesEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No matches in this stage yet</p></div>';
      return;
    }

    // Sort chronologically by date then match_number
    stageMatches.sort((a, b) => {
      const dateA = a.match_date || '';
      const dateB = b.match_date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.match_number || 0) - (b.match_number || 0);
    });

    // Group by date
    const dateGroups = [];
    let currentDate = null;
    let currentGroup = null;

    stageMatches.forEach(m => {
      const d = m.match_date || 'TBD';
      if (d !== currentDate) {
        currentDate = d;
        currentGroup = { date: d, matches: [] };
        dateGroups.push(currentGroup);
      }
      currentGroup.matches.push(m);
    });

    let html = '';
    dateGroups.forEach((group, idx) => {
      const dateLabel = group.date !== 'TBD' ? formatMatchDate(group.date) : 'Date TBD';
      html += `
        <div class="date-group" style="margin-bottom: 1.5rem; animation: fadeIn 0.4s ease ${idx * 0.05}s both;">
          <div style="padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; border-left: 3px solid var(--primary); background: var(--primary-light); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
            <span style="font-size: 0.85rem; font-weight: 600; color: var(--primary);">📅 ${dateLabel}</span>
          </div>
          ${group.matches.map(m => renderMatchRow(m, stage)).join('')}
        </div>
      `;
    });

    matchesEl.innerHTML = html;
  }

  function renderMatchRow(match, stage) {
    const homeCode = match.home_team_code || 'TBD';
    const awayCode = match.away_team_code || 'TBD';
    const homeFlag = match.home_flag || '⬜';
    const awayFlag = match.away_flag || '⬜';
    const hasResult = match.home_score !== null;

    // Badge: group letter for group stage, stage name for knockout
    let badgeHTML;
    if (stage === 'group' && match.group_letter) {
      badgeHTML = `<span class="badge badge-muted" style="font-size: 0.65rem;">Group ${match.group_letter}</span>`;
    } else {
      badgeHTML = `<span class="badge badge-muted" style="font-size: 0.65rem;">${getStageName(stage)}</span>`;
    }

    // Score area
    let scoreHTML;
    if (hasResult) {
      scoreHTML = `<span class="result-display">${match.home_score} – ${match.away_score}</span>`;
    } else {
      scoreHTML = `<span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500; padding: 0.2rem 0.6rem;">vs</span>`;
    }

    return `
      <div class="match-row" style="position: relative;">
        <div style="position: absolute; top: 0.4rem; left: 0.5rem;">${badgeHTML}</div>
        <span class="team-name team-home">
          <span>${escapeHtml(homeCode)}</span>
          <span class="flag-emoji">${homeFlag}</span>
        </span>
        <div class="match-score-area">
          ${scoreHTML}
        </div>
        <span class="team-name team-away">
          <span class="flag-emoji">${awayFlag}</span>
          <span>${escapeHtml(awayCode)}</span>
        </span>
      </div>
    `;
  }

  // Tab click handlers
  tabsEl.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabsEl.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderStage(tab.dataset.stage);
    });
  });

  // Render default stage
  renderStage('group');
});
