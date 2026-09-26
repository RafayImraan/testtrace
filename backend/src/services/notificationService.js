/**
 * In-app notification service.
 * Writes a row in `notifications` and pushes it to the user's socket room so
 * the bell icon updates instantly (no polling, no page refresh).
 *
 * dedupe_key protects against duplicates: the due-soon cron runs every few
 * minutes but a tester should only be warned once per task.
 */
const { query, queryOne } = require('../config/db');
const realtime = require('./realtime');

/**
 * @returns {Promise<object|null>} the created notification, or null if deduped
 */
async function notify({
  userId,
  title,
  message = null,
  type = 'info',
  link = null,
  dedupeKey = null,
}, client = null) {
  if (!userId) return null;
  const sql = `
    INSERT INTO notifications (user_id, title, message, type, link, dedupe_key)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING *`;
  const runner = client ? (t, p) => client.query(t, p) : query;
  const rows = (await runner(sql, [userId, title, message, type, link, dedupeKey])).rows;
  const created = rows[0] || null;

  if (created) {
    realtime.emitToUser(userId, 'notification:new', shape(created));
  }
  return created;
}

/** DB row -> API shape */
const shape = (n) => ({
  id: n.id,
  title: n.title,
  message: n.message,
  type: n.type,
  link: n.link,
  isRead: n.is_read,
  createdAt: n.created_at,
});

/** GET list + unread count for the bell dropdown */
async function listForUser(userId, { limit = 30, unreadOnly = false } = {}) {
  const rows = await query(
    `SELECT * FROM notifications
     WHERE user_id = $1 ${unreadOnly ? 'AND is_read = FALSE' : ''}
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  const unread = await queryOne(
    'SELECT count(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  );
  return { data: rows.rows.map(shape), unread: unread.c };
}

async function markRead(userId, id = null) {
  if (id) {
    await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [id, userId]);
  } else {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [userId]);
  }
  return listForUser(userId);
}

async function remove(userId, id) {
  await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, userId]);
}

module.exports = { notify, listForUser, markRead, remove, shape };
