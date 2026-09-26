-- =====================================================================
--  Test Trace & Automate  --  Migration 001: initial schema
--  PostgreSQL 14+
--  Every table is multi-project ready (project_id) even though the UI
--  works with one "active project" at a time.
-- =====================================================================

-- gen_random_uuid() for batch ids
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE user_role        AS ENUM ('admin', 'lead', 'tester');
CREATE TYPE item_priority    AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE test_status      AS ENUM ('pending', 'in_progress', 'passed', 'failed', 'blocked');
CREATE TYPE execution_type   AS ENUM ('manual', 'automated');
CREATE TYPE script_type      AS ENUM ('ui', 'api');
CREATE TYPE run_status       AS ENUM ('queued', 'running', 'done', 'error');
CREATE TYPE trigger_type     AS ENUM ('manual', 'scheduled');
CREATE TYPE cycle_state      AS ENUM ('planned', 'active', 'completed');

-- Human readable codes (TC-001, REQ-001) are produced by these sequences
-- so concurrent inserts can never collide.
CREATE SEQUENCE test_case_code_seq;
CREATE SEQUENCE requirement_code_seq;

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(160) NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  role          user_role    NOT NULL DEFAULT 'tester',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  avatar_color  VARCHAR(9),                        -- used by the UI avatars
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- case-insensitive unique e-mail
CREATE UNIQUE INDEX users_email_lower_uidx ON users (lower(email));

-- ---------------------------------------------------------------------
-- PROJECTS
-- ---------------------------------------------------------------------
CREATE TABLE projects (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- REQUIREMENTS
-- ---------------------------------------------------------------------
CREATE TABLE requirements (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code        VARCHAR(20)  NOT NULL,               -- REQ-001
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  priority    item_priority NOT NULL DEFAULT 'medium',
  created_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT requirements_code_uq UNIQUE (project_id, code)
);

-- ---------------------------------------------------------------------
-- TEST CASES  (+ ordered steps)
-- ---------------------------------------------------------------------
CREATE TABLE test_cases (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code           VARCHAR(20)   NOT NULL,           -- TC-001
  title          VARCHAR(200)  NOT NULL,
  preconditions  TEXT,
  expected_result TEXT         NOT NULL,
  priority       item_priority NOT NULL DEFAULT 'medium',
  module         VARCHAR(80)   NOT NULL,           -- module / feature tag
  requirement_id INTEGER       REFERENCES requirements(id) ON DELETE SET NULL,
  is_automated   BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by     INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT test_cases_code_uq UNIQUE (project_id, code)
);

CREATE TABLE test_case_steps (
  id           SERIAL PRIMARY KEY,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  step_no      INTEGER NOT NULL CHECK (step_no > 0),
  action       TEXT    NOT NULL,
  CONSTRAINT test_case_steps_uq UNIQUE (test_case_id, step_no)
);

-- ---------------------------------------------------------------------
-- TEST CYCLES  (a run of a set of test cases, e.g. "Sprint 1 Regression")
-- ---------------------------------------------------------------------
CREATE TABLE test_cycles (
  id               SERIAL PRIMARY KEY,
  project_id       INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name             VARCHAR(150) NOT NULL,
  description      TEXT,
  status           cycle_state  NOT NULL DEFAULT 'planned',
  start_date       DATE,
  end_date         DATE,
  schedule_enabled BOOLEAN      NOT NULL DEFAULT FALSE,   -- nightly automation
  schedule_cron    VARCHAR(60)  NOT NULL DEFAULT '0 2 * * *',
  last_scheduled_at TIMESTAMPTZ,
  created_by       INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT test_cycles_dates_chk CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- ---------------------------------------------------------------------
-- CYCLE_TESTS  --  one row per test case inside a cycle.
-- This is where assignment + execution status live.
-- ---------------------------------------------------------------------
CREATE TABLE cycle_tests (
  id            SERIAL PRIMARY KEY,
  cycle_id      INTEGER     NOT NULL REFERENCES test_cycles(id) ON DELETE CASCADE,
  test_case_id  INTEGER     NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  assignee_id   INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  assigned_by   INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  assigned_at   TIMESTAMPTZ,
  due_date      DATE,
  status        test_status NOT NULL DEFAULT 'pending',
  actual_result TEXT,
  remarks       TEXT,
  executed_by   INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  executed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cycle_tests_uq UNIQUE (cycle_id, test_case_id)      -- no duplicate case in a cycle
);

-- ---------------------------------------------------------------------
-- EXECUTIONS  --  immutable history of every status change
-- ---------------------------------------------------------------------
CREATE TABLE executions (
  id                SERIAL PRIMARY KEY,
  cycle_test_id     INTEGER        NOT NULL REFERENCES cycle_tests(id) ON DELETE CASCADE,
  test_case_id      INTEGER        NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  cycle_id          INTEGER        NOT NULL REFERENCES test_cycles(id) ON DELETE CASCADE,
  status            test_status    NOT NULL,
  execution_type    execution_type NOT NULL DEFAULT 'manual',
  actual_result     TEXT,
  remarks           TEXT,
  screenshot_path   TEXT,
  log               TEXT,
  duration_ms       INTEGER,
  automation_run_id INTEGER,                       -- FK added after automation_runs exists
  executed_by       INTEGER        REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- AUTOMATION
-- ---------------------------------------------------------------------
CREATE TABLE automation_scripts (
  id            SERIAL PRIMARY KEY,
  test_case_id  INTEGER     NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  type          script_type NOT NULL,
  file_path     VARCHAR(255) NOT NULL,             -- relative to /worker/scripts
  description   TEXT,
  timeout_ms    INTEGER     NOT NULL DEFAULT 60000 CHECK (timeout_ms BETWEEN 1000 AND 600000),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automation_scripts_case_uq UNIQUE (test_case_id)   -- 1 script per test case
);

CREATE TABLE automation_runs (
  id              SERIAL PRIMARY KEY,
  batch_id        UUID         NOT NULL DEFAULT gen_random_uuid(), -- groups a "Run automation" click
  script_id       INTEGER      NOT NULL REFERENCES automation_scripts(id) ON DELETE CASCADE,
  test_case_id    INTEGER      NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  cycle_id        INTEGER      REFERENCES test_cycles(id) ON DELETE SET NULL,
  cycle_test_id   INTEGER      REFERENCES cycle_tests(id) ON DELETE SET NULL,
  status          run_status   NOT NULL DEFAULT 'queued',
  trigger_type    trigger_type NOT NULL DEFAULT 'manual',
  triggered_by    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  attempts        INTEGER      NOT NULL DEFAULT 0,
  log             TEXT,
  error           TEXT,
  screenshot_path TEXT,
  duration_ms     INTEGER,
  worker_id       VARCHAR(80),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE executions
  ADD CONSTRAINT executions_automation_run_fk
  FOREIGN KEY (automation_run_id) REFERENCES automation_runs(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- AUDIT LOG  --  who changed what, from -> to
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(40) NOT NULL,               -- test_case | cycle_test | automation_run ...
  entity_id   INTEGER,
  action      VARCHAR(60) NOT NULL,               -- create | update | status_change | assign ...
  old_value   JSONB,
  new_value   JSONB,
  ip_address  VARCHAR(60),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS  (in-app bell)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(160) NOT NULL,
  message    TEXT,
  type       VARCHAR(40)  NOT NULL DEFAULT 'info',  -- assignment | due_soon | automation | info
  link       VARCHAR(200),
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  dedupe_key VARCHAR(160) UNIQUE,                   -- stops cron from spamming
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- (migration bookkeeping table `schema_migrations` is created by db/migrate.js
--  before the first migration runs, so it is intentionally not defined here)

-- ---------------------------------------------------------------------
-- INDEXES  (FKs + the filters the UI actually uses)
-- ---------------------------------------------------------------------
CREATE INDEX idx_requirements_project      ON requirements (project_id);
CREATE INDEX idx_test_cases_project        ON test_cases (project_id);
CREATE INDEX idx_test_cases_module         ON test_cases (module);
CREATE INDEX idx_test_cases_priority       ON test_cases (priority);
CREATE INDEX idx_test_cases_requirement    ON test_cases (requirement_id);
CREATE INDEX idx_test_cases_automated      ON test_cases (is_automated) WHERE is_automated;
CREATE INDEX idx_steps_case                ON test_case_steps (test_case_id, step_no);
CREATE INDEX idx_cycles_project            ON test_cycles (project_id);
CREATE INDEX idx_cycle_tests_cycle         ON cycle_tests (cycle_id);
CREATE INDEX idx_cycle_tests_case          ON cycle_tests (test_case_id);
CREATE INDEX idx_cycle_tests_assignee      ON cycle_tests (assignee_id);
CREATE INDEX idx_cycle_tests_status        ON cycle_tests (status);
-- fast "overdue" lookups: open work with a due date
CREATE INDEX idx_cycle_tests_due_open      ON cycle_tests (due_date)
  WHERE due_date IS NOT NULL AND status IN ('pending', 'in_progress', 'blocked');
CREATE INDEX idx_executions_cycle_test     ON executions (cycle_test_id, created_at DESC);
CREATE INDEX idx_executions_case           ON executions (test_case_id, created_at DESC);
CREATE INDEX idx_executions_cycle          ON executions (cycle_id);
CREATE INDEX idx_scripts_case              ON automation_scripts (test_case_id);
-- THE most important index of the whole app: the worker polls queue head
CREATE INDEX idx_runs_queue                ON automation_runs (status, created_at)
  WHERE status = 'queued';
CREATE INDEX idx_runs_batch                ON automation_runs (batch_id);
CREATE INDEX idx_runs_cycle                ON automation_runs (cycle_id, created_at DESC);
CREATE INDEX idx_audit_entity              ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user                ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_notifications_user        ON notifications (user_id, is_read, created_at DESC);

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated      BEFORE UPDATE ON users       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_test_cases_updated BEFORE UPDATE ON test_cases  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cycles_updated     BEFORE UPDATE ON test_cycles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cycle_tests_updated BEFORE UPDATE ON cycle_tests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_requirements_updated BEFORE UPDATE ON requirements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
