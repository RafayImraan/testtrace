/**
 * Projects: the app is multi-project ready, the UI works with one active project
 * (chosen in the top bar, remembered in localStorage).
 */
const { query, queryOne } = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/error');
const { writeAudit, clientIp } = require('../utils/audit');

const shape = (p) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  description: p.description,
  isActive: p.is_active,
  createdAt: p.created_at,
  counts: p.test_cases !== undefined ? { testCases: p.test_cases, cycles: p.cycles } : undefined,
});

/** GET /api/projects */
const list = asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT p.*,
      (SELECT count(*)::int FROM test_cases tc WHERE tc.project_id = p.id) AS test_cases,
      (SELECT count(*)::int FROM test_cycles c WHERE c.project_id = p.id) AS cycles
    FROM projects p ORDER BY p.id`);
  res.json({ data: rows.rows.map(shape) });
});

/** GET /api/projects/:id */
const get = asyncHandler(async (req, res) => {
  const p = await queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  if (!p) throw ApiError.notFound('Project not found');
  res.json({ project: shape(p) });
});

/** POST /api/projects  (admin/lead) */
const create = asyncHandler(async (req, res) => {
  const { code, name, description } = req.body;
  const p = await queryOne(
    `INSERT INTO projects (code, name, description, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [code.toUpperCase(), name, description || null, req.user.id]
  );
  await writeAudit({
    userId: req.user.id,
    entityType: 'project',
    entityId: p.id,
    action: 'create',
    newValue: { code: p.code, name: p.name },
    ip: clientIp(req),
  });
  res.status(201).json({ project: shape(p) });
});

/** PATCH /api/projects/:id (admin/lead) */
const update = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;
  const p = await queryOne(
    `UPDATE projects SET name = COALESCE($2,name), description = COALESCE($3,description),
        is_active = COALESCE($4,is_active) WHERE id = $1 RETURNING *`,
    [req.params.id, name ?? null, description ?? null, isActive === undefined ? null : isActive]
  );
  if (!p) throw ApiError.notFound('Project not found');
  res.json({ project: shape(p) });
});

module.exports = { list, get, create, update };
