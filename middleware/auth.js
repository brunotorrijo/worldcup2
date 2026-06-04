const jwt = require('jsonwebtoken');
const { queryOne } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'worldcup2026-dev-secret';

/**
 * Middleware: requires a logged-in creator user (via JWT cookie).
 */
function requireCreator(req, res, next) {
  const token = req.cookies && req.cookies.creator_token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

/**
 * Middleware: identifies a player via the 'player_token' cookie.
 * Does NOT reject if no token found — just sets req.player = null.
 */
async function identifyPlayer(req, res, next) {
  const token = req.cookies && req.cookies.player_token;

  if (!token) {
    req.player = null;
    return next();
  }

  try {
    const player = await queryOne('SELECT * FROM players WHERE session_token = ?', [token]);
    req.player = player || null;
  } catch (err) {
    req.player = null;
  }

  next();
}

/**
 * Create a JWT token for a creator user.
 */
function createCreatorToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = { requireCreator, identifyPlayer, createCreatorToken, JWT_SECRET };
