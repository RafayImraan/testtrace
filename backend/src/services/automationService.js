/**
 * Automation orchestration service (backend side).
 * The worker itself lives in /worker and polls the queue.
 * The backend is responsible for:
 *  - queuing runs when a lead/tester clicks "Run automation"
 *  - the nightly scheduler that checks cycle cron expressions
 *  - claiming queued runs (FOR UPDATE SKIP LOCKED) for the worker
 *  - ingesting results posted by the worker and turning them into
 *    executions + cycle_test status changes + audit + realtime events.
 *
 * This file is intentionally split into two parts:
 *  - queueRuns(): used by the automation controller (phase 4)
 *  - triggerScheduledCycles(): used by cron (phase 4)
 *  - claimRuns() / ingestResult(): used by the worker
 */
const { query, queryOne, tx } = require('../config/db');
const { writeAudit } = require('../utils/audit');
const realtime = require('./realtime');

/** Check if a cron expression is due within the last minute (simple parser). */
function isCronDue(cronExpr, lastRunAt) {
  // For demo purposes we delegate to node-cron's validation but implement
  // a trivial "every minute" and "daily at 02:00" check.
  // The real scheduler runs every minute and only triggers if enough time
  // has passed since last_scheduled_at (at least 23h for daily jobs).
  if (!lastRunAt) return true;
  const hoursSince = (Date.now() - new Date(lastRunAt).getTime()) / 3600000;
  if (cronExpr === '0 2 * * *' || cronExpr.includes('2 * *')) {
    return hoursSince >= 23;
  }
  // For other crons, require at least 1 hour since last run to avoid spam.
  return hoursSince >= 1;
}

/** Cron job: enqueue automated tests for cycles whose schedule is enabled. */
async function triggerScheduledCycles() {
  const cycles = await query(`
    SELECT id, project_id, schedule_cron, last_scheduled_at
    FROM test_cycles WHERE schedule_enabled = TRUE
  `);

  for (const cycle of cycles.rows) {
    if (!isCronDue(cycle.schedule_cron, cycle.last_scheduled_at)) continue;

    // Find all automated test cases in this cycle that have an active script
    const tests = await query(
      `SELECT ct.id AS cycle_test_id, tc.id AS test_case_id, s.id AS script_id
       FROM cycle_tests ct
       JOIN test_cases tc ON tc.id = ct.test_case_id
       JOIN automation_scripts s ON s.test_case_id = tc.id AND s.is_active = TRUE
       WHERE ct.cycle_id = $1`,
      [cycle.id]
    );

    if (!tests.rows.length) continue;

    const batchId = await queueRuns({
      items: tests.rows.map((r) => ({
        scriptId: r.script_id,
        testCaseId: r.test_case_id,
        cycleId: cycle.id,
        cycleTestId: r.cycle_test_id,
      })),
      triggerType: 'scheduled',
      triggeredBy: null,
    });

    await query('UPDATE test_cycles SET last_scheduled_at = now() WHERE id = $1', [cycle.id]);
    console.log(`[automation] scheduled batch ${batchId} for cycle ${cycle.id} (${tests.rows.length} tests)`);

    await writeAudit({
      userId: null,
      entityType: 'test_cycle',
      entityId: cycle.id,
      action: 'scheduled_automation',
      newValue: { batchId, count: tests.rows.length, cron: cycle.schedule_cron },
    });
  }
}

/**
 * Queue a set of runs (used by manual trigger and scheduler).
 * @param {Array<{scriptId, testCaseId, cycleId?, cycleTestId?}>} items
 * @param {'manual'|'scheduled'} triggerType
 * @param {number|null} triggeredBy user id
 * @returns {string} batchId
 */
async function queueRuns({ items, triggerType = 'manual', triggeredBy = null }) {
  if (!items?.length) return null;
  const batchId = require('crypto').randomUUID();

  await tx(async (client) => {
    for (const it of items) {
      await client.query(
        `INSERT INTO automation_runs
           (batch_id, script_id, test_case_id, cycle_id, cycle_test_id, status, trigger_type, triggered_by)
         VALUES ($1,$2,$3,$4,$5,'queued',$6,$7)`,
        [batchId, it.scriptId, it.testCaseId, it.cycleId || null, it.cycleTestId || null, triggerType, triggeredBy]
      );
    }
  });

  // Push realtime event so UI shows "queued" immediately
  if (items[0]?.cycleId) {
    const cycle = await queryOne('SELECT project_id FROM test_cycles WHERE id = $1', [items[0].cycleId]);
    if (cycle) {
      realtime.emitToProject(cycle.project_id, 'automation:run', { batchId, status: 'queued', count: items.length, triggerType });
    }
  }

  return batchId;
}

/**
 * Worker claims up to N queued runs atomically (FOR UPDATE SKIP LOCKED).
 * Returns the claimed rows so the worker can run them.
 */
async function claimRuns({ limit = 5, workerId = 'worker-1' }) {
  return tx(async (client) => {
    const { rows } = await client.query(
      `SELECT ar.*, s.file_path, s.type AS script_type, s.timeout_ms,
              tc.code AS test_case_code, tc.project_id
       FROM automation_runs ar
       JOIN automation_scripts s ON s.id = ar.script_id
       JOIN test_cases tc ON tc.id = ar.test_case_id
       WHERE ar.status = 'queued'
       ORDER BY ar.created_at ASC
       LIMIT $1
       FOR UPDATE OF ar SKIP LOCKED`,
      [limit]
    );

    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    await client.query(
      `UPDATE automation_runs
       SET status = 'running', started_at = now(), worker_id = $2, attempts = attempts + 1
       WHERE id = ANY($1::int[])`,
      [ids, workerId]
    );

    return rows.map((r) => ({ ...r, status: 'running' }));
  });
}

/**
 * Worker posts result: { status: PASSED|FAILED, log, error, screenshotPath?, durationMs }
 * Backend turns it into an execution + cycle_test status update.
 */
async function ingestResult(runId, payload, { workerId = null, ip = null, userId = null } = {}) {
  const run = await queryOne('SELECT * FROM automation_runs WHERE id = $1', [runId]);
  if (!run) throw Object.assign(new Error('Run not found'), { status: 404 });

  const passed = payload.status === 'PASSED';
  const testStatus = passed ? 'passed' : 'failed';
  const duration = payload.durationMs || null;

  return tx(async (client) => {
    // 1) Update the run itself
    const updatedRun = (
      await client.query(
        `UPDATE automation_runs
         SET status = 'done',
             log = $2, error = $3, screenshot_path = $4,
             duration_ms = $5, finished_at = now(), worker_id = COALESCE($6, worker_id)
         WHERE id = $1 RETURNING *`,
        [runId, payload.log || null, payload.error || null, payload.screenshotPath || null, duration, workerId]
      )
    ).rows[0];

    // 2) If linked to a cycle_test, update its status and create an execution row
    if (run.cycle_test_id) {
      const ct = (await client.query('SELECT * FROM cycle_tests WHERE id = $1', [run.cycle_test_id])).rows[0];
      if (ct) {
        await client.query(
          `UPDATE cycle_tests SET status = $2, actual_result = $3, remarks = $4,
                  executed_by = COALESCE($5, executed_by), executed_at = now(), updated_at = now()
           WHERE id = $1`,
          [
            ct.id,
            testStatus,
            passed ? 'Automated run PASSED' : `Automated run FAILED: ${(payload.error || '').slice(0, 500)}`,
            payload.log ? payload.log.slice(0, 1000) : null,
            userId || run.triggered_by,
          ]
        );

        const exec = (
          await client.query(
            `INSERT INTO executions
               (cycle_test_id, test_case_id, cycle_id, status, execution_type,
                actual_result, remarks, screenshot_path, log, duration_ms, automation_run_id, executed_by)
             VALUES ($1,$2,$3,$4,'automated',$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [
              ct.id,
              run.test_case_id,
              run.cycle_id,
              testStatus,
              passed ? 'Automated run PASSED' : 'Automated run FAILED',
              payload.log ? payload.log.slice(0, 2000) : null,
              payload.screenshotPath || null,
              payload.log || null,
              duration,
              runId,
              userId || run.triggered_by,
            ]
          )
        ).rows[0];

        await writeAudit(
          {
            userId: userId || run.triggered_by,
            entityType: 'cycle_test',
            entityId: ct.id,
            action: 'automation_result',
            oldValue: { status: ct.status },
            newValue: { status: testStatus, executionId: exec.id, runId },
            ip,
          },
          client
        );

        // realtime: push to project room
        const cycle = (await client.query('SELECT project_id FROM test_cycles WHERE id = $1', [ct.cycle_id])).rows[0];
        if (cycle) {
          realtime.emitToProject(cycle.project_id, 'cycle_test:updated', {
            cycleTestId: ct.id,
            cycleId: ct.cycle_id,
            testCaseId: run.test_case_id,
            status: testStatus,
            executionType: 'automated',
            runId,
          });
          realtime.emitDashboard(cycle.project_id, { reason: 'automation_result', cycleId: ct.cycle_id });
        }
      }
    }

    await writeAudit(
      {
        userId,
        entityType: 'automation_run',
        entityId: runId,
        action: 'result_ingested',
        newValue: { status: testStatus, durationMs: duration },
        ip,
      },
      client
    );

    return updatedRun;
  });
}

module.exports = { queueRuns, triggerScheduledCycles, claimRuns, ingestResult, isCronDue };
