/**
 * Dashboard stats: cards, status doughnut, pass/fail per module, execution trend.
 */
const { query, queryOne } = require('../config/db');
const { asyncHandler } = require('../middleware/error');

const getStats = asyncHandler(async (req, res) => {
  const { cycleId, projectId } = req.query;

  let params = [];
  if (cycleId) {
    params = [Number(cycleId)];
  } else if (projectId) {
    params = [Number(projectId)];
  }

  // Base query for cycle_tests
  const baseWhere = cycleId ? 'WHERE ct.cycle_id = $1' : projectId ? 'WHERE c.project_id = $1' : '';
  const baseParams = params;

  // Cards
  const cardsRow = await queryOne(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE ct.status = 'pending')::int AS pending,
       count(*) FILTER (WHERE ct.status = 'in_progress')::int AS in_progress,
       count(*) FILTER (WHERE ct.status = 'passed')::int AS passed,
       count(*) FILTER (WHERE ct.status = 'failed')::int AS failed,
       count(*) FILTER (WHERE ct.status = 'blocked')::int AS blocked,
       count(*) FILTER (WHERE ct.status IN ('passed','failed','blocked'))::int AS executed,
       count(*) FILTER (WHERE ct.due_date < CURRENT_DATE AND ct.status IN ('pending','in_progress','blocked'))::int AS overdue
     FROM cycle_tests ct
     ${cycleId ? '' : projectId ? 'JOIN test_cycles c ON c.id = ct.cycle_id' : ''}
     ${baseWhere}`,
    baseParams
  );

  const total = cardsRow.total || 0;
  const executed = cardsRow.executed || 0;
  const passed = cardsRow.passed || 0;
  const executedPct = total ? Math.round((executed / total) * 100) : 0;
  const passRate = executed ? Math.round((passed / executed) * 100) : 0;

  // Status doughnut
  const statusData = {
    pending: cardsRow.pending,
    in_progress: cardsRow.in_progress,
    passed: cardsRow.passed,
    failed: cardsRow.failed,
    blocked: cardsRow.blocked,
  };

  // Pass/fail per module bar chart
  const perModule = await query(
    `SELECT tc.module,
            count(*)::int AS total,
            count(*) FILTER (WHERE ct.status = 'passed')::int AS passed,
            count(*) FILTER (WHERE ct.status = 'failed')::int AS failed,
            count(*) FILTER (WHERE ct.status = 'blocked')::int AS blocked
     FROM cycle_tests ct
     JOIN test_cases tc ON tc.id = ct.test_case_id
     ${cycleId ? '' : projectId ? 'JOIN test_cycles c ON c.id = ct.cycle_id' : ''}
     ${baseWhere}
     GROUP BY tc.module
     ORDER BY total DESC`,
    baseParams
  );

  // Execution trend last 14 days
  const trendJoin = projectId && !cycleId ? 'JOIN test_cycles c ON c.id = e.cycle_id' : '';
  const trendWhere = [
    cycleId ? 'e.cycle_id = $1' : projectId ? 'c.project_id = $1' : 'TRUE',
    `e.created_at >= CURRENT_DATE - INTERVAL '14 days'`,
  ];
  const trend = await query(
    `SELECT date_trunc('day', e.created_at)::date AS day,
            count(*)::int AS total,
            count(*) FILTER (WHERE e.status = 'passed')::int AS passed,
            count(*) FILTER (WHERE e.status = 'failed')::int AS failed
     FROM executions e
     ${trendJoin}
     WHERE ${trendWhere.join(' AND ')}
     GROUP BY 1
     ORDER BY 1`,
    baseParams
  );

  // Recent executions
  const recent = await query(
    `SELECT e.*, tc.code, tc.title, c.name AS cycle_name, u.full_name AS executed_by_name
     FROM executions e
     JOIN test_cases tc ON tc.id = e.test_case_id
     JOIN test_cycles c ON c.id = e.cycle_id
     LEFT JOIN users u ON u.id = e.executed_by
     ${baseWhere.replace('ct.', 'e.').replace('c.project_id', 'c.project_id')}
     ORDER BY e.created_at DESC LIMIT 10`,
    baseParams
  );

  res.json({
    cards: { ...cardsRow, total, executed, executedPct, passRate },
    status: statusData,
    perModule: perModule.rows,
    trend: trend.rows,
    recent: recent.rows,
    filters: { cycleId: cycleId ? Number(cycleId) : null, projectId: projectId ? Number(projectId) : null },
  });
});

module.exports = { getStats };
