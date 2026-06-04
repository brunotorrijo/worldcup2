/**
 * Database initialization script for Turso.
 * Run once to create schema and seed data:
 *   TURSO_URL=... TURSO_AUTH_TOKEN=... node db/init.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

async function init() {
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error('❌ TURSO_URL is required');
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  // Create schema using batch (each CREATE TABLE as one statement)
  console.log('📋 Creating schema...');
  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      creator_id INTEGER REFERENCES users(id),
      group_predictions_locked INTEGER DEFAULT 0,
      knockout_predictions_locked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER REFERENCES leagues(id),
      user_id INTEGER REFERENCES users(id),
      display_name TEXT NOT NULL,
      session_token TEXT UNIQUE,
      is_creator INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      group_letter TEXT NOT NULL,
      flag_emoji TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS matches (
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
    )`,
    `CREATE TABLE IF NOT EXISTS predictions (
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
    )`,
    `CREATE TABLE IF NOT EXISTS group_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER REFERENCES players(id),
      group_letter TEXT NOT NULL,
      position INTEGER NOT NULL,
      team_id INTEGER REFERENCES teams(id),
      points_earned INTEGER DEFAULT 0,
      UNIQUE(player_id, group_letter, position)
    )`
  ], 'write');
  console.log('✅ Schema created');

  // Check if already seeded
  const teams = await client.execute('SELECT COUNT(*) as count FROM teams');
  const teamCount0 = Number(teams.rows[0].count);
  const matchCheck = await client.execute('SELECT COUNT(*) as count FROM matches');
  const matchCount0 = Number(matchCheck.rows[0].count);

  if (teamCount0 === 48 && matchCount0 === 104) {
    console.log('⏭️  Database already seeded, skipping');
    return;
  }

  // Clear partial data if any
  if (teamCount0 > 0 || matchCount0 > 0) {
    console.log('🧹 Clearing partial seed data...');
    await client.batch([
      'DELETE FROM matches',
      'DELETE FROM teams'
    ], 'write');
  }

  // Disable foreign keys for seeding (knockout matches have NULL team refs)
  await client.execute('PRAGMA foreign_keys = OFF');

  // Read and execute seed
  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
  // Strip comment lines first, then split on semicolons
  const cleanedSeed = seed
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  const seedStatements = cleanedSeed
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`🌱 Seeding ${seedStatements.length} records...`);

  // Batch in groups of 20 for efficiency
  for (let i = 0; i < seedStatements.length; i += 20) {
    const batchStmts = seedStatements.slice(i, i + 20).map(sql => ({ sql, args: [] }));
    await client.batch(batchStmts, 'write');
    process.stdout.write(`\r   Progress: ${Math.min(i + 20, seedStatements.length)}/${seedStatements.length}`);
  }

  await client.execute('PRAGMA foreign_keys = ON');


  console.log('\n✅ Database seeded with World Cup 2026 data');

  // Verify
  const teamCount = await client.execute('SELECT COUNT(*) as count FROM teams');
  const matchCount = await client.execute('SELECT COUNT(*) as count FROM matches');
  console.log(`   ${teamCount.rows[0].count} teams, ${matchCount.rows[0].count} matches`);
}

init().catch(err => {
  console.error('❌ Init failed:', err);
  process.exit(1);
});
