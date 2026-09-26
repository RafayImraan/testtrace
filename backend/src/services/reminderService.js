/**
 * Due-soon reminder service.
 * Runs every 10 minutes (via node-cron). Finds cycle_tests:
 *   - due within 24h and still open (pending / in_progress / blocked)
 *   - already overdue
 * Creates a notification with a dedupe_key so each task only warns once per day.
 * Uses the realtime gateway to push the bell icon live.
 */
const { query } = require('../config/db');
const { notify } = require('./notificationService');

async function sendDueSoonReminders() {
  // tasks due in next 24h
  const dueSoon = await query(`
    SELECT ct.id, ct.cycle_id, ct.test_case_id, ct.assignee_id, ct.due_date,
           tc.code, tc.title, c.name AS cycle_name, c.project_id
    FROM cycle_tests ct
    JOIN test_cases tc ON tc.id = ct.test_case_id
    JOIN test_cycles c ON c.id = ct.cycle_id
    WHERE ct.assignee_id IS NOT NULL
      AND ct.due_date IS NOT NULL
      AND ct.status IN ('pending','in_progress','blocked')
      AND ct.due_date <= CURRENT_DATE + INTERVAL '1 day'
      AND ct.due_date >= CURRENT_DATE - INTERVAL '7 days'
  `);

  for (const row of dueSoon.rows) {
    const isOverdue = new Date(row.due_date) < new Date(new Date().toDateString());
    const key = `due:${row.id}:${new Date(row.due_date).toISOString().slice(0, 10)}`;
    await notify({
      userId: row.assignee_id,
      title: isOverdue ? `Overdue: ${row.code}` : `Due soon: ${row.code}`,
      message: `${row.code} – ${row.title} in cycle "${row.cycle_name}" is ${isOverdue ? 'OVERDUE' : 'due within 24h'} (due ${row.due_date.toISOString().slice(0,10)})`,
      type: isOverdue ? 'overdue' : 'due_soon',
      link: `/cycles/${row.cycle_id}`,
      dedupeKey: key,
    });
  }

  if (dueSoon.rows.length && process.env.NODE_ENV !== 'test') {
    console.log(`[reminder] processed ${dueSoon.rows.length} due/overdue tasks`);
  }
}

module.exports = { sendDueSoonReminders };
