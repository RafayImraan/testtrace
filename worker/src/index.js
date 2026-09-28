/**
 * Automation Worker entry point.
 * Polls the backend queue every WORKER_POLL_INTERVAL_MS, claims up to 5 runs,
 * executes them (Playwright for UI, axios for API) and posts results back.
 *
 * No Redis: Postgres is the queue (SELECT ... FOR UPDATE SKIP LOCKED).
 * No silent failures: every crash/timeout is recorded as FAILED with logs.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const config = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:4000',
  pollMs: Number(process.env.WORKER_POLL_INTERVAL_MS || 3000),
  workerId: process.env.WORKER_ID || 'worker-1',
  email: process.env.WORKER_EMAIL || 'lead@tta.local',
  password: process.env.WORKER_PASSWORD || 'Lead@123',
  headless: String(process.env.AUTOMATION_HEADLESS || 'true') === 'true',
  sampleAppUrl: process.env.SAMPLE_APP_URL || 'http://localhost:5000',
};

let token = null;

async function login() {
  try {
    const res = await axios.post(`${config.backendUrl}/api/auth/login`, {
      email: config.email,
      password: config.password,
    });
    token = res.data.token;
    console.log(`[worker] logged in as ${config.email}`);
    return true;
  } catch (err) {
    console.error(`[worker] login failed: ${err.response?.data?.error?.message || err.message}`);
    return false;
  }
}

async function claimRuns() {
  try {
    const res = await axios.post(
      `${config.backendUrl}/api/automation/claim`,
      { limit: 3, workerId: config.workerId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data.runs || res.data.data || [];
  } catch (err) {
    if (err.response?.status === 401) {
      console.log('[worker] token expired, re-login...');
      await login();
      return [];
    }
    console.error('[worker] claim failed:', err.response?.data?.error?.message || err.message);
    return [];
  }
}

async function postResult(runId, result) {
  // Drop null/undefined fields and cap lengths so validation can never reject a result.
  const body = {};
  for (const [k, v] of Object.entries(result)) {
    if (v === null || v === undefined) continue;
    body[k] = v;
  }
  if (typeof body.log === 'string') body.log = body.log.slice(0, 20000);
  if (typeof body.error === 'string') body.error = body.error.slice(0, 10000);
  if (typeof body.screenshotPath === 'string') body.screenshotPath = body.screenshotPath.slice(0, 500);
  try {
    await axios.post(`${config.backendUrl}/api/automation/runs/${runId}/result`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`[worker] run ${runId} -> ${result.status} (${result.durationMs}ms)`);
  } catch (err) {
    console.error(`[worker] post result ${runId} failed:`, err.response?.data?.error?.message || err.message);
  }
}

async function runOnce() {
  if (!token && !(await login())) return;

  const runs = await claimRuns();
  if (!runs.length) return;

  console.log(`[worker] claimed ${runs.length} run(s)`);

  for (const run of runs) {
    const started = Date.now();
    let outcome;
    try {
      // Dynamic import of runner (ui vs api)
      const runner = require('./runner');
      outcome = await runner.executeRun(run, { headless: config.headless, sampleAppUrl: config.sampleAppUrl, backendUrl: config.backendUrl });
    } catch (err) {
      console.error(`[worker] run ${run.id} crashed:`, err.message);
      outcome = {
        status: 'FAILED',
        log: `Worker crash: ${err.message}\n${err.stack || ''}`.slice(0, 8000),
        error: err.message,
        durationMs: Date.now() - started,
      };
    }

    // Ensure duration
    if (!outcome.durationMs) outcome.durationMs = Date.now() - started;

    // Handle screenshot file if runner saved one to disk -> upload via backend's static path?
    // For simplicity, runner returns screenshotPath relative to backend's uploads folder if it saved one.
    // If it's a local temp file, we would need to upload; but we keep it simple: runner saves to /app/uploads/screenshots
    // which is shared volume in docker-compose.

    await postResult(run.id, outcome);
  }
}

async function main() {
  console.log(`\n🤖  TTA Automation Worker starting`);
  console.log(`    backend: ${config.backendUrl}`);
  console.log(`    poll interval: ${config.pollMs}ms`);
  console.log(`    workerId: ${config.workerId}`);
  console.log(`    sampleAppUrl: ${config.sampleAppUrl}\n`);

  // Ensure artifacts dir exists
  const artDir = path.resolve(__dirname, '../.artifacts/screenshots');
  fs.mkdirSync(artDir, { recursive: true });

  // Initial login
  await login();

  // Poll loop
  setInterval(runOnce, config.pollMs);
  // Run immediately
  await runOnce();
}

main().catch((err) => {
  console.error('Fatal worker error:', err);
  process.exit(1);
});
