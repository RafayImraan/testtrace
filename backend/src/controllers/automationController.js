/**
 * Automation controller: scripts CRUD, runs, trigger, claim, result ingestion, schedules.
 */
const { query, queryOne } = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/error');
const { writeAudit, clientIp } = require('../utils/audit');
const { pagination, pageMeta } = require('../utils/helpers');
const realtime = require('../services/realtime');
const automationService = require('../services/automationService');

const shapeScript = (s) => ({
  id: s.id,
  testCaseId: s.test_case_id,
  testCaseCode: s.test_case_code,
  testCaseTitle: s.test_case_title,
  name: s.name,
  type: s.type,
  filePath: s.file_path,
  description: s.description,
  timeoutMs: s.timeout_ms,
  isActive: s.is_active,
  createdAt: s.created_at,
});

const shapeRun = (r) => ({
  id: r.id,
  batchId: r.batch_id,
  scriptId: r.script_id,
  scriptName: r.script_name,
  filePath: r.file_path,
  testCaseId: r.test_case_id,
  testCaseCode: r.test_case_code,
  cycleId: r.cycle_id,
  cycleTestId: r.cycle_test_id,
  cycleName: r.cycle_name,
  status: r.status,
  triggerType: r.trigger_type,
  triggeredBy: r.triggered_by,
  triggeredByName: r.triggered_by_name,
  log: r.log,
  error: r.error,
  screenshotPath: r.screenshot_path,
  durationMs: r.duration_ms,
  workerId: r.worker_id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  createdAt: r.created_at,
});

/** GET /api/automation/scripts */
const listScripts = asyncHandler(async (req, res) => {
  const { projectId, type, q } = req.query;
  const conds = [];
  const params = [];
  let idx = 1;
  if (projectId) { params.push(Number(projectId)); conds.push(`tc.project_id = $${idx++}`); }
  if (type) { params.push(type); conds.push(`s.type = $${idx++}`); }
  if (q) { params.push(`%${q}%`); conds.push(`(s.name ILIKE $${idx} OR tc.code ILIKE $${idx} OR tc.title ILIKE $${idx})`); idx++; }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await query(
    `SELECT s.*, tc.code AS test_case_code, tc.title AS test_case_title, tc.project_id
     FROM automation_scripts s JOIN test_cases tc ON tc.id = s.test_case_id
     ${where} ORDER BY s.id DESC`,
    params
  );
  res.json({ data: rows.rows.map(shapeScript) });
});

/** POST /api/automation/scripts */
const createScript = asyncHandler(async (req, res) => {
  const { testCaseId, name, type, filePath, description, timeoutMs } = req.body;
  const tc = await queryOne('SELECT id, project_id FROM test_cases WHERE id = $1', [testCaseId]);
  if (!tc) throw ApiError.badRequest('Test case not found');
  const exists = await queryOne('SELECT id FROM automation_scripts WHERE test_case_id = $1', [testCaseId]);
  if (exists) throw ApiError.conflict('This test case already has a script linked');

  const s = await queryOne(
    `INSERT INTO automation_scripts (test_case_id, name, type, file_path, description, timeout_ms)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [testCaseId, name, type, filePath, description || null, timeoutMs || 60000]
  );
  await query('UPDATE test_cases SET is_automated = TRUE WHERE id = $1', [testCaseId]);
  await writeAudit({ userId: req.user.id, entityType: 'automation_script', entityId: s.id, action: 'create', newValue: { testCaseId, filePath }, ip: clientIp(req) });
  realtime.emitToProject(tc.project_id, 'automation:script_created', { scriptId: s.id });
  const full = await queryOne(`SELECT s.*, tc.code AS test_case_code, tc.title AS test_case_title FROM automation_scripts s JOIN test_cases tc ON tc.id = s.test_case_id WHERE s.id = $1`, [s.id]);
  res.status(201).json({ script: shapeScript(full) });
});

/** PATCH /api/automation/scripts/:id */
const updateScript = asyncHandler(async (req, res) => {
  const before = await queryOne('SELECT s.*, tc.project_id FROM automation_scripts s JOIN test_cases tc ON tc.id = s.test_case_id WHERE s.id = $1', [req.params.id]);
  if (!before) throw ApiError.notFound('Script not found');
  const { name, type, filePath, description, timeoutMs, isActive } = req.body;
  const s = await queryOne(
    `UPDATE automation_scripts SET name = COALESCE($2, name), type = COALESCE($3, type), file_path = COALESCE($4, file_path),
            description = COALESCE($5, description), timeout_ms = COALESCE($6, timeout_ms), is_active = COALESCE($7, is_active)
     WHERE id = $1 RETURNING *`,
    [req.params.id, name ?? null, type ?? null, filePath ?? null, description ?? null, timeoutMs ?? null, isActive ?? null]
  );
  await writeAudit({ userId: req.user.id, entityType: 'automation_script', entityId: s.id, action: 'update', oldValue: { filePath: before.file_path }, newValue: { filePath: s.file_path }, ip: clientIp(req) });
  realtime.emitToProject(before.project_id, 'automation:script_updated', { scriptId: s.id });
  const full = await queryOne(`SELECT s.*, tc.code AS test_case_code, tc.title AS test_case_title FROM automation_scripts s JOIN test_cases tc ON tc.id = s.test_case_id WHERE s.id = $1`, [s.id]);
  res.json({ script: shapeScript(full) });
});

/** DELETE /api/automation/scripts/:id */
const deleteScript = asyncHandler(async (req, res) => {
  const s = await queryOne('SELECT s.*, tc.project_id FROM automation_scripts s JOIN test_cases tc ON tc.id = s.test_case_id WHERE s.id = $1', [req.params.id]);
  if (!s) throw ApiError.notFound('Script not found');
  await query('DELETE FROM automation_scripts WHERE id = $1', [req.params.id]);
  await writeAudit({ userId: req.user.id, entityType: 'automation_script', entityId: s.id, action: 'delete', oldValue: { filePath: s.file_path }, ip: clientIp(req) });
  realtime.emitToProject(s.project_id, 'automation:script_deleted', { scriptId: s.id });
  res.json({ message: 'Script deleted' });
});

/** GET /api/automation/runs */
const listRuns = asyncHandler(async (req, res) => {
  const { status, cycleId, batchId, page, pageSize } = req.query;
  const { limit, offset, page: pg, pageSize: ps } = pagination({ page, pageSize });
  const conds = [];
  const params = [];
  let idx = 1;
  if (status) { params.push(status); conds.push(`ar.status = $${idx++}`); }
  if (cycleId) { params.push(Number(cycleId)); conds.push(`ar.cycle_id = $${idx++}`); }
  if (batchId) { params.push(batchId); conds.push(`ar.batch_id = $${idx++}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const total = (await queryOne(`SELECT count(*)::int AS c FROM automation_runs ar ${where}`, params)).c;
  const rows = await query(
    `SELECT ar.*, s.name AS script_name, s.file_path, tc.code AS test_case_code, c.name AS cycle_name, u.full_name AS triggered_by_name
     FROM automation_runs ar
     JOIN automation_scripts s ON s.id = ar.script_id
     JOIN test_cases tc ON tc.id = ar.test_case_id
     LEFT JOIN test_cycles c ON c.id = ar.cycle_id
     LEFT JOIN users u ON u.id = ar.triggered_by
     ${where}
     ORDER BY ar.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json({ data: rows.rows.map(shapeRun), meta: pageMeta(pg, ps, total) });
});

/** GET /api/automation/runs/:id */
const getRun = asyncHandler(async (req, res) => {
  const r = await queryOne(
    `SELECT ar.*, s.name AS script_name, s.file_path, tc.code AS test_case_code, c.name AS cycle_name, u.full_name AS triggered_by_name
     FROM automation_runs ar
     JOIN automation_scripts s ON s.id = ar.script_id
     JOIN test_cases tc ON tc.id = ar.test_case_id
     LEFT JOIN test_cycles c ON c.id = ar.cycle_id
     LEFT JOIN users u ON u.id = ar.triggered_by
     WHERE ar.id = $1`,
    [req.params.id]
  );
  if (!r) throw ApiError.notFound('Run not found');
  const execution = await queryOne('SELECT * FROM executions WHERE automation_run_id = $1 ORDER BY created_at DESC LIMIT 1', [r.id]);
  res.json({ run: shapeRun(r), execution: execution || null });
});

/** POST /api/automation/run */
const triggerRun = asyncHandler(async (req, res) => {
  const { testCaseIds, cycleId, cycleTestIds } = req.body;
  let items = [];

  if (cycleId) {
    const cycle = await queryOne('SELECT id, project_id FROM test_cycles WHERE id = $1', [cycleId]);
    if (!cycle) throw ApiError.badRequest('Cycle not found');
    const rows = await query(
      `SELECT ct.id AS cycle_test_id, tc.id AS test_case_id, s.id AS script_id, tc.project_id
       FROM cycle_tests ct
       JOIN test_cases tc ON tc.id = ct.test_case_id
       JOIN automation_scripts s ON s.test_case_id = tc.id AND s.is_active = TRUE
       WHERE ct.cycle_id = $1 ${testCaseIds ? 'AND tc.id = ANY($2::int[])' : ''}`,
      testCaseIds ? [cycleId, testCaseIds] : [cycleId]
    );
    items = rows.rows.map(r => ({ scriptId: r.script_id, testCaseId: r.test_case_id, cycleId: cycle.id, cycleTestId: r.cycle_test_id, projectId: r.project_id }));
  } else if (cycleTestIds?.length) {
    const rows = await query(
      `SELECT ct.id AS cycle_test_id, ct.cycle_id, tc.id AS test_case_id, s.id AS script_id, tc.project_id
       FROM cycle_tests ct
       JOIN test_cases tc ON tc.id = ct.test_case_id
       JOIN automation_scripts s ON s.test_case_id = tc.id AND s.is_active = TRUE
       WHERE ct.id = ANY($1::int[])`,
      [cycleTestIds]
    );
    items = rows.rows.map(r => ({ scriptId: r.script_id, testCaseId: r.test_case_id, cycleId: r.cycle_id, cycleTestId: r.cycle_test_id, projectId: r.project_id }));
  } else if (testCaseIds?.length) {
    const rows = await query(
      `SELECT tc.id AS test_case_id, s.id AS script_id, tc.project_id
       FROM test_cases tc JOIN automation_scripts s ON s.test_case_id = tc.id AND s.is_active = TRUE
       WHERE tc.id = ANY($1::int[])`,
      [testCaseIds]
    );
    items = rows.rows.map(r => ({ scriptId: r.script_id, testCaseId: r.test_case_id, projectId: r.project_id }));
  } else {
    throw ApiError.badRequest('Provide cycleId, cycleTestIds or testCaseIds');
  }

  if (!items.length) throw ApiError.badRequest('No automated test cases found for the given selection');

  // RBAC: tester can only trigger own assigned tests
  if (req.user.role === 'tester') {
    if (cycleTestIds) {
      const own = await query(`SELECT id FROM cycle_tests WHERE id = ANY($1::int[]) AND assignee_id = $2`, [cycleTestIds, req.user.id]);
      const ownIds = new Set(own.rows.map(r => r.id));
      items = items.filter(it => !it.cycleTestId || ownIds.has(it.cycleTestId));
      if (!items.length) throw ApiError.forbidden('You can only trigger automation for your own assigned tests');
    } else if (cycleId) {
      const own = await query(`SELECT id FROM cycle_tests WHERE cycle_id = $1 AND assignee_id = $2`, [cycleId, req.user.id]);
      if (!own.rows.length) throw ApiError.forbidden('You have no assigned tests in this cycle');
      const ownIds = new Set(own.rows.map(r => r.id));
      items = items.filter(it => !it.cycleTestId || ownIds.has(it.cycleTestId));
    }
  }

  const batchId = await automationService.queueRuns({
    items,
    triggerType: 'manual',
    triggeredBy: req.user.id,
  });

  await writeAudit({
    userId: req.user.id,
    entityType: 'automation_run',
    entityId: null,
    action: 'trigger',
    newValue: { batchId, count: items.length, cycleId: cycleId || null },
    ip: clientIp(req),
  });

  const projectId = items[0]?.projectId;
  if (projectId) realtime.emitToProject(projectId, 'automation:run', { batchId, status: 'queued', count: items.length, triggerType: 'manual' });

  res.status(202).json({ batchId, queued: items.length });
});

/** POST /api/automation/claim (worker only, but we allow lead/admin for simplicity) */
const claim = asyncHandler(async (req, res) => {
  const { limit = 5, workerId = 'worker-1' } = req.body;
  // Only lead/admin/worker account can claim; tester cannot
  if (req.user.role === 'tester' && req.user.email !== (process.env.WORKER_EMAIL || 'lead@tta.local')) {
    throw ApiError.forbidden('Only automation workers can claim runs');
  }
  const runs = await automationService.claimRuns({ limit: Math.min(20, Number(limit) || 5), workerId });
  res.json({ runs, count: runs.length });
});

/** POST /api/automation/runs/:id/result (worker) */
const ingest = asyncHandler(async (req, res) => {
  const { status, log, error, screenshotPath, durationMs } = req.body;
  if (!status || !['PASSED','FAILED'].includes(status)) throw ApiError.badRequest('status must be PASSED or FAILED');
  const run = await automationService.ingestResult(
    Number(req.params.id),
    { status, log, error, screenshotPath, durationMs },
    { workerId: req.body.workerId || 'worker-1', ip: clientIp(req), userId: req.user.id }
  );
  res.json({ run });
});

/** GET /api/automation/health */
const health = asyncHandler(async (req, res) => {
  const queued = (await queryOne(`SELECT count(*)::int AS c FROM automation_runs WHERE status = 'queued'`)).c;
  const running = (await queryOne(`SELECT count(*)::int AS c FROM automation_runs WHERE status = 'running'`)).c;
  const lastRun = await queryOne(`SELECT * FROM automation_runs ORDER BY created_at DESC LIMIT 1`);
  res.json({ queued, running, lastRun: lastRun ? shapeRun(lastRun) : null, workerId: process.env.WORKER_ID || 'worker-1' });
});

/** GET /api/automation/schedules */
const listSchedules = asyncHandler(async (req, res) => {
  const rows = await query(`SELECT id, project_id, name, schedule_enabled, schedule_cron, last_scheduled_at FROM test_cycles ORDER BY id DESC`);
  res.json({ data: rows.rows });
});

/** POST /api/automation/schedules */
const saveSchedule = asyncHandler(async (req, res) => {
  const { cycleId, enabled, cron } = req.body;
  if (!cycleId) throw ApiError.badRequest('cycleId required');
  const c = await queryOne('SELECT * FROM test_cycles WHERE id = $1', [cycleId]);
  if (!c) throw ApiError.notFound('Cycle not found');
  const updated = await queryOne(
    `UPDATE test_cycles SET schedule_enabled = $2, schedule_cron = COALESCE($3, schedule_cron) WHERE id = $1 RETURNING *`,
    [cycleId, enabled, cron || null]
  );
  await writeAudit({ userId: req.user.id, entityType: 'test_cycle', entityId: cycleId, action: 'schedule', newValue: { enabled, cron }, ip: clientIp(req) });
  realtime.emitToProject(updated.project_id, 'cycle:updated', { cycleId });
  res.json({ cycle: updated });
});

module.exports = { listScripts, createScript, updateScript, deleteScript, listRuns, getRun, triggerRun, claim, ingest, health, listSchedules, saveSchedule };
