const { createClient } = require('@libsql/client');

let db;

function getDb() {
  if (!db) {
    const url = process.env.TURSO_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error('TURSO_URL environment variable is required');
    }

    db = createClient({
      url,
      authToken,
      intMode: 'number'
    });
  }
  return db;
}

/**
 * Execute a query that returns rows (SELECT)
 * Returns array of row objects
 */
async function query(sql, args = []) {
  const client = getDb();
  const result = await client.execute({ sql, args });
  return result.rows;
}

/**
 * Execute a query that returns a single row (SELECT ... LIMIT 1)
 * Returns a single row object or null
 */
async function queryOne(sql, args = []) {
  const rows = await query(sql, args);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE)
 * Returns { rowsAffected, lastInsertRowid }
 */
async function execute(sql, args = []) {
  const client = getDb();
  const result = await client.execute({ sql, args });
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: Number(result.lastInsertRowid)
  };
}

/**
 * Execute multiple statements in a batch (transaction)
 */
async function batch(statements) {
  const client = getDb();
  return client.batch(statements, 'write');
}

module.exports = { getDb, query, queryOne, execute, batch };
