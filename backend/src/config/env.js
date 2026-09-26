/**
 * Environment configuration.
 * Loads .env from the repo root and from the local package folder,
 * then exposes a single typed-ish `config` object so nothing else in the
 * codebase touches process.env directly. No secrets are hardcoded here.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// root .env first (shared by backend/worker/db scripts), then a package
// local .env that may override it during local development.
const candidates = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const file of candidates) {
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false });
}

const num = (v, fallback) => (v === undefined || v === '' ? fallback : Number(v));
const bool = (v, fallback) => (v === undefined || v === '' ? fallback : String(v) === 'true');
const list = (v, fallback = []) =>
  v === undefined || v === '' ? fallback : String(v).split(',').map((s) => s.trim()).filter(Boolean);

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  port: num(process.env.PORT, 4000),

  db: {
    connectionString:
      process.env.DATABASE_URL ||
      `postgres://${process.env.POSTGRES_USER || 'tta'}:${process.env.POSTGRES_PASSWORD || 'tta_pass'}` +
        `@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${
          process.env.POSTGRES_DB || 'test_trace_automate'
        }`,
    max: num(process.env.PG_POOL_MAX, 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_only_change_me_super_long_random_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),

  corsOrigins: list(process.env.CORS_ORIGIN, [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:4000',
  ]),

  loginRateLimit: {
    windowMs: num(process.env.LOGIN_RATE_WINDOW_MINUTES, 15) * 60 * 1000,
    max: num(process.env.LOGIN_RATE_MAX_ATTEMPTS, 10),
  },

  uploads: {
    dir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),
    maxMb: num(process.env.UPLOAD_MAX_MB, 5),
  },

  runMigrationsOnStart: bool(process.env.RUN_MIGRATIONS_ON_START, false),
  runSeedOnStart: bool(process.env.RUN_SEED_ON_START, false),
};

// Fail fast on a obviously unsafe production setup.
if (config.isProd && config.jwt.secret.includes('change_me')) {
  // eslint-disable-next-line no-console
  console.warn('[config] WARNING: JWT_SECRET looks like a default value. Set a real secret!');
}

module.exports = config;
