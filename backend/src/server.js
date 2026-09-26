/**
 * Backend entry point.
 *  1. wait for PostgreSQL
 *  2. optionally run migrations + seed (handy for `docker compose up`)
 *  3. start the HTTP server, attach socket.io, start cron jobs
 *  4. graceful shutdown on SIGTERM/SIGINT
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const config = require('./config/env');
const { waitForDb, pool } = require('./config/db');
const { createApp } = require('./app');
const { attachSockets } = require('./sockets');
const realtime = require('./services/realtime');
const { startCron } = require('./cron');

/** Run a node script (migrate/seed) and stream its output to our own logs. */
function runScript(relPath, args = []) {
  return new Promise((resolve, reject) => {
    const script = path.resolve(__dirname, '../..', relPath);
    const child = spawn('node', [script, ...args], { stdio: 'inherit' });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${relPath} exited with code ${code}`))
    );
  });
}

async function main() {
  await waitForDb();

  if (config.runMigrationsOnStart) {
    console.log('[startup] applying migrations...');
    await runScript('db/migrate.js');
  }
  if (config.runSeedOnStart) {
    console.log('[startup] seeding demo data (idempotent)...');
    await runScript('db/seed/seed.js');
  }

  const app = createApp();
  const server = http.createServer(app);

  // Realtime: same HTTP server, /socket.io path
  const io = attachSockets(server);
  realtime.init(io);

  // Cron: due-soon notifications + nightly automation
  startCron();

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`\n🧪  Test Trace & Automate API listening on http://localhost:${config.port}`);
    console.log(`    Swagger docs : http://localhost:${config.port}/api/docs`);
    console.log(`    Health check : http://localhost:${config.port}/api/health`);
    console.log(`    Environment  : ${config.env}\n`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[shutdown] received ${signal}, closing down...`);
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    // don't hang forever
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
