/**
 * Requirements CRUD + traceability matrix.
 */
const { query, queryOne, tx } = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/error');
const { writeAudit, clientIp } = require('../utils/audit');
const { pagination, pageMeta, nextCode } = require('../utils/helpers');
const realtime = require('../services/realtime');

const shape = (r) => ({
  id: r.id,
  projectId: r.project_id,
  code: r.code,
  title: r.title,
  description: r.description,
  priority: r.priority,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  testCaseCount: r.test_case_count ? Number(r.test_case_count) : 0,
});

const list = asyncHandler(async (req, res) => {
  const { projectId, q, page, pageSize } = req.query;
  const { limit, offset, page: pg, pageSize: ps } = pagination({ page, pageSize });
  const conds = [];
  const params = [];
  let idx = 1;
  if (projectId) { params.push(Number(projectId)); conds.push(`r.project_id = $${idx++}`); }
  if (q) { params.push(`%${q}%`); conds.push(`(r.code ILIKE $${idx} OR r.title ILIKE $${idx})`); idx++; }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const total = (await queryOne(`SELECT count(*)::int AS c FROM requirements r ${where}`, params)).c;
  const rows = await query(
    `SELECT r.*, (SELECT count(*) FROM test_cases tc WHERE tc.requirement_id = r.id)::int AS test_case_count
     FROM requirements r ${where} ORDER BY r.id LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json({ data: rows.rows.map(shape), meta: pageMeta(pg, ps, total) });
});

const get = asyncHandler(async (req, res) => {
  const r = await queryOne('SELECT * FROM requirements WHERE id = $1', [req.params.id]);
  if (!r) throw ApiError.notFound('Requirement not found');
  const tcs = await query(`SELECT id, code, title, module, priority, is_automated FROM test_cases WHERE requirement_id = $1 ORDER BY id`, [r.id]);
  res.json({ requirement: shape(r), testCases: tcs.rows });
});

const create = asyncHandler(async (req, res) => {
  const { projectId, title, description, priority } = req.body;
  const proj = await queryOne('SELECT id FROM projects WHERE id = $1', [projectId]);
  if (!proj) throw ApiError.badRequest('Project not found');

  const created = await tx(async (client) => {
    const code = await nextCode(client, 'REQ');
    const r = (await client.query(
      `INSERT INTO requirements (project_id, code, title, description, priority, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [projectId, code, title, description || null, priority || 'medium', req.user.id]
    )).rows[0];
    await writeAudit({ userId: req.user.id, entityType: 'requirement', entityId: r.id, action: 'create', newValue: { code: r.code, title: r.title }, ip: clientIp(req) }, client);
    return r;
  });
  realtime.emitToProject(projectId, 'requirement:created', { requirementId: created.id });
  res.status(201).json({ requirement: shape(created) });
});

const update = asyncHandler(async (req, res) => {
  const before = await queryOne('SELECT * FROM requirements WHERE id = $1', [req.params.id]);
  if (!before) throw ApiError.notFound('Requirement not found');
  const { title, description, priority } = req.body;
  const r = await queryOne(
    `UPDATE requirements SET title = COALESCE($2, title), description = COALESCE($3, description), priority = COALESCE($4, priority) WHERE id = $1 RETURNING *`,
    [req.params.id, title ?? null, description ?? null, priority ?? null]
  );
  await writeAudit({ userId: req.user.id, entityType: 'requirement', entityId: r.id, action: 'update', oldValue: { title: before.title }, newValue: { title: r.title }, ip: clientIp(req) });
  realtime.emitToProject(r.project_id, 'requirement:updated', { requirementId: r.id });
  res.json({ requirement: shape(r) });
});

const remove = asyncHandler(async (req, res) => {
  const r = await queryOne('SELECT * FROM requirements WHERE id = $1', [req.params.id]);
  if (!r) throw ApiError.notFound('Requirement not found');
  await query('DELETE FROM requirements WHERE id = $1', [req.params.id]);
  await writeAudit({ userId: req.user.id, entityType: 'requirement', entityId: r.id, action: 'delete', oldValue: { code: r.code }, ip: clientIp(req) });
  realtime.emitToProject(r.project_id, 'requirement:deleted', { requirementId: r.id });
  res.json({ message: `${r.code} deleted` });
});

/** GET /api/requirements/traceability/matrix?projectId=&cycleId= */
const matrix = asyncHandler(async (req, res) => {
  const { projectId, cycleId } = req.query;
  if (!projectId && !cycleId) throw ApiError.badRequest('projectId or cycleId required');

  let params = [];
  if (cycleId) {
    params = [Number(cycleId)];
  } else {
    params = [Number(projectId)];
  }

  const rows = await query(
    `SELECT req.id AS requirement_id, req.code AS requirement_code, req.title AS requirement_title, req.priority AS requirement_priority,
            tc.id AS test_case_id, tc.code AS test_case_code, tc.title AS test_case_title, tc.priority AS test_case_priority, tc.is_automated,
            ct.id AS cycle_test_id, ct.cycle_id, c.name AS cycle_name, ct.status, ct.due_date, ct.remarks,
            u.full_name AS assignee,
            le.execution_type, le.created_at AS last_executed_at
     FROM requirements req
     LEFT JOIN test_cases tc ON tc.requirement_id = req.id
     LEFT JOIN cycle_tests ct ON ct.test_case_id = tc.id ${cycleId ? 'AND ct.cycle_id = $1' : ''}
     LEFT JOIN test_cycles c ON c.id = ct.cycle_id
     LEFT JOIN users u ON u.id = ct.assignee_id
     LEFT JOIN v_latest_execution le ON le.cycle_test_id = ct.id
     ${cycleId ? '' : 'WHERE req.project_id = $1'}
     ORDER BY req.code, tc.code`,
    params
  );

  // Aggregate coverage per requirement
  const map = {};
  for (const r of rows.rows) {
    if (!map[r.requirement_id]) {
      map[r.requirement_id] = {
        requirementId: r.requirement_id,
        code: r.requirement_code,
        title: r.requirement_title,
        priority: r.requirement_priority,
        testCases: [],
        total: 0,
        passed: 0,
        failed: 0,
        coverage: 0,
      };
    }
    if (r.test_case_id) {
      map[r.requirement_id].testCases.push({
        testCaseId: r.test_case_id,
        code: r.test_case_code,
        title: r.test_case_title,
        priority: r.test_case_priority,
        isAutomated: r.is_automated,
        cycleTestId: r.cycle_test_id,
        cycleId: r.cycle_id,
        cycleName: r.cycle_name,
        status: r.status,
        assignee: r.assignee,
        executionType: r.execution_type,
        lastExecutedAt: r.last_executed_at,
      });
    }
  }

  for (const reqId of Object.keys(map)) {
    const entry = map[reqId];
    entry.total = entry.testCases.length;
    entry.passed = entry.testCases.filter(tc => tc.status === 'passed').length;
    entry.failed = entry.testCases.filter(tc => tc.status === 'failed').length;
    const executed = entry.testCases.filter(tc => ['passed','failed','blocked'].includes(tc.status)).length;
    entry.coverage = entry.total ? Math.round((executed / entry.total) * 100) : 0;
  }

  const data = Object.values(map);
  const summary = {
    totalRequirements: data.length,
    totalTestCases: data.reduce((s, r) => s + r.total, 0),
    avgCoverage: data.length ? Math.round(data.reduce((s, r) => s + r.coverage, 0) / data.length) : 0,
  };

  res.json({ data, summary });
});

module.exports = { list, get, create, update, remove, matrix };
