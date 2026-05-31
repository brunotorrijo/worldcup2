-- Users table (league creators)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Leagues table
CREATE TABLE IF NOT EXISTS leagues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  creator_id INTEGER REFERENCES users(id),
  group_predictions_locked INTEGER DEFAULT 0,
  knockout_predictions_locked INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Players table (participants in a league)
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id INTEGER REFERENCES leagues(id),
  user_id INTEGER REFERENCES users(id),
  display_name TEXT NOT NULL,
  session_token TEXT UNIQUE,
  is_creator INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Teams table (all 48 World Cup teams)
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  group_letter TEXT NOT NULL,
  flag_emoji TEXT
);

-- Matches table (group + knockout)
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage TEXT NOT NULL,
  group_letter TEXT,
  home_team_id INTEGER REFERENCES teams(id),
  away_team_id INTEGER REFERENCES teams(id),
  match_number INTEGER,
  match_date TEXT,
  home_score INTEGER,
  away_score INTEGER,
  extra_time INTEGER DEFAULT 0,
  home_score_et INTEGER,
  away_score_et INTEGER,
  penalties INTEGER DEFAULT 0,
  home_penalties INTEGER,
  away_penalties INTEGER,
  winner_team_id INTEGER REFERENCES teams(id),
  bracket_position TEXT
);

-- Predictions table (match score predictions)
CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER REFERENCES players(id),
  match_id INTEGER REFERENCES matches(id),
  predicted_home_score INTEGER,
  predicted_away_score INTEGER,
  predicted_extra_time INTEGER DEFAULT 0,
  predicted_penalties INTEGER DEFAULT 0,
  predicted_winner_id INTEGER REFERENCES teams(id),
  points_earned INTEGER DEFAULT 0,
  UNIQUE(player_id, match_id)
);

-- Group predictions table (predicted group standings)
CREATE TABLE IF NOT EXISTS group_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER REFERENCES players(id),
  group_letter TEXT NOT NULL,
  position INTEGER NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  points_earned INTEGER DEFAULT 0,
  UNIQUE(player_id, group_letter, position)
);
