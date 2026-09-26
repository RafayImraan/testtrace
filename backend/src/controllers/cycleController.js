/**
 * Test Cycles controller: CRUD, stats, add/remove tests, kanban, assign.
 */
const { query, queryOne, tx } = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/error');
const { writeAudit, clientIp } = require('../utils/audit');
const realtime = require('../services/realtime');
const { notify } = require('../services/notificationService');

const statsForCycle = async (cycleId) => {
  const row = await queryOne(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE status = 'pending')::int AS pending,
       count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
       count(*) FILTER (WHERE status = 'passed')::int AS passed,
       count(*) FILTER (WHERE status = 'failed')::int AS failed,
       count(*) FILTER (WHERE status = 'blocked')::int AS blocked,
       count(*) FILTER (WHERE status IN ('passed','failed','blocked'))::int AS executed,
       count(*) FILTER (WHERE due_date < CURRENT_DATE AND status IN ('pending','in_progress','blocked'))::int AS overdue
     FROM cycle_tests WHERE cycle_id = $1`,
    [cycleId]
  );
  const executedPct = row.total ? Math.round((row.executed / row.total) * 100) : 0;
  const passRate = row.executed ? Math.round((row.passed / row.executed) * 100) : 0;
  return { ...row, executedPct, passRate };
};

const shapeCycle = (c, stats = null) => ({
  id: c.id,
  projectId: c.project_id,
  name: c.name,
  description: c.description,
  status: c.status,
  startDate: c.start_date,
  endDate: c.end_date,
  scheduleEnabled: c.schedule_enabled,
  scheduleCron: c.schedule_cron,
  lastScheduledAt: c.last_scheduled_at,
  createdBy: c.created_by,
  createdAt: c.created_at,
  updatedAt: c.updated_at,
  stats,
});

/** GET /api/cycles */
const list = asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  const where = projectId ? 'WHERE c.project_id = $1' : '';
  const params = projectId ? [Number(projectId)] : [];
  const rows = await query(`SELECT c.* FROM test_cycles c ${where} ORDER BY c.id DESC`, params);
  const data = [];
  for (const c of rows.rows) {
    const s = await statsForCycle(c.id);
    data.push(shapeCycle(c, s));
  }
  res.json({ data });
});

/** GET /api/cycles/:id */
const get = asyncHandler(async (req, res) => {
  const c = await queryOne('SELECT * FROM test_cycles WHERE id = $1', [req.params.id]);
  if (!c) throw ApiError.notFound('Cycle not found');
  const stats = await statsForCycle(c.id);
  const tests = await query(
    `SELECT ct.*, tc.code AS test_case_code, tc.title, tc.module, tc.priority, tc.is_automated,
            u.full_name AS assignee_name, u.avatar_color AS assignee_color,
            le.status AS last_exec_status, le.execution_type AS last_execution_type
     FROM cycle_tests ct
     JOIN test_cases tc ON tc.id = ct.test_case_id
     LEFT JOIN users u ON u.id = ct.assignee_id
     LEFT JOIN v_latest_execution le ON le.cycle_test_id = ct.id
     WHERE ct.cycle_id = $1
     ORDER BY ct.id`,
    [c.id]
  );
  res.json({ cycle: shapeCycle(c, stats), tests: tests.rows, stats });
});

/** POST /api/cycles */
const create = asyncHandler(async (req, res) => {
  const { projectId, name, description, status, startDate, endDate, scheduleEnabled, scheduleCron } = req.body;
  const proj = await queryOne('SELECT id FROM projects WHERE id = $1', [projectId]);
  if (!proj) throw ApiError.badRequest('Project not found');

  const c = await queryOne(
    `INSERT INTO test_cycles (project_id, name, description, status, start_date, end_date, created_by, schedule_enabled, schedule_cron)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [projectId, name, description || null, status || 'planned', startDate || null, endDate || null, req.user.id, scheduleEnabled || false, scheduleCron || '0 2 * * *']
  );
  await writeAudit({ userId: req.user.id, entityType: 'test_cycle', entityId: c.id, action: 'create', newValue: { name: c.name }, ip: clientIp(req) });
  realtime.emitToProject(projectId, 'cycle:created', { cycleId: c.id });
  res.status(201).json({ cycle: shapeCycle(c, await statsForCycle(c.id)) });
});

/** PATCH /api/cycles/:id */
const update = asyncHandler(async (req, res) => {
  const before = await queryOne('SELECT * FROM test_cycles WHERE id = $1', [req.params.id]);
  if (!before) throw ApiError.notFound('Cycle not found');
  const { name, description, status, startDate, endDate, scheduleEnabled, scheduleCron } = req.body;
  const c = await queryOne(
    `UPDATE test_cycles SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       status = COALESCE($4, status),
       start_date = COALESCE($5, start_date),
       end_date = COALESCE($6, end_date),
       schedule_enabled = COALESCE($7, schedule_enabled),
       schedule_cron = COALESCE($8, schedule_cron)
     WHERE id = $1 RETURNING *`,
    [req.params.id, name ?? null, description ?? null, status ?? null, startDate ?? null, endDate ?? null, scheduleEnabled ?? null, scheduleCron ?? null]
  );
  await writeAudit({ userId: req.user.id, entityType: 'test_cycle', entityId: c.id, action: 'update', oldValue: { name: before.name, status: before.status }, newValue: { name: c.name, status: c.status }, ip: clientIp(req) });
  realtime.emitToProject(c.project_id, 'cycle:updated', { cycleId: c.id });
  realtime.emitDashboard(c.project_id, { cycleId: c.id });
  res.json({ cycle: shapeCycle(c, await statsForCycle(c.id)) });
});

/** DELETE /api/cycles/:id */
const remove = asyncHandler(async (req, res) => {
  const c = await queryOne('SELECT * FROM test_cycles WHERE id = $1', [req.params.id]);
  if (!c) throw ApiError.notFound('Cycle not found');
  await query('DELETE FROM test_cycles WHERE id = $1', [req.params.id]);
  await writeAudit({ userId: req.user.id, entityType: 'test_cycle', entityId: c.id, action: 'delete', oldValue: { name: c.name }, ip: clientIp(req) });
  realtime.emitToProject(c.project_id, 'cycle:deleted', { cycleId: c.id });
  res.json({ message: `Cycle ${c.name} deleted` });
});

/** POST /api/cycles/:id/tests */
const addTests = asyncHandler(async (req, res) => {
  const cycle = await queryOne('SELECT * FROM test_cycles WHERE id = $1', [req.params.id]);
  if (!cycle) throw ApiError.notFound('Cycle not found');
  const { testCaseIds } = req.body;
  let added = 0;
  await tx(async (client) => {
    for (const tcId of testCaseIds) {
      const tc = await client.query('SELECT id, project_id FROM test_cases WHERE id = $1', [tcId]);
      if (!tc.rows[0] || tc.rows[0].project_id !== cycle.project_id) continue;
      const res = await client.query(
        `INSERT INTO cycle_tests (cycle_id, test_case_id, status) VALUES ($1,$2,'pending') ON CONFLICT (cycle_id, test_case_id) DO NOTHING`,
        [cycle.id, tcId]
      );
      added += res.rowCount;
    }
    await writeAudit({ userId: req.user.id, entityType: 'test_cycle', entityId: cycle.id, action: 'add_tests', newValue: { testCaseIds, added }, ip: clientIp(req) }, client);
  });
  realtime.emitToProject(cycle.project_id, 'cycle:tests_added', { cycleId: cycle.id, added });
  realtime.emitDashboard(cycle.project_id, { cycleId: cycle.id });
  res.status(201).json({ added, cycleId: cycle.id });
});

/** DELETE /api/cycles/:id/tests?testCaseId= */
const removeTest = asyncHandler(async (req, res) => {
  const cycle = await queryOne('SELECT * FROM test_cycles WHERE id = $1', [req.params.id]);
  if (!cycle) throw ApiError.notFound('Cycle not found');
  const { testCaseId } = req.query;
  if (!testCaseId) throw ApiError.badRequest('testCaseId query param required');
  await query('DELETE FROM cycle_tests WHERE cycle_id = $1 AND test_case_id = $2', [cycle.id, Number(testCaseId)]);
  await writeAudit({ userId: req.user.id, entityType: 'test_cycle', entityId: cycle.id, action: 'remove_test', newValue: { testCaseId }, ip: clientIp(req) });
  realtime.emitToProject(cycle.project_id, 'cycle:test_removed', { cycleId: cycle.id, testCaseId: Number(testCaseId) });
  realtime.emitDashboard(cycle.project_id, { cycleId: cycle.id });
  res.json({ message: 'Removed' });
});

/** GET /api/cycles/:id/kanban */
const kanban = asyncHandler(async (req, res) => {
  const cycle = await queryOne('SELECT * FROM test_cycles WHERE id = $1', [req.params.id]);
  if (!cycle) throw ApiError.notFound('Cycle not found');
  const rows = await query(
    `SELECT ct.*, tc.code, tc.title, tc.module, tc.priority, tc.is_automated,
            u.full_name AS assignee_name, u.avatar_color
     FROM cycle_tests ct
     JOIN test_cases tc ON tc.id = ct.test_case_id
     LEFT JOIN users u ON u.id = ct.assignee_id
     WHERE ct.cycle_id = $1
     ORDER BY ct.due_date NULLS LAST, ct.id`,
    [cycle.id]
  );
  const columns = {
    pending: rows.rows.filter(r => r.status === 'pending'),
    in_progress: rows.rows.filter(r => r.status === 'in_progress'),
    passed: rows.rows.filter(r => r.status === 'passed'),
    failed: rows.rows.filter(r => r.status === 'failed'),
    blocked: rows.rows.filter(r => r.status === 'blocked'),
  };
  res.json({ cycle: shapeCycle(cycle, await statsForCycle(cycle.id)), columns, all: rows.rows });
});

/** POST /api/cycles/:id/assign */
const assign = asyncHandler(async (req, res) => {
  const cycle = await queryOne('SELECT * FROM test_cycles WHERE id = $1', [req.params.id]);
  if (!cycle) throw ApiError.notFound('Cycle not found');
  const { cycleTestIds, assigneeId, dueDate } = req.body;
  const user = await queryOne('SELECT id, full_name FROM users WHERE id = $1 AND is_active', [assigneeId]);
  if (!user) throw ApiError.badRequest('Assignee not found or inactive');

  await tx(async (client) => {
    for (const ctId of cycleTestIds) {
      const before = (await client.query('SELECT * FROM cycle_tests WHERE id = $1 AND cycle_id = $2', [ctId, cycle.id])).rows[0];
      if (!before) continue;
      await client.query(
        `UPDATE cycle_tests SET assignee_id = $2, assigned_by = $3, assigned_at = now(), due_date = COALESCE($4, due_date), updated_at = now()
         WHERE id = $1`,
        [ctId, assigneeId, req.user.id, dueDate || null]
      );
      await writeAudit({
        userId: req.user.id,
        entityType: 'cycle_test',
        entityId: ctId,
        action: 'assign',
        oldValue: { assigneeId: before.assignee_id },
        newValue: { assigneeId, dueDate },
        ip: clientIp(req),
      }, client);

      await notify({
        userId: assigneeId,
        title: `Assigned: ${before.id} in ${cycle.name}`,
        message: `You have been assigned a test in cycle "${cycle.name}"${dueDate ? ` due ${dueDate}` : ''}`,
        type: 'assignment',
        link: `/cycles/${cycle.id}`,
        dedupeKey: `assign:${ctId}:${assigneeId}:${Date.now()}`,
      }, client);
    }
  });

  // fetch updated rows
  const updated = await query(
    `SELECT ct.*, tc.code, tc.title FROM cycle_tests ct JOIN test_cases tc ON tc.id = ct.test_case_id WHERE ct.id = ANY($1::int[])`,
    [cycleTestIds]
  );

  realtime.emitToProject(cycle.project_id, 'cycle_test:assigned', { cycleId: cycle.id, cycleTestIds, assigneeId, dueDate });
  for (const ctId of cycleTestIds) {
    realtime.emitToUser(assigneeId, 'cycle_test:assigned', { cycleId: cycle.id, cycleTestId: ctId });
  }

  res.json({ assigned: updated.rows.length, data: updated.rows });
});

module.exports = { list, get, create, update, remove, addTests, removeTest, kanban, assign, statsForCycle };
