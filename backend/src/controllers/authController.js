/**
 * Authentication controller: login, logout, current profile, password change.
 * Passwords are hashed with bcrypt; the API never returns password_hash.
 */
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { query, queryOne } = require('../config/db');
const { signToken } = require('../middleware/auth');
const { ApiError, asyncHandler } = require('../middleware/error');
const { writeAudit, clientIp } = require('../utils/audit');

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  fullName: u.full_name,
  role: u.role,
  isActive: u.is_active,
  avatarColor: u.avatar_color,
  lastLoginAt: u.last_login_at,
  createdAt: u.created_at,
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await queryOne('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);

  // Same message for unknown user and wrong password: no account enumeration.
  if (!user) throw ApiError.unauthorized('Invalid e-mail or password');
  if (!user.is_active) throw ApiError.forbidden('This account has been deactivated');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await writeAudit({
      userId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'login_failed',
      ip: clientIp(req),
    });
    throw ApiError.unauthorized('Invalid e-mail or password');
  }

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  await writeAudit({
    userId: user.id,
    entityType: 'user',
    entityId: user.id,
    action: 'login',
    newValue: { email: user.email, role: user.role },
    ip: clientIp(req),
  });

  res.json({ token: signToken(user), user: publicUser({ ...user, last_login_at: new Date() }) });
});

/** POST /api/auth/logout  (JWTs are stateless: the client drops the token) */
const logout = asyncHandler(async (req, res) => {
  await writeAudit({
    userId: req.user.id,
    entityType: 'user',
    entityId: req.user.id,
    action: 'logout',
    ip: clientIp(req),
  });
  res.json({ message: 'Logged out' });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!user) throw ApiError.notFound('User not found');
  const stats = await queryOne(
    `SELECT
       (SELECT count(*)::int FROM cycle_tests WHERE assignee_id = $1) AS assigned,
       (SELECT count(*)::int FROM cycle_tests
          WHERE assignee_id = $1 AND status IN ('pending','in_progress','blocked')) AS open,
       (SELECT count(*)::int FROM cycle_tests
          WHERE assignee_id = $1 AND status = 'passed') AS passed,
       (SELECT count(*)::int FROM audit_logs WHERE user_id = $1) AS actions`,
    [req.user.id]
  );
  res.json({ user: publicUser(user), stats });
});

/** PATCH /api/auth/profile  (any logged in user may edit their own name) */
const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, avatarColor } = req.body;
  const updated = await queryOne(
    `UPDATE users SET full_name = COALESCE($2, full_name),
                      avatar_color = COALESCE($3, avatar_color)
     WHERE id = $1 RETURNING *`,
    [req.user.id, fullName ?? null, avatarColor ?? null]
  );
  await writeAudit({
    userId: req.user.id,
    entityType: 'user',
    entityId: req.user.id,
    action: 'update_profile',
    newValue: { fullName, avatarColor },
    ip: clientIp(req),
  });
  res.json({ user: publicUser(updated) });
});

/** POST /api/auth/password */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) throw ApiError.badRequest('Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, hash]);
  await writeAudit({
    userId: req.user.id,
    entityType: 'user',
    entityId: req.user.id,
    action: 'change_password',
    ip: clientIp(req),
  });
  res.json({ message: 'Password updated' });
});

module.exports = { login, logout, me, updateProfile, changePassword, publicUser };
