const express = require('express');
const { query, queryOne, execute, batch } = require('../db/database');
const { requireCreator } = require('../middleware/auth');
const router = express.Router();

const ROUND_MULTIPLIERS = {
  'R32': 1.0, 'R16': 1.25, 'QF': 1.5,
  'SF': 2.0, '3RD': 1.5, 'FINAL': 3.0
};

// POST /api/matches/:matchId/result
router.post('/matches/:matchId/result', requireCreator, async (req, res) => {
  try {
    const match = await queryOne('SELECT * FROM matches WHERE id = ?', [req.params.matchId]);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const { homeScore, awayScore, extraTime, homeScoreEt, awayScoreEt,
            penalties, homePenalties, awayPenalties, winnerId } = req.body;

    if (homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({ error: 'Scores are required' });
    }

    let winnerTeamId = winnerId || null;
    if (match.stage === 'group') {
      if (homeScore > awayScore) winnerTeamId = match.home_team_id;
      else if (awayScore > homeScore) winnerTeamId = match.away_team_id;
      else winnerTeamId = null;
    }

    await execute(`
      UPDATE matches SET
        home_score = ?, away_score = ?,
        extra_time = ?, home_score_et = ?, away_score_et = ?,
        penalties = ?, home_penalties = ?, away_penalties = ?,
        winner_team_id = ?
      WHERE id = ?
    `, [
      homeScore, awayScore,
      extraTime ? 1 : 0, homeScoreEt || null, awayScoreEt || null,
      penalties ? 1 : 0, homePenalties || null, awayPenalties || null,
      winnerTeamId, req.params.matchId
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Save result error:', err);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

// Helper: Calculate group standings from actual match results
async function calculateGroupStandings(groupLetter) {
  const teams = await query('SELECT * FROM teams WHERE group_letter = ?', [groupLetter]);
  const matches = await query(
    "SELECT * FROM matches WHERE group_letter = ? AND stage = 'group' AND home_score IS NOT NULL",
    [groupLetter]
  );

  const standings = {};
  teams.forEach(t => {
    standings[t.id] = { teamId: t.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  });

  matches.forEach(m => {
    const home = standings[m.home_team_id];
    const away = standings[m.away_team_id];
    if (!home || !away) return;

    home.played++; away.played++;
    home.gf += Number(m.home_score); home.ga += Number(m.away_score);
    away.gf += Number(m.away_score); away.ga += Number(m.home_score);

    if (Number(m.home_score) > Number(m.away_score)) {
      home.won++; home.points += 3; away.lost++;
    } else if (Number(m.home_score) < Number(m.away_score)) {
      away.won++; away.points += 3; home.lost++;
    } else {
      home.drawn++; away.drawn++; home.points += 1; away.points += 1;
    }
  });

  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
}

// POST /api/leagues/:id/calculate-points
router.post('/leagues/:id/calculate-points', requireCreator, async (req, res) => {
  try {
    const league = await queryOne('SELECT * FROM leagues WHERE id = ?', [req.params.id]);
    if (!league) return res.status(404).json({ error: 'League not found' });

    const players = await query('SELECT * FROM players WHERE league_id = ?', [league.id]);
    const stmts = [];

    // Reset all points
    stmts.push({
      sql: 'UPDATE predictions SET points_earned = 0 WHERE player_id IN (SELECT id FROM players WHERE league_id = ?)',
      args: [league.id]
    });
    stmts.push({
      sql: 'UPDATE group_predictions SET points_earned = 0 WHERE player_id IN (SELECT id FROM players WHERE league_id = ?)',
      args: [league.id]
    });
    await batch(stmts);

    // Calculate group match points
    const groupMatches = await query("SELECT * FROM matches WHERE stage = 'group' AND home_score IS NOT NULL");
    const pointUpdates = [];

    for (const match of groupMatches) {
      const predictions = await query(
        'SELECT * FROM predictions WHERE match_id = ? AND player_id IN (SELECT id FROM players WHERE league_id = ?)',
        [match.id, league.id]
      );

      for (const pred of predictions) {
        let points = 0;
        const hs = Number(match.home_score), as = Number(match.away_score);
        const phs = Number(pred.predicted_home_score), pas = Number(pred.predicted_away_score);

        const actualResult = hs > as ? 'H' : hs < as ? 'A' : 'D';
        const predResult = phs > pas ? 'H' : phs < pas ? 'A' : 'D';

        if (actualResult === predResult) points += 3;
        if ((hs - as) === (phs - pas)) points += 2;
        if (hs === phs && as === pas) points += 3;

        pointUpdates.push({
          sql: 'UPDATE predictions SET points_earned = ? WHERE id = ?',
          args: [points, pred.id]
        });
      }
    }

    if (pointUpdates.length > 0) {
      // Batch in groups of 50
      for (let i = 0; i < pointUpdates.length; i += 50) {
        await batch(pointUpdates.slice(i, i + 50));
      }
    }

    // Calculate group standing points
    const groups = ['A','B','C','D','E','F','G','H','I','J','K','L'];
    const standingUpdates = [];

    for (const groupLetter of groups) {
      const countRow = await queryOne(
        "SELECT COUNT(*) as count FROM matches WHERE group_letter = ? AND stage = 'group' AND home_score IS NOT NULL",
        [groupLetter]
      );
      if (Number(countRow.count) < 6) continue;

      const actualStandings = await calculateGroupStandings(groupLetter);

      for (const player of players) {
        const preds = await query(
          'SELECT * FROM group_predictions WHERE player_id = ? AND group_letter = ? ORDER BY position',
          [player.id, groupLetter]
        );

        for (const pred of preds) {
          let points = 0;
          const actualPos = actualStandings.findIndex(s => s.teamId === Number(pred.team_id));
          if (actualPos === -1) continue;

          if (actualPos + 1 === Number(pred.position)) {
            points = 4;
          } else if (Number(pred.position) <= 2 && actualPos < 2) {
            points = 2;
          } else if (Number(pred.position) === 3 && actualPos === 2) {
            points = 2;
          }

          standingUpdates.push({
            sql: 'UPDATE group_predictions SET points_earned = ? WHERE id = ?',
            args: [points, pred.id]
          });
        }
      }
    }

    if (standingUpdates.length > 0) {
      for (let i = 0; i < standingUpdates.length; i += 50) {
        await batch(standingUpdates.slice(i, i + 50));
      }
    }

    // Calculate knockout match points
    const knockoutMatches = await query("SELECT * FROM matches WHERE stage != 'group' AND home_score IS NOT NULL");
    const koUpdates = [];

    for (const match of knockoutMatches) {
      const multiplier = ROUND_MULTIPLIERS[match.stage] || 1.0;
      const predictions = await query(
        'SELECT * FROM predictions WHERE match_id = ? AND player_id IN (SELECT id FROM players WHERE league_id = ?)',
        [match.id, league.id]
      );

      for (const pred of predictions) {
        let basePoints = 0;

        if (pred.predicted_winner_id && match.winner_team_id &&
            Number(pred.predicted_winner_id) === Number(match.winner_team_id)) {
          basePoints += 4;
        }

        if (pred.predicted_home_score !== null && pred.predicted_away_score !== null &&
            match.home_score !== null && match.away_score !== null) {
          const hs = Number(match.home_score), as = Number(match.away_score);
          const phs = Number(pred.predicted_home_score), pas = Number(pred.predicted_away_score);

          const actualResult90 = hs > as ? 'H' : hs < as ? 'A' : 'D';
          const predResult90 = phs > pas ? 'H' : phs < pas ? 'A' : 'D';

          if (actualResult90 === predResult90) basePoints += 3;
          if (phs === hs && pas === as) basePoints += 3;
        }

        if (match.extra_time && pred.predicted_extra_time) basePoints += 2;
        if (match.penalties && pred.predicted_penalties) basePoints += 3;

        const finalPoints = Math.floor(basePoints * multiplier);
        koUpdates.push({
          sql: 'UPDATE predictions SET points_earned = ? WHERE id = ?',
          args: [finalPoints, pred.id]
        });
      }
    }

    if (koUpdates.length > 0) {
      for (let i = 0; i < koUpdates.length; i += 50) {
        await batch(koUpdates.slice(i, i + 50));
      }
    }

    res.json({ ok: true, message: 'Points recalculated' });
  } catch (err) {
    console.error('Calculate points error:', err);
    res.status(500).json({ error: 'Failed to calculate points' });
  }
});

// GET /api/leagues/:id/leaderboard
router.get('/leagues/:id/leaderboard', async (req, res) => {
  try {
    const league = await queryOne('SELECT * FROM leagues WHERE id = ?', [req.params.id]);
    if (!league) return res.status(404).json({ error: 'League not found' });

    const players = await query('SELECT * FROM players WHERE league_id = ?', [league.id]);

    const leaderboard = [];
    for (const player of players) {
      const gmp = await queryOne(`
        SELECT COALESCE(SUM(p.points_earned), 0) as total
        FROM predictions p JOIN matches m ON p.match_id = m.id
        WHERE p.player_id = ? AND m.stage = 'group'
      `, [player.id]);

      const gsp = await queryOne(
        'SELECT COALESCE(SUM(points_earned), 0) as total FROM group_predictions WHERE player_id = ?',
        [player.id]
      );

      const kop = await queryOne(`
        SELECT COALESCE(SUM(p.points_earned), 0) as total
        FROM predictions p JOIN matches m ON p.match_id = m.id
        WHERE p.player_id = ? AND m.stage != 'group'
      `, [player.id]);

      const groupMatchPoints = Number(gmp.total);
      const groupStandingPoints = Number(gsp.total);
      const knockoutPoints = Number(kop.total);
      const totalPoints = groupMatchPoints + groupStandingPoints + knockoutPoints;

      const gmpc = await queryOne(`
        SELECT COUNT(*) as count FROM predictions p
        JOIN matches m ON p.match_id = m.id
        WHERE p.player_id = ? AND m.stage = 'group'
      `, [player.id]);

      const gspc = await queryOne(
        'SELECT COUNT(*) as count FROM group_predictions WHERE player_id = ?',
        [player.id]
      );

      const kopc = await queryOne(`
        SELECT COUNT(*) as count FROM predictions p
        JOIN matches m ON p.match_id = m.id
        WHERE p.player_id = ? AND m.stage != 'group'
      `, [player.id]);

      leaderboard.push({
        playerId: player.id,
        displayName: player.display_name,
        isCreator: player.is_creator,
        groupMatchPoints, groupStandingPoints, knockoutPoints, totalPoints,
        predictions: {
          groupMatches: Number(gmpc.count),
          groupStandings: Number(gspc.count),
          knockout: Number(kopc.count)
        }
      });
    }

    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));

    let rank = 1;
    leaderboard.forEach((entry, i) => {
      if (i > 0 && entry.totalPoints < leaderboard[i - 1].totalPoints) rank = i + 1;
      entry.rank = rank;
    });

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

module.exports = router;
