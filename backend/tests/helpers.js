/**
 * Test helpers: create app, get tokens, seed minimal data for isolated tests.
 * Uses the test database (test_trace_automate_test) which is reset before each suite.
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { createApp } = require('../src/app');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://tta:tta_pass@localhost:5432/test_trace_automate_test',
});

async function resetDb() {
  // Apply migrations if needed (reuse migrate logic via SQL files)
  const fs = require('fs');
  const path = require('path');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Drop and recreate schema (fast for tests)
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;');
    // Create pgcrypto
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    // Apply 001_init.sql and 002_views.sql
    const migrationsDir = path.join(__dirname, '../../db/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f=>f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      // Remove schema_migrations creation if present (we handle separately)
      await client.query(sql);
    }
    // Ensure schema_migrations table exists for consistency
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(160) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function seedUsers() {
  const hash = await bcrypt.hash('Test@123', 4);
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, avatar_color)
       VALUES
         ('admin@test.local', $1, 'Admin Test', 'admin', '#7c3aed'),
         ('lead@test.local', $1, 'Lead Test', 'lead', '#0ea5e9'),
         ('tester@test.local', $1, 'Tester Test', 'tester', '#f59e0b')
       RETURNING id, email, role`,
    [hash]
    );
    const proj = (await client.query(`INSERT INTO projects (code, name, description) VALUES ('TEST','Test Project','Test') RETURNING id`)).rows[0];
    const req = (await client.query(`INSERT INTO requirements (project_id, code, title, priority) VALUES ($1,'REQ-001','Req 1','high') RETURNING id`, [proj.id])).rows[0];
    return { users: res.rows, projectId: proj.id, requirementId: req.id, pool };
  } finally {
    client.release();
  }
}

function app() {
  return createApp();
}

module.exports = { resetDb, seedUsers, app, pool };
