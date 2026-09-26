/**
 * Audit trail helper.
 * EVERY status change / CRUD action that matters calls writeAudit().
 * Rows are append-only: we store the old and new value as JSONB snapshots
 * so the Audit Log page can show "what exactly changed".
 *
 * Runs with the caller's client when inside a transaction, so the audit row
 * and the data change succeed or fail together.
 */
const { query } = require('../config/db');

/**
 * @param {object} p
 * @param {number|null} p.userId
 * @param {string} p.entityType  test_case | cycle_test | test_cycle | requirement | user | automation_run | automation_schedule
 * @param {number|null} p.entityId
 * @param {string} p.action      create | update | delete | status_change | assign | unassign | trigger | schedule | login | export
 * @param {object|null} p.oldValue
 * @param {object|null} p.newValue
 * @param {string|null} p.ip
 * @param {object|null} client   optional pg client (transaction)
 */
async function writeAudit({ userId = null, entityType, entityId = null, action, oldValue = null, newValue = null, ip = null }, client = null) {
  const sql = `
    INSERT INTO audit_logs (user_id, entity_type, entity_id, action, old_value, new_value, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at`;
  const params = [
    userId,
    entityType,
    entityId,
    action,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    ip,
  ];
  const runner = client ? (text, p) => client.query(text, p) : query;
  return (await runner(sql, params)).rows[0];
}

/** Turn req.ip / x-forwarded-for into a compact string for the audit row. */
function clientIp(req) {
  if (!req) return null;
  const fwd = (req.headers && req.headers['x-forwarded-for']) || '';
  return (fwd.split(',')[0] || req.ip || '').slice(0, 60) || null;
}

module.exports = { writeAudit, clientIp };
