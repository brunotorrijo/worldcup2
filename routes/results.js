const express = require('express');
const { query, queryOne, execute, batch } = require('../db/database');
const { requireCreator } = require('../middleware/auth');
const router = express.Router();

const ROUND_MULTIPLIERS = {
  'R32': 2.0, 'R16': 2.5, 'QF': 3.0,
  'SF': 4.5, '3RD': 3.0, 'FINAL': 6.0
};
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

    // Bracket Auto-Advancement Logic
    if (match.stage !== 'group') {
      const progression = KNOCKOUT_PROGRESSION[match.match_number];
      if (progression) {
        // Advance Winner to next match (or clear if null)
        const slotCol = progression.slot === 'home' ? 'home_team_id' : 'away_team_id';
        await execute(`UPDATE matches SET ${slotCol} = ? WHERE match_number = ?`, [
          winnerTeamId, progression.nextMatch
        ]);

        // If it's a Semifinal, also advance the Loser to the 3rd place match (or clear if null)
        if (progression.thirdPlaceMatch) {
          let loserTeamId = null;
          if (winnerTeamId) {
            if (Number(winnerTeamId) === Number(match.home_team_id)) {
              loserTeamId = match.away_team_id;
            } else if (Number(winnerTeamId) === Number(match.away_team_id)) {
              loserTeamId = match.home_team_id;
            }
          }
          const thirdSlotCol = progression.thirdPlaceSlot === 'home' ? 'home_team_id' : 'away_team_id';
          await execute(`UPDATE matches SET ${thirdSlotCol} = ? WHERE match_number = ?`, [
            loserTeamId, progression.thirdPlaceMatch
          ]);
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Save result error:', err);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

// POST /api/reset-knockout — Completely reset the knockout bracket from R16 onwards
router.post('/reset-knockout', requireCreator, async (req, res) => {
  try {
    await execute('UPDATE matches SET home_team_id = NULL, away_team_id = NULL WHERE match_number >= 89');
    res.json({ ok: true, message: 'Bracket reset to TBD' });
  } catch (err) {
    console.error('Reset knockout error:', err);
    res.status(500).json({ error: 'Failed to reset bracket' });
  }
});

// POST /api/populate-knockout — Populate R32 bracket with qualified teams (one-time use)
router.post('/populate-knockout', requireCreator, async (req, res) => {
  try {
    const R32_MATCHUPS = {
      73: ['RSA', 'CAN'],   // South Africa vs Canada
      74: ['GER', 'PAR'],   // Germany vs Paraguay
      75: ['NED', 'MAR'],   // Netherlands vs Morocco
      76: ['BRA', 'JPN'],   // Brazil vs Japan
      77: ['FRA', 'SWE'],   // France vs Sweden
      78: ['CIV', 'NOR'],   // Côte d'Ivoire vs Norway
      79: ['MEX', 'ECU'],   // Mexico vs Ecuador
      80: ['ENG', 'COD'],   // England vs DR Congo
      81: ['BEL', 'SEN'],   // Belgium vs Senegal
      82: ['USA', 'BIH'],   // United States vs Bosnia & Herzegovina
      83: ['ESP', 'AUT'],   // Spain vs Austria
      84: ['POR', 'CRO'],   // Portugal vs Croatia
      85: ['SUI', 'ALG'],   // Switzerland vs Algeria
      86: ['ARG', 'CPV'],   // Argentina vs Cape Verde
      87: ['COL', 'GHA'],   // Colombia vs Ghana
      88: ['AUS', 'EGY'],   // Australia vs Egypt
    };

    const teams = await query('SELECT id, code FROM teams');
    const teamsByCode = {};
    teams.forEach(t => { teamsByCode[t.code] = t.id; });

    const updates = [];
    for (const [matchNum, [homeCode, awayCode]] of Object.entries(R32_MATCHUPS)) {
      const homeId = teamsByCode[homeCode];
      const awayId = teamsByCode[awayCode];
      if (!homeId || !awayId) continue;
      updates.push({
        sql: 'UPDATE matches SET home_team_id = ?, away_team_id = ? WHERE match_number = ?',
        args: [homeId, awayId, parseInt(matchNum)]
      });
    }

    if (updates.length > 0) {
      await batch(updates);
    }

    res.json({ ok: true, message: `Updated ${updates.length} R32 matches` });
  } catch (err) {
    console.error('Populate knockout error:', err);
    res.status(500).json({ error: 'Failed to populate knockout bracket' });
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
            points = 10;
          } else if (Number(pred.position) <= 3 && actualPos < 3) {
            points = 5;
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
    const allKnockoutMatches = await query("SELECT * FROM matches WHERE stage != 'group' ORDER BY match_number");
    const allPredictions = await query("SELECT * FROM predictions WHERE match_id IN (SELECT id FROM matches WHERE stage != 'group') AND player_id IN (SELECT id FROM players WHERE league_id = ?)", [league.id]);
    
    // Build derived bracket for each player to determine their predicted matchups
    const playerBrackets = {};
    for (const p of players) {
      const pPreds = allPredictions.filter(pr => Number(pr.player_id) === Number(p.id));
      const draft = {};
      pPreds.forEach(pr => { draft[pr.match_id] = pr.predicted_winner_id; });
      
      const derived = JSON.parse(JSON.stringify(allKnockoutMatches));
      const mByNum = {};
      derived.forEach(m => mByNum[m.match_number] = m);

      derived.forEach(match => {
        const winnerId = draft[match.id];
        if (winnerId && (Number(winnerId) === Number(match.home_team_id) || Number(winnerId) === Number(match.away_team_id))) {
          const prog = KNOCKOUT_PROGRESSION[match.match_number];
          if (prog && mByNum[prog.nextMatch]) {
            const nextM = mByNum[prog.nextMatch];
            const slotCol = prog.slot === 'home' ? 'home_team_id' : 'away_team_id';
            nextM[slotCol] = winnerId;
            
            if (prog.thirdPlaceMatch && mByNum[prog.thirdPlaceMatch]) {
              const thirdM = mByNum[prog.thirdPlaceMatch];
              const thirdSlotCol = prog.thirdPlaceSlot === 'home' ? 'home_team_id' : 'away_team_id';
              const isHomeWinner = Number(winnerId) === Number(match.home_team_id);
              const loserId = isHomeWinner ? match.away_team_id : match.home_team_id;
              if (loserId) thirdM[thirdSlotCol] = loserId;
            }
          }
        }
      });
      playerBrackets[p.id] = derived;
    }

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

        // Ensure they correctly predicted at least one team in this match
        if (match.stage !== 'R32') {
          const pBracket = playerBrackets[pred.player_id];
          const pMatch = pBracket.find(m => m.id === pred.match_id);
          
          if (pMatch) {
            const predictedHome = pMatch.home_team_id;
            const predictedAway = pMatch.away_team_id;
            const realHome = match.home_team_id;
            const realAway = match.away_team_id;
            
            const hasOneCorrectTeam = (predictedHome && (Number(predictedHome) === Number(realHome) || Number(predictedHome) === Number(realAway))) ||
                                      (predictedAway && (Number(predictedAway) === Number(realHome) || Number(predictedAway) === Number(realAway)));
                                      
            if (!hasOneCorrectTeam) {
              koUpdates.push({
                sql: 'UPDATE predictions SET points_earned = 0 WHERE id = ?',
                args: [pred.id]
              });
              continue; // 0 points, they didn't predict either team
            }
          }
        }

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

        let finalPoints = Math.floor(basePoints * multiplier);

        // Manual override: Force 0 points for Player 28 on the R16 games he missed
        if (Number(pred.player_id) === 28 && [89, 90, 92].includes(Number(match.match_number))) {
          finalPoints = 0;
        }

        // Manual override: Force 0 points for Player 19 on the R32 games he missed
        if (Number(pred.player_id) === 19 && Number(match.match_number) >= 73 && Number(match.match_number) <= 88) {
          finalPoints = 0;
        }

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
    const playerIds = players.map(p => p.id);

    if (playerIds.length > 0) {
      const placeholders = playerIds.map(() => '?').join(',');

      const [gmpRows, gspRows, kopRows, gmpcRows, gspcRows, kopcRows] = await Promise.all([
        query(`
          SELECT p.player_id, COALESCE(SUM(p.points_earned), 0) as total
          FROM predictions p JOIN matches m ON p.match_id = m.id
          WHERE p.player_id IN (${placeholders}) AND m.stage = 'group'
          GROUP BY p.player_id
        `, playerIds),
        query(`
          SELECT player_id, COALESCE(SUM(points_earned), 0) as total
          FROM group_predictions
          WHERE player_id IN (${placeholders})
          GROUP BY player_id
        `, playerIds),
        query(`
          SELECT p.player_id, COALESCE(SUM(p.points_earned), 0) as total
          FROM predictions p JOIN matches m ON p.match_id = m.id
          WHERE p.player_id IN (${placeholders}) AND m.stage != 'group'
          GROUP BY p.player_id
        `, playerIds),
        query(`
          SELECT p.player_id, COUNT(*) as count
          FROM predictions p JOIN matches m ON p.match_id = m.id
          WHERE p.player_id IN (${placeholders}) AND m.stage = 'group'
          GROUP BY p.player_id
        `, playerIds),
        query(`
          SELECT player_id, COUNT(*) as count
          FROM group_predictions
          WHERE player_id IN (${placeholders})
          GROUP BY player_id
        `, playerIds),
        query(`
          SELECT p.player_id, COUNT(*) as count
          FROM predictions p JOIN matches m ON p.match_id = m.id
          WHERE p.player_id IN (${placeholders}) AND m.stage != 'group'
          GROUP BY p.player_id
        `, playerIds)
      ]);

      const gmpMap = Object.fromEntries(gmpRows.map(r => [r.player_id, Number(r.total)]));
      const gspMap = Object.fromEntries(gspRows.map(r => [r.player_id, Number(r.total)]));
      const kopMap = Object.fromEntries(kopRows.map(r => [r.player_id, Number(r.total)]));
      const gmpcMap = Object.fromEntries(gmpcRows.map(r => [r.player_id, Number(r.count)]));
      const gspcMap = Object.fromEntries(gspcRows.map(r => [r.player_id, Number(r.count)]));
      const kopcMap = Object.fromEntries(kopcRows.map(r => [r.player_id, Number(r.count)]));

      for (const player of players) {
        const groupMatchPoints = gmpMap[player.id] || 0;
        const groupStandingPoints = gspMap[player.id] || 0;
        const knockoutPoints = kopMap[player.id] || 0;
        const totalPoints = groupMatchPoints + groupStandingPoints + knockoutPoints;

        leaderboard.push({
          playerId: player.id,
          displayName: player.display_name,
          isCreator: player.is_creator,
          groupMatchPoints, groupStandingPoints, knockoutPoints, totalPoints,
          predictions: {
            groupMatches: gmpcMap[player.id] || 0,
            groupStandings: gspcMap[player.id] || 0,
            knockout: kopcMap[player.id] || 0
          }
        });
      }
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
