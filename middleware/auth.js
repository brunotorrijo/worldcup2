const db = require('../db/database');

/**
 * Middleware: requires a logged-in creator user (via session).
 */
function requireCreator(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

/**
 * Middleware: identifies a player via the 'player_token' cookie.
 * Does NOT reject if no token found — just sets req.player = null.
 */
function identifyPlayer(req, res, next) {
  const token = req.cookies && req.cookies.player_token;

  if (!token) {
    req.player = null;
    return next();
  }

  try {
    const player = db.prepare('SELECT * FROM players WHERE session_token = ?').get(token);
    req.player = player || null;
  } catch (err) {
    req.player = null;
  }

  next();
}

module.exports = { requireCreator, identifyPlayer };
