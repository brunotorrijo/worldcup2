const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

// Initialize database (runs schema + seed on first load)
require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Trust proxy for Railway/Render (needed for secure cookies behind reverse proxy)
if (IS_PROD) {
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leagues', require('./routes/league'));
app.use('/api/leagues', require('./routes/predictions'));
app.use('/api', require('./routes/results'));

// SPA fallback — serve index.html for unmatched routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n⚽ World Cup 2026 Prediction League`);
  console.log(`🏟️  Running on http://0.0.0.0:${PORT}\n`);
});
