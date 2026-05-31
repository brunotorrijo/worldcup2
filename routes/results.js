const express = require('express');
const db = require('../db/database');
const { requireCreator } = require('../middleware/auth');
const router = express.Router();

const ROUND_MULTIPLIERS = {
  'R32': 1.0,
  'R16': 1.25,
  'QF': 1.5,
  'SF': 2.0,
  '3RD': 1.5,
  'FINAL': 3.0
};

// POST /api/matches/:matchId/result — Enter match result
router.post('/matches/:matchId/result', requireCreator, (req, res) => {
  try {
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const { homeScore, awayScore, extraTime, homeScoreEt, awayScoreEt,
            penalties, homePenalties, awayPenalties, winnerId } = req.body;

    if (homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({ error: 'Scores are required' });
    }

    let winnerTeamId = winnerId || null;

    // For group stage, determine winner from score
    if (match.stage === 'group') {
      if (homeScore > awayScore) winnerTeamId = match.home_team_id;
      else if (awayScore > homeScore) winnerTeamId = match.away_team_id;
      else winnerTeamId = null; // draw
    }

    db.prepare(`
      UPDATE matches SET
        home_score = ?, away_score = ?,
        extra_time = ?, home_score_et = ?, away_score_et = ?,
        penalties = ?, home_penalties = ?, away_penalties = ?,
        winner_team_id = ?
      WHERE id = ?
    `).run(
      homeScore, awayScore,
      extraTime ? 1 : 0, homeScoreEt || null, awayScoreEt || null,
      penalties ? 1 : 0, homePenalties || null, awayPenalties || null,
      winnerTeamId,
      req.params.matchId
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Save result error:', err);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

// Helper: Calculate group standings from actual match results
function calculateGroupStandings(groupLetter) {
  const teams = db.prepare('SELECT * FROM teams WHERE group_letter = ?').all(groupLetter);
  const matches = db.prepare(
    "SELECT * FROM matches WHERE group_letter = ? AND stage = 'group' AND home_score IS NOT NULL"
  ).all(groupLetter);

  const standings = {};
  teams.forEach(t => {
    standings[t.id] = { teamId: t.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  });

  matches.forEach(m => {
    const home = standings[m.home_team_id];
    const away = standings[m.away_team_id];
    if (!home || !away) return;

    home.played++;
    away.played++;
    home.gf += m.home_score;
    home.ga += m.away_score;
    away.gf += m.away_score;
    away.ga += m.home_score;

    if (m.home_score > m.away_score) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (m.home_score < m.away_score) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }
  });

  // Sort: points desc, gd desc, gf desc
  const sorted = Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });

  return sorted;
}

// POST /api/leagues/:id/calculate-points — Recalculate all points
router.post('/leagues/:id/calculate-points', requireCreator, (req, res) => {
  try {
    const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });

    const players = db.prepare('SELECT * FROM players WHERE league_id = ?').all(league.id);

    const transaction = db.transaction(() => {
      // Reset all points
      db.prepare(`
        UPDATE predictions SET points_earned = 0
        WHERE player_id IN (SELECT id FROM players WHERE league_id = ?)
      `).run(league.id);
      db.prepare(`
        UPDATE group_predictions SET points_earned = 0
        WHERE player_id IN (SELECT id FROM players WHERE league_id = ?)
      `).run(league.id);

      // Calculate group match points
      const groupMatches = db.prepare(
        "SELECT * FROM matches WHERE stage = 'group' AND home_score IS NOT NULL"
      ).all();

      for (const match of groupMatches) {
        const predictions = db.prepare(
          'SELECT * FROM predictions WHERE match_id = ? AND player_id IN (SELECT id FROM players WHERE league_id = ?)'
        ).all(match.id, league.id);

        for (const pred of predictions) {
          let points = 0;
          const actualResult = match.home_score > match.away_score ? 'H'
            : match.home_score < match.away_score ? 'A' : 'D';
          const predResult = pred.predicted_home_score > pred.predicted_away_score ? 'H'
            : pred.predicted_home_score < pred.predicted_away_score ? 'A' : 'D';

          // Correct outcome
          if (actualResult === predResult) points += 3;
          // Correct goal difference
          if ((match.home_score - match.away_score) === (pred.predicted_home_score - pred.predicted_away_score)) points += 2;
          // Exact score
          if (match.home_score === pred.predicted_home_score && match.away_score === pred.predicted_away_score) points += 3;

          db.prepare('UPDATE predictions SET points_earned = ? WHERE id = ?').run(points, pred.id);
        }
      }

      // Calculate group standing points
      const groups = ['A','B','C','D','E','F','G','H','I','J','K','L'];
      for (const groupLetter of groups) {
        const completedMatches = db.prepare(
          "SELECT COUNT(*) as count FROM matches WHERE group_letter = ? AND stage = 'group' AND home_score IS NOT NULL"
        ).get(groupLetter).count;

        if (completedMatches < 6) continue; // Only score if all group matches played

        const actualStandings = calculateGroupStandings(groupLetter);

        for (const player of players) {
          const predictions = db.prepare(
            'SELECT * FROM group_predictions WHERE player_id = ? AND group_letter = ? ORDER BY position'
          ).all(player.id, groupLetter);

          for (const pred of predictions) {
            let points = 0;
            const actualPos = actualStandings.findIndex(s => s.teamId === pred.team_id);

            if (actualPos === -1) continue;

            // Check if predicted position matches actual (0-indexed actualPos + 1 = actual position)
            if (actualPos + 1 === pred.position) {
              points = 4; // Exact position
            } else if (pred.position <= 2 && actualPos < 2) {
              points = 2; // Both in top 2 but wrong order
            } else if (pred.position === 3 && actualPos === 2) {
              points = 2; // Correct 3rd place
            }

            db.prepare('UPDATE group_predictions SET points_earned = ? WHERE id = ?').run(points, pred.id);
          }
        }
      }

      // Calculate knockout match points
      const knockoutMatches = db.prepare(
        "SELECT * FROM matches WHERE stage != 'group' AND home_score IS NOT NULL"
      ).all();

      for (const match of knockoutMatches) {
        const multiplier = ROUND_MULTIPLIERS[match.stage] || 1.0;

        const predictions = db.prepare(
          'SELECT * FROM predictions WHERE match_id = ? AND player_id IN (SELECT id FROM players WHERE league_id = ?)'
        ).all(match.id, league.id);

        for (const pred of predictions) {
          let basePoints = 0;

          // 1. Correct winner — 4 pts (most important for knockout)
          if (pred.predicted_winner_id && match.winner_team_id &&
              pred.predicted_winner_id === match.winner_team_id) {
            basePoints += 4;
          }

          // 2. 90-minute score analysis
          if (pred.predicted_home_score !== null && pred.predicted_away_score !== null &&
              match.home_score !== null && match.away_score !== null) {

            const actualResult90 = match.home_score > match.away_score ? 'H'
              : match.home_score < match.away_score ? 'A' : 'D';
            const predResult90 = pred.predicted_home_score > pred.predicted_away_score ? 'H'
              : pred.predicted_home_score < pred.predicted_away_score ? 'A' : 'D';

            // Correct result direction in 90 mins — +3 pts
            if (actualResult90 === predResult90) {
              basePoints += 3;
            }

            // Exact 90-minute score — +3 pts more
            if (pred.predicted_home_score === match.home_score &&
                pred.predicted_away_score === match.away_score) {
              basePoints += 3;
            }
          }

          // 3. Extra time prediction — +2 pts
          if (match.extra_time && pred.predicted_extra_time) {
            basePoints += 2;
          }

          // 4. Penalties prediction — +3 pts
          if (match.penalties && pred.predicted_penalties) {
            basePoints += 3;
          }

          const finalPoints = Math.floor(basePoints * multiplier);
          db.prepare('UPDATE predictions SET points_earned = ? WHERE id = ?').run(finalPoints, pred.id);
        }
      }
    });

    transaction();
    res.json({ ok: true, message: 'Points recalculated' });
  } catch (err) {
    console.error('Calculate points error:', err);
    res.status(500).json({ error: 'Failed to calculate points' });
  }
});

// GET /api/leagues/:id/leaderboard
router.get('/leagues/:id/leaderboard', (req, res) => {
  try {
    const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });

    const players = db.prepare('SELECT * FROM players WHERE league_id = ?').all(league.id);

    const leaderboard = players.map(player => {
      const groupMatchPoints = db.prepare(`
        SELECT COALESCE(SUM(p.points_earned), 0) as total
        FROM predictions p
        JOIN matches m ON p.match_id = m.id
        WHERE p.player_id = ? AND m.stage = 'group'
      `).get(player.id).total;

      const groupStandingPoints = db.prepare(
        'SELECT COALESCE(SUM(points_earned), 0) as total FROM group_predictions WHERE player_id = ?'
      ).get(player.id).total;

      const knockoutPoints = db.prepare(`
        SELECT COALESCE(SUM(p.points_earned), 0) as total
        FROM predictions p
        JOIN matches m ON p.match_id = m.id
        WHERE p.player_id = ? AND m.stage != 'group'
      `).get(player.id).total;

      const totalPoints = groupMatchPoints + groupStandingPoints + knockoutPoints;

      // Count predictions made
      const groupMatchPredCount = db.prepare(`
        SELECT COUNT(*) as count FROM predictions p
        JOIN matches m ON p.match_id = m.id
        WHERE p.player_id = ? AND m.stage = 'group'
      `).get(player.id).count;

      const groupStandingPredCount = db.prepare(
        'SELECT COUNT(*) as count FROM group_predictions WHERE player_id = ?'
      ).get(player.id).count;

      const knockoutPredCount = db.prepare(`
        SELECT COUNT(*) as count FROM predictions p
        JOIN matches m ON p.match_id = m.id
        WHERE p.player_id = ? AND m.stage != 'group'
      `).get(player.id).count;

      return {
        playerId: player.id,
        displayName: player.display_name,
        isCreator: player.is_creator,
        groupMatchPoints,
        groupStandingPoints,
        knockoutPoints,
        totalPoints,
        predictions: {
          groupMatches: groupMatchPredCount,
          groupStandings: groupStandingPredCount,
          knockout: knockoutPredCount
        }
      };
    });

    // Sort by total points desc, then by name
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));

    // Assign ranks
    let rank = 1;
    leaderboard.forEach((entry, i) => {
      if (i > 0 && entry.totalPoints < leaderboard[i - 1].totalPoints) {
        rank = i + 1;
      }
      entry.rank = rank;
    });

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

module.exports = router;
