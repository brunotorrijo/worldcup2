const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { requireCreator, identifyPlayer } = require('../middleware/auth');
const router = express.Router();

// Hard deadline dates (same as in predictions.js)
const GROUP_STAGE_LOCK_DATE = new Date('2026-06-11T00:00:00Z');
const KNOCKOUT_LOCK_DATE = new Date('2026-06-28T00:00:00Z');

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

// POST /api/leagues — Create a new league
router.post('/', requireCreator, (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'League name is required' });
    }

    // Check if creator already has a league
    const existing = db.prepare('SELECT id FROM leagues WHERE creator_id = ?').get(req.session.userId);
    if (existing) {
      return res.status(409).json({ error: 'You already have a league. You can only create one league.' });
    }

    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const result = db.prepare(
      'INSERT INTO leagues (name, invite_code, creator_id) VALUES (?, ?, ?)'
    ).run(name.trim(), inviteCode, req.session.userId);

    const leagueId = result.lastInsertRowid;

    // Create player entry for the creator
    const token = crypto.randomBytes(32).toString('hex');
    const playerResult = db.prepare(
      'INSERT INTO players (league_id, user_id, display_name, session_token, is_creator) VALUES (?, ?, ?, ?, 1)'
    ).run(leagueId, req.session.userId, req.session.username, token);

    res.json({
      id: leagueId,
      name: name.trim(),
      inviteCode,
      playerId: playerResult.lastInsertRowid,
      playerToken: token
    });
  } catch (err) {
    console.error('Create league error:', err);
    res.status(500).json({ error: 'Failed to create league' });
  }
});

// GET /api/leagues/invite/:code — Lookup league by invite code
router.get('/invite/:code', (req, res) => {
  try {
    const league = db.prepare('SELECT id, name, invite_code, created_at FROM leagues WHERE invite_code = ?')
      .get(req.params.code.toUpperCase());

    if (!league) {
      return res.status(404).json({ error: 'League not found. Check your invite code.' });
    }

    const playerCount = db.prepare('SELECT COUNT(*) as count FROM players WHERE league_id = ?')
      .get(league.id).count;

    res.json({ ...league, playerCount });
  } catch (err) {
    console.error('Invite lookup error:', err);
    res.status(500).json({ error: 'Failed to lookup league' });
  }
});

// GET /api/leagues/:id — Get full league info
router.get('/:id', (req, res) => {
  try {
    const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    const teams = db.prepare('SELECT * FROM teams ORDER BY group_letter, id').all();
    const matches = db.prepare(`
      SELECT m.*,
        ht.name as home_team_name, ht.code as home_team_code, ht.flag_emoji as home_flag,
        at.name as away_team_name, at.code as away_team_code, at.flag_emoji as away_flag
      FROM matches m
      LEFT JOIN teams ht ON m.home_team_id = ht.id
      LEFT JOIN teams at ON m.away_team_id = at.id
      ORDER BY m.match_number
    `).all();

    const players = db.prepare(
      'SELECT id, display_name, is_creator, created_at FROM players WHERE league_id = ?'
    ).all(league.id);

    // Group teams by group letter
    const groups = {};
    teams.forEach(t => {
      if (!groups[t.group_letter]) groups[t.group_letter] = [];
      groups[t.group_letter].push(t);
    });

    res.json({
      ...league,
      group_predictions_locked: isGroupStageLocked(league) ? 1 : 0,
      knockout_predictions_locked: isKnockoutLocked(league) ? 1 : 0,
      group_lock_deadline: GROUP_STAGE_LOCK_DATE.toISOString(),
      knockout_lock_deadline: KNOCKOUT_LOCK_DATE.toISOString(),
      groups,
      matches,
      players
    });
  } catch (err) {
    console.error('Get league error:', err);
    res.status(500).json({ error: 'Failed to get league' });
  }
});

// POST /api/leagues/:id/join — Join a league
router.post('/:id/join', (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    // Check for duplicate name in this league
    const dupName = db.prepare(
      'SELECT id FROM players WHERE league_id = ? AND display_name = ?'
    ).get(league.id, displayName.trim());
    if (dupName) {
      return res.status(409).json({ error: 'That name is already taken in this league' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const result = db.prepare(
      'INSERT INTO players (league_id, display_name, session_token) VALUES (?, ?, ?)'
    ).run(league.id, displayName.trim(), token);

    // Set cookie
    res.cookie('player_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      playerId: result.lastInsertRowid,
      displayName: displayName.trim(),
      leagueId: league.id,
      leagueName: league.name,
      token
    });
  } catch (err) {
    console.error('Join league error:', err);
    res.status(500).json({ error: 'Failed to join league' });
  }
});

// GET /api/leagues/:id/players — List all players
router.get('/:id/players', (req, res) => {
  try {
    const players = db.prepare(
      'SELECT id, display_name, is_creator, created_at FROM players WHERE league_id = ? ORDER BY created_at'
    ).all(req.params.id);
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get players' });
  }
});

// PUT /api/leagues/:id/players/:playerId — Edit player name
router.put('/:id/players/:playerId', requireCreator, (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    db.prepare('UPDATE players SET display_name = ? WHERE id = ? AND league_id = ?')
      .run(displayName.trim(), req.params.playerId, req.params.id);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// DELETE /api/leagues/:id/players/:playerId — Remove player
router.delete('/:id/players/:playerId', requireCreator, (req, res) => {
  try {
    // Don't allow deleting the creator
    const player = db.prepare('SELECT * FROM players WHERE id = ? AND league_id = ?')
      .get(req.params.playerId, req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    if (player.is_creator) {
      return res.status(403).json({ error: 'Cannot remove the league creator' });
    }

    // Delete predictions first
    db.prepare('DELETE FROM predictions WHERE player_id = ?').run(req.params.playerId);
    db.prepare('DELETE FROM group_predictions WHERE player_id = ?').run(req.params.playerId);
    db.prepare('DELETE FROM players WHERE id = ?').run(req.params.playerId);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove player' });
  }
});

// PUT /api/leagues/:id/lock — Lock/unlock predictions
router.put('/:id/lock', requireCreator, (req, res) => {
  try {
    const { groupLocked, knockoutLocked } = req.body;

    if (groupLocked !== undefined) {
      db.prepare('UPDATE leagues SET group_predictions_locked = ? WHERE id = ?')
        .run(groupLocked ? 1 : 0, req.params.id);
    }
    if (knockoutLocked !== undefined) {
      db.prepare('UPDATE leagues SET knockout_predictions_locked = ? WHERE id = ?')
        .run(knockoutLocked ? 1 : 0, req.params.id);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lock state' });
  }
});

module.exports = router;
