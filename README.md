# Test Trace & Automate

A web-based test management platform for a university Software Testing course project. It lets a QA team create manual test cases, track execution (Pending → In Progress → Passed/Failed/Blocked), assign work with Kanban, run Playwright/API automation and see results live, and export traceability + PDF/Excel reports.

**Tech stack:** React (Vite) + Tailwind + React Router + Chart.js + axios + socket.io-client | Node.js + Express + JWT + bcrypt + zod + socket.io + node-cron + multer + pdfkit + exceljs | PostgreSQL | Independent Playwright automation worker (browser and APIRequestContext tests) polling the database queue | Docker Compose + sample-app SUT | Jest + Supertest.

---

## 🚀 Quick start (Docker – recommended)

```bash
# 1. clone
git clone <repo> && cd test-trace-automate

# 2. env (optional – defaults work)
cp .env.example .env   # edit JWT_SECRET for prod

# 3. up – builds all images, runs migrations + seed automatically
docker compose up --build
```

Wait ~30s for `tta-backend` healthcheck to turn healthy. Then open:

* **Frontend (nginx + proxy):** http://localhost:8080
* **Backend API + Swagger:** http://localhost:4000/api/docs  (also proxied at http://localhost:8080/api/docs)
* **Sample App (SUT):** http://localhost:5000

### Demo credentials (seeded)

| Role | Email | Password | What they can do |
|------|-------|----------|------------------|
| Admin | admin@tta.local | Admin@123 | Everything + user management |
| Lead | lead@tta.local | Lead@123 | Create/edit test cases, cycles, requirements, assign, trigger automation, export |
| Tester | tester1@tta.local | Tester@123 | View assigned, update status/remarks/screenshot, trigger own automation |
| Tester | tester2@tta.local | Tester@123 | Same |
| Tester | tester3@tta.local | Tester@123 | Same |

Seed also creates: 1 project (SHOP – ShopEase Web App), 9 requirements, 44 test cases, 2 cycles with mixed statuses, 14 correctly linked Playwright automation scripts, 5 past runs, two sample defects linked to requirements and test cases, audit logs and notifications.

---

## 🛠️ Local dev without Docker

```bash
# 0. prerequisites: Node 20+, PostgreSQL 14+ running locally
# create role/db
sudo -u postgres psql -c "CREATE ROLE tta WITH LOGIN PASSWORD 'tta_pass' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE test_trace_automate OWNER tta;"
sudo -u postgres psql -c "CREATE DATABASE test_trace_automate_test OWNER tta;"

# 1. install all
npm run install:all   # root + backend + frontend + worker

# 2. env
cp .env.example .env
# ensure DATABASE_URL points to localhost (default in .env.example does)

# 3. migrate + seed
npm run setup:db   # = migrate:reset + seed

# 4. run services in separate terminals
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:5173 (proxies /api to :4000)
npm run dev:worker    # polls queue every 3s
npm run dev:sample    # http://localhost:5000  SUT with BUG_MODE=true

# 5. tests
npm test   # backend Jest + Supertest; thresholds are in backend/package.json
```

---

## 📁 Folder structure

```
test-trace-automate/
├── docker-compose.yml
├── .env.example  .gitignore  .prettierrc
├── docs/
│   ├── ER.md               # Mermaid ER diagram + design notes
│   ├── ARCHITECTURE.md      # High-level + layers
│   ├── TEST_PLAN.md         # Manual, Playwright automation, and defect test plan
│   └── PROPOSAL_ALIGNMENT.md # Requirement-by-requirement mapping to the proposal
├── db/
│   ├── migrations/001_init.sql 002_views.sql
│   ├── migrate.js          # tiny SQL runner (no ORM)
│   └── seed/seed.js        # idempotent demo data
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── server.js  app.js
│   │   ├── config/{env,db,swagger}.js
│   │   ├── middleware/{auth,validate,error}.js
│   │   ├── controllers/*  (auth, users, projects, requirements, testCases, cycles, cycleTests, dashboard, automation, reports, audit, notifications)
│   │   ├── routes/*       # RESTful
│   │   ├── services/{realtime,notificationService,reminderService,automationService}.js
│   │   ├── sockets/index.js  (JWT auth, rooms project:<id> user:<id>)
│   │   ├── cron/index.js     (due-soon + nightly automation + housekeeping)
│   │   ├── validators/*      (zod)
│   │   └── utils/{audit,helpers}.js
│   └── tests/{setup,helpers,auth.test, testCases.test}.js
├── frontend/
│   ├── Dockerfile  nginx.conf  vite.config.js  tailwind.config.js
│   └── src/
│       ├── App.jsx  main.jsx  index.css
│       ├── lib/{api,socket}.js
│       ├── context/AuthContext.jsx
│       ├── components/{Layout,Badges}.jsx
│       └── pages/{Login,Dashboard,TestCases,Cycles,Kanban,MyTasks,Automation,Requirements,Defects,Reports,AuditLog,Users,Notifications,Profile}.jsx
├── worker/
│   ├── Dockerfile  (playwright image)
│   ├── src/{index,runner,uiRunner,apiRunner}.js
│   └── scripts/
│       ├── ui/{login-valid,login-invalid,search-product,search-empty,add-to-cart,checkout-valid,tta-login,tta-create-testcase,tta-status-change}.js
│       └── api/{login-rate-limit,checkout-api,auth-rbac,failing-endpoint,intentional-crash}.js
└── sample-app/
    ├── Dockerfile
    ├── server.js  (SUT with intentional bugs when BUG_MODE=true)
    └── public/index.html
```

---

## 🗄️ Database

14 tables: `users, projects, requirements, test_cases, test_case_steps, test_cycles, cycle_tests (UNIQUE cycle+case), executions, automation_scripts, automation_runs (batch_id, queue), defects, audit_logs, notifications, schema_migrations` + 3 views (`v_latest_execution`, `v_test_case_status`, `v_traceability`). Defects enforce same-project links to their requirement and test case. See `docs/ER.md`.

Key indexes: `idx_runs_queue WHERE status='queued'` (worker polling), `idx_cycle_tests_due_open` (overdue), `idx_executions_cycle_test`, etc.

---

## 🔌 API

RESTful JSON, consistent error envelope `{ error: { message, code, details } }`, zod validation → 422, JWT bearer.

* `POST /api/auth/login` – rate limited (15min/10 attempts)
* `GET /api/auth/me` – profile + counters
* `CRUD /api/users` – admin only, plus `/assignable`
* `CRUD /api/projects`, `/api/requirements`, `/api/test-cases`, `/api/cycles`; report and update defects at `/api/defects`
* `POST /api/cycles/:id/tests` – add cases, `DELETE` – remove, `POST /:id/assign` – assign with due date
* `GET /api/cycles/:id/kanban`, `GET /api/cycle-tests/my-tasks`, `PATCH /:id/status`, `POST /:id/execute` (multipart screenshot)
* `GET /api/dashboard/stats?projectId=&cycleId=` – cards, doughnut, bar, trend
* `Automation: GET /scripts, POST /scripts, GET /runs, GET /runs/:id, POST /run (queue), POST /claim (worker FOR UPDATE SKIP LOCKED), POST /runs/:id/result (ingest), GET /health, GET|POST /schedules`
* `GET /api/reports/cycle/:id.pdf` and `.xlsx`, `GET /summary`
* `GET /api/audit-logs` (admin/lead), `GET /api/notifications`, `POST /read`, `DELETE`

Swagger UI at `/api/docs`, OpenAPI JSON at `/api/openapi.json`.

Realtime events (socket.io): `cycle_test:updated`, `cycle_test:assigned`, `dashboard:refresh`, `automation:run`, `notification:new`.

---

## 🤖 Automation module

* `automation_scripts` links a test_case to a file in `/worker/scripts/`.
* Clicking "Run Automation" (on test case, on cycle, or selected) creates `automation_runs` rows `status=queued` with a shared `batch_id`.
* Worker polls every 3s, claims up to 3 runs atomically (`FOR UPDATE SKIP LOCKED`), runs Playwright headless browser checks or Playwright API checks, saves logs and browser failure screenshots to `/uploads/screenshots`, then posts results to the backend.
* Backend creates `executions` row `type=automated`, updates `cycle_tests.status`, writes audit log, emits socket event – UI updates live without refresh.
* Scheduling: lead can enable nightly cron per cycle (`0 2 * * *` default); worker + backend cron check every minute if due.
* Scripts: 9 browser UI + 5 API checks = 14. Browser tests use Playwright; API checks use Playwright `APIRequestContext`. The set covers the sample app and platform self-tests for login, test-case CRUD, assignment, status changes and RBAC. Expected failures exercise sample-app defect and worker-error reporting.

No silent failures: any crash/timeout is caught and recorded as `FAILED` with error in log.

---

## 📊 Reporting & Traceability

* Requirements CRUD (`REQ-001`…).
* Traceability matrix: each requirement links to its test cases, latest execution result and associated defect IDs/status/severity, with coverage %. Duplicate test cases across cycles count once using their latest cycle execution.
* Export cycle report as PDF (summary, table of tests with status/assignee/remarks) via pdfkit and Excel (.xlsx with 3 sheets: Summary, Test Cases, Executions) via exceljs.

---

## 🧪 Testing the platform itself

* **Jest + Supertest:** `backend/tests/` – auth, RBAC, test case CRUD, and defect create/list/update/link validation. Coverage thresholds are configured in `backend/package.json`.
* **Manual:** 30+ cases in `docs/TEST_PLAN.md`, also loaded into seed data so platform tests itself (visible in Test Cases page).
* **Defect tracking:** report defects with required links to a requirement and test case, track severity/status, and review the links from the Defects page. The seed includes sample-app defects.

---

## 🎬 5-minute demo script (for viva)

1. **Login as lead** – `lead@tta.local / Lead@123` at http://localhost:8080 . Show dashboard: cards, doughnut, bar per module, trend line. Explain live updates via socket.io.

2. **Test Cases** – filter by module Login, show TC-001 code, steps, linked requirement REQ-001. Create a new test case, show audit log entry.

3. **Cycles** – open "Sprint 1 Regression", show stats, list of cycle_tests with assignees. Add a test case by ID, assign 2 tests to tester1 with due date tomorrow – show notification bell increments (real-time).

4. **Kanban** – drag a Pending card to In Progress – show status change, audit log, dashboard updates within 2s without refresh.

5. **My Tasks (as tester)** – logout, login as `tester1@tta.local / Tester@123`, open My Tasks, see assigned, overdue highlighted. Execute a test: set Passed, add remarks, upload screenshot – show execution history.

6. **Automation** – back as lead, go to Automation → Scripts (14 scripts). Click "Run all automated" on Sprint 1 cycle. Watch Run History: queued → running → done, 1 failure with screenshot and log (search-empty, failing-endpoint). Open run detail, show log viewer and screenshot. Explain worker polling Postgres queue, no Redis, `FOR UPDATE SKIP LOCKED`.

7. **Requirements, Defects & Traceability** – show 9 requirements, linked defects, and the matrix from requirement → test case → latest result.

8. **Reports** – in cycle detail, download PDF and Excel – open them, show summary + detailed sheets.

9. **Audit Log & Swagger** – show audit page filter by user/action, then open `/api/docs` Swagger UI.

10. **Sample App** – open http://localhost:5000 , show intentional bugs (empty search 500, checkout FAIL 500) that cause the failing automation runs.

---

## 📸 Screenshots (to be added)

Place screenshots in `docs/screenshots/` and link here:

* Dashboard with charts
* Kanban drag-drop
* Automation run with failure screenshot
* Traceability matrix
* PDF report
* Swagger docs

---

## 🔒 Env vars

See `.env.example` – all secrets via env, no hardcoded. Important: `JWT_SECRET` must be long random in prod, `BCRYPT_ROUNDS=10`, `DATABASE_URL`, `CORS_ORIGIN`, `WORKER_EMAIL/PASSWORD` (worker logs in as lead).

---

## 📝 License

MIT – for educational purposes.
