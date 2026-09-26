#!/usr/bin/env node
/**
 * Seed script: idempotent demo data.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://tta:tta_pass@localhost:5432/test_trace_automate',
});
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🧹  Clearing existing demo data...');
    await client.query(`
      TRUNCATE executions, automation_runs, automation_scripts,
               cycle_tests, test_case_steps, test_cases,
               test_cycles, requirements, projects,
               audit_logs, notifications
      RESTART IDENTITY CASCADE;
    `);
    await client.query(`ALTER SEQUENCE test_case_code_seq RESTART WITH 1`);
    await client.query(`ALTER SEQUENCE requirement_code_seq RESTART WITH 1`);
    await client.query(`DELETE FROM users WHERE email LIKE '%@tta.local'`);

    console.log('👤  Creating users...');
    const hashAdmin = await bcrypt.hash('Admin@123', BCRYPT_ROUNDS);
    const hashLead = await bcrypt.hash('Lead@123', BCRYPT_ROUNDS);
    const hashTester = await bcrypt.hash('Tester@123', BCRYPT_ROUNDS);

    const usersRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, avatar_color)
       VALUES
         ('admin@tta.local',   $1, 'Ayesha Admin',  'admin',  '#7c3aed'),
         ('lead@tta.local',    $2, 'Bilal Lead',    'lead',   '#0ea5e9'),
         ('tester1@tta.local', $3, 'Sara Tester',   'tester', '#f59e0b'),
         ('tester2@tta.local', $3, 'Usman Tester',  'tester', '#10b981'),
         ('tester3@tta.local', $3, 'Hina Tester',   'tester', '#ec4899')
       RETURNING id, email, role`,
      [hashAdmin, hashLead, hashTester]
    );
    const byEmail = Object.fromEntries(usersRes.rows.map((u) => [u.email, u.id]));
    const adminId = byEmail['admin@tta.local'];
    const leadId = byEmail['lead@tta.local'];
    const tester1Id = byEmail['tester1@tta.local'];
    const tester2Id = byEmail['tester2@tta.local'];
    const tester3Id = byEmail['tester3@tta.local'];

    console.log('📁  Creating project...');
    const proj = (
      await client.query(
        `INSERT INTO projects (code, name, description, created_by)
         VALUES ('SHOP', 'ShopEase Web App', 'E-commerce platform used as the demo SUT and as the platform itself (self-testing). Includes login, product catalog, cart, checkout and admin panel.', $1)
         RETURNING *`,
        [adminId]
      )
    ).rows[0];

    console.log('📋  Creating requirements (8)...');
    const reqData = [
      { title: 'User Authentication', description: 'System shall allow users to register, login, logout, reset password and manage sessions securely.', priority: 'critical' },
      { title: 'Product Catalog & Search', description: 'Users can browse categories, search products, filter by price/brand and view product details.', priority: 'high' },
      { title: 'Shopping Cart Management', description: 'Add/remove items, update quantity, persist cart across sessions, show subtotal.', priority: 'high' },
      { title: 'Checkout & Payments', description: 'Checkout flow with address, payment method selection, order summary and confirmation email.', priority: 'critical' },
      { title: 'Test Management Core', description: 'CRUD for test cases, test cycles, assignments, status tracking and audit logging.', priority: 'critical' },
      { title: 'Automation Execution', description: 'Link test cases to Playwright/API scripts, queue runs, collect logs/screenshots and update results automatically.', priority: 'high' },
      { title: 'Reporting & Traceability', description: 'Traceability matrix REQ->TC->Result, dashboard charts, PDF/Excel export.', priority: 'medium' },
      { title: 'User & Role Management', description: 'Admin can manage users, roles, activation status; RBAC enforced on API and UI.', priority: 'medium' },
    ];
    const requirements = [];
    for (const r of reqData) {
      const code = (await client.query(`SELECT nextval('requirement_code_seq') AS n`)).rows[0].n;
      const formatted = `REQ-${String(code).padStart(3, '0')}`;
      const inserted = (
        await client.query(
          `INSERT INTO requirements (project_id, code, title, description, priority, created_by)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [proj.id, formatted, r.title, r.description, r.priority, leadId]
        )
      ).rows[0];
      requirements.push(inserted);
    }

    console.log('🧪  Creating test cases (~40)...');
    const tcSeed = [
      { module: 'Login', title: 'Login with valid admin credentials', pre: 'User on /login page', exp: 'Redirect to dashboard, JWT issued', pri: 'critical', reqIdx: 0, auto: true },
      { module: 'Login', title: 'Login with invalid password shows error', pre: 'User on /login page', exp: 'Error toast "Invalid e-mail or password", no token', pri: 'high', reqIdx: 0, auto: true },
      { module: 'Login', title: 'Login with empty fields triggers validation', pre: 'Login form empty', exp: 'Inline validation messages', pri: 'medium', reqIdx: 0, auto: false },
      { module: 'Login', title: 'Logout clears token and redirects to login', pre: 'Logged in user', exp: 'Token cleared, redirected to /login', pri: 'high', reqIdx: 0, auto: false },
      { module: 'Login', title: 'Session expires after JWT expiry', pre: 'Token near expiry', exp: 'Auto logout, message "Session expired"', pri: 'medium', reqIdx: 0, auto: false },
      { module: 'Login', title: 'Brute force protection rate limits login', pre: '10 failed attempts', exp: '429 Too Many Requests after threshold', pri: 'high', reqIdx: 0, auto: true },
      { module: 'Login', title: 'Password change with correct current password', pre: 'Logged in user on profile', exp: 'Password updated, audit log entry', pri: 'high', reqIdx: 0, auto: false },
      { module: 'Login', title: 'Password change with wrong current password fails', pre: 'Logged in user', exp: '400 Current password incorrect', pri: 'medium', reqIdx: 0, auto: false },
      { module: 'Catalog', title: 'Browse products by category', pre: 'User on catalog page', exp: 'Products filtered by category, pagination works', pri: 'high', reqIdx: 1, auto: false },
      { module: 'Catalog', title: 'Search product by name returns results', pre: 'Catalog page', exp: 'Search results contain matching product', pri: 'high', reqIdx: 1, auto: true },
      { module: 'Catalog', title: 'Filter by price range', pre: 'Catalog page', exp: 'Only products within range shown', pri: 'medium', reqIdx: 1, auto: false },
      { module: 'Catalog', title: 'View product detail page', pre: 'Click product card', exp: 'Detail page shows title, price, description', pri: 'medium', reqIdx: 1, auto: false },
      { module: 'Catalog', title: 'Search with no results shows empty state', pre: 'Search nonsense', exp: 'Empty state "No products found"', pri: 'low', reqIdx: 1, auto: true },
      { module: 'Cart', title: 'Add product to cart increments count', pre: 'Product detail page', exp: 'Cart badge +1, item in cart list', pri: 'critical', reqIdx: 2, auto: true },
      { module: 'Cart', title: 'Remove product from cart', pre: 'Cart has items', exp: 'Item removed, total recalculated', pri: 'high', reqIdx: 2, auto: false },
      { module: 'Cart', title: 'Update quantity in cart', pre: 'Cart with 1 item', exp: 'Quantity updated, subtotal updated', pri: 'medium', reqIdx: 2, auto: false },
      { module: 'Cart', title: 'Cart persists after page refresh', pre: 'Add item, refresh', exp: 'Cart still contains item (localStorage or API)', pri: 'medium', reqIdx: 2, auto: false },
      { module: 'Cart', title: 'Cart total calculation with multiple items', pre: 'Cart with 3 items', exp: 'Total = sum(qty*price)', pri: 'high', reqIdx: 2, auto: false },
      { module: 'Checkout', title: 'Checkout with valid address and payment', pre: 'Cart with items, logged in', exp: 'Order created, confirmation page', pri: 'critical', reqIdx: 3, auto: true },
      { module: 'Checkout', title: 'Checkout fails when cart is empty', pre: 'Empty cart, go to /checkout', exp: 'Redirect to cart, error "Cart is empty"', pri: 'medium', reqIdx: 3, auto: false },
      { module: 'Checkout', title: 'Apply invalid coupon code shows error', pre: 'Checkout page', exp: 'Error "Invalid coupon"', pri: 'low', reqIdx: 3, auto: false },
      { module: 'Checkout', title: 'Order confirmation email content check (API)', pre: 'Order created via API', exp: 'API returns order with emailSent=true', pri: 'medium', reqIdx: 3, auto: true },
      { module: 'Test Management', title: 'Create test case with valid data (Platform self-test)', pre: 'Lead logged in, on Test Cases page', exp: 'Test case created, appears in list, audit log entry', pri: 'critical', reqIdx: 4, auto: false },
      { module: 'Test Management', title: 'Create test case without title fails validation', pre: 'Lead on create form', exp: '422 Validation error for title', pri: 'high', reqIdx: 4, auto: false },
      { module: 'Test Management', title: 'Edit test case priority and module', pre: 'Existing test case', exp: 'Updated fields persisted, updated_at changed', pri: 'medium', reqIdx: 4, auto: false },
      { module: 'Test Management', title: 'Search test cases by module filter', pre: 'Test Cases page with data', exp: 'Only matching module cases shown', pri: 'medium', reqIdx: 4, auto: false },
      { module: 'Test Management', title: 'Create test cycle and add test cases', pre: 'Lead on Cycles page', exp: 'Cycle created with selected cases, stats total>0', pri: 'critical', reqIdx: 4, auto: false },
      { module: 'Test Management', title: 'Assign test case in cycle to tester', pre: 'Cycle detail, test case row', exp: 'Assignee updated, notification sent, audit log', pri: 'high', reqIdx: 4, auto: false },
      { module: 'Test Management', title: 'Tester updates own assigned test status to Passed', pre: 'Tester on My Tasks, assigned test', exp: 'Status changed to passed, execution history row created', pri: 'critical', reqIdx: 4, auto: false },
      { module: 'Test Management', title: 'Tester cannot update unassigned test (RBAC)', pre: 'Tester tries PATCH /cycle-tests/xxx/status for unassigned', exp: '403 Forbidden', pri: 'high', reqIdx: 4, auto: true },
      { module: 'Test Management', title: 'Kanban drag-and-drop changes status', pre: 'Kanban board, pending card', exp: 'Card moves to In Progress, status updated via API', pri: 'medium', reqIdx: 4, auto: false },
      { module: 'Test Management', title: 'Upload screenshot on execution', pre: 'Execute test with screenshot', exp: 'Screenshot saved, path in execution record', pri: 'medium', reqIdx: 4, auto: false },
      { module: 'Automation', title: 'Register automation script for test case', pre: 'Lead on Automation > Scripts', exp: 'Script linked, is_automated=true', pri: 'high', reqIdx: 5, auto: false },
      { module: 'Automation', title: 'Run automation for single test case', pre: 'Test case with script', exp: 'Run queued, then done, execution added', pri: 'critical', reqIdx: 5, auto: false },
      { module: 'Automation', title: 'Run automation for entire cycle', pre: 'Cycle with 5 automated cases', exp: 'Batch created, 5 runs queued, results appear live', pri: 'critical', reqIdx: 5, auto: false },
      { module: 'Automation', title: 'Failed automation captures screenshot and log', pre: 'Script that intentionally fails', exp: 'Run status done, cycle_test status failed, screenshot present', pri: 'high', reqIdx: 5, auto: true },
      { module: 'Automation', title: 'Worker crash/timeout recorded as FAILED', pre: 'Script that throws exception', exp: 'Run status error/done, error field populated, no silent failure', pri: 'high', reqIdx: 5, auto: true },
      { module: 'Automation', title: 'Nightly schedule triggers for enabled cycle', pre: 'Cycle with schedule_enabled=true', exp: 'Cron enqueues runs, last_scheduled_at updated', pri: 'medium', reqIdx: 5, auto: false },
      { module: 'Reporting', title: 'Traceability matrix shows coverage per requirement', pre: 'Requirements page', exp: 'Matrix REQ x TC with status badges, coverage %', pri: 'medium', reqIdx: 6, auto: false },
      { module: 'Reporting', title: 'Export cycle report as PDF and Excel', pre: 'Cycle detail with executions', exp: 'PDF and XLSX download, contain summary + detailed sheets', pri: 'high', reqIdx: 6, auto: false },
      { module: 'Users', title: 'Admin creates new tester user', pre: 'Admin on Users page', exp: 'User created, can login', pri: 'high', reqIdx: 7, auto: false },
      { module: 'Users', title: 'Tester cannot access Users page (RBAC)', pre: 'Tester navigates to /users', exp: '403 or redirect, UI hides menu', pri: 'high', reqIdx: 7, auto: false },
    ];

    const testCases = [];
    for (const tc of tcSeed) {
      const code = (await client.query(`SELECT nextval('test_case_code_seq') AS n`)).rows[0].n;
      const formatted = `TC-${String(code).padStart(3, '0')}`;
      const reqId = requirements[tc.reqIdx]?.id || null;
      const inserted = (
        await client.query(
          `INSERT INTO test_cases
             (project_id, code, title, preconditions, expected_result, priority, module, requirement_id, is_automated, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [proj.id, formatted, tc.title, tc.pre, tc.exp, tc.pri, tc.module, reqId, tc.auto, leadId]
        )
      ).rows[0];

      const steps = [
        `Navigate to relevant page for "${tc.title}"`,
        `Perform main action: ${tc.title}`,
        `Verify expected result: ${tc.exp}`,
      ];
      for (let i = 0; i < steps.length; i++) {
        await client.query(
          `INSERT INTO test_case_steps (test_case_id, step_no, action) VALUES ($1,$2,$3)`,
          [inserted.id, i + 1, steps[i]]
        );
      }
      testCases.push(inserted);
    }

    console.log('🔁  Creating test cycles (2)...');
    const cycle1 = (
      await client.query(
        `INSERT INTO test_cycles (project_id, name, description, status, start_date, end_date, created_by, schedule_enabled, schedule_cron)
         VALUES ($1,'Sprint 1 Regression','First regression cycle covering login, catalog, cart and core test management', 'active', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '5 days', $2, TRUE, '0 2 * * *')
         RETURNING *`,
        [proj.id, leadId]
      )
    ).rows[0];
    const cycle2 = (
      await client.query(
        `INSERT INTO test_cycles (project_id, name, description, status, start_date, end_date, created_by, schedule_enabled)
         VALUES ($1,'Sprint 2 Regression','Second cycle focusing on automation, reporting and checkout flows', 'planned', CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', $2, FALSE)
         RETURNING *`,
        [proj.id, leadId]
      )
    ).rows[0];

    console.log('📌  Adding test cases to cycles + assignments...');
    const cycle1Cases = testCases.slice(0, 20);
    const cycle2Cases = [...testCases.slice(15, 35)];

    async function addCasesToCycle(cycle, cases) {
      for (const tc of cases) {
        const assignees = [tester1Id, tester2Id, tester3Id];
        const assignee = assignees[cases.indexOf(tc) % assignees.length];
        const dueOffset = (cases.indexOf(tc) % 5) - 2;
        const r = Math.random();
        let realistic = 'pending';
        if (r < 0.3) realistic = 'pending';
        else if (r < 0.5) realistic = 'in_progress';
        else if (r < 0.75) realistic = 'passed';
        else if (r < 0.9) realistic = 'failed';
        else realistic = 'blocked';

        const ct = (
          await client.query(
            `INSERT INTO cycle_tests (cycle_id, test_case_id, assignee_id, assigned_by, assigned_at, due_date, status)
             VALUES ($1,$2,$3,$4, now(), CURRENT_DATE + ($5::text || ' days')::interval, $6)
             ON CONFLICT (cycle_id, test_case_id) DO NOTHING
             RETURNING *`,
            [cycle.id, tc.id, assignee, leadId, String(dueOffset), realistic]
          )
        ).rows[0];

        if (ct) {
          if (['passed', 'failed', 'blocked'].includes(realistic)) {
            const execBy = assignee;
            await client.query(
              `INSERT INTO executions (cycle_test_id, test_case_id, cycle_id, status, execution_type, actual_result, remarks, executed_by)
               VALUES ($1,$2,$3,$4,'manual',$5,$6,$7)`,
              [
                ct.id,
                tc.id,
                cycle.id,
                realistic,
                realistic === 'passed' ? 'Works as expected' : realistic === 'failed' ? 'Found defect: see remarks' : 'Blocked by dependency',
                realistic === 'failed' ? 'Step 2 fails intermittently' : null,
                execBy,
              ]
            );
          }
        }
      }
    }

    await addCasesToCycle(cycle1, cycle1Cases);
    await addCasesToCycle(cycle2, cycle2Cases);

    console.log('🤖  Registering automation scripts...');
    const automatedCases = testCases.filter((tc) => tc.is_automated);
    const scriptFiles = [
      { file: 'ui/login-valid.js', type: 'ui', name: 'UI: Login valid' },
      { file: 'ui/login-invalid.js', type: 'ui', name: 'UI: Login invalid' },
      { file: 'ui/search-product.js', type: 'ui', name: 'UI: Search product' },
      { file: 'ui/search-empty.js', type: 'ui', name: 'UI: Search empty' },
      { file: 'ui/add-to-cart.js', type: 'ui', name: 'UI: Add to cart' },
      { file: 'ui/checkout-valid.js', type: 'ui', name: 'UI: Checkout valid' },
      { file: 'ui/tta-login.js', type: 'ui', name: 'UI: TTA Platform login' },
      { file: 'ui/tta-create-testcase.js', type: 'ui', name: 'UI: TTA Create test case' },
      { file: 'ui/tta-status-change.js', type: 'ui', name: 'UI: TTA Status change' },
      { file: 'api/login-rate-limit.js', type: 'api', name: 'API: Rate limit' },
      { file: 'api/checkout-api.js', type: 'api', name: 'API: Checkout' },
      { file: 'api/auth-rbac.js', type: 'api', name: 'API: RBAC check' },
      { file: 'api/failing-endpoint.js', type: 'api', name: 'API: Intentional failure' },
    ];

    for (let i = 0; i < automatedCases.length && i < scriptFiles.length; i++) {
      const tc = automatedCases[i];
      const sf = scriptFiles[i];
      await client.query(
        `INSERT INTO automation_scripts (test_case_id, name, type, file_path, description, timeout_ms)
         VALUES ($1,$2,$3,$4,$5,60000)
         ON CONFLICT (test_case_id) DO UPDATE SET file_path = EXCLUDED.file_path, type = EXCLUDED.type`,
        [tc.id, sf.name, sf.type, sf.file, `Automated script for ${tc.code} - ${tc.title}`]
      );
    }

    console.log('📜  Creating some past automation runs...');
    const scripts = (await client.query(`SELECT * FROM automation_scripts`)).rows;
    const cycleTests = (await client.query(`SELECT * FROM cycle_tests WHERE cycle_id = $1 LIMIT 5`, [cycle1.id])).rows;

    for (let i = 0; i < Math.min(5, scripts.length, cycleTests.length); i++) {
      const s = scripts[i];
      const ct = cycleTests[i];
      const passed = i % 3 !== 1;
      const batchId = crypto.randomUUID();
      const dur = passed ? 2300 + i * 100 : 1500;
      const startedAt = new Date(Date.now() - 2 * 3600 * 1000);
      const finishedAt = new Date(startedAt.getTime() + dur);
      const run = (
        await client.query(
          `INSERT INTO automation_runs (batch_id, script_id, test_case_id, cycle_id, cycle_test_id, status, trigger_type, triggered_by, log, error, duration_ms, started_at, finished_at, worker_id)
           VALUES ($1,$2,$3,$4,$5,'done',$6,$7,$8,$9,$10,$11,$12,'seed-worker')
           RETURNING *`,
          [
            batchId,
            s.id,
            s.test_case_id,
            ct.cycle_id,
            ct.id,
            i % 2 === 0 ? 'manual' : 'scheduled',
            leadId,
            passed ? `PASS ${s.name} passed\nStep 1 ok\nStep 2 ok` : `FAIL ${s.name} failed\nAssertionError: expected 200 but got 500\nat api/checkout-api.js:42`,
            passed ? null : 'AssertionError: expected 200 but got 500 (intentional bug in sample-app)',
            dur,
            startedAt,
            finishedAt,
          ]
        )
      ).rows[0];

      await client.query(
        `INSERT INTO executions (cycle_test_id, test_case_id, cycle_id, status, execution_type, actual_result, log, duration_ms, automation_run_id, executed_by)
         VALUES ($1,$2,$3,$4,'automated',$5,$6,$7,$8,$9)`,
        [
          ct.id,
          s.test_case_id,
          ct.cycle_id,
          passed ? 'passed' : 'failed',
          passed ? 'Automated PASSED' : 'Automated FAILED',
          run.log,
          run.duration_ms,
          run.id,
          leadId,
        ]
      );

      await client.query(`UPDATE cycle_tests SET status = $2, executed_at = now(), executed_by = $3 WHERE id = $1`, [
        ct.id,
        passed ? 'passed' : 'failed',
        leadId,
      ]);
    }

    console.log('📝  Creating audit logs...');
    for (let i = 0; i < 15; i++) {
      const userId = [adminId, leadId, tester1Id][i % 3];
      const actions = ['create', 'update', 'status_change', 'assign', 'login'];
      const entities = ['test_case', 'cycle_test', 'test_cycle', 'user'];
      await client.query(
        `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, old_value, new_value)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          userId,
          entities[i % entities.length],
          Math.floor(Math.random() * 20) + 1,
          actions[i % actions.length],
          JSON.stringify({ status: 'pending' }),
          JSON.stringify({ status: ['passed', 'failed', 'in_progress'][i % 3] }),
        ]
      );
    }

    console.log('🔔  Creating notifications...');
    const notifData = [
      { user: tester1Id, title: 'New assignment: TC-001', message: 'You have been assigned TC-001 in Sprint 1 Regression', type: 'assignment', link: `/cycles/${cycle1.id}` },
      { user: tester2Id, title: 'New assignment: TC-002', message: 'You have been assigned TC-002 in Sprint 1 Regression', type: 'assignment', link: `/cycles/${cycle1.id}` },
      { user: tester3Id, title: 'Due soon: TC-005', message: 'TC-005 is due within 24h', type: 'due_soon', link: `/my-tasks` },
      { user: tester1Id, title: 'Automation finished: 3 passed, 1 failed', message: 'Batch run completed for Sprint 1 Regression', type: 'automation', link: `/automation/runs` },
    ];
    for (const n of notifData) {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)`,
        [n.user, n.title, n.message, n.type, n.link]
      );
    }

    await client.query('COMMIT');
    console.log('\n✅  Seed completed successfully!');
    console.log(`   Project: ${proj.code} - ${proj.name}`);
    console.log(`   Users: admin@tta.local / Admin@123, lead@tta.local / Lead@123, tester1..3@tta.local / Tester@123`);
    console.log(`   Requirements: ${requirements.length}, Test cases: ${testCases.length}, Cycles: 2`);
    console.log(`   Automation scripts: ${scripts.length}, Runs: 5`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
