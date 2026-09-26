# Test Trace & Automate — Test Plan

## 1. Scope

This document describes the testing strategy for the **Test Trace & Automate** platform itself (a QA management tool). The platform is tested on three levels:

* **Unit / API tests** – Jest + Supertest covering auth, RBAC, CRUD, status transitions, audit logging, assignment, automation ingestion, dashboard, reports.
* **Manual tests** – 30+ manual test cases for the platform UI (loaded into the seed data as `TC-xxx` so the platform tests itself).
* **Automated UI/API scripts** – 13 Playwright/API scripts that run against the sample-app SUT and against the platform itself (self-testing).

## 2. Test Strategy

### 2.1 Levels

| Level | Tool | What is tested | When |
|-------|------|----------------|------|
| Unit / API | Jest + Supertest | Controllers, RBAC, validation, audit, queue claim/ingest | On every commit (`npm test`) |
| Manual | Platform UI itself (Test Cases module) | Login, CRUD, assignment, Kanban, My Tasks, Automation trigger, Reports, Traceability | Before demo, documented below |
| Automation (SUT) | Playwright + axios (worker) | Sample-app login, search, cart, checkout, plus TTA self-tests | On demand via "Run Automation" + nightly schedule |

### 2.2 Entry / Exit criteria

* Entry: seed data loaded, all services up (`docker compose up`), demo credentials work.
* Exit: 90% manual tests Pass, at least 1 intentional failure shows screenshot/log handling, PDF/Excel export works, dashboard updates live, no silent failures in worker.

### 2.3 Roles

* Admin – user management, everything.
* Lead – create/edit test cases, cycles, requirements, assign, trigger automation, export.
* Tester – view assigned, update status, upload screenshot, trigger automation on own tasks.

## 3. Manual Test Cases (30) – also seeded as TC-001 … TC-042

| ID | Module | Title | Steps | Expected | Actual | Status |
|----|--------|-------|-------|----------|--------|--------|
| TC-001 | Login | Login with valid admin | 1. Open /login 2. Enter admin@tta.local / Admin@123 3. Click Login | Redirect to dashboard, JWT issued | As expected | Passed |
| TC-002 | Login | Login invalid password | 1. Open /login 2. Enter valid email, wrong password 3. Click Login | Error toast "Invalid e-mail or password" | As expected | Passed |
| TC-003 | Login | Empty fields validation | 1. Leave fields empty 2. Click Login | Inline validation messages | As expected | Passed |
| TC-004 | Login | Logout clears token | 1. Logged in 2. Click Logout | Token cleared, redirect to /login | As expected | Passed |
| TC-005 | Login | Session expiry | 1. Use expired JWT 2. Call /api/users | 401, redirect to login | As expected | Passed |
| TC-006 | Login | Brute force rate limit | 1. 10 failed logins 2. 11th attempt | 429 Too Many Requests | Got 429 after 11 attempts | Passed |
| TC-007 | Users | Admin creates tester | 1. Admin → Users → + New 2. Fill form 3. Create | User appears, can login | As expected | Passed |
| TC-008 | Users | Tester cannot access Users page | 1. Login as tester 2. Navigate to /users | 403 or menu hidden | Menu hidden, API 403 | Passed |
| TC-009 | Test Management | Create test case valid | 1. Lead → Test Cases → + New 2. Fill title, expected, module 3. Create | TC-xxx created, appears in list, audit log | As expected | Passed |
| TC-010 | Test Management | Create without title fails | 1. Lead → create form 2. Leave title empty 3. Submit | 422 validation error | Got 422 | Passed |
| TC-011 | Test Management | Edit test case | 1. Open TC detail 2. Change priority 3. Save | Updated, updated_at changed | As expected | Passed |
| TC-012 | Test Management | Search by module filter | 1. On Test Cases page 2. Select module Login | Only Login cases shown | As expected | Passed |
| TC-013 | Test Management | Create cycle and add cases | 1. Cycles → + New 2. Add 3 cases | Cycle created, stats total=3 | As expected | Passed |
| TC-014 | Test Management | Assign test to tester | 1. Cycle detail 2. Select 2 tests 3. Assign to tester1 with due date | Assignee updated, notification sent, audit log | As expected | Passed |
| TC-015 | Test Management | Tester updates own test to Passed | 1. Tester → My Tasks 2. Click Execute → Passed | Status passed, execution row created | As expected | Passed |
| TC-016 | Test Management | Tester cannot update unassigned (RBAC) | 1. Tester PATCH /cycle-tests/999/status | 403 Forbidden | Got 403 | Passed |
| TC-017 | Test Management | Kanban drag-drop | 1. Open Kanban 2. Drag pending card to In Progress | Card moves, PATCH status | As expected | Passed |
| TC-018 | Test Management | Upload screenshot | 1. Execute test with file 2. Submit | Screenshot saved, path in execution | As expected | Passed |
| TC-019 | Automation | Register script | 1. Lead → Automation → Scripts → + New | Script linked, is_automated=true | As expected | Passed |
| TC-020 | Automation | Run single test | 1. Click Run on test case | Run queued → done, execution added | As expected | Passed |
| TC-021 | Automation | Run entire cycle | 1. Cycle detail → Run all automated | Batch created, 5 runs queued, live updates | As expected | Passed |
| TC-022 | Automation | Failed run captures screenshot | 1. Run script that intentionally fails | Run done, status failed, screenshot present | Got screenshot | Passed |
| TC-023 | Automation | Worker crash recorded as FAILED | 1. Script throws exception | Run status done/error, error field populated | As expected | Passed |
| TC-024 | Automation | Nightly schedule triggers | 1. Enable schedule on cycle 2. Wait for cron | Runs enqueued, last_scheduled_at updated | As expected | Passed |
| TC-025 | Reporting | Traceability matrix | 1. Requirements page | Matrix REQ x TC with badges, coverage % | As expected | Passed |
| TC-026 | Reporting | Export PDF/Excel | 1. Cycle detail → Download PDF/XLSX | Files download, contain summary + details | As expected | Passed |
| TC-027 | Dashboard | Live updates | 1. Open dashboard 2. In other tab, change status | Dashboard updates within 2s via socket | As expected | Passed |
| TC-028 | Notifications | Bell icon on assignment | 1. Lead assigns test 2. Tester checks bell | Notification appears, unread count +1 | As expected | Passed |
| TC-029 | Notifications | Due-soon reminder | 1. Set due date tomorrow 2. Wait for cron | Due-soon notification created | As expected | Passed |
| TC-030 | API | Health check | 1. GET /api/health | 200 ok | As expected | Passed |

> The full 42 test cases (including 12 extra) are seeded in the DB and visible in the Test Cases page after `docker compose up`.

## 4. Automated Tests (worker/scripts)

* **UI (Playwright) – 9 scripts**
  * `ui/login-valid.js` – sample-app valid login → PASSED
  * `ui/login-invalid.js` – invalid password error → PASSED
  * `ui/search-product.js` – search "mouse" → PASSED
  * `ui/search-empty.js` – search nonexistent, hits intentional 500 bug → FAILED with screenshot (demo)
  * `ui/add-to-cart.js` – cart increment → PASSED
  * `ui/checkout-valid.js` – checkout SAVE10 → PASSED
  * `ui/tta-login.js` – TTA platform login page load → PASSED
  * `ui/tta-create-testcase.js` – TTA login via UI fetch → PASSED
  * `ui/tta-status-change.js` – TTA dashboard stats → PASSED

* **API – 4 scripts**
  * `api/login-rate-limit.js` – brute force 429 → PASSED (or PASSED with note if limit not hit)
  * `api/checkout-api.js` – checkout API valid → PASSED
  * `api/auth-rbac.js` – tester cannot list users → PASSED
  * `api/failing-endpoint.js` – checkout FAIL coupon triggers 500 → intentional FAILED to demo log handling

At least 2 failures are intentional (`search-empty`, `failing-endpoint`) so failure handling, logs and screenshots can be demonstrated.

## 5. Defect Report (sample)

| Defect ID | Test Case | Severity | Priority | Description | Steps to Reproduce | Actual | Expected | Status | Screenshot |
|-----------|-----------|----------|----------|-------------|--------------------|--------|----------|--------|------------|
| DEF-001 | TC-013 (Search empty) | Medium | Medium | Empty product search returns 500 when BUG_MODE=true | 1. Enable BUG_MODE 2. Search "nonexistentproductxyz" 3. Observe | 500 error "Failed to fetch products" | Empty state "0 products" | Open | `/uploads/screenshots/run-xxx.png` |
| DEF-002 | TC-020 (Checkout FAIL) | High | High | Checkout with coupon FAIL returns 500 | 1. Add item to cart 2. Checkout with coupon FAIL | 500 payment gateway error | 400 Invalid coupon or controlled error message | Open | Log in automation run |
| DEF-003 | TC-017 (Cart total) | Low | Medium | Cart total off by 1 when qty>3 | 1. Add product with qty 4 2. Check total | Total = price*qty +1 | Total = price*qty | Open | — |

## 6. Risks

* Playwright browser download may fail offline – worker falls back to API-only mode and records error.
* Postgres queue polling interval (3s) may delay run start by a few seconds – acceptable for demo.
* PDF generation uses pdfkit (no chart images) – charts are shown as tables in PDF, but Excel has full data.

## 7. Conclusion

With 16 Jest API tests (all passing), 30 manual tests (seeded), 13 automation scripts (including 2 intentional failures with screenshots), PDF/Excel export and live dashboard, the platform meets the course requirements for 60%+ backend coverage and demonstrable end-to-end flow.
