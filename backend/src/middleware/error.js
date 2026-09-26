/**
 * Centralised error handling.
 * Every API error leaves the server in ONE shape:
 *   { "error": { "message": "...", "code": "VALIDATION_ERROR", "details": [...] } }
 * Controllers/middleware throw ApiError and the handler at the bottom formats it.
 */

/** Application error with an HTTP status attached. */
class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code || defaultCode(status);
    this.details = details;
    Error.captureStackTrace(this, ApiError);
  }
  static badRequest(msg = 'Bad request', opts) { return new ApiError(400, msg, opts); }
  static unauthorized(msg = 'Authentication required', opts) { return new ApiError(401, msg, opts); }
  static forbidden(msg = 'You do not have permission to do this', opts) { return new ApiError(403, msg, opts); }
  static notFound(msg = 'Resource not found', opts) { return new ApiError(404, msg, opts); }
  static conflict(msg = 'Conflict with existing data', opts) { return new ApiError(409, msg, opts); }
  static tooMany(msg = 'Too many requests', opts) { return new ApiError(429, msg, opts); }
  static internal(msg = 'Internal server error', opts) { return new ApiError(500, msg, opts); }
}

function defaultCode(status) {
  return (
    {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
    }[status] || 'ERROR'
  );
}

/** Wrap async route handlers so rejected promises reach the error handler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** 404 for unknown API routes. */
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));
}

/** Map raw Postgres errors onto friendly API errors. */
function mapPgError(err) {
  switch (err.code) {
    case '23505': // unique_violation
      return ApiError.conflict('Duplicate value violates a unique constraint', {
        code: 'DUPLICATE',
        details: err.detail,
      });
    case '23503': // foreign_key_violation
      return ApiError.badRequest('Referenced record does not exist', {
        code: 'FK_VIOLATION',
        details: err.detail,
      });
    case '23514': // check_violation
      return ApiError.badRequest('Value violates a check constraint', {
        code: 'CHECK_VIOLATION',
        details: err.constraint,
      });
    case '22P02': // invalid_text_representation e.g. bad integer/uuid
      return ApiError.badRequest('Invalid value format in request', { code: 'INVALID_FORMAT' });
    default:
      return null;
  }
}

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  const mapped = err instanceof ApiError ? err : mapPgError(err) || err;
  const status = mapped.status && mapped.status >= 400 ? mapped.status : 500;

  if (status >= 500) {
    console.error('[error]', req.method, req.originalUrl, '\n', err);
  }

  res.status(status).json({
    error: {
      message: status >= 500 && config_isProd() ? 'Internal server error' : mapped.message,
      code: mapped.code || defaultCode(status),
      ...(mapped.details ? { details: mapped.details } : {}),
    },
  });
}
/* eslint-enable no-unused-vars */

function config_isProd() {
  return process.env.NODE_ENV === 'production';
}

module.exports = { ApiError, asyncHandler, notFoundHandler, errorHandler };
