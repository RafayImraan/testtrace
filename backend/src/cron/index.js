/**
 * Scheduled jobs (node-cron).
 *   - due-soon reminders   (every 10 minutes)   -> reminderService
 *   - nightly automation   (every minute check) -> automationService
 *   - housekeeping         (hourly)             -> trims old automation logs
 * Every job is wrapped in try/catch: a failing job must never kill the API.
 */
const cron = require('node-cron');
const config = require('../config/env');
const { query } = require('../config/db');

const jobs = [];

/** Register a cron expression -> handler, with error isolation + logging. */
function register(expression, name, handler, { runOnStart = false } = {}) {
  if (!cron.validate(expression)) {
    console.warn(`[cron] invalid expression for "${name}": ${expression}`);
    return null;
  }
  const task = cron.schedule(expression, async () => {
    const started = Date.now();
    try {
      await handler();
      if (!config.isTest) console.log(`[cron] ${name} finished in ${Date.now() - started}ms`);
    } catch (err) {
      console.error(`[cron] ${name} failed:`, err.message);
    }
  });
  jobs.push({ name, expression, task });
  if (!config.isTest) console.log(`[cron] scheduled "${name}" (${expression})`);
  if (runOnStart) {
    Promise.resolve(handler()).catch((e) => console.error(`[cron] ${name} initial run failed:`, e.message));
  }
  return task;
}

function startCron() {
  if (config.isTest) return jobs;

  const { sendDueSoonReminders } = require('../services/reminderService');
  const { triggerScheduledCycles } = require('../services/automationService');

  // 1) Warn owners about tasks due within 24h (and about overdue ones).
  register('*/10 * * * *', 'due-soon-reminders', sendDueSoonReminders);

  // 2) Nightly automation: checks every minute whether a cycle's cron is due.
  register('* * * * *', 'nightly-automation-check', triggerScheduledCycles);

  // 3) Housekeeping: trim heavy logs of old finished runs (keeps the demo DB small).
  register('0 * * * *', 'runs-housekeeping', async () => {
    const hours = Number(process.env.AUTOMATION_RETENTION_HOURS || 24);
    const res = await query(
      `UPDATE automation_runs SET log = '[log trimmed by retention policy]'
       WHERE status IN ('done','error')
         AND finished_at < now() - ($1 || ' hours')::interval
         AND log IS NOT NULL`,
      [String(hours)]
    );
    if (res.rowCount) console.log(`[cron] trimmed ${res.rowCount} old run log(s)`);
  });

  return jobs;
}

function stopCron() {
  jobs.forEach(({ task }) => task.stop());
}

module.exports = { startCron, stopCron, register, jobs };
