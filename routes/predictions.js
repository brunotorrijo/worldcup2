const express = require('express');
const db = require('../db/database');
const { identifyPlayer } = require('../middleware/auth');
const router = express.Router();

// Hard deadline dates (UTC) — predictions auto-lock regardless of manual toggle
const GROUP_STAGE_LOCK_DATE = new Date('2026-06-11T00:00:00Z');  // First match kickoff day
const KNOCKOUT_LOCK_DATE = new Date('2026-06-28T00:00:00Z');      // First knockout match day

function isGroupStageLocked(league) {
  // Locked if EITHER the manual toggle is on OR the deadline has passed
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
router.get('/:id/predictions/groups/:playerId', (req, res) => {
  try {
    const matchPredictions = db.prepare(`
      SELECT p.*, m.group_letter, m.home_team_id, m.away_team_id
      FROM predictions p
      JOIN matches m ON p.match_id = m.id
      WHERE p.player_id = ? AND m.stage = 'group'
    `).all(req.params.playerId);

    const groupPredictions = db.prepare(
      'SELECT * FROM group_predictions WHERE player_id = ? ORDER BY group_letter, position'
    ).all(req.params.playerId);

    res.json({ matchPredictions, groupPredictions });
  } catch (err) {
    console.error('Get group predictions error:', err);
    res.status(500).json({ error: 'Failed to get predictions' });
  }
});

// POST /api/leagues/:id/predictions/groups
router.post('/:id/predictions/groups', identifyPlayer, (req, res) => {
  try {
    const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });

    // ---- HARD LOCK CHECK ----
    if (isGroupStageLocked(league)) {
      return res.status(403).json({ error: 'Group stage predictions are locked. The deadline has passed.' });
    }

    // Identify player from body or middleware
    const playerId = req.body.playerId || (req.player && req.player.id);
    if (!playerId) return res.status(401).json({ error: 'Player not identified' });

    // Verify player belongs to league
    const player = db.prepare('SELECT * FROM players WHERE id = ? AND league_id = ?')
      .get(playerId, req.params.id);
    if (!player) return res.status(403).json({ error: 'Player not in this league' });

    const { matchPredictions, groupPredictions } = req.body;

    const upsertMatch = db.prepare(`
      INSERT INTO predictions (player_id, match_id, predicted_home_score, predicted_away_score)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(player_id, match_id) DO UPDATE SET
        predicted_home_score = excluded.predicted_home_score,
        predicted_away_score = excluded.predicted_away_score
    `);

    const upsertGroup = db.prepare(`
      INSERT INTO group_predictions (player_id, group_letter, position, team_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(player_id, group_letter, position) DO UPDATE SET
        team_id = excluded.team_id
    `);

    const transaction = db.transaction(() => {
      if (matchPredictions && Array.isArray(matchPredictions)) {
        for (const p of matchPredictions) {
          if (p.homeScore !== null && p.homeScore !== undefined &&
              p.awayScore !== null && p.awayScore !== undefined) {
            upsertMatch.run(playerId, p.matchId, p.homeScore, p.awayScore);
          }
        }
      }
      if (groupPredictions && Array.isArray(groupPredictions)) {
        for (const g of groupPredictions) {
          if (g.teamId) {
            upsertGroup.run(playerId, g.groupLetter, g.position, g.teamId);
          }
        }
      }
    });

    transaction();
    res.json({ ok: true });
  } catch (err) {
    console.error('Save group predictions error:', err);
    res.status(500).json({ error: 'Failed to save predictions' });
  }
});

// GET /api/leagues/:id/predictions/knockout/:playerId
router.get('/:id/predictions/knockout/:playerId', (req, res) => {
  try {
    const predictions = db.prepare(`
      SELECT p.*, m.stage, m.bracket_position, m.home_team_id, m.away_team_id
      FROM predictions p
      JOIN matches m ON p.match_id = m.id
      WHERE p.player_id = ? AND m.stage != 'group'
    `).all(req.params.playerId);

    res.json({ predictions });
  } catch (err) {
    console.error('Get knockout predictions error:', err);
    res.status(500).json({ error: 'Failed to get predictions' });
  }
});

// POST /api/leagues/:id/predictions/knockout
router.post('/:id/predictions/knockout', identifyPlayer, (req, res) => {
  try {
    const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });

    // ---- HARD LOCK CHECK ----
    if (isKnockoutLocked(league)) {
      return res.status(403).json({ error: 'Knockout predictions are locked. The deadline has passed.' });
    }

    const playerId = req.body.playerId || (req.player && req.player.id);
    if (!playerId) return res.status(401).json({ error: 'Player not identified' });

    const player = db.prepare('SELECT * FROM players WHERE id = ? AND league_id = ?')
      .get(playerId, req.params.id);
    if (!player) return res.status(403).json({ error: 'Player not in this league' });

    const { predictions } = req.body;

    const upsert = db.prepare(`
      INSERT INTO predictions (player_id, match_id, predicted_home_score, predicted_away_score,
        predicted_extra_time, predicted_penalties, predicted_winner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player_id, match_id) DO UPDATE SET
        predicted_home_score = excluded.predicted_home_score,
        predicted_away_score = excluded.predicted_away_score,
        predicted_extra_time = excluded.predicted_extra_time,
        predicted_penalties = excluded.predicted_penalties,
        predicted_winner_id = excluded.predicted_winner_id
    `);

    const transaction = db.transaction(() => {
      if (predictions && Array.isArray(predictions)) {
        for (const p of predictions) {
          upsert.run(
            playerId, p.matchId,
            p.homeScore ?? null, p.awayScore ?? null,
            p.extraTime ? 1 : 0, p.penalties ? 1 : 0,
            p.winnerId || null
          );
        }
      }
    });

    transaction();
    res.json({ ok: true });
  } catch (err) {
    console.error('Save knockout predictions error:', err);
    res.status(500).json({ error: 'Failed to save predictions' });
  }
});

// Export lock check functions for use in league route
module.exports = router;
module.exports.isGroupStageLocked = isGroupStageLocked;
module.exports.isKnockoutLocked = isKnockoutLocked;
