# Test Trace & Automate — Entity Relationship Diagram

Mermaid source (renders on GitHub, VS Code, mermaid.live). The same diagram is kept in
`docs/ER.md`. Enums are shown inline on the columns that use them.

```mermaid
erDiagram
  USERS ||--o{ PROJECTS          : "created_by"
  USERS ||--o{ REQUIREMENTS      : "created_by"
  USERS ||--o{ TEST_CASES        : "created_by"
  USERS ||--o{ TEST_CYCLES       : "created_by"
  USERS ||--o{ CYCLE_TESTS       : "assignee / executed_by"
  USERS ||--o{ EXECUTIONS        : "executed_by"
  USERS ||--o{ AUTOMATION_RUNS   : "triggered_by"
  USERS ||--o{ AUDIT_LOGS        : "user_id"
  USERS ||--o{ NOTIFICATIONS     : "user_id"

  PROJECTS ||--o{ REQUIREMENTS   : "project_id"
  PROJECTS ||--o{ TEST_CASES     : "project_id"
  PROJECTS ||--o{ TEST_CYCLES    : "project_id"

  REQUIREMENTS ||--o{ TEST_CASES : "requirement_id (traceability)"

  TEST_CASES ||--o{ TEST_CASE_STEPS : "ordered steps"
  TEST_CASES ||--o| AUTOMATION_SCRIPTS : "0..1 script per case"
  TEST_CASES ||--o{ CYCLE_TESTS  : "included in cycles"
  TEST_CASES ||--o{ EXECUTIONS   : "history"
  TEST_CASES ||--o{ AUTOMATION_RUNS : "runs"

  TEST_CYCLES ||--o{ CYCLE_TESTS : "cycle_id"
  TEST_CYCLES ||--o{ EXECUTIONS  : "cycle_id"
  TEST_CYCLES ||--o{ AUTOMATION_RUNS : "cycle_id"

  CYCLE_TESTS ||--o{ EXECUTIONS  : "cycle_test_id"
  CYCLE_TESTS ||--o{ AUTOMATION_RUNS : "cycle_test_id"

  AUTOMATION_SCRIPTS ||--o{ AUTOMATION_RUNS : "script_id"
  AUTOMATION_RUNS ||--o{ EXECUTIONS : "automation_run_id"

  USERS {
    serial   id PK
    varchar  email "UNIQUE lower(email)"
    varchar  password_hash "bcrypt"
    varchar  full_name
    enum     role "admin|lead|tester"
    boolean  is_active
    tstz     last_login_at
    tstz     created_at
  }

  PROJECTS {
    serial  id PK
    varchar code UK
    varchar name
    text    description
    boolean is_active
  }

  REQUIREMENTS {
    serial  id PK
    int     project_id FK
    varchar code "REQ-001, UNIQUE(project_id,code)"
    varchar title
    text    description
    enum    priority "low|medium|high|critical"
  }

  TEST_CASES {
    serial  id PK
    int     project_id FK
    varchar code "TC-001 from sequence, UNIQUE(project_id,code)"
    varchar title
    text    preconditions
    text    expected_result
    enum    priority "low|medium|high|critical"
    varchar module
    int     requirement_id FK
    boolean is_automated
    boolean is_active
  }

  TEST_CASE_STEPS {
    serial  id PK
    int     test_case_id FK
    int     step_no "UNIQUE(test_case_id, step_no)"
    text    action
  }

  TEST_CYCLES {
    serial  id PK
    int     project_id FK
    varchar name
    text    description
    enum    status "planned|active|completed"
    date    start_date
    date    end_date
    boolean schedule_enabled "nightly automation"
    varchar schedule_cron
    tstz    last_scheduled_at
  }

  CYCLE_TESTS {
    serial  id PK
    int     cycle_id FK
    int     test_case_id FK "UNIQUE(cycle_id,test_case_id)"
    int     assignee_id FK
    date    due_date
    enum    status "pending|in_progress|passed|failed|blocked"
    text    actual_result
    text    remarks
    int     executed_by FK
    tstz    executed_at
  }

  EXECUTIONS {
    serial  id PK
    int     cycle_test_id FK
    int     test_case_id FK
    int     cycle_id FK
    enum    status
    enum    execution_type "manual|automated"
    text    actual_result
    text    remarks
    text    screenshot_path
    text    log
    int     duration_ms
    int     automation_run_id FK
    int     executed_by FK
    tstz    created_at
  }

  AUTOMATION_SCRIPTS {
    serial  id PK
    int     test_case_id FK UK
    varchar name
    enum    type "ui|api"
    varchar file_path
    int     timeout_ms
    boolean is_active
  }

  AUTOMATION_RUNS {
    serial  id PK
    uuid    batch_id "groups one 'Run automation' click"
    int     script_id FK
    int     test_case_id FK
    int     cycle_id FK
    int     cycle_test_id FK
    enum    status "queued|running|done|error"
    enum    trigger_type "manual|scheduled"
    int     triggered_by FK
    int     attempts
    text    log
    text    error
    text    screenshot_path
    int     duration_ms
    varchar worker_id
    tstz    started_at
    tstz    finished_at
  }

  AUDIT_LOGS {
    serial  id PK
    int     user_id FK
    varchar entity_type
    int     entity_id
    varchar action
    jsonb   old_value
    jsonb   new_value
    tstz    created_at
  }

  NOTIFICATIONS {
    serial  id PK
    int     user_id FK
    varchar title
    text    message
    varchar type "assignment|due_soon|automation|info"
    varchar link
    boolean is_read
    varchar dedupe_key UK
  }
```

## Design notes (useful for the viva)

1. **Why `cycle_tests`?** A test case is a reusable artefact; its *execution status* only
   makes sense inside a cycle. Keeping the two apart means the same test case can be
   Pending in "Sprint 2 Regression" while already Passed in "Sprint 1 Regression", and the
   `UNIQUE (cycle_id, test_case_id)` constraint stops a case being added twice.
2. **Why `executions` in addition to `cycle_tests.status`?** `cycle_tests` holds *current*
   state (fast dashboard queries, Kanban), `executions` holds *history* (trend chart, audit,
   "last automated run"). Every status change inserts a row — never an update.
3. **`automation_runs` vs `executions`**: a run is a *technical* attempt (retries, logs,
   queue state, worker id); an execution is a *business* result. A crashed script still
   produces a run with `status = 'error'` and an execution with `status = 'failed'`.
4. **Queue without Redis**: the worker polls
   `SELECT ... WHERE status='queued' ... FOR UPDATE SKIP LOCKED` (partial index
   `idx_runs_queue`), marks the row `running`, then posts the result back through the API.
   This is the standard Postgres-as-a-queue pattern and needs no extra infrastructure.
5. **Traceability** is a plain JOIN chain: `requirements → test_cases → cycle_tests →
   executions`, exposed as the `v_traceability` view.
6. **Indexes** target real access paths: queue polling, "my tasks", "overdue", status
   filtering, per-cycle execution history and the audit page filters.
