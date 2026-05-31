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
        <div class="leaderboard-row ${rankClass} ${currentClass}" style="animation-delay: ${delay}s;">
          <div class="rank-number">${medal || entry.rank}</div>
          <div class="player-name">
            ${escapeHtml(entry.displayName)}
            ${entry.isCreator ? '<span class="badge badge-gold" style="margin-left: 0.35rem;">Creator</span>' : ''}
          </div>
          <div class="points-cell">${entry.groupMatchPoints}</div>
          <div class="points-cell">${entry.groupStandingPoints}</div>
          <div class="points-cell">${entry.knockoutPoints}</div>
          <div class="total-points">${entry.totalPoints}</div>
        </div>
      `;
    });

    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><p>Failed to load leaderboard: ${err.message}</p></div>`;
  }
});
