/**
 * PostgreSQL access layer.
 *  - one shared connection pool for the whole process
 *  - query()  : simple parameterised query (always use $-parameters!)
 *  - queryOne(): single row or null
 *  - tx()     : run several statements inside one transaction, rollback on error
 *
 * We use node-postgres directly (no ORM) which keeps the SQL visible and
 * explainable during the viva.
 */
const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  connectionString: config.db.connectionString,
  max: config.db.max,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  // A idle client error must never crash the API process.
  console.error('[db] unexpected idle client error:', err.message);
});

/** Run a parameterised query. */
async function query(text, params = []) {
  const started = Date.now();
  const res = await pool.query(text, params);
  const ms = Date.now() - started;
  if (ms > 400 && !config.isTest) {
    console.warn(`[db] slow query ${ms}ms: ${text.replace(/\s+/g, ' ').slice(0, 120)}`);
  }
  return res;
}

/** First row of a query, or null. */
async function queryOne(text, params = []) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

/**
 * Transaction helper.
 *   await tx(async (client) => { await client.query(...); });
 * Automatically COMMITs, ROLLBACKs on throw and always releases the client.
 */
async function tx(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* connection already dead */
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Wait until the database accepts connections (used on container startup). */
async function waitForDb(retries = 30, delayMs = 1000) {
  for (let i = 1; i <= retries; i += 1) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (err) {
      console.log(`[db] not ready (${i}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Database not reachable after retries');
}

module.exports = { pool, query, queryOne, tx, waitForDb, config };
