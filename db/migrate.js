#!/usr/bin/env node
/**
 * Tiny SQL migration runner (no ORM, no magic).
 *  - reads db/migrations/*.sql in filename order
 *  - records what has been applied in the schema_migrations table
 *  - each file runs inside its own transaction (all-or-nothing)
 *
 * Usage:  node db/migrate.js          -> apply pending migrations
 *         node db/migrate.js --reset  -> DROP every app table and re-apply (dev only)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://tta:tta_pass@localhost:5432/test_trace_automate',
  max: 2,
});

async function ensureBookkeeping(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(160) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}

async function reset(client) {
  console.log('⚠️  --reset: dropping schema public (dev only)');
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.query('GRANT ALL ON SCHEMA public TO public;');
}

async function main() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    if (process.argv.includes('--reset')) {
      await reset(client);
    }
    await ensureBookkeeping(client);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`• skip   ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`• apply  ${file} ... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log('ok');
        count += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`FAILED\n${err.message}`);
        throw err;
      }
    }
    console.log(count ? `\n✅ ${count} migration(s) applied.` : '\n✅ Database already up to date.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration error:', err.message);
  process.exit(1);
});
