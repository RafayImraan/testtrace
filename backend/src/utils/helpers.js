/**
 * Small shared helpers: pagination parsing, code generation, misc formatting.
 */

/** Build LIMIT/OFFSET + page meta from ?page=&pageSize= */
function pagination(q = {}) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize, 10) || 10));
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

/** Standard list envelope used by every collection endpoint. */
function pageMeta(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Next human readable code (TC-001, REQ-001 ...).
 * Uses a Postgres sequence => safe under concurrency.
 */
async function nextCode(client, kind) {
  const seq = kind === 'REQ' ? 'requirement_code_seq' : 'test_case_code_seq';
  const res = await (client ? client.query(`SELECT nextval('${seq}') AS n`)
    : require('../config/db').query(`SELECT nextval('${seq}') AS n`));
  return `${kind}-${String(res.rows[0].n).padStart(3, '0')}`;
}

/** Convert "true"/"false"/"" from query strings into booleans/undefined. */
function parseBool(v) {
  if (v === undefined || v === null || v === '') return undefined;
  return v === true || v === 'true' || v === '1';
}

/** Strip undefined keys so dynamic UPDATE statements stay clean. */
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

const humanMs = (ms) => (ms == null ? null : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

/** CSV-safe value used by the Excel export. */
const excelEnum = (v) => (v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');

module.exports = { pagination, pageMeta, nextCode, parseBool, compact, humanMs, excelEnum };
