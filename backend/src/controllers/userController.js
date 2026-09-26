/**
 * User management (admin only, except the "list assignable users" helper which
 * leads need in order to assign work).
 */
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { query, queryOne, tx } = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/error');
const { writeAudit, clientIp } = require('../utils/audit');
const { publicUser } = require('./authController');
const { pagination, pageMeta } = require('../utils/helpers');

/** GET /api/users  (admin/lead) - filters: role, active, q */
const listUsers = asyncHandler(async (req, res) => {
  const { role, active, q } = req.validatedQuery || {};
  const { page, pageSize, limit, offset } = pagination(req.validatedQuery || {});
  const where = [];
  const params = [];
  if (role) { params.push(role); where.push(`role = $${params.length}`); }
  if (active !== undefined) { params.push(active); where.push(`is_active = $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await queryOne(`SELECT count(*)::int AS c FROM users ${clause}`, params)).c;
  const rows = await query(
    `SELECT * FROM users ${clause} ORDER BY id LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json({ data: rows.rows.map(publicUser), meta: pageMeta(page, pageSize, total) });
});

/** GET /api/users/assignable  (admin/lead) - light list for dropdowns */
const assignableUsers = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT id, full_name, email, role, avatar_color FROM users
     WHERE is_active AND role <> 'admin' ORDER BY role, full_name`
  );
  res.json({
    data: rows.rows.map((u) => ({
      id: u.id,
      fullName: u.full_name,
      email: u.email,
      role: u.role,
      avatarColor: u.avatar_color,
    })),
  });
});

/** GET /api/users/:id */
const getUser = asyncHandler(async (req, res) => {
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user: publicUser(user) });
});

/** POST /api/users  (admin only) - accounts are created by an admin */
const createUser = asyncHandler(async (req, res) => {
  const { email, password, fullName, role, avatarColor } = req.body;
  const exists = await queryOne('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  if (exists) throw ApiError.conflict('A user with that e-mail already exists');

  const hash = await bcrypt.hash(password, config.bcryptRounds);
  const created = await tx(async (client) => {
    const r = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, avatar_color)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [email, hash, fullName, role, avatarColor || null]
    );
    await writeAudit(
      {
        userId: req.user.id,
        entityType: 'user',
        entityId: r.rows[0].id,
        action: 'create',
        newValue: { email, fullName, role },
        ip: clientIp(req),
      },
      client
    );
    return r.rows[0];
  });
  res.status(201).json({ user: publicUser(created) });
});

/** PATCH /api/users/:id  (admin only) - edit name/role/password/active flag */
const updateUser = asyncHandler(async (req, res) => {
  const { fullName, role, isActive, password, email, avatarColor } = req.body;
  const before = await queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!before) throw ApiError.notFound('User not found');

  // Guard rails: never lock yourself out of the system.
  if (before.id === req.user.id && (isActive === false || role === 'tester')) {
    throw ApiError.badRequest('You cannot deactivate or demote your own admin account');
  }
  if (email && email.toLowerCase() !== before.email.toLowerCase()) {
    const dupe = await queryOne('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (dupe) throw ApiError.conflict('A user with that e-mail already exists');
  }

  const hash = password ? await bcrypt.hash(password, config.bcryptRounds) : null;
  const updated = await tx(async (client) => {
    const r = await client.query(
      `UPDATE users SET
         full_name    = COALESCE($2, full_name),
         email        = COALESCE($3, email),
         role         = COALESCE($4, role),
         is_active    = COALESCE($5, is_active),
         avatar_color = COALESCE($6, avatar_color),
         password_hash= COALESCE($7, password_hash)
       WHERE id = $1 RETURNING *`,
      [req.params.id, fullName ?? null, email ?? null, role ?? null,
       isActive === undefined ? null : isActive, avatarColor ?? null, hash]
    );
    await writeAudit(
      {
        userId: req.user.id,
        entityType: 'user',
        entityId: before.id,
        action: 'update',
        oldValue: { role: before.role, isActive: before.is_active, fullName: before.full_name },
        newValue: { role: r.rows[0].role, isActive: r.rows[0].is_active, fullName: r.rows[0].full_name },
        ip: clientIp(req),
      },
      client
    );
    return r.rows[0];
  });
  res.json({ user: publicUser(updated) });
});

/** DELETE /api/users/:id  (admin only, soft: deactivate) */
const deactivateUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw ApiError.badRequest('You cannot deactivate your own account');
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [id]);
  if (!user) throw ApiError.notFound('User not found');

  await query('UPDATE users SET is_active = FALSE WHERE id = $1', [id]);
  await writeAudit({
    userId: req.user.id,
    entityType: 'user',
    entityId: id,
    action: 'deactivate',
    oldValue: { isActive: true },
    newValue: { isActive: false },
    ip: clientIp(req),
  });
  res.json({ message: `${user.full_name} deactivated` });
});

module.exports = { listUsers, assignableUsers, getUser, createUser, updateUser, deactivateUser };
