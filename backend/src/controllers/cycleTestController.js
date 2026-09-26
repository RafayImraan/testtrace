/**
 * CycleTests controller: my tasks, status change, execute with screenshot, executions history.
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const config = require('../config/env');
const { query, queryOne, tx } = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/error');
const { writeAudit, clientIp } = require('../utils/audit');
const realtime = require('../services/realtime');

const shape = (ct) => ({
  id: ct.id,
  cycleId: ct.cycle_id,
  testCaseId: ct.test_case_id,
  testCaseCode: ct.test_case_code || ct.code,
  title: ct.title,
  module: ct.module,
  priority: ct.priority,
  isAutomated: ct.is_automated,
  assigneeId: ct.assignee_id,
  assigneeName: ct.assignee_name,
  assigneeColor: ct.assignee_color,
  assignedBy: ct.assigned_by,
  dueDate: ct.due_date,
  status: ct.status,
  actualResult: ct.actual_result,
  remarks: ct.remarks,
  executedBy: ct.executed_by,
  executedAt: ct.executed_at,
  cycleName: ct.cycle_name,
  projectId: ct.project_id,
  overdue: ct.due_date ? new Date(ct.due_date) < new Date(new Date().toDateString()) && ['pending','in_progress','blocked'].includes(ct.status) : false,
});

// Multer setup for screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(config.uploads.dir, 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `ct-${req.params.id}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: config.uploads.maxMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'), false);
    cb(null, true);
  },
});

/** GET /api/cycle-tests/my-tasks */
const myTasks = asyncHandler(async (req, res) => {
  const { status, overdue } = req.query;
  const conditions = ['ct.assignee_id = $1'];
  const params = [req.user.id];
  let idx = 2;
  if (status) { params.push(status); conditions.push(`ct.status = $${idx++}`); }
  if (overdue === 'true') { conditions.push(`ct.due_date < CURRENT_DATE AND ct.status IN ('pending','in_progress','blocked')`); }

  const rows = await query(
    `SELECT ct.*, tc.code, tc.title, tc.module, tc.priority, tc.is_automated,
            c.name AS cycle_name, c.project_id, c.id AS cycle_id_real,
            u.full_name AS assignee_name
     FROM cycle_tests ct
     JOIN test_cases tc ON tc.id = ct.test_case_id
     JOIN test_cycles c ON c.id = ct.cycle_id
     LEFT JOIN users u ON u.id = ct.assignee_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ct.due_date NULLS LAST, ct.id DESC`,
    params
  );
  res.json({ data: rows.rows.map(r => shape({ ...r, cycle_id: r.cycle_id || r.cycle_id_real, test_case_code: r.code })) });
});

/** PATCH /api/cycle-tests/:id/status */
const changeStatus = asyncHandler(async (req, res) => {
  const { status, actualResult, remarks } = req.body;
  const ct = await queryOne(
    `SELECT ct.*, tc.project_id, tc.code FROM cycle_tests ct JOIN test_cases tc ON tc.id = ct.test_case_id WHERE ct.id = $1`,
    [req.params.id]
  );
  if (!ct) throw ApiError.notFound('Cycle test not found');

  // RBAC: tester can only update own assigned tests
  if (req.user.role === 'tester' && ct.assignee_id !== req.user.id) {
    throw ApiError.forbidden('You can only update your own assigned tests');
  }

  const beforeStatus = ct.status;

  const updated = await tx(async (client) => {
    const r = (
      await client.query(
        `UPDATE cycle_tests SET status = $2, actual_result = COALESCE($3, actual_result), remarks = COALESCE($4, remarks),
                executed_by = $5, executed_at = now(), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [ct.id, status, actualResult || null, remarks || null, req.user.id]
      )
    ).rows[0];

    await client.query(
      `INSERT INTO executions (cycle_test_id, test_case_id, cycle_id, status, execution_type, actual_result, remarks, executed_by)
       VALUES ($1,$2,$3,$4,'manual',$5,$6,$7)`,
      [r.id, r.test_case_id, r.cycle_id, status, actualResult || null, remarks || null, req.user.id]
    );

    await writeAudit({
      userId: req.user.id,
      entityType: 'cycle_test',
      entityId: r.id,
      action: 'status_change',
      oldValue: { status: beforeStatus },
      newValue: { status, actualResult, remarks },
      ip: clientIp(req),
    }, client);

    return r;
  });

  // realtime
  realtime.emitToProject(ct.project_id, 'cycle_test:updated', {
    cycleTestId: updated.id,
    cycleId: updated.cycle_id,
    testCaseId: updated.test_case_id,
    status,
    executedBy: req.user.id,
  });
  realtime.emitDashboard(ct.project_id, { cycleId: updated.cycle_id, cycleTestId: updated.id });

  const full = await queryOne(
    `SELECT ct.*, tc.code, tc.title, tc.module, tc.priority, tc.is_automated, c.name AS cycle_name, c.project_id
     FROM cycle_tests ct JOIN test_cases tc ON tc.id = ct.test_case_id JOIN test_cycles c ON c.id = ct.cycle_id
     WHERE ct.id = $1`,
    [updated.id]
  );

  res.json({ cycleTest: shape({ ...full, test_case_code: full.code }) });
});

/** POST /api/cycle-tests/:id/execute  (multipart with screenshot) */
const execute = [
  upload.single('screenshot'),
  asyncHandler(async (req, res) => {
    const { status, actualResult, remarks } = req.body;
    if (!status) throw ApiError.badRequest('status is required');

    const ct = await queryOne(
      `SELECT ct.*, tc.project_id, tc.code FROM cycle_tests ct JOIN test_cases tc ON tc.id = ct.test_case_id WHERE ct.id = $1`,
      [req.params.id]
    );
    if (!ct) throw ApiError.notFound('Cycle test not found');
    if (req.user.role === 'tester' && ct.assignee_id !== req.user.id) {
      throw ApiError.forbidden('You can only execute your own assigned tests');
    }

    const screenshotPath = req.file ? `/uploads/screenshots/${req.file.filename}` : null;
    const beforeStatus = ct.status;

    const updated = await tx(async (client) => {
      const r = (
        await client.query(
          `UPDATE cycle_tests SET status = $2, actual_result = COALESCE($3, actual_result), remarks = COALESCE($4, remarks),
                  executed_by = $5, executed_at = now(), updated_at = now()
           WHERE id = $1 RETURNING *`,
          [ct.id, status, actualResult || null, remarks || null, req.user.id]
        )
      ).rows[0];

      const exec = (
        await client.query(
          `INSERT INTO executions (cycle_test_id, test_case_id, cycle_id, status, execution_type, actual_result, remarks, screenshot_path, executed_by)
           VALUES ($1,$2,$3,$4,'manual',$5,$6,$7,$8) RETURNING *`,
          [r.id, r.test_case_id, r.cycle_id, status, actualResult || null, remarks || null, screenshotPath, req.user.id]
        )
      ).rows[0];

      await writeAudit({
        userId: req.user.id,
        entityType: 'cycle_test',
        entityId: r.id,
        action: 'execute',
        oldValue: { status: beforeStatus },
        newValue: { status, executionId: exec.id, screenshotPath },
        ip: clientIp(req),
      }, client);

      return { cycleTest: r, execution: exec };
    });

    realtime.emitToProject(ct.project_id, 'cycle_test:updated', {
      cycleTestId: updated.cycleTest.id,
      cycleId: updated.cycleTest.cycle_id,
      testCaseId: updated.cycleTest.test_case_id,
      status,
      screenshotPath,
    });
    realtime.emitDashboard(ct.project_id, { cycleId: updated.cycleTest.cycle_id });

    res.json({ cycleTest: updated.cycleTest, execution: updated.execution });
  }),
];

/** GET /api/cycle-tests/:id/executions */
const executions = asyncHandler(async (req, res) => {
  const ct = await queryOne('SELECT id FROM cycle_tests WHERE id = $1', [req.params.id]);
  if (!ct) throw ApiError.notFound('Cycle test not found');
  const rows = await query(
    `SELECT e.*, u.full_name AS executed_by_name FROM executions e LEFT JOIN users u ON u.id = e.executed_by
     WHERE e.cycle_test_id = $1 ORDER BY e.created_at DESC`,
    [req.params.id]
  );
  res.json({ data: rows.rows });
});

module.exports = { myTasks, changeStatus, execute, executions };
