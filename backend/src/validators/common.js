/**
 * Shared enum values and zod primitives reused by every validator.
 * Keeping them in one place means the API, the DB and the UI agree on the
 * exact vocabulary (e.g. "in_progress", not "In Progress").
 */
const { z } = require('zod');

const ROLES = ['admin', 'lead', 'tester'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const TEST_STATUSES = ['pending', 'in_progress', 'passed', 'failed', 'blocked'];
const SCRIPT_TYPES = ['ui', 'api'];
const RUN_STATUSES = ['queued', 'running', 'done', 'error'];
const TRIGGER_TYPES = ['manual', 'scheduled'];
const CYCLE_STATES = ['planned', 'active', 'completed'];

const idParam = z.coerce.number().int().positive();
const idList = z
  .union([z.string(), z.array(z.union([z.string(), z.number()]))])
  .transform((v) => (Array.isArray(v) ? v : String(v).split(',')).map((s) => parseInt(s, 10)).filter(Boolean));

const priority = z.enum(PRIORITIES);
const testStatus = z.enum(TEST_STATUSES);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// Parse "?body" from multipart/form-data or JSON
const jsonBody = (schema) =>
  z.preprocess((v) => {
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  }, schema);

const email = z.string().trim().email('A valid e-mail is required').max(160);
const password = z.string().min(6, 'Password must be at least 6 characters').max(72);

module.exports = {
  z,
  ROLES,
  PRIORITIES,
  TEST_STATUSES,
  SCRIPT_TYPES,
  RUN_STATUSES,
  TRIGGER_TYPES,
  CYCLE_STATES,
  idParam,
  idList,
  priority,
  testStatus,
  dateString,
  jsonBody,
  email,
  password,
};
