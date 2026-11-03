const { query, queryOne, tx } = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/error');
const { writeAudit, clientIp } = require('../utils/audit');

const shape = (d) => ({
  id: d.id,
  code: `DEF-${String(d.id).padStart(3, '0')}`,
  projectId: d.project_id,
  requirementId: d.requirement_id,
  requirementCode: d.requirement_code,
  requirementTitle: d.requirement_title,
  testCaseId: d.test_case_id,
  testCaseCode: d.test_case_code,
  testCaseTitle: d.test_case_title,
  cycleTestId: d.cycle_test_id,
  cycleName: d.cycle_name,
  title: d.title,
  description: d.description,
  severity: d.severity,
  status: d.status,
  createdBy: d.created_by,
  reporter: d.reporter,
  assignedTo: d.assigned_to,
  assignee: d.assignee,
  resolvedAt: d.resolved_at,
  createdAt: d.created_at,
  updatedAt: d.updated_at,
});

const joins = `
  SELECT d.*, r.code AS requirement_code, r.title AS requirement_title,
         tc.code AS test_case_code, tc.title AS test_case_title,
         c.name AS cycle_name, reporter.full_name AS reporter,
         assignee.full_name AS assignee
  FROM defects d
  JOIN requirements r ON r.id = d.requirement_id
  JOIN test_cases tc ON tc.id = d.test_case_id
  LEFT JOIN cycle_tests ct ON ct.id = d.cycle_test_id
  LEFT JOIN test_cycles c ON c.id = ct.cycle_id
  LEFT JOIN users reporter ON reporter.id = d.created_by
  LEFT JOIN users assignee ON assignee.id = d.assigned_to`;

const list = asyncHandler(async (req, res) => {
  const projectId = Number(req.query.projectId);
  if (!Number.isInteger(projectId) || projectId <= 0) throw ApiError.badRequest('projectId is required');
  const params = [projectId];
  let filter = 'WHERE d.project_id = $1';
  if (req.query.status) { params.push(req.query.status); filter += ` AND d.status = $${params.length}`; }
  if (req.query.severity) { params.push(req.query.severity); filter += ` AND d.severity = $${params.length}`; }
  const rows = await query(`${joins} ${filter} ORDER BY d.created_at DESC`, params);
  res.json({ data: rows.rows.map(shape) });
});

const create = asyncHandler(async (req, res) => {
  const { projectId, requirementId, testCaseId, cycleTestId, title, description, severity } = req.body;
  const tc = await queryOne(
    'SELECT id, project_id, requirement_id FROM test_cases WHERE id = $1',
    [testCaseId]
  );
  if (!tc || tc.project_id !== projectId || tc.requirement_id !== requirementId) {
    throw ApiError.badRequest('The selected test case must belong to the project and requirement');
  }
  if (cycleTestId) {
    const linked = await queryOne(
      'SELECT id FROM cycle_tests WHERE id = $1 AND test_case_id = $2',
      [cycleTestId, testCaseId]
    );
    if (!linked) throw ApiError.badRequest('Cycle execution does not match the selected test case');
  }

  const created = await tx(async (client) => {
    const defect = (await client.query(
      `INSERT INTO defects (project_id, requirement_id, test_case_id, cycle_test_id, title, description, severity, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [projectId, requirementId, testCaseId, cycleTestId || null, title, description, severity || 'major', req.user.id]
    )).rows[0];
    await writeAudit({
      userId: req.user.id,
      entityType: 'defect',
      entityId: defect.id,
      action: 'create',
      newValue: { title, severity: defect.severity, requirementId, testCaseId, cycleTestId: cycleTestId || null },
      ip: clientIp(req),
    }, client);
    return defect;
  });
  const full = await queryOne(`${joins} WHERE d.id = $1`, [created.id]);
  res.status(201).json({ defect: shape(full) });
});

const update = asyncHandler(async (req, res) => {
  const before = await queryOne('SELECT * FROM defects WHERE id = $1', [req.params.id]);
  if (!before) throw ApiError.notFound('Defect not found');
  const { status, severity, assignedTo } = req.body;
  if (assignedTo) {
    const assignee = await queryOne('SELECT id FROM users WHERE id = $1 AND is_active', [assignedTo]);
    if (!assignee) throw ApiError.badRequest('Assignee not found or inactive');
  }
  const after = await tx(async (client) => {
    const row = (await client.query(
      `UPDATE defects SET status = COALESCE($2, status), severity = COALESCE($3, severity),
              assigned_to = COALESCE($4, assigned_to),
              resolved_at = CASE WHEN COALESCE($2, status) IN ('fixed','closed') THEN COALESCE(resolved_at, now())
                                 ELSE NULL END
       WHERE id = $1 RETURNING *`,
      [before.id, status || null, severity || null, assignedTo || null]
    )).rows[0];
    await writeAudit({
      userId: req.user.id,
      entityType: 'defect',
      entityId: row.id,
      action: 'update',
      oldValue: { status: before.status, severity: before.severity, assignedTo: before.assigned_to },
      newValue: { status: row.status, severity: row.severity, assignedTo: row.assigned_to },
      ip: clientIp(req),
    }, client);
    return row;
  });
  const full = await queryOne(`${joins} WHERE d.id = $1`, [after.id]);
  res.json({ defect: shape(full) });
});

module.exports = { list, create, update };
