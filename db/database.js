const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'worldcup.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed if teams table is empty
const count = db.prepare('SELECT COUNT(*) as count FROM teams').get();
if (count.count === 0) {
  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  db.exec(seed);
  console.log('Database seeded with World Cup 2026 data');
}

console.log('Database initialized');

module.exports = db;
