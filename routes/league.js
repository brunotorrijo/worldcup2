const express = require('express');
const crypto = require('crypto');
const { query, queryOne, execute } = require('../db/database');
const { requireCreator, identifyPlayer } = require('../middleware/auth');
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

// POST /api/leagues — Create a new league
router.post('/', requireCreator, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'League name is required' });
    }

    const existing = await queryOne('SELECT id FROM leagues WHERE creator_id = ?', [req.userId]);
    if (existing) {
      return res.status(409).json({ error: 'You already have a league. You can only create one league.' });
    }

    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const result = await execute(
      'INSERT INTO leagues (name, invite_code, creator_id) VALUES (?, ?, ?)',
      [name.trim(), inviteCode, req.userId]
    );
    const leagueId = result.lastInsertRowid;

    const token = crypto.randomBytes(32).toString('hex');
    const playerResult = await execute(
      'INSERT INTO players (league_id, user_id, display_name, session_token, is_creator) VALUES (?, ?, ?, ?, 1)',
      [leagueId, req.userId, req.username, token]
    );

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

// GET /api/leagues/invite/:code
router.get('/invite/:code', async (req, res) => {
  try {
    const league = await queryOne(
      'SELECT id, name, invite_code, created_at FROM leagues WHERE invite_code = ?',
      [req.params.code.toUpperCase()]
    );
    if (!league) {
      return res.status(404).json({ error: 'League not found. Check your invite code.' });
    }

    const countRow = await queryOne('SELECT COUNT(*) as count FROM players WHERE league_id = ?', [league.id]);
    res.json({ ...league, playerCount: Number(countRow.count) });
  } catch (err) {
    console.error('Invite lookup error:', err);
    res.status(500).json({ error: 'Failed to lookup league' });
  }
});

// GET /api/leagues/:id
router.get('/:id', async (req, res) => {
  try {
    const league = await queryOne('SELECT * FROM leagues WHERE id = ?', [req.params.id]);
    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    const [teams, matches, players] = await Promise.all([
      query('SELECT * FROM teams ORDER BY group_letter, id'),
      query(`
        SELECT m.*,
          ht.name as home_team_name, ht.code as home_team_code, ht.flag_emoji as home_flag,
          at.name as away_team_name, at.code as away_team_code, at.flag_emoji as away_flag
        FROM matches m
        LEFT JOIN teams ht ON m.home_team_id = ht.id
        LEFT JOIN teams at ON m.away_team_id = at.id
        ORDER BY m.match_number
      `),
      query(
        'SELECT id, display_name, is_creator, created_at FROM players WHERE league_id = ? ORDER BY created_at',
        [league.id]
      )
    ]);

    const groups = {};
    teams.forEach(t => {
      if (!groups[t.group_letter]) groups[t.group_letter] = [];
      groups[t.group_letter].push(t);
    });

    // Enrich players with prediction progress (bulk queries to avoid N+1)
    const groupMatchCount = matches.filter(m => m.stage === 'group').length;
    const groupStandingCount = Object.keys(groups).length * 3;

    const playerIds = players.map(p => p.id);

    if (playerIds.length > 0) {
      const placeholders = playerIds.map(() => '?').join(',');

      const [mpRows, gpRows, kpRows] = await Promise.all([
        query(`
          SELECT p.player_id, COUNT(*) as count FROM predictions p
          JOIN matches m ON p.match_id = m.id
          WHERE p.player_id IN (${placeholders}) AND m.stage = 'group'
          GROUP BY p.player_id
        `, playerIds),
        query(`
          SELECT player_id, COUNT(*) as count FROM group_predictions
          WHERE player_id IN (${placeholders}) AND position <= 3
          GROUP BY player_id
        `, playerIds),
        query(`
          SELECT p.player_id, COUNT(*) as count FROM predictions p
          JOIN matches m ON p.match_id = m.id
          WHERE p.player_id IN (${placeholders}) AND m.stage != 'group'
          GROUP BY p.player_id
        `, playerIds)
      ]);

      const mpMap = Object.fromEntries(mpRows.map(r => [r.player_id, Number(r.count)]));
      const gpMap = Object.fromEntries(gpRows.map(r => [r.player_id, Number(r.count)]));
      const kpMap = Object.fromEntries(kpRows.map(r => [r.player_id, Number(r.count)]));

      for (const player of players) {
        player.predictionProgress = {
          groupMatches: mpMap[player.id] || 0,
          groupMatchesTotal: groupMatchCount,
          groupStandings: gpMap[player.id] || 0,
          groupStandingsTotal: groupStandingCount,
          knockout: kpMap[player.id] || 0
        };
      }
    }

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

// POST /api/leagues/:id/join
router.post('/:id/join', async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const league = await queryOne('SELECT * FROM leagues WHERE id = ?', [req.params.id]);
    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    const dupName = await queryOne(
      'SELECT id FROM players WHERE league_id = ? AND display_name = ?',
      [league.id, displayName.trim()]
    );
    if (dupName) {
      return res.status(409).json({ error: 'That name is already taken in this league' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const result = await execute(
      'INSERT INTO players (league_id, display_name, session_token) VALUES (?, ?, ?)',
      [league.id, displayName.trim(), token]
    );

    res.cookie('player_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
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

// GET /api/leagues/:id/players
router.get('/:id/players', async (req, res) => {
  try {
    const players = await query(
      'SELECT id, display_name, is_creator, created_at FROM players WHERE league_id = ? ORDER BY created_at',
      [req.params.id]
    );
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get players' });
  }
});

// PUT /api/leagues/:id/players/:playerId
router.put('/:id/players/:playerId', requireCreator, async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    await execute(
      'UPDATE players SET display_name = ? WHERE id = ? AND league_id = ?',
      [displayName.trim(), req.params.playerId, req.params.id]
    );

    const player = await queryOne('SELECT user_id FROM players WHERE id = ?', [req.params.playerId]);
    if (player && player.user_id) {
      await execute('UPDATE users SET username = ? WHERE id = ?', [displayName.trim(), player.user_id]);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// DELETE /api/leagues/:id/players/:playerId
router.delete('/:id/players/:playerId', requireCreator, async (req, res) => {
  try {
    const player = await queryOne(
      'SELECT * FROM players WHERE id = ? AND league_id = ?',
      [req.params.playerId, req.params.id]
    );
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (player.is_creator) return res.status(403).json({ error: 'Cannot remove the league creator' });

    await execute('DELETE FROM predictions WHERE player_id = ?', [req.params.playerId]);
    await execute('DELETE FROM group_predictions WHERE player_id = ?', [req.params.playerId]);
    await execute('DELETE FROM players WHERE id = ?', [req.params.playerId]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove player' });
  }
});

// PUT /api/leagues/:id/lock
router.put('/:id/lock', requireCreator, async (req, res) => {
  try {
    const { groupLocked, knockoutLocked } = req.body;

    if (groupLocked !== undefined) {
      await execute('UPDATE leagues SET group_predictions_locked = ? WHERE id = ?',
        [groupLocked ? 1 : 0, req.params.id]);
    }
    if (knockoutLocked !== undefined) {
      await execute('UPDATE leagues SET knockout_predictions_locked = ? WHERE id = ?',
        [knockoutLocked ? 1 : 0, req.params.id]);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lock state' });
  }
});

module.exports = router;
