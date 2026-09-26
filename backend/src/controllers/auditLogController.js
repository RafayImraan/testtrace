const { query, queryOne } = require('../config/db');
const { asyncHandler } = require('../middleware/error');
const { pagination, pageMeta } = require('../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const { userId, entityType, action, from, to, page, pageSize } = req.query;
  const { limit, offset, page: pg, pageSize: ps } = pagination({ page, pageSize });
  const conds = [];
  const params = [];
  let idx = 1;
  if (userId) { params.push(Number(userId)); conds.push(`al.user_id = $${idx++}`); }
  if (entityType) { params.push(entityType); conds.push(`al.entity_type = $${idx++}`); }
  if (action) { params.push(action); conds.push(`al.action = $${idx++}`); }
  if (from) { params.push(new Date(from)); conds.push(`al.created_at >= $${idx++}`); }
  if (to) { params.push(new Date(to)); conds.push(`al.created_at <= $${idx++}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const total = (await queryOne(`SELECT count(*)::int AS c FROM audit_logs al ${where}`, params)).c;
  const rows = await query(
    `SELECT al.*, u.full_name AS user_name, u.email AS user_email
     FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
     ${where} ORDER BY al.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json({ data: rows.rows, meta: pageMeta(pg, ps, total) });
});

module.exports = { list };
