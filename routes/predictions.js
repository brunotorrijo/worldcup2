const express = require('express');
const { query, queryOne, execute, batch } = require('../db/database');
const { identifyPlayer } = require('../middleware/auth');
const router = express.Router();

const GROUP_STAGE_LOCK_DATE = new Date('2026-06-11T19:00:00Z');
const KNOCKOUT_LOCK_DATE = new Date('2026-06-28T19:00:00Z');

function isGroupStageLocked(league) {
  if (league.group_predictions_locked) return true;
  if (new Date() >= GROUP_STAGE_LOCK_DATE) return true;
  return false;
}

function isKnockoutLocked(league) {
  if (league.knockout_predictions_locked) return true;
  if (new Date() >= KNOCKOUT_LOCK_DATE) return true;
  return false;
}

// GET /api/leagues/:id/predictions/groups/:playerId
router.get('/:id/predictions/groups/:playerId', async (req, res) => {
  try {
    const matchPredictions = await query(`
      SELECT p.*, m.group_letter, m.home_team_id, m.away_team_id
      FROM predictions p
      JOIN matches m ON p.match_id = m.id
      WHERE p.player_id = ? AND m.stage = 'group'
    `, [req.params.playerId]);

    const groupPredictions = await query(
      'SELECT * FROM group_predictions WHERE player_id = ? ORDER BY group_letter, position',
      [req.params.playerId]
    );

    res.json({ matchPredictions, groupPredictions });
  } catch (err) {
    console.error('Get group predictions error:', err);
    res.status(500).json({ error: 'Failed to get predictions' });
  }
});

// POST /api/leagues/:id/predictions/groups
router.post('/:id/predictions/groups', identifyPlayer, async (req, res) => {
  try {
    const league = await queryOne('SELECT * FROM leagues WHERE id = ?', [req.params.id]);
    if (!league) return res.status(404).json({ error: 'League not found' });

    if (isGroupStageLocked(league)) {
      return res.status(403).json({ error: 'Group stage predictions are locked. The deadline has passed.' });
    }

    const tokenPlayerId = req.player && req.player.id;
    if (!tokenPlayerId) return res.status(401).json({ error: 'Player not authenticated' });
    if (req.body.playerId && parseInt(req.body.playerId) !== parseInt(tokenPlayerId)) {
      return res.status(403).json({ error: 'Cannot submit predictions for another player' });
    }
    const playerId = tokenPlayerId;

    const player = await queryOne(
      'SELECT * FROM players WHERE id = ? AND league_id = ?',
      [playerId, req.params.id]
    );
    if (!player) return res.status(403).json({ error: 'Player not in this league' });

    const { matchPredictions, groupPredictions } = req.body;
    const statements = [];

    if (matchPredictions && Array.isArray(matchPredictions)) {
      for (const p of matchPredictions) {
        if (p.homeScore !== null && p.homeScore !== undefined &&
            p.awayScore !== null && p.awayScore !== undefined) {
          statements.push({
            sql: `INSERT INTO predictions (player_id, match_id, predicted_home_score, predicted_away_score)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT(player_id, match_id) DO UPDATE SET
                    predicted_home_score = excluded.predicted_home_score,
                    predicted_away_score = excluded.predicted_away_score`,
            args: [playerId, p.matchId, p.homeScore, p.awayScore]
          });
        }
      }
    }
    if (groupPredictions && Array.isArray(groupPredictions)) {
      for (const g of groupPredictions) {
        if (g.teamId) {
          statements.push({
            sql: `INSERT INTO group_predictions (player_id, group_letter, position, team_id)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT(player_id, group_letter, position) DO UPDATE SET
                    team_id = excluded.team_id`,
            args: [playerId, g.groupLetter, g.position, g.teamId]
          });
        }
      }
    }

    if (statements.length > 0) {
      await batch(statements);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Save group predictions error:', err);
    res.status(500).json({ error: 'Failed to save predictions' });
  }
});

// GET /api/leagues/:id/predictions/knockout/:playerId
router.get('/:id/predictions/knockout/:playerId', async (req, res) => {
  try {
    const predictions = await query(`
      SELECT p.*, m.stage, m.bracket_position, m.home_team_id, m.away_team_id
      FROM predictions p
      JOIN matches m ON p.match_id = m.id
      WHERE p.player_id = ? AND m.stage != 'group'
    `, [req.params.playerId]);

    res.json({ predictions });
  } catch (err) {
    console.error('Get knockout predictions error:', err);
    res.status(500).json({ error: 'Failed to get predictions' });
  }
});

// POST /api/leagues/:id/predictions/knockout
router.post('/:id/predictions/knockout', identifyPlayer, async (req, res) => {
  try {
    const league = await queryOne('SELECT * FROM leagues WHERE id = ?', [req.params.id]);
    if (!league) return res.status(404).json({ error: 'League not found' });

    if (isKnockoutLocked(league)) {
      return res.status(403).json({ error: 'Knockout predictions are locked. The deadline has passed.' });
    }

    const tokenPlayerId = req.player && req.player.id;
    if (!tokenPlayerId) return res.status(401).json({ error: 'Player not authenticated' });
    if (req.body.playerId && parseInt(req.body.playerId) !== parseInt(tokenPlayerId)) {
      return res.status(403).json({ error: 'Cannot submit predictions for another player' });
    }
    const playerId = tokenPlayerId;

    const player = await queryOne(
      'SELECT * FROM players WHERE id = ? AND league_id = ?',
      [playerId, req.params.id]
    );
    if (!player) return res.status(403).json({ error: 'Player not in this league' });

    const { predictions } = req.body;
    const statements = [];

    if (predictions && Array.isArray(predictions)) {
      for (const p of predictions) {
        statements.push({
          sql: `INSERT INTO predictions (player_id, match_id, predicted_home_score, predicted_away_score,
                  predicted_extra_time, predicted_penalties, predicted_winner_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(player_id, match_id) DO UPDATE SET
                  predicted_home_score = excluded.predicted_home_score,
                  predicted_away_score = excluded.predicted_away_score,
                  predicted_extra_time = excluded.predicted_extra_time,
                  predicted_penalties = excluded.predicted_penalties,
                  predicted_winner_id = excluded.predicted_winner_id`,
          args: [
            playerId, p.matchId,
            p.homeScore ?? null, p.awayScore ?? null,
            p.extraTime ? 1 : 0, p.penalties ? 1 : 0,
            p.winnerId || null
          ]
        });
      }
    }

    if (statements.length > 0) {
      await batch(statements);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Save knockout predictions error:', err);
    res.status(500).json({ error: 'Failed to save predictions' });
  }
});

module.exports = router;
