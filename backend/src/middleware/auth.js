/**
 * Authentication (JWT) + Role based access control.
 *
 *  authenticate        -> verifies "Authorization: Bearer <token>" and loads req.user
 *  authorize(...roles) -> allows only the listed roles (admin always allowed)
 *  requireSelfOrRoles  -> testers may only touch their own rows
 */
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { queryOne } = require('../config/db');
const { ApiError, asyncHandler } = require('./error');

/** Sign a JWT for a user row. */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.full_name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/** Verify a token and return its payload (throws ApiError on failure). */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token'
    );
  }
}

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Missing bearer token');

  const payload = verifyToken(token);
  // Re-read the user so de-activated accounts lose access immediately and
  // role changes take effect without waiting for the token to expire.
  const user = await queryOne(
    'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
    [payload.sub]
  );
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.is_active) throw ApiError.forbidden('Account is deactivated');

  req.user = user;
  next();
});

/** Role guard. Usage: router.post('/', authenticate, authorize('admin','lead'), handler) */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    return next(
      ApiError.forbidden(`Role "${req.user.role}" is not allowed to perform this action`)
    );
  };
}

/** true if the requester is lead/admin (or admin). */
const isManager = (user) => user && (user.role === 'admin' || user.role === 'lead');

module.exports = { signToken, verifyToken, authenticate, authorize, isManager };
