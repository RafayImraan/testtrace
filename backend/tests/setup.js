/**
 * Jest setup: set NODE_ENV=test so cron jobs don't start and logs are quieter.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://tta:tta_pass@localhost:5432/test_trace_automate_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_jest_only_super_long';
process.env.BCRYPT_ROUNDS = '4'; // fast hashing for tests
