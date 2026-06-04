const express = require('express');
const bcrypt = require('bcryptjs');
const { queryOne, execute } = require('../db/database');
const { createCreatorToken } = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
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

    const existing = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);

    const token = createCreatorToken(result.lastInsertRowid, username);
    res.cookie('creator_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({ id: result.lastInsertRowid, username });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await queryOne('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = createCreatorToken(user.id, user.username);
    res.cookie('creator_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    // Check if user has a league
    const league = await queryOne('SELECT * FROM leagues WHERE creator_id = ?', [user.id]);
    const player = league
      ? await queryOne('SELECT * FROM players WHERE league_id = ? AND user_id = ?', [league.id, user.id])
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
  res.clearCookie('creator_token');
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const token = req.cookies && req.cookies.creator_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await queryOne('SELECT id, username FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const league = await queryOne('SELECT * FROM leagues WHERE creator_id = ?', [user.id]);
    const player = league
      ? await queryOne('SELECT * FROM players WHERE league_id = ? AND user_id = ?', [league.id, user.id])
      : null;

    res.json({
      id: user.id,
      username: user.username,
      league: league ? { id: league.id, name: league.name, inviteCode: league.invite_code } : null,
      playerId: player ? player.id : null
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(401).json({ error: 'Session expired' });
  }
});

module.exports = router;
