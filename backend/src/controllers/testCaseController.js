/**
 * Test Case Management: CRUD, search, filter, pagination, steps, executions.
 */
const { query, queryOne, tx } = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/error');
const { writeAudit, clientIp } = require('../utils/audit');
const { pagination, pageMeta, nextCode } = require('../utils/helpers');
const realtime = require('../services/realtime');

const shape = (tc, steps = []) => ({
  id: tc.id,
  projectId: tc.project_id,
  code: tc.code,
  title: tc.title,
  preconditions: tc.preconditions,
  expectedResult: tc.expected_result,
  priority: tc.priority,
  module: tc.module,
  requirementId: tc.requirement_id,
  requirementCode: tc.requirement_code || null,
  requirementTitle: tc.requirement_title || null,
  isAutomated: tc.is_automated,
  isActive: tc.is_active,
  createdBy: tc.created_by,
  createdAt: tc.created_at,
  updatedAt: tc.updated_at,
  steps: steps.map(s => ({ id: s.id, stepNo: s.step_no, action: s.action })),
  // enriched fields from latest cycle_test if present
  latestStatus: tc.latest_status || null,
  latestCycleId: tc.latest_cycle_id || null,
  latestAssigneeId: tc.latest_assignee_id || null,
});

/** GET /api/test-cases/meta/modules */
const modules = asyncHandler(async (req, res) => {
  const { projectId } = req.validatedQuery || req.query;
  const where = projectId ? 'WHERE project_id = $1' : '';
  const params = projectId ? [Number(projectId)] : [];
  const rows = await query(`SELECT DISTINCT module FROM test_cases ${where} ORDER BY module`, params);
  res.json({ data: rows.rows.map(r => r.module) });
});

/** GET /api/test-cases */
const list = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || req.query;
  const { page, pageSize, limit, offset } = pagination(q);
  const conditions = [];
  const params = [];
  let idx = 1;

  if (q.projectId) { params.push(Number(q.projectId)); conditions.push(`tc.project_id = $${idx++}`); }
  if (q.q) { params.push(`%${q.q}%`); conditions.push(`(tc.code ILIKE $${idx} OR tc.title ILIKE $${idx})`); idx++; }
  if (q.module) { params.push(q.module); conditions.push(`tc.module = $${idx++}`); }
  if (q.priority) { params.push(q.priority); conditions.push(`tc.priority = $${idx++}`); }
  if (q.requirementId) { params.push(Number(q.requirementId)); conditions.push(`tc.requirement_id = $${idx++}`); }
  if (q.isAutomated !== undefined && q.isAutomated !== '') {
    const bool = q.isAutomated === 'true' || q.isAutomated === true || q.isAutomated === '1';
    params.push(bool); conditions.push(`tc.is_automated = $${idx++}`);
  }
  // status / assignee / cycle filters need join with cycle_tests
  let joinCycleTests = '';
  if (q.status || q.assigneeId || q.cycleId) {
    joinCycleTests = `JOIN cycle_tests ct ON ct.test_case_id = tc.id`;
    if (q.cycleId) { params.push(Number(q.cycleId)); conditions.push(`ct.cycle_id = $${idx++}`); }
    if (q.status) { params.push(q.status); conditions.push(`ct.status = $${idx++}`); }
    if (q.assigneeId) { params.push(Number(q.assigneeId)); conditions.push(`ct.assignee_id = $${idx++}`); }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countSql = `SELECT count(DISTINCT tc.id)::int AS c FROM test_cases tc ${joinCycleTests} ${whereClause}`;
  const total = (await queryOne(countSql, params)).c;

  const dataSql = `
    SELECT tc.*, r.code AS requirement_code, r.title AS requirement_title,
           latest.status AS latest_status, latest.cycle_id AS latest_cycle_id, latest.assignee_id AS latest_assignee_id
    FROM test_cases tc
    LEFT JOIN requirements r ON r.id = tc.requirement_id
    LEFT JOIN LATERAL (
      SELECT status, cycle_id, assignee_id FROM cycle_tests WHERE test_case_id = tc.id ORDER BY updated_at DESC LIMIT 1
    ) latest ON TRUE
    ${joinCycleTests}
    ${whereClause}
    GROUP BY tc.id, r.code, r.title, latest.status, latest.cycle_id, latest.assignee_id
    ORDER BY tc.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const rows = await query(dataSql, params);

  // Fetch steps for these cases in one query
  const ids = rows.rows.map(r => r.id);
  let stepsMap = {};
  if (ids.length) {
    const stepsRows = await query(`SELECT * FROM test_case_steps WHERE test_case_id = ANY($1::int[]) ORDER BY test_case_id, step_no`, [ids]);
    for (const s of stepsRows.rows) {
      if (!stepsMap[s.test_case_id]) stepsMap[s.test_case_id] = [];
      stepsMap[s.test_case_id].push(s);
    }
  }

  res.json({ data: rows.rows.map(tc => shape(tc, stepsMap[tc.id] || [])), meta: pageMeta(page, pageSize, total) });
});

/** GET /api/test-cases/:id */
const get = asyncHandler(async (req, res) => {
  const tc = await queryOne(
    `SELECT tc.*, r.code AS requirement_code, r.title AS requirement_title
     FROM test_cases tc LEFT JOIN requirements r ON r.id = tc.requirement_id WHERE tc.id = $1`,
    [req.params.id]
  );
  if (!tc) throw ApiError.notFound('Test case not found');

  const steps = await query(`SELECT * FROM test_case_steps WHERE test_case_id = $1 ORDER BY step_no`, [tc.id]);
  const cycles = await query(
    `SELECT c.id, c.name, ct.status, ct.assignee_id, u.full_name AS assignee_name, ct.due_date
     FROM cycle_tests ct JOIN test_cycles c ON c.id = ct.cycle_id LEFT JOIN users u ON u.id = ct.assignee_id
     WHERE ct.test_case_id = $1 ORDER BY c.id DESC`,
    [tc.id]
  );
  const executions = await query(
    `SELECT e.*, u.full_name AS executed_by_name FROM executions e LEFT JOIN users u ON u.id = e.executed_by
     WHERE e.test_case_id = $1 ORDER BY e.created_at DESC LIMIT 20`,
    [tc.id]
  );
  const script = await queryOne(`SELECT * FROM automation_scripts WHERE test_case_id = $1`, [tc.id]);

  res.json({ testCase: shape(tc, steps.rows), cycles: cycles.rows, executions: executions.rows, automationScript: script || null });
});

/** POST /api/test-cases (admin/lead) */
const create = asyncHandler(async (req, res) => {
  const { projectId, title, preconditions, expectedResult, priority, module, requirementId, isAutomated, steps } = req.body;

  // Validate project exists
  const proj = await queryOne('SELECT id FROM projects WHERE id = $1', [projectId]);
  if (!proj) throw ApiError.badRequest('Project not found');

  if (requirementId) {
    const reqExists = await queryOne('SELECT id FROM requirements WHERE id = $1 AND project_id = $2', [requirementId, projectId]);
    if (!reqExists) throw ApiError.badRequest('Requirement not found in this project');
  }

  const created = await tx(async (client) => {
    const code = await nextCode(client, 'TC');
    const tc = (
      await client.query(
        `INSERT INTO test_cases (project_id, code, title, preconditions, expected_result, priority, module, requirement_id, is_automated, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [projectId, code, title, preconditions || null, expectedResult, priority, module, requirementId || null, isAutomated || false, req.user.id]
      )
    ).rows[0];

    if (steps?.length) {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await client.query(`INSERT INTO test_case_steps (test_case_id, step_no, action) VALUES ($1,$2,$3)`, [tc.id, s.stepNo || i + 1, s.action]);
      }
    }

    await writeAudit({
      userId: req.user.id,
      entityType: 'test_case',
      entityId: tc.id,
      action: 'create',
      newValue: { code: tc.code, title: tc.title, module: tc.module },
      ip: clientIp(req),
    }, client);

    return tc;
  });

  const full = await queryOne(`SELECT tc.*, r.code AS requirement_code FROM test_cases tc LEFT JOIN requirements r ON r.id = tc.requirement_id WHERE tc.id = $1`, [created.id]);
  const stepsRows = await query(`SELECT * FROM test_case_steps WHERE test_case_id = $1 ORDER BY step_no`, [created.id]);

  // realtime
  const projRow = await queryOne('SELECT id FROM projects WHERE id = $1', [projectId]);
  if (projRow) realtime.emitToProject(projectId, 'test_case:created', { testCaseId: created.id });

  res.status(201).json({ testCase: shape(full, stepsRows.rows) });
});

/** PATCH /api/test-cases/:id (admin/lead) */
const update = asyncHandler(async (req, res) => {
  const before = await queryOne('SELECT * FROM test_cases WHERE id = $1', [req.params.id]);
  if (!before) throw ApiError.notFound('Test case not found');

  const { title, preconditions, expectedResult, priority, module, requirementId, isAutomated, isActive, steps } = req.body;

  const updated = await tx(async (client) => {
    const r = (
      await client.query(
        `UPDATE test_cases SET
           title = COALESCE($2, title),
           preconditions = COALESCE($3, preconditions),
           expected_result = COALESCE($4, expected_result),
           priority = COALESCE($5, priority),
           module = COALESCE($6, module),
           requirement_id = COALESCE($7, requirement_id),
           is_automated = COALESCE($8, is_automated),
           is_active = COALESCE($9, is_active)
         WHERE id = $1 RETURNING *`,
        [req.params.id, title ?? null, preconditions ?? null, expectedResult ?? null, priority ?? null, module ?? null, requirementId ?? null, isAutomated ?? null, isActive ?? null]
      )
    ).rows[0];

    if (steps) {
      await client.query(`DELETE FROM test_case_steps WHERE test_case_id = $1`, [r.id]);
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await client.query(`INSERT INTO test_case_steps (test_case_id, step_no, action) VALUES ($1,$2,$3)`, [r.id, s.stepNo || i + 1, s.action]);
      }
    }

    await writeAudit({
      userId: req.user.id,
      entityType: 'test_case',
      entityId: r.id,
      action: 'update',
      oldValue: { title: before.title, priority: before.priority, module: before.module },
      newValue: { title: r.title, priority: r.priority, module: r.module },
      ip: clientIp(req),
    }, client);

    return r;
  });

  const full = await queryOne(`SELECT tc.*, r.code AS requirement_code FROM test_cases tc LEFT JOIN requirements r ON r.id = tc.requirement_id WHERE tc.id = $1`, [updated.id]);
  const stepsRows = await query(`SELECT * FROM test_case_steps WHERE test_case_id = $1 ORDER BY step_no`, [updated.id]);

  realtime.emitToProject(updated.project_id, 'test_case:updated', { testCaseId: updated.id });

  res.json({ testCase: shape(full, stepsRows.rows) });
});

/** DELETE /api/test-cases/:id (admin/lead) soft delete */
const remove = asyncHandler(async (req, res) => {
  const tc = await queryOne('SELECT * FROM test_cases WHERE id = $1', [req.params.id]);
  if (!tc) throw ApiError.notFound('Test case not found');
  await query('UPDATE test_cases SET is_active = FALSE WHERE id = $1', [req.params.id]);
  await writeAudit({
    userId: req.user.id,
    entityType: 'test_case',
    entityId: tc.id,
    action: 'delete',
    oldValue: { isActive: true },
    newValue: { isActive: false },
    ip: clientIp(req),
  });
  realtime.emitToProject(tc.project_id, 'test_case:deleted', { testCaseId: tc.id });
  res.json({ message: `${tc.code} deactivated` });
});

module.exports = { list, get, create, update, remove, modules };
