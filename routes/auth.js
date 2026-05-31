const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);

    req.session.userId = result.lastInsertRowid;
    req.session.username = username;

    res.json({ id: result.lastInsertRowid, username });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    // Check if user has a league
    const league = db.prepare('SELECT * FROM leagues WHERE creator_id = ?').get(user.id);
    const player = league
      ? db.prepare('SELECT * FROM players WHERE league_id = ? AND user_id = ?').get(league.id, user.id)
      : null;

    res.json({
      id: user.id,
      username: user.username,
      league: league ? { id: league.id, name: league.name, inviteCode: league.invite_code } : null,
      playerId: player ? player.id : null
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const league = db.prepare('SELECT * FROM leagues WHERE creator_id = ?').get(user.id);
  const player = league
    ? db.prepare('SELECT * FROM players WHERE league_id = ? AND user_id = ?').get(league.id, user.id)
    : null;

  res.json({
    id: user.id,
    username: user.username,
    league: league ? { id: league.id, name: league.name, inviteCode: league.invite_code } : null,
    playerId: player ? player.id : null
  });
});

module.exports = router;
