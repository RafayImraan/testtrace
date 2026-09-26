# Test Trace & Automate — Architecture

## High-level overview

```
┌─────────────┐      REST + Socket.io      ┌──────────────────┐      Polls queue      ┌──────────────┐
│  Frontend   │  ───────────────────────▶  │  Backend (API)   │  ◀──────────────────  │   Worker     │
│ React Vite  │  ◀───────────────────────  │  Express + pg    │  ──POST result────▶  │ Playwright   │
│ Tailwind    │      Realtime events       │  JWT + RBAC      │                       │ API scripts  │
└─────────────┘                            └────────┬─────────┘                       └──────┬───────┘
                                                    │                                        │
                                                    │ SQL                                    │ HTTP
                                                    ▼                                        ▼
                                           ┌──────────────────┐                     ┌──────────────────┐
                                           │   PostgreSQL     │                     │  Sample App      │
                                           │  13 tables +     │                     │  SUT with bugs   │
                                           │  3 views         │                     │  :5000           │
                                           └──────────────────┘                     └──────────────────┘
```

* **No Redis**: the worker polls `automation_runs WHERE status='queued' FOR UPDATE SKIP LOCKED` (partial index `idx_runs_queue`). This is the classic Postgres-as-a-queue pattern.
* **Realtime**: socket.io rooms `project:<id>` (dashboard, kanban, lists) and `user:<id>` (notifications). Every status change emits `cycle_test:updated` and `dashboard:refresh` so the UI updates within ~2s without refresh.
* **File uploads**: `multer` saves screenshots to `/uploads/screenshots`, served statically at `/uploads/*` and proxied by nginx in production.

## Backend layers

* `config/` – env parsing (single source of truth, no `process.env` elsewhere) and pg pool.
* `middleware/` – `authenticate` (JWT + re-read user for instant deactivation), `authorize(...roles)`, `validate` (zod), centralized error handling with consistent `{ error: { message, code, details } }` envelope.
* `controllers/` – thin, request → service → response. Every write goes through `tx()` so audit log and data change are atomic.
* `services/` – `realtime.js` (socket emit helpers), `notificationService.js`, `reminderService.js` (due-soon cron), `automationService.js` (queue, claim, ingest, scheduler).
* `routes/` – RESTful, versioned under `/api`.
* `sockets/` – JWT auth for sockets, room join/leave.
* `cron/` – node-cron jobs: due-soon reminders every 10 min, nightly automation check every minute, housekeeping hourly.

## Data model

See `docs/ER.md` for the full ER diagram. Key decisions:

* `cycle_tests` holds *current* status; `executions` holds *history*. Dashboard queries the former (fast), trend chart queries the latter.
* `automation_runs` vs `executions`: a run is a technical attempt (queue state, worker id, retries, log); an execution is a business result. A crashed script still produces a run with `error` and an execution with `status='failed'`.
* `UNIQUE(cycle_id, test_case_id)` prevents duplicate cases in a cycle.
* `test_case_code_seq` / `requirement_code_seq` produce human readable codes `TC-001`, `REQ-001` safely under concurrency.

## Frontend

* Vite + React Router + Tailwind + Chart.js + axios + socket.io-client + react-hot-toast.
* `AuthContext` stores JWT, user, active projectId, joins socket rooms.
* Pages: Login, Dashboard (cards + doughnut/bar/line), Test Cases (CRUD, filters, pagination), Cycles (list + detail, add/remove, assign, run automation), Kanban (HTML5 drag-drop → PATCH status), My Tasks (overdue highlighting), Automation (scripts, runs, logs, screenshots, schedules), Requirements & Traceability Matrix, Reports (PDF/Excel download), Audit Log, Users (admin), Notifications, Profile.
* All pages handle loading, empty, error states.

## Automation worker

* `src/index.js` – poll loop, login, claim, run, post result.
* `src/runner.js` – dispatches to UI or API runner with timeout wrapper.
* `src/uiRunner.js` – Playwright, browser launch, screenshot on failure (saved to shared volume).
* `src/apiRunner.js` – axios/fetch based.
* `scripts/` – 13 scripts: 6 Playwright UI (login valid/invalid, search, add-to-cart, checkout, 3 self-tests of TTA), 4 API (rate limit, checkout, RBAC, intentional failure), plus 2 extra. At least 2 fail intentionally to demo failure handling.
* No silent failures: every exception/timeout is caught and returned as `FAILED` with log.

## Sample App (SUT)

* Tiny Express app with login, product catalog, cart, checkout pages and REST APIs.
* Intentional bugs when `BUG_MODE=true`: empty product search 500, checkout FAIL coupon 500, cart total off by 1 when qty>3, admin login random 500. These are used by the failing automation scripts.

## Security & non-functional

* bcrypt password hashing, JWT with expiry, helmet, CORS allowlist, rate limiting on login (express-rate-limit).
* Input validation with zod on every route, proper status codes.
* No hardcoded secrets – `.env.example` documents everything, `docker-compose.yml` reads `.env`.
* ESLint + Prettier config, clean folder structure, readable well-commented code (viva-friendly).

## Deployment

* Docker Compose: `postgres:16-alpine`, `backend` (Node 20), `frontend` (Node build + nginx), `worker` (Playwright image), `sample-app` (Node). `docker compose up --build` runs migrations + seed automatically (`RUN_MIGRATIONS_ON_START`, `RUN_SEED_ON_START`).
* For local dev without Docker: `npm run setup:db` (migrate+seed), then `npm run dev:backend`, `npm run dev:frontend`, `npm run dev:worker`, `node sample-app/server.js` in separate terminals.
